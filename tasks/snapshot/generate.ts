import { Contract } from "ethers";
import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import {
    getGaugeChoices,
    getGaugeSnapshot,
    parseLabel,
    saveGaugeChoices,
    saveGaugeSnapshot,
    sortGaugeList,
    compareAddresses,
    GaugeChoice,
    Gauge,
} from "./utils";
import { getSigner } from "../utils";
import { config } from "../deploy/mainnet-config";
import { HardhatRuntime } from "../utils/networkAddressFactory";
import {
    IGaugeController__factory,
    MockCurveGauge__factory,
    BunniToken__factory,
    IUniswapV3PoolImmutables__factory,
    ERC20__factory,
} from "../../types";
import { removedGauges, validNetworks } from "./constants";
import { uniqBy } from "lodash";

const gaugeFilterNetworks = (gauge: any) => validNetworks.includes(gauge.network);
const gaugeFilterPoolType = (gauge: any) => gauge.pool.poolType !== "Element";
const gaugeFormatRow = (gauge: any) => ({ address: gauge.address, label: parseLabel(gauge) });

task("snapshot:generate").setAction(async function (_: TaskArguments, hre: HardhatRuntime) {
    const signer = await getSigner(hre);
    const gaugeSnapshot = getGaugeSnapshot();

    const validNetworkGauges = gaugeSnapshot
        .filter(gaugeFilterNetworks)
        .filter(gaugeFilterPoolType)
        .filter((gauge: any) => !gauge.isKilled);

    const sortedGauges = sortGaugeList(validNetworkGauges);

    const cleanedGauges = [];

    for (let i = 0; i < sortedGauges.length; i++) {
        const g = sortedGauges[i];

        try {
            const gauge = MockCurveGauge__factory.connect(g.address, signer);
            if (await gauge.is_killed()) {
                continue;
            }

            if (removedGauges.includes(g.address.toLowerCase())) {
                continue;
            }

            /////////////////////////////////////
            // The gauge is valid so we add it //
            /////////////////////////////////////
            cleanedGauges.push(g);
        } catch (e) {
            console.log("Snapshot generate task error:", e, g);
        }
    }

    const formattedGauges = cleanedGauges.map(gaugeFormatRow);
    saveGaugeChoices(uniqBy(formattedGauges, "address"));
});

task("snapshot:validate").setAction(async function (_: TaskArguments, hre: HardhatRuntime) {
    const signer = await getSigner(hre);
    const gauges = getGaugeChoices();
    const gaugeController = IGaugeController__factory.connect(config.addresses.gaugeController, signer);

    const count = Number((await gaugeController.n_gauges()).toString());

    for (let i = 0; i < count; i++) {
        const addr = await gaugeController.gauges(i);
        const gauge = new Contract(addr, ["function is_killed() external view returns (bool)"], signer);

        if (await gauge.is_killed()) continue;

        const found = gauges.find((g: GaugeChoice) => compareAddresses(addr, g.address));
        const isRemoved = removedGauges.find(g => compareAddresses(g, addr));
        if (!found && !isRemoved) {
            console.log("Missing:", i, addr);
        }
    }
});

task("gauges:choices:print").setAction(async function (_: TaskArguments, hre: HardhatRuntime) {
    const signer = await getSigner(hre);
    const gauges = getGaugeChoices();

    const gaugeController = IGaugeController__factory.connect(config.addresses.gaugeController, signer);

    const count = Number((await gaugeController.n_gauges()).toString());

    const cleanedGauges: GaugeChoice[] = [];

    for (let i = 0; i < count; i++) {
        const addr = await gaugeController.gauges(i);
        const gauge = new Contract(
            addr,
            [
                "function is_killed() external view returns (bool)",
                "function lp_token() external view returns (address)",
            ],
            signer,
        );

        if (await gauge.is_killed()) continue;

        const found = gauges.find((g: GaugeChoice) => compareAddresses(addr, g.address));
        const isRemoved = removedGauges.find(g => compareAddresses(g, addr));
        if (!found && !isRemoved) {
            console.log("Missing:", i, addr);
        }

        try {
            const lpTokenAddress = await gauge.lp_token();
            const lpToken = BunniToken__factory.connect(lpTokenAddress, signer);
            const lpTokenName = await lpToken.name();

            cleanedGauges.push({ address: gauge.address, label: lpTokenName });
        } catch (e) {
            console.log("Print task error:", gauge.address);
            cleanedGauges.push({ address: gauge.address, label: "MISSING" });
        }
    }

    console.log(cleanedGauges);
});

task("gauges:snapshot:print").setAction(async function (_: TaskArguments, hre: HardhatRuntime) {
    const signer = await getSigner(hre);
    const gauges = getGaugeChoices();

    const gaugeController = IGaugeController__factory.connect(config.addresses.gaugeController, signer);

    const count = Number((await gaugeController.n_gauges()).toString());

    const snapshotGauges: Gauge[] = [];

    for (let i = 0; i < count; i++) {
        const addr = await gaugeController.gauges(i);
        const gauge = new Contract(
            addr,
            [
                "function is_killed() external view returns (bool)",
                "function lp_token() external view returns (address)",
            ],
            signer,
        );

        if (await gauge.is_killed()) continue;

        const found = gauges.find((g: GaugeChoice) => compareAddresses(addr, g.address));
        const isRemoved = removedGauges.find(g => compareAddresses(g, addr));
        if (!found && !isRemoved) {
            console.log("Missing:", i, addr);
        }

        try {
            const lpTokenAddress = await gauge.lp_token();
            const lpToken = BunniToken__factory.connect(lpTokenAddress, signer);
            const lpTokenName = await lpToken.name();

            const uniPoolAddress = await lpToken.pool();
            const uniPool = IUniswapV3PoolImmutables__factory.connect(uniPoolAddress, signer);

            const token0Address = await uniPool.token0();
            const token1Address = await uniPool.token1();

            const token0 = ERC20__factory.connect(token0Address, signer);
            const token1 = ERC20__factory.connect(token1Address, signer);

            const token0Symbol = await token0.symbol();
            const token1Symbol = await token1.symbol();

            const poolType = {
                tokens: [
                    { symbol: token0Symbol, address: token0Address },
                    { symbol: token1Symbol, address: token1Address },
                ],
            };

            snapshotGauges.push({ pool: poolType, network: 1, address: gauge.address, label: lpTokenName });
        } catch (e) {
            console.log("Print task error:", gauge.address);

            const poolType = {
                tokens: [{ symbol: "N/A", address: "N/A" }],
            };

            snapshotGauges.push({ pool: poolType, network: 1, address: gauge.address, label: "MISSING" });
        }
    }

    saveGaugeSnapshot(snapshotGauges);
});
