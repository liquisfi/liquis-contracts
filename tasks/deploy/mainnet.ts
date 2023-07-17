import { MockCurveGauge__factory } from "./../../types/generated/factories/MockCurveGauge__factory";
import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import { logContracts } from "../utils/deploy-utils";
import { getSigner } from "../utils";
import {
    deployPhase1,
    deployPhase2,
    deployPhase3,
    deployPhase4,
    deployPhase6,
    deployTempBooster,
} from "../../scripts/deploySystem";
import { config } from "./mainnet-config";
import { ONE_WEEK, ZERO_ADDRESS } from "../../test-utils/constants";
import { deployContract } from "../utils";
import { LiqMerkleDrop, LiqMerkleDrop__factory } from "../../types/generated";
import { BigNumber } from "ethers";

task("deploy:mainnet:1").setAction(async function (_: TaskArguments, hre) {
    const deployer = await getSigner(hre);

    // ~~~~~~~~~~~~~~~
    // ~~~ PHASE 1 ~~~
    // ~~~~~~~~~~~~~~~
    const phase1 = await deployPhase1(hre, deployer, config.addresses, false, true, 3);
    logContracts(phase1 as unknown as { [key: string]: { address: string } });
});
task("deploy:mainnet:2").setAction(async function (_: TaskArguments, hre) {
    const deployer = await getSigner(hre);

    const phase1 = await config.getPhase1(deployer);

    // ~~~~~~~~~~~~~~~
    // ~~~ PHASE 2 ~~~
    // ~~~~~~~~~~~~~~~
    const phase2 = await deployPhase2(
        hre,
        deployer,
        phase1,
        config.distroList,
        config.multisigs,
        config.naming,
        config.addresses,
        true,
        3,
    );
    logContracts(phase2 as unknown as { [key: string]: { address: string } });
});
task("deploy:mainnet:3").setAction(async function (_: TaskArguments, hre) {
    const deployer = await getSigner(hre);

    const phase2 = await config.getPhase2(deployer);

    // ~~~~~~~~~~~~~~~
    // ~~~ PHASE 3 ~~~
    // ~~~~~~~~~~~~~~~
    const phase3 = await deployPhase3(hre, deployer, phase2, config.multisigs, config.addresses, true, 3);
    logContracts(phase3 as unknown as { [key: string]: { address: string } });
});
task("deploy:mainnet:4").setAction(async function (_: TaskArguments, hre) {
    const deployer = await getSigner(hre);

    const phase3 = await config.getPhase3(deployer);

    // ~~~~~~~~~~~~~~~
    // ~~~ PHASE 4 ~~~
    // ~~~~~~~~~~~~~~~
    const phase4 = await deployPhase4(hre, deployer, phase3, config.addresses, true, 3);
    logContracts(phase4 as unknown as { [key: string]: { address: string } });
});
task("deploy:mainnet:6").setAction(async function (_: TaskArguments, hre) {
    const deployer = await getSigner(hre);

    const phase2 = await config.getPhase2(deployer);

    // ~~~~~~~~~~~~~~~
    // ~~~ PHASE 6 ~~~
    // ~~~~~~~~~~~~~~~
    const phase6 = await deployPhase6(
        hre,
        deployer,
        phase2,
        config.multisigs,
        config.naming,
        config.addresses,
        true,
        3,
    );
    logContracts(phase6 as unknown as { [key: string]: { address: string } });
});

task("deploy:mainnet:temp-booster").setAction(async function (_: TaskArguments, hre) {
    const deployer = await getSigner(hre);
    const tempBooster = await deployTempBooster(hre, deployer, true, 3);
    logContracts({ tempBooster });
});

task("deploy:mainnet:merkledrop")
    .addParam("hash", "The root hash of merkle tree")
    .setAction(async function (taskArgs: TaskArguments, hre) {
        const deployer = await getSigner(hre);

        const phase2 = await config.getPhase2(deployer);

        const hash = taskArgs.hash;
        if (hash == "" || hash == undefined) {
            throw console.error("invalid hash");
        }

        const SCALE = BigNumber.from(10).pow(18);
        const AMOUNT = SCALE.mul(100000);
        const TOTAL_COUNT = BigNumber.from(30);

        const airdrop = await deployContract<LiqMerkleDrop>(
            hre,
            new LiqMerkleDrop__factory(deployer),
            "LiqMerkleDrop",
            [
                config.multisigs.treasuryMultisig,
                hash,
                phase2.cvx.address,
                phase2.cvxLocker.address,
                0,
                ONE_WEEK.mul(26),
                TOTAL_COUNT,
                AMOUNT,
            ],
            {},
            true,
            3,
        );

        logContracts({ airdrop });
    });

task("mainnet:getgauges").setAction(async function (_: TaskArguments, hre) {
    const { ethers } = hre;

    // Connect to the network
    const provider = ethers.getDefaultProvider();

    const contract = new ethers.Contract(
        "0xC128468b7Ce63eA702C1f104D55A2566b13D3ABD",
        ["function gauges(uint256 arg) view returns (address)"],
        provider,
    );
    const gaugeAddress: string[] = [];
    // 4 to 36
    for (let i = 4; i < 36; i++) {
        const thisAddr = await contract.gauges(i);
        gaugeAddress.push(thisAddr);
    }
    console.log(gaugeAddress);
});

task("mainnet:getStashes").setAction(async function (_: TaskArguments, hre) {
    const deployer = await getSigner(hre);
    const { addresses } = config;
    const { gauges } = addresses;

    const gaugesWithRewardTokens = [];
    for (let i = 0; i < gauges.length; i++) {
        const gauge = MockCurveGauge__factory.connect(gauges[i], deployer);
        if ((await gauge.reward_tokens(0)) != ZERO_ADDRESS) {
            gaugesWithRewardTokens.push(gauges[i]);
        }
    }
    console.log(gaugesWithRewardTokens);
});
