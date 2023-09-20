import { table } from "table";
import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import { request, gql } from "graphql-request";
import { HardhatRuntime } from "../utils/networkAddressFactory";
import { getSigner } from "../utils";
import { IGaugeController__factory } from "../../types/generated";
import { configs } from "./constants";
import { GaugeChoice, getGaugeChoices } from "./utils";

const selectedGauges = [
    {
        address: "0x157C6F527dE5987235ae1305608494731Ff03b10",
        label: "Bunni WETH/LIQ LP [∞ - 0.000000]",
        extraWeight: 500,
        percentage: 0.05,
    },
    {
        address: "0xbB6Fb649929420dc56d90B013C2e4cAeE291e759",
        label: "Bunni liqLIT/BAL-20WETH-80LIT LP [∞ - 0.000000]",
        extraWeight: 200,
        percentage: 0.02,
    },
    {
        address: "0x8e375Dfb1b347D3E84fA9dfe1EeCdC5fD7845e9e",
        label: "Bunni liqLIT/BAL-20WETH-80LIT LP [1.111149 - 0.909014]",
        extraWeight: 300,
        percentage: 0.03,
    },
];

// yarn hardhat --config tasks.config.ts snapshot:result:modif --proposal 0xd6...a2e0 --debug true --network mainnet

task("snapshot:result:modif", "Get results for the first proposal that uses non standard labels")
    .addParam("proposal", "The proposal ID of the snapshot")
    .addOptionalParam("debug", "Debug mode", "false")
    .setAction(async function (taskArgs: TaskArguments, hre: HardhatRuntime) {
        const signer = await getSigner(hre);

        const query = gql`
            query Proposal($proposal: String) {
                proposal(id: $proposal) {
                    id
                    scores_total
                    scores
                    choices
                    scores_state
                }
            }
        `;

        const config = configs.main; // Note test for testing and main for mainnet
        const proposalId = taskArgs.proposal;
        const debug = taskArgs.debug === "true";
        const data = await request(`${config.hub}/graphql`, query, { proposal: proposalId });
        const proposal = data.proposal;
        if (proposal.scores_state !== "final" && !debug) {
            console.log("Scores not final");
            console.log("Exiting...");
            return;
        }

        // ----------------------------------------------------------
        // Get Gauge Weight Votes
        // ----------------------------------------------------------
        const gaugeList = getGaugeChoices();

        const results: { choice: string; score: number; percentage: number; address: string }[] = [];

        for (let i = 0; i < proposal.choices.length; i++) {
            const score = proposal.scores[i];
            const choice = proposal.choices[i];
            const percentage = score / proposal.scores_total;
            const resp = gaugeList.find((gauge: GaugeChoice) => gauge.label === choice);

            results.push({ choice, score, percentage, address: resp?.address });
        }

        const successfulGauges = results
            .filter(({ percentage }) => percentage > 0.001)
            .sort((a, b) => b.percentage - a.percentage);

        // ----------------------------------------------------------
        // Get Existing Votes
        // Look up the existing vote weight that was previous given to all the gauges
        // ----------------------------------------------------------

        const voterProxyAddress = "0x37aeB332D6E57112f1BFE36923a7ee670Ee9278b";
        const gaugeControllerAddress = "0x901c8aA6A61f74aC95E7f397E22A0Ac7c1242218";
        const gaugeController = IGaugeController__factory.connect(gaugeControllerAddress, signer);
        const gaugesWithExistingWeights = await Promise.all(
            gaugeList.map(async (gauge: GaugeChoice) => {
                const [, power] = await gaugeController.vote_user_slopes(voterProxyAddress, gauge.address);
                return { address: gauge.address, label: gauge.label, existingWeight: power };
            }),
        );

        // ----------------------------------------------------------
        // Get New Votes
        // ----------------------------------------------------------

        const totalVotes = 10000;

        for (const gauge of successfulGauges) {
            gauge.score *= 0.9;
            gauge.percentage *= 0.9;
        }

        for (const selectedGauge of selectedGauges) {
            const existingGauge = successfulGauges.find(gauge => gauge.address === selectedGauge.address);

            if (existingGauge) {
                // If gauge already exists in successfulGauges, we update the extraWeight
                existingGauge.score += selectedGauge.extraWeight;
                existingGauge.percentage += selectedGauge.percentage;
            } else {
                // If gauge does not exist, we add it at the end of successfulGauges
                successfulGauges.push({
                    choice: selectedGauge.label,
                    score: selectedGauge.extraWeight,
                    percentage: selectedGauge.percentage,
                    address: selectedGauge.address,
                });
            }
        }

        const sumOfPercentages = successfulGauges.reduce((acc, x) => acc + x.percentage, 0);
        const weights = successfulGauges.map(gauge => Math.floor((totalVotes * gauge.percentage) / sumOfPercentages));

        const totalWeightBefore = weights.reduce((acc, x) => acc + x, 0);

        const voteDelta = totalVotes - totalWeightBefore;
        weights[0] += voteDelta;

        const totalWeightAfter = weights.reduce((acc, x) => acc + x, 0);

        if (totalWeightAfter !== totalVotes) {
            console.log("Total weight is not equal to total votes.");
            console.log("Exiting...");
            return;
        }

        // ----------------------------------------------------------
        // Order Votes
        // gauges that don't have any votes in this epoch need to be sent with weight 0
        // gauges that have decreased in vote weight have to be sent first
        // ----------------------------------------------------------

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        interface Vote {
            gauge: GaugeChoice;
            voteDelta: number;
            voteWeight: number;
            percentage: number;
        }
        let votes: Vote[] = [];
        for (const gauge of gaugesWithExistingWeights) {
            const idx = successfulGauges.findIndex(g => gauge.address === g.address);
            if (~idx) {
                // Gauge that we want to cast a vote for this time
                const voteWeight = weights[idx];
                const voteGauge = successfulGauges[idx];
                const voteDelta = voteWeight - gauge.existingWeight.toNumber();
                votes.push({ gauge, voteDelta, voteWeight, percentage: voteGauge.percentage });
            } else if (gauge.existingWeight.gt(0)) {
                // Gauge not found in vote list but it has a weight already
                // so we need to send a vote to reset it to 0.
                votes.push({ gauge, voteDelta: gauge.existingWeight.toNumber(), voteWeight: 0, percentage: 0 });
            }
        }

        // sort votes by lowest delta first
        votes = votes.sort((a, b) => a.voteDelta - b.voteDelta);
        votes = votes.sort(a => (a.voteWeight === 0 ? -1 : 1));

        // ----------------------------------------------------------
        // Processing
        // ----------------------------------------------------------

        console.log("Successful gauge votes");
        const tableData = [
            ["Gauge", "voteDelta", "percentage", "address", "weight"],
            ...votes.map(({ gauge, voteDelta, voteWeight, percentage }) => [
                gauge.label,
                voteDelta,
                (percentage * 100).toFixed(2) + "%",
                gauge.address,
                voteWeight,
            ]),
        ];
        console.log(table(tableData));

        console.log("\n\nGauge Labels");
        console.log(JSON.stringify(tableData.slice(1).map(x => x[0])));

        console.log("\n\nGauge Addresses");
        console.log(JSON.stringify(votes.map(v => v.gauge.address)));

        console.log("\n\nVote weights");
        console.log(JSON.stringify(votes.map(v => v.voteWeight)));
    });
