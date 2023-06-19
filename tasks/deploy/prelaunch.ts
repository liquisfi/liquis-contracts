import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import { logContracts } from "../utils/deploy-utils";
import { getSigner } from "../utils";
import { deployPhase1 } from "../../scripts/deploySystem";
import { config } from "./mainnet-config";
import { deployContract } from "../utils";
import {
    LiqToken,
    LiqToken__factory,
    LitConvertor,
    LitConvertor__factory,
    PrelaunchRewardsPool,
    PrelaunchRewardsPool__factory,
} from "../../types/generated";

interface Phase2Deployed {
    liq: LiqToken;
    litConvertor: LitConvertor;
    prelaunchRewardsPool: PrelaunchRewardsPool;
}

task("deploy:voterProxy:mainnet").setAction(async function (_: TaskArguments, hre) {
    const deployer = await getSigner(hre);

    // ~~~~~~~~~~~~~~~
    // ~~~ PHASE 1 ~~~
    // ~~~~~~~~~~~~~~~

    const phase1 = await deployPhase1(hre, deployer, config.addresses, false, true, 3);
    logContracts(phase1 as unknown as { [key: string]: { address: string } });
});

task("deploy:prelaunch:mainnet").setAction(async function (_: TaskArguments, hre) {
    const debug = true;
    const waitForBlocks = 3;

    const deployer = await getSigner(hre);

    const phase1 = await config.getPhase1(deployer);

    // ~~~~~~~~~~~~~~~
    // ~~~ PHASE 2 ~~~
    // ~~~~~~~~~~~~~~~

    const liq = await deployContract<LiqToken>(
        hre,
        new LiqToken__factory(deployer),
        "LiqToken",
        [phase1.voterProxy.address, config.naming.cvxName, config.naming.cvxSymbol],
        {},
        debug,
        waitForBlocks,
    );

    const litConvertor = await deployContract<LitConvertor>(
        hre,
        new LitConvertor__factory(deployer),
        "LitConvertor",
        [config.addresses.balancerVault, config.addresses.lit, config.addresses.weth, config.addresses.balancerPoolId],
        {},
        debug,
        waitForBlocks,
    );

    const prelaunchRewardsPool = await deployContract<PrelaunchRewardsPool>(
        hre,
        new PrelaunchRewardsPool__factory(deployer),
        "PrelaunchRewardsPool",
        [config.addresses.tokenBpt, liq.address, litConvertor.address, config.addresses.lit],
        {},
        debug,
        waitForBlocks,
    );

    const phase2: Phase2Deployed = { liq, litConvertor, prelaunchRewardsPool };
    logContracts(phase2 as unknown as { [key: string]: { address: string } });
});
