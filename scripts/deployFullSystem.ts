import { Signer } from "ethers";
import {
    VoterProxy,
    Booster,
    LiqToken,
    CvxCrvToken,
    CrvDepositor,
    BaseRewardPool,
    BaseRewardPool__factory,
    LitDepositorHelper,
    LiqLocker,
    LiqLocker__factory,
    LitDepositorHelper__factory,
    RewardFactory,
    RewardFactory__factory,
    TokenFactory,
    TokenFactory__factory,
    ProxyFactory,
    ProxyFactory__factory,
    StashFactoryV2,
    StashFactoryV2__factory,
    ExtraRewardStashV3,
    ExtraRewardStashV3__factory,
    PoolManagerProxy,
    PoolManagerProxy__factory,
    PoolManager,
    PoolManager__factory,
    BoosterOwner,
    BoosterOwner__factory,
    FlashOptionsExerciser,
    FlashOptionsExerciser__factory,
    PooledOptionsExerciser,
    PooledOptionsExerciser__factory,
    LiqMinter,
    LiquisClaimZap,
    LiquisClaimZap__factory,
    LiquisViewHelpers,
    LiquisViewHelpers__factory,
} from "../types/generated";
import { deployContract, waitForTx } from "../tasks/utils";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ZERO_ADDRESS, ONE_WEEK } from "../test-utils/constants";

import * as fs from "fs";
import MainnetConfig from "./contracts.json";
import HardhatConfig from "./contracts.hardhat.json";
import TenderlyConfig from "./contracts.tenderly.json";

interface ExtSystemConfig {
    token: string;
    lit: string;
    tokenBpt: string;
    minter: string;
    votingEscrow: string;
    feeDistribution: string;
    gaugeController: string;
    balancerVault: string;
    balancerPoolId: string;
    weth: string;
}

interface NamingConfig {
    cvxName: string;
    cvxSymbol: string;
    vlCvxName: string;
    vlCvxSymbol: string;
    cvxCrvName: string;
    cvxCrvSymbol: string;
    tokenFactoryNamePostfix: string;
}

interface MultisigConfig {
    treasuryMultisig: string;
    daoMultisig: string;
}

interface PrelaunchDeployed {
    voterProxy: VoterProxy;
    liq: LiqToken;
    minter: LiqMinter;
    booster: Booster;
    liqLit: CvxCrvToken;
    crvDepositor: CrvDepositor;
}

interface FullSystemDeployed extends PrelaunchDeployed {
    boosterOwner: BoosterOwner;
    rewardFactory: RewardFactory;
    tokenFactory: TokenFactory;
    proxyFactory: ProxyFactory;
    stashFactory: StashFactoryV2;
    stashV3: ExtraRewardStashV3;
    liqLitRewards: BaseRewardPool;
    crvDepositor: CrvDepositor;
    litDepositorHelper: LitDepositorHelper;
    poolManagerProxy: PoolManagerProxy;
    poolManager: PoolManager;
    liqLocker: LiqLocker;
    flashOptionsExerciser: FlashOptionsExerciser;
    pooledOptionsExerciser: PooledOptionsExerciser;
    claimZap: LiquisClaimZap;
    liquisViewHelpers: LiquisViewHelpers;
}

function getConfig(hre: HardhatRuntimeEnvironment) {
    if (hre.network.name === "mainnet") {
        return MainnetConfig;
    }
    if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
        return HardhatConfig;
    }
    if (hre.network.name === "tenderly") {
        return TenderlyConfig;
    }

    throw new Error("not found config");
}

function writeConfigFile(config: any, hre: HardhatRuntimeEnvironment) {
    let filePath;
    switch (hre.network.name) {
        case "mainnet":
            filePath = "scripts/contracts.json";
            break;
        case "localhost":
            filePath = "scripts/contracts.hardhat.json";
            break;
        case "hardhat":
            filePath = "scripts/contracts.hardhat.json";
            break;
        case "tenderly":
            filePath = "scripts/contracts.tenderly.json";
            break;
        default:
            throw Error("Unsupported network");
    }
    console.log(`>> Writing ${filePath}`);
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    console.log("✅ Done");
}

async function deployFullSystem(
    hre: HardhatRuntimeEnvironment,
    signer: Signer,
    multisigs: MultisigConfig,
    naming: NamingConfig,
    config: ExtSystemConfig,
    deployed: PrelaunchDeployed,
    debug = false,
    waitForBlocks = 0,
): Promise<FullSystemDeployed> {
    const deployer = signer;
    const deployerAddress = await deployer.getAddress();

    const { token, gaugeController } = config;
    const { booster, liq, liqLit, crvDepositor } = deployed;

    const outputConfig = getConfig(hre);

    console.log("Current chain connected:", hre.network.name);

    const rewardFactory = await deployContract<RewardFactory>(
        hre,
        new RewardFactory__factory(deployer),
        "RewardFactory",
        [booster.address, token],
        {},
        debug,
        waitForBlocks,
    );

    const tokenFactory = await deployContract<TokenFactory>(
        hre,
        new TokenFactory__factory(deployer),
        "TokenFactory",
        [booster.address, naming.tokenFactoryNamePostfix, naming.cvxSymbol.toLowerCase()],
        {},
        debug,
        waitForBlocks,
    );

    const proxyFactory = await deployContract<ProxyFactory>(
        hre,
        new ProxyFactory__factory(deployer),
        "ProxyFactory",
        [],
        {},
        debug,
        waitForBlocks,
    );

    const stashFactory = await deployContract<StashFactoryV2>(
        hre,
        new StashFactoryV2__factory(deployer),
        "StashFactory",
        [booster.address, rewardFactory.address, proxyFactory.address],
        {},
        debug,
        waitForBlocks,
    );

    const stashV3 = await deployContract<ExtraRewardStashV3>(
        hre,
        new ExtraRewardStashV3__factory(deployer),
        "ExtraRewardStashV3",
        [token],
        {},
        debug,
        waitForBlocks,
    );

    const liqLitRewards = await deployContract<BaseRewardPool>(
        hre,
        new BaseRewardPool__factory(deployer),
        "BaseRewardPool",
        [0, liqLit.address, token, booster.address, rewardFactory.address],
        {},
        debug,
        waitForBlocks,
    );

    const poolManagerProxy = await deployContract<PoolManagerProxy>(
        hre,
        new PoolManagerProxy__factory(deployer),
        "PoolManagerProxy",
        [booster.address, deployerAddress],
        {},
        debug,
        waitForBlocks,
    );

    const poolManager = await deployContract<PoolManager>(
        hre,
        new PoolManager__factory(deployer),
        "PoolManager",
        [poolManagerProxy.address, booster.address, gaugeController, multisigs.daoMultisig],
        {},
        debug,
        waitForBlocks,
    );

    const boosterOwner = await deployContract<BoosterOwner>(
        hre,
        new BoosterOwner__factory(deployer),
        "BoosterOwner",
        [multisigs.daoMultisig, poolManagerProxy.address, booster.address, stashFactory.address, ZERO_ADDRESS, true],
        {},
        debug,
        waitForBlocks,
    );

    const liqLocker = await deployContract<LiqLocker>(
        hre,
        new LiqLocker__factory(deployer),
        "LiqLocker",
        [naming.vlCvxName, naming.vlCvxSymbol, liq.address, liqLit.address, liqLitRewards.address, token],
        {},
        debug,
        waitForBlocks,
    );

    // We are deploying a new litDepositorHelper with support for Eth, Weth, Lit
    const litDepositorHelper = await deployContract<LitDepositorHelper>(
        hre,
        new LitDepositorHelper__factory(deployer),
        "LitDepositorHelper",
        [crvDepositor.address, config.balancerVault, config.lit, config.weth, config.balancerPoolId],
        {},
        debug,
        waitForBlocks,
    );

    const flashOptionsExerciser = await deployContract<FlashOptionsExerciser>(
        hre,
        new FlashOptionsExerciser__factory(deployer),
        "FlashOptionsExerciser",
        [liqLit.address, booster.address, litDepositorHelper.address, liqLitRewards.address, liqLocker.address],
        {},
        debug,
        waitForBlocks,
    );

    const pooledOptionsExerciser = await deployContract<PooledOptionsExerciser>(
        hre,
        new PooledOptionsExerciser__factory(deployer),
        "PooledOptionsExerciser",
        [liqLit.address, booster.address, litDepositorHelper.address, liqLitRewards.address, liqLocker.address],
        {},
        debug,
        waitForBlocks,
    );

    const claimZap = await deployContract<LiquisClaimZap>(
        hre,
        new LiquisClaimZap__factory(deployer),
        "LiquisClaimZap",
        [liq.address, liqLit.address, liqLitRewards.address, liqLocker.address],
        {},
        debug,
        waitForBlocks,
    );

    const liquisViewHelpers = await deployContract<LiquisViewHelpers>(
        hre,
        new LiquisViewHelpers__factory(deployer),
        "LiquisViewHelpers",
        [],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.rewardFactory = rewardFactory.address;
    writeConfigFile(outputConfig, hre);

    outputConfig.Deployments.tokenFactory = tokenFactory.address;
    writeConfigFile(outputConfig, hre);

    outputConfig.Deployments.proxyFactory = proxyFactory.address;
    writeConfigFile(outputConfig, hre);

    outputConfig.Deployments.stashFactory = stashFactory.address;
    writeConfigFile(outputConfig, hre);

    outputConfig.Deployments.stashV3 = stashV3.address;
    writeConfigFile(outputConfig, hre);

    outputConfig.Deployments.liqLitRewards = liqLitRewards.address;
    writeConfigFile(outputConfig, hre);

    outputConfig.Deployments.poolManagerProxy = poolManagerProxy.address;
    writeConfigFile(outputConfig, hre);

    outputConfig.Deployments.poolManager = poolManager.address;
    writeConfigFile(outputConfig, hre);

    outputConfig.Deployments.boosterOwner = boosterOwner.address;
    writeConfigFile(outputConfig, hre);

    outputConfig.Deployments.liqLocker = liqLocker.address;
    writeConfigFile(outputConfig, hre);

    outputConfig.Deployments.litDepositorHelper = litDepositorHelper.address;
    writeConfigFile(outputConfig, hre);

    outputConfig.Deployments.flashOptionsExerciser = flashOptionsExerciser.address;
    writeConfigFile(outputConfig, hre);

    outputConfig.Deployments.pooledOptionsExerciser = pooledOptionsExerciser.address;
    writeConfigFile(outputConfig, hre);

    outputConfig.Deployments.claimZap = claimZap.address;
    writeConfigFile(outputConfig, hre);

    outputConfig.Deployments.liquisViewHelpers = liquisViewHelpers.address;
    writeConfigFile(outputConfig, hre);

    // Once VoterProxy is whitelisted an initial lock needs to be done
    // Transfer some BPT to the VoterProxy and call crvDepositor.initialLock()

    // Note lickLocker needs a lock of 100 LIQ minimum
    let tx = await liqLocker.addReward(token, booster.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await liqLocker.setApprovals();
    await waitForTx(tx, debug, waitForBlocks);

    tx = await liqLocker.transferOwnership(multisigs.daoMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    // Dao multisig protected methods
    // tx = await stashFactory.setImplementation(ZERO_ADDRESS, ZERO_ADDRESS, stashV3.address);
    // await waitForTx(tx, debug, waitForBlocks);

    // tx = await booster.setRewardContracts(liqLitRewards.address, liqLocker.address);
    // await waitForTx(tx, debug, waitForBlocks);

    // Liquis deployer is current poolManager
    tx = await booster.setPoolManager(poolManagerProxy.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await poolManagerProxy.setOperator(poolManager.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await poolManagerProxy.setOwner(multisigs.daoMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    // Dao multisig protected methods
    // tx = await booster.setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address);
    // await waitForTx(tx, debug, waitForBlocks);

    // tx = await booster.setArbitrator(arbitratorVault.address);
    // await waitForTx(tx, debug, waitForBlocks);

    // tx = await booster.setFeeInfo(config.weth, config.feeDistribution);
    // await waitForTx(tx, debug, waitForBlocks);

    // Set final owner to BoosterOwner contract
    // tx = await booster.setOwner(boosterOwner.address);
    // await waitForTx(tx, debug, waitForBlocks);

    tx = await pooledOptionsExerciser.setOwner(multisigs.daoMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await flashOptionsExerciser.setOwner(multisigs.daoMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await litDepositorHelper.setApprovals();
    await tx.wait();

    return {
        ...deployed,
        boosterOwner,
        rewardFactory,
        tokenFactory,
        proxyFactory,
        stashFactory,
        stashV3,
        liqLitRewards,
        crvDepositor,
        litDepositorHelper,
        poolManagerProxy,
        poolManager,
        liqLocker,
        flashOptionsExerciser,
        pooledOptionsExerciser,
        claimZap,
        liquisViewHelpers,
    };
}

export { MultisigConfig, ExtSystemConfig, NamingConfig, deployFullSystem, PrelaunchDeployed, FullSystemDeployed };
