import { BigNumber as BN, ContractReceipt, ContractTransaction, Signer } from "ethers";
import {
    ExtraRewardsDistributor,
    AuraPenaltyForwarder,
    IGaugeController__factory,
    MockWalletChecker__factory,
    MockCurveVoteEscrow__factory,
    BoosterOwner__factory,
    BoosterOwner,
    AuraClaimZap__factory,
    AuraClaimZap,
    BalLiquidityProvider,
    Booster__factory,
    Booster,
    VoterProxy__factory,
    VoterProxy,
    RewardFactory__factory,
    RewardFactory,
    StashFactoryV2__factory,
    StashFactoryV2,
    TokenFactory__factory,
    TokenFactory,
    ProxyFactory__factory,
    ProxyFactory,
    CvxCrvToken__factory,
    CvxCrvToken,
    CrvDepositor__factory,
    CrvDepositor,
    PoolManagerV3__factory,
    PoolManagerV3,
    BaseRewardPool__factory,
    BaseRewardPool,
    ArbitratorVault__factory,
    ArbitratorVault,
    ExtraRewardStashV3,
    ExtraRewardStashV3__factory,
    PoolManagerProxy__factory,
    PoolManagerProxy,
    PoolManagerSecondaryProxy__factory,
    PoolManagerSecondaryProxy,
    MockERC20__factory,
    IBalancerPool__factory,
    ConvexMasterChef,
    LiqLocker,
    LiqLocker__factory,
    LiqToken,
    LiqToken__factory,
    LiqMinter,
    LiqMinter__factory,
    LitDepositorHelper,
    LitDepositorHelper__factory,
    IWeightedPool2TokensFactory__factory,
    AuraPenaltyForwarder__factory,
    ExtraRewardsDistributor__factory,
    LiqVestedEscrow,
    LiqVestedEscrow__factory,
    LiqMerkleDrop,
    LiqMerkleDrop__factory,
    ClaimFeesHelper,
    ClaimFeesHelper__factory,
    BoosterHelper,
    BoosterHelper__factory,
    GaugeMigrator,
    GaugeMigrator__factory,
    TempBooster,
    TempBooster__factory,
    PoolMigrator,
    PoolMigrator__factory,
    PoolManagerV4,
    BoosterOwnerSecondary,
    FlashOptionsExerciser,
    FlashOptionsExerciser__factory,
    PooledOptionsExerciser,
    PooledOptionsExerciser__factory,
    PrelaunchRewardsPool,
    PrelaunchRewardsPool__factory,
} from "../types/generated";
import { AssetHelpers } from "@balancer-labs/balancer-js";
import { Chain, deployContract, waitForTx } from "../tasks/utils";
import { ZERO_ADDRESS, DEAD_ADDRESS, ONE_WEEK, ZERO_KEY } from "../test-utils/constants";
import { simpleToExactAmount } from "../test-utils/math";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getChain } from "../tasks/utils/networkAddressFactory";

import * as fs from "fs";
import MainnetConfig from "./contracts.json";
import HardhatConfig from "./contracts.hardhat.json";

interface AirdropData {
    merkleRoot: string;
    startDelay: BN;
    length: BN;
    totalClaims: BN;
    amount: BN;
}

interface VestingRecipient {
    address: string;
    amount: BN;
}

interface VestingGroup {
    period: BN;
    recipients: VestingRecipient[];
}

interface LBPData {
    tknAmount: BN;
    wethAmount: BN;
    matching: BN;
}
interface DistroList {
    miningRewards: BN;
    lpIncentives: BN;
    cvxCrvBootstrap: BN;
    lbp: LBPData;
    airdrops: AirdropData[];
    immutableVesting: VestingGroup[];
    vesting: VestingGroup[];
}
interface BalancerPoolFactories {
    weightedPool2Tokens: string;
    stablePool: string;
    bootstrappingPool: string;
    weightedPool?: string;
}
interface ExtSystemConfig {
    authorizerAdapter?: string;
    token: string;
    lit?: string;
    tokenBpt: string;
    tokenWhale?: string;
    minter: string;
    votingEscrow: string;
    feeDistribution: string;
    gaugeController: string;
    voteOwnership?: string;
    voteParameter?: string;
    gauges?: string[];
    balancerVault: string;
    balancerPoolFactories?: BalancerPoolFactories;
    balancerPoolId: string;
    balancerMinOutBps: string;
    balancerPoolOwner?: string;
    balancerGaugeFactory?: string;
    balancerHelpers?: string;
    weth: string;
    wethWhale?: string;
    treasury?: string;
    keeper?: string;
    staBAL3?: string;
    staBAL3Whale?: string;
    feeToken?: string;
    feeTokenWhale?: string;
    feeTokenHandlerPath?: { poolIds: string[]; assetsIn: string[] };
    ldo?: string;
    ldoWhale?: string;
    stEthGaugeLdoDepositor?: string;
    uniswapRouter?: string;
    sushiswapRouter?: string;
    auraBalGauge?: string;
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
    vestingMultisig: string;
    treasuryMultisig: string;
    daoMultisig: string;
}

interface BPTData {
    tokens: string[];
    name: string;
    symbol: string;
    swapFee: BN;
    weights?: BN[];
    ampParameter?: number;
}

interface BalancerPoolDeployed {
    poolId: string;
    address: string;
}
interface Phase1Deployed {
    voterProxy: VoterProxy;
}

interface Factories {
    rewardFactory: RewardFactory;
    stashFactory: StashFactoryV2;
    tokenFactory: TokenFactory;
    proxyFactory: ProxyFactory;
}
interface Phase2Deployed extends Phase1Deployed {
    cvx: LiqToken;
    minter: LiqMinter;
    booster: Booster;
    boosterOwner: BoosterOwner;
    factories: Factories;
    arbitratorVault: ArbitratorVault;
    cvxCrv: CvxCrvToken;
    cvxCrvBpt?: BalancerPoolDeployed;
    cvxCrvRewards: BaseRewardPool;
    crvDepositor: CrvDepositor;
    litDepositorHelper: LitDepositorHelper;
    poolManager: PoolManagerV3;
    poolManagerProxy: PoolManagerProxy;
    poolManagerSecondaryProxy: PoolManagerSecondaryProxy;
    cvxLocker: LiqLocker;
    chef?: ConvexMasterChef;
    vestedEscrows: LiqVestedEscrow[];
    drops: LiqMerkleDrop[];
    lbpBpt?: BalancerPoolDeployed;
    balLiquidityProvider?: BalLiquidityProvider;
    penaltyForwarder: AuraPenaltyForwarder;
    extraRewardsDistributor: ExtraRewardsDistributor;
    flashOptionsExerciser: FlashOptionsExerciser;
    pooledOptionsExerciser: PooledOptionsExerciser;
    prelaunchRewardsPool: PrelaunchRewardsPool;
}

interface Phase3Deployed extends Phase2Deployed {
    pool8020Bpt: BalancerPoolDeployed;
}
// Phase 4
interface SystemDeployed extends Phase3Deployed {
    claimZap: AuraClaimZap;
    feeCollector: ClaimFeesHelper;
}

// Alias of phase 4 is the core system deployed.
type Phase4Deployed = SystemDeployed;

interface Phase5Deployed extends Phase4Deployed {
    boosterHelper: BoosterHelper;
    gaugeMigrator: GaugeMigrator;
}

interface Phase6Deployed {
    booster: Booster;
    boosterOwner: BoosterOwner;
    boosterHelper: BoosterHelper;
    feeCollector: ClaimFeesHelper;
    factories: Factories;
    cvxCrvRewards: BaseRewardPool;
    poolManager: PoolManagerV3;
    poolManagerProxy: PoolManagerProxy;
    poolManagerSecondaryProxy: PoolManagerSecondaryProxy;
    claimZap: AuraClaimZap;
    stashV3: ExtraRewardStashV3;
    poolMigrator: PoolMigrator;
}
type PoolsSnapshot = { gauge: string; lptoken: string; shutdown: boolean; pid: number };

interface Phase8Deployed {
    poolManagerV4: PoolManagerV4;
    boosterOwnerSecondary: BoosterOwnerSecondary;
}

function getPoolAddress(utils: any, receipt: ContractReceipt): string {
    const event = receipt.events.find(e => e.topics[0] === utils.keccak256(utils.toUtf8Bytes("PoolCreated(address)")));
    return utils.hexZeroPad(utils.hexStripZeros(event.topics[1]), 20);
}

function getConfig(hre: HardhatRuntimeEnvironment) {
    if (hre.network.name === "mainnet") {
        return MainnetConfig;
    }
    if (hre.network.name === "hardhat") {
        return HardhatConfig;
    }

    throw new Error("not found config");
}

function writeConfigFile(config: any, hre: HardhatRuntimeEnvironment) {
    let filePath;
    switch (hre.network.name) {
        case "mainnet":
            filePath = "scripts/contracts.json";
            break;
        case "hardhat":
            filePath = "scripts/contracts.hardhat.json";
            break;
        default:
            throw Error("Unsupported network");
    }
    console.log(`>> Writing ${filePath}`);
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    console.log("✅ Done");
}
/**
 * FLOW
 * Phase 1: Voter Proxy, get whitelisted on Curve system
 * Phase 2: cvx, booster, factories, cvxCrv, crvDepositor, poolManager, vlCVX + stakerProxy
 *           - Schedule: Vesting streams
 *           - Schedule: 2% emission for cvxCrv staking
 *           - Create:   cvxCRV/CRV BPT Stableswap
 *           - Schedule: chef (or other) & cvxCRV/CRV incentives
 *           - Schedule: Airdrop(s)
 *           - Schedule: LBP
 * Phase 2.1: Enable swapping and start weight decay on LBP
 * Phase 3: Liquidity from LBP taken and used for AURA/ETH pool
 *          Airdrops & initial farming begins like clockwork
 * Phase 4: Pools, claimzap & farming
 * Phase 5: Governance - Bravo, GaugeVoting, VoteForwarder, update roles
 */

async function deployPhase1(
    hre: HardhatRuntimeEnvironment,
    signer: Signer,
    extSystem: ExtSystemConfig,
    approveWalletLocal = true,
    debug = false,
    waitForBlocks = 0,
): Promise<Phase1Deployed> {
    const deployer = signer;

    // -----------------------------
    // 1. VoterProxy
    // -----------------------------

    const voterProxy = await deployContract<VoterProxy>(
        hre,
        new VoterProxy__factory(deployer),
        "VoterProxy",
        [extSystem.minter, extSystem.token, extSystem.tokenBpt, extSystem.votingEscrow, extSystem.gaugeController],
        {},
        debug,
        waitForBlocks,
    );

    if (approveWalletLocal) {
        const ve = MockCurveVoteEscrow__factory.connect(extSystem.votingEscrow, deployer);
        const walletChecker = MockWalletChecker__factory.connect(await ve.smart_wallet_checker(), deployer);
        await walletChecker.approveWallet(voterProxy.address);

        const crvBpt = MockERC20__factory.connect(extSystem.tokenBpt, deployer);
        await crvBpt.transfer(voterProxy.address, simpleToExactAmount(1));
    }

    const outputConfig = getConfig(hre);
    outputConfig.Deployments.voterProxy = voterProxy.address;
    writeConfigFile(outputConfig, hre);

    return { voterProxy };
}

async function deployPhase2(
    hre: HardhatRuntimeEnvironment,
    signer: Signer,
    deployment: Phase1Deployed,
    distroList: DistroList,
    multisigs: MultisigConfig,
    naming: NamingConfig,
    config: ExtSystemConfig,
    debug = false,
    waitForBlocks = 0,
): Promise<Phase2Deployed> {
    const { ethers } = hre;
    const chain = getChain(hre);
    const deployer = signer;
    const deployerAddress = await deployer.getAddress();

    const { token, tokenBpt, votingEscrow, gaugeController } = config;
    const { voterProxy } = deployment;

    const outputConfig = getConfig(hre);

    console.log("Current chain connected:", hre.network.name);

    // -----------------------------
    // 2: cvx, booster, factories, cvxCrv, crvDepositor, poolManager, vlCVX + stakerProxy
    //        - Schedule: Vesting streams
    //        - Schedule: 2% emission for cvxCrv staking
    //        - Create:   cvxCRV/CRV BPT Stableswap
    //        - Schedule: chef (or other) & cvxCRV/CRV incentives
    //        - Schedule: Airdrop(s)
    //        - Schedule: LBP
    // -----------------------------
    // POST-2: TreasuryDAO: LBP.updateWeightsGradually
    //         TreasuryDAO: LBP.setSwapEnabled

    // -----------------------------
    // 2.1 Core system:
    //     - cvx
    //     - booster
    //     - factories (reward, token, proxy, stash)
    //     - cvxCrv (cvxCrv, crvDepositor)
    //     - pool management (poolManager + 2x proxies)
    //     - vlCVX + ((stkCVX && stakerProxy) || fix)
    // -----------------------------

    const premineIncetives = distroList.lpIncentives
        .add(distroList.airdrops.reduce((p, c) => p.add(c.amount), BN.from(0)))
        .add(distroList.cvxCrvBootstrap)
        .add(distroList.lbp.tknAmount)
        .add(distroList.lbp.matching);
    const totalVested = distroList.vesting
        .concat(distroList.immutableVesting)
        .reduce((p, c) => p.add(c.recipients.reduce((pp, cc) => pp.add(cc.amount), BN.from(0))), BN.from(0));
    const premine = premineIncetives.add(totalVested);
    const checksum = premine.add(distroList.miningRewards);
    if (!checksum.eq(simpleToExactAmount(100, 24)) || !premine.eq(simpleToExactAmount(50, 24))) {
        console.log(checksum.toString());
        throw console.error();
    }

    const cvx = await deployContract<LiqToken>(
        hre,
        new LiqToken__factory(deployer),
        "LiqToken",
        [deployment.voterProxy.address, naming.cvxName, naming.cvxSymbol],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.liq = cvx.address;
    writeConfigFile(outputConfig, hre);

    const minter = await deployContract<LiqMinter>(
        hre,
        new LiqMinter__factory(deployer),
        "LiqMinter",
        [cvx.address, multisigs.daoMultisig],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.minter = minter.address;
    writeConfigFile(outputConfig, hre);

    const booster = await deployContract<Booster>(
        hre,
        new Booster__factory(deployer),
        "Booster",
        [voterProxy.address, cvx.address, token],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.booster = booster.address;
    writeConfigFile(outputConfig, hre);

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

    outputConfig.Deployments.tokenFactory = tokenFactory.address;
    writeConfigFile(outputConfig, hre);

    const proxyFactory = await deployContract<ProxyFactory>(
        hre,
        new ProxyFactory__factory(deployer),
        "ProxyFactory",
        [],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.proxyFactory = proxyFactory.address;
    writeConfigFile(outputConfig, hre);

    const stashFactory = await deployContract<StashFactoryV2>(
        hre,
        new StashFactoryV2__factory(deployer),
        "StashFactory",
        [booster.address, rewardFactory.address, proxyFactory.address],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.stashFactory = stashFactory.address;
    writeConfigFile(outputConfig, hre);

    const stashV3 = await deployContract<ExtraRewardStashV3>(
        hre,
        new ExtraRewardStashV3__factory(deployer),
        "ExtraRewardStashV3",
        [token],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.stashV3 = stashV3.address;
    writeConfigFile(outputConfig, hre);

    const cvxCrv = await deployContract<CvxCrvToken>(
        hre,
        new CvxCrvToken__factory(deployer),
        "CvxCrv",
        [naming.cvxCrvName, naming.cvxCrvSymbol],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.liqLit = cvxCrv.address;
    writeConfigFile(outputConfig, hre);

    const crvDepositor = await deployContract<CrvDepositor>(
        hre,
        new CrvDepositor__factory(deployer),
        "CrvDepositor",
        [voterProxy.address, cvxCrv.address, tokenBpt, votingEscrow, multisigs.daoMultisig],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.crvDepositor = crvDepositor.address;
    writeConfigFile(outputConfig, hre);

    const cvxCrvRewards = await deployContract<BaseRewardPool>(
        hre,
        new BaseRewardPool__factory(deployer),
        "BaseRewardPool",
        [0, cvxCrv.address, token, booster.address, rewardFactory.address],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.liqLitRewards = cvxCrvRewards.address;
    writeConfigFile(outputConfig, hre);

    const poolManagerProxy = await deployContract<PoolManagerProxy>(
        hre,
        new PoolManagerProxy__factory(deployer),
        "PoolManagerProxy",
        [booster.address, deployerAddress],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.poolManagerProxy = poolManagerProxy.address;
    writeConfigFile(outputConfig, hre);

    const poolManagerSecondaryProxy = await deployContract<PoolManagerSecondaryProxy>(
        hre,
        new PoolManagerSecondaryProxy__factory(deployer),
        "PoolManagerProxy",
        [gaugeController, poolManagerProxy.address, booster.address, deployerAddress],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.poolManagerSecondaryProxy = poolManagerSecondaryProxy.address;
    writeConfigFile(outputConfig, hre);

    const poolManager = await deployContract<PoolManagerV3>(
        hre,
        new PoolManagerV3__factory(deployer),
        "PoolManagerV3",
        [poolManagerSecondaryProxy.address, gaugeController, multisigs.daoMultisig],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.poolManager = poolManager.address;
    writeConfigFile(outputConfig, hre);

    const boosterOwner = await deployContract<BoosterOwner>(
        hre,
        new BoosterOwner__factory(deployer),
        "BoosterOwner",
        [
            multisigs.daoMultisig,
            poolManagerSecondaryProxy.address,
            booster.address,
            stashFactory.address,
            ZERO_ADDRESS,
            true,
        ],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.boosterOwner = boosterOwner.address;
    writeConfigFile(outputConfig, hre);

    const arbitratorVault = await deployContract<ArbitratorVault>(
        hre,
        new ArbitratorVault__factory(deployer),
        "ArbitratorVault",
        [booster.address],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.arbitratorVault = arbitratorVault.address;
    writeConfigFile(outputConfig, hre);

    const cvxLocker = await deployContract<LiqLocker>(
        hre,
        new LiqLocker__factory(deployer),
        "LiqLocker",
        [naming.vlCvxName, naming.vlCvxSymbol, cvx.address, cvxCrv.address, cvxCrvRewards.address, token],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.liqLocker = cvxLocker.address;
    writeConfigFile(outputConfig, hre);

    const litDepositorHelper = await deployContract<LitDepositorHelper>(
        hre,
        new LitDepositorHelper__factory(deployer),
        "LitDepositorHelper",
        [crvDepositor.address, config.balancerVault, config.lit, config.weth, config.balancerPoolId],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.litDepositorHelper = litDepositorHelper.address;
    writeConfigFile(outputConfig, hre);

    const extraRewardsDistributor = await deployContract<ExtraRewardsDistributor>(
        hre,
        new ExtraRewardsDistributor__factory(deployer),
        "ExtraRewardsDistributor",
        [cvxLocker.address],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.extraRewardsDistributor = extraRewardsDistributor.address;
    writeConfigFile(outputConfig, hre);

    const penaltyForwarder = await deployContract<AuraPenaltyForwarder>(
        hre,
        new AuraPenaltyForwarder__factory(deployer),
        "AuraPenaltyForwarder",
        [extraRewardsDistributor.address, cvx.address, ONE_WEEK.mul(7).div(2), multisigs.daoMultisig],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.penaltyForwarder = penaltyForwarder.address;
    writeConfigFile(outputConfig, hre);

    let flashOptionsExerciser: FlashOptionsExerciser;
    // Some addresses are hardcoded in an immutable way and does not work with hre
    if (chain != Chain.local) {
        flashOptionsExerciser = await deployContract<FlashOptionsExerciser>(
            hre,
            new FlashOptionsExerciser__factory(deployer),
            "FlashOptionsExerciser",
            [cvxCrv.address, booster.address, litDepositorHelper.address, cvxCrvRewards.address, cvxLocker.address],
            {},
            debug,
            waitForBlocks,
        );
    }

    outputConfig.Deployments.flashOptionsExerciser = flashOptionsExerciser.address;
    writeConfigFile(outputConfig, hre);

    let pooledOptionsExerciser: PooledOptionsExerciser;
    // Some addresses are hardcoded in an immutable way and does not work with hre
    if (chain != Chain.local) {
        pooledOptionsExerciser = await deployContract<PooledOptionsExerciser>(
            hre,
            new PooledOptionsExerciser__factory(deployer),
            "PooledOptionsExerciser",
            [cvxCrv.address, booster.address, litDepositorHelper.address, cvxCrvRewards.address, cvxLocker.address],
            {},
            debug,
            waitForBlocks,
        );
    }

    outputConfig.Deployments.pooledOptionsExerciser = pooledOptionsExerciser.address;
    writeConfigFile(outputConfig, hre);

    const prelaunchRewardsPool = await deployContract<PrelaunchRewardsPool>(
        hre,
        new PrelaunchRewardsPool__factory(deployer),
        "PrelaunchRewardsPool",
        [
            config.tokenBpt,
            cvx.address,
            litDepositorHelper.address,
            config.lit,
            crvDepositor.address,
            voterProxy.address,
            config.votingEscrow,
        ],
        {},
        debug,
        waitForBlocks,
    );

    outputConfig.Deployments.prelaunchRewardsPool = prelaunchRewardsPool.address;
    writeConfigFile(outputConfig, hre);

    let tx = await cvxLocker.addReward(token, booster.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await cvxLocker.setApprovals();
    await waitForTx(tx, debug, waitForBlocks);

    tx = await litDepositorHelper.setApprovals();
    await waitForTx(tx, debug, waitForBlocks);

    tx = await cvxLocker.transferOwnership(multisigs.daoMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await voterProxy.setOperator(booster.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await cvx.init(deployerAddress, minter.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await stashFactory.setImplementation(ZERO_ADDRESS, ZERO_ADDRESS, stashV3.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await cvxCrv.setOperator(crvDepositor.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await voterProxy.setDepositor(crvDepositor.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await voterProxy.setOwner(multisigs.daoMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    // Note needs to be commented for deployment
    const crvBpt = MockERC20__factory.connect(config.tokenBpt, deployer);
    const crvBptbalance = await crvBpt.balanceOf(deployerAddress);

    if (hre.network.name == "hardhat") {
        if (crvBptbalance.lt(simpleToExactAmount(1))) {
            throw console.error("No crvBPT for initial lock");
        }
        tx = await crvBpt.transfer(voterProxy.address, simpleToExactAmount(1));
        await waitForTx(tx, debug, waitForBlocks);

        tx = await crvDepositor.initialLock();
        await waitForTx(tx, debug, waitForBlocks);
    }

    tx = await crvDepositor.setFeeManager(multisigs.daoMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await booster.setRewardContracts(cvxCrvRewards.address, cvxLocker.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await booster.setPoolManager(poolManagerProxy.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await poolManagerProxy.setOperator(poolManagerSecondaryProxy.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await poolManagerProxy.setOwner(ZERO_ADDRESS);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await poolManagerSecondaryProxy.setOperator(poolManager.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await poolManagerSecondaryProxy.setOwner(multisigs.daoMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await booster.setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await arbitratorVault.setOperator(multisigs.daoMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await booster.setArbitrator(arbitratorVault.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await booster.setVoteDelegate(multisigs.daoMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    // Set fees to Booster
    // liqLit stakers 19.5%
    // LIQ lockers 3%
    // Triggers 0.5%
    // Protocol LIQ:WETH LPs 2%
    tx = await booster.setFees(1950, 300, 50, 200);
    await waitForTx(tx, debug, waitForBlocks);

    if (chain != Chain.local) {
        tx = await booster.setFeeInfo(config.weth, config.feeDistribution);
        await waitForTx(tx, debug, waitForBlocks);
    }

    tx = await booster.setFeeManager(multisigs.daoMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await booster.setOwner(boosterOwner.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await extraRewardsDistributor.modifyWhitelist(penaltyForwarder.address, true);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await extraRewardsDistributor.transferOwnership(multisigs.daoMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    if (chain != Chain.local) {
        tx = await pooledOptionsExerciser.setOwner(multisigs.daoMultisig);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await flashOptionsExerciser.setOwner(multisigs.daoMultisig);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await prelaunchRewardsPool.setOwner(multisigs.daoMultisig);
        await waitForTx(tx, debug, waitForBlocks);
    }

    // -----------------------------
    // 2.2. Token liquidity:
    // - Schedule: vesting streams
    // - Schedule: Airdrop(s)
    // -----------------------------

    // -----------------------------
    // 2.2.1 Schedule: vesting escrow streams
    // -----------------------------

    const currentTime = BN.from((await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp);
    const DELAY = ONE_WEEK;
    const vestingStart = currentTime.add(DELAY);
    const vestedEscrows = [];

    const vestingDistro = distroList.vesting
        .map(v => ({ ...v, admin: multisigs.vestingMultisig }))
        .concat(distroList.immutableVesting.map(v => ({ ...v, admin: ZERO_ADDRESS })));

    for (let i = 0; i < vestingDistro.length; i++) {
        const vestingGroup = vestingDistro[i];
        const groupVestingAmount = vestingGroup.recipients.reduce((p, c) => p.add(c.amount), BN.from(0));
        const vestingEnd = vestingStart.add(vestingGroup.period);

        const vestedEscrow = await deployContract<LiqVestedEscrow>(
            hre,
            new LiqVestedEscrow__factory(deployer),
            "LiqVestedEscrow",
            [cvx.address, vestingGroup.admin, cvxLocker.address, vestingStart, vestingEnd],
            {},
            debug,
            waitForBlocks,
        );

        tx = await cvx.approve(vestedEscrow.address, groupVestingAmount);
        await waitForTx(tx, debug, waitForBlocks);
        const vestingAddr = vestingGroup.recipients.map(m => m.address);
        const vestingAmounts = vestingGroup.recipients.map(m => m.amount);
        tx = await vestedEscrow.fund(vestingAddr, vestingAmounts);
        await waitForTx(tx, debug, waitForBlocks);

        vestedEscrows.push(vestedEscrow);
    }

    // -----------------------------
    // 2.2.2 Schedule: Airdrop(s)
    // -----------------------------

    const dropCount = distroList.airdrops.length;
    const drops: LiqMerkleDrop[] = [];
    for (let i = 0; i < dropCount; i++) {
        const { merkleRoot, startDelay, length, totalClaims, amount } = distroList.airdrops[i];
        const airdrop = await deployContract<LiqMerkleDrop>(
            hre,
            new LiqMerkleDrop__factory(deployer),
            "LiqMerkleDrop",
            [
                multisigs.treasuryMultisig,
                merkleRoot,
                cvx.address,
                cvxLocker.address,
                startDelay,
                length,
                totalClaims,
                amount,
            ],
            {},
            debug,
            waitForBlocks,
        );
        tx = await cvx.transfer(airdrop.address, amount);
        await waitForTx(tx, debug, waitForBlocks);
        drops.push(airdrop);
    }

    const balance = await cvx.balanceOf(deployerAddress);
    if (balance.gt(0)) {
        // throw console.error("Uh oh, deployer still has CVX to distribute: ", balance.toString());
        tx = await cvx.transfer(multisigs.treasuryMultisig, balance);
        await waitForTx(tx, debug, waitForBlocks);
    }

    return {
        ...deployment,
        cvx,
        minter,
        booster,
        boosterOwner,
        factories: {
            rewardFactory,
            stashFactory,
            tokenFactory,
            proxyFactory,
        },
        arbitratorVault,
        cvxCrv,
        cvxCrvRewards,
        crvDepositor,
        litDepositorHelper,
        poolManager,
        cvxLocker,
        vestedEscrows,
        drops,
        penaltyForwarder,
        extraRewardsDistributor,
        poolManagerProxy,
        poolManagerSecondaryProxy,
        flashOptionsExerciser,
        pooledOptionsExerciser,
        prelaunchRewardsPool,
    };
}

async function deployPhase3(
    hre: HardhatRuntimeEnvironment,
    signer: Signer,
    deployment: Phase2Deployed,
    multisigs: MultisigConfig,
    config: ExtSystemConfig,
    debug = false,
    waitForBlocks = 0,
): Promise<Phase3Deployed> {
    const { ethers } = hre;
    const chain = getChain(hre);
    const deployer = signer;
    const balHelper = new AssetHelpers(config.weth);

    const { cvx, balLiquidityProvider } = deployment;

    // PRE-3: TreasuryDAO: LBP.withdraw
    //        TreasuryDAO: WETH.transfer(liqProvider)
    //        TreasuryDAO: AURA.transfer(liqProvider)
    // -----------------------------
    // 3: Liquidity from LBP taken and used for AURA/ETH pool
    //     - create: TKN/ETH 80/20 BPT
    //     - fund: liq
    // -----------------------------
    // POST-3: MerkleDrops && 2% cvxCRV staking manual trigger

    // If Mainnet or Kovan, create LBP
    let tx: ContractTransaction;
    let pool: BalancerPoolDeployed = { address: DEAD_ADDRESS, poolId: ZERO_KEY };
    if (chain == Chain.mainnet) {
        const tknAmount = await cvx.balanceOf(balLiquidityProvider.address);
        const wethAmount = await MockERC20__factory.connect(config.weth, deployer).balanceOf(
            balLiquidityProvider.address,
        );
        if (tknAmount.lt(simpleToExactAmount(1.5, 24)) || wethAmount.lt(simpleToExactAmount(375))) {
            console.log(tknAmount.toString(), wethAmount.toString());
            throw console.error("Invalid balances");
        }
        const [poolTokens, weights, initialBalances] = balHelper.sortTokens(
            [cvx.address, config.weth],
            [simpleToExactAmount(80, 16), simpleToExactAmount(20, 16)],
            [tknAmount, wethAmount],
        );
        const poolData: BPTData = {
            tokens: poolTokens,
            name: `Balancer 80 ${await cvx.symbol()} 20 WETH`,
            symbol: `B-80${await cvx.symbol()}-20WETH`,
            swapFee: simpleToExactAmount(1, 16),
            weights: weights as BN[],
        };
        if (debug) {
            console.log(poolData.tokens);
        }

        const poolFactory = IWeightedPool2TokensFactory__factory.connect(
            config.balancerPoolFactories.weightedPool2Tokens,
            deployer,
        );
        tx = await poolFactory.create(
            poolData.name,
            poolData.symbol,
            poolData.tokens,
            poolData.weights,
            poolData.swapFee,
            true,
            !!config.balancerPoolOwner && config.balancerPoolOwner != ZERO_ADDRESS
                ? config.balancerPoolOwner
                : multisigs.treasuryMultisig,
        );
        const receipt = await waitForTx(tx, debug, waitForBlocks);
        const poolAddress = getPoolAddress(ethers.utils, receipt);

        const poolId = await IBalancerPool__factory.connect(poolAddress, deployer).getPoolId();
        pool = { address: poolAddress, poolId };
        const joinPoolRequest = {
            assets: poolTokens,
            maxAmountsIn: initialBalances as BN[],
            userData: ethers.utils.defaultAbiCoder.encode(["uint256", "uint256[]"], [0, initialBalances as BN[]]),
            fromInternalBalance: false,
        };

        tx = await balLiquidityProvider.provideLiquidity(poolId, joinPoolRequest);
        await waitForTx(tx, debug, waitForBlocks);
    }

    return { ...deployment, pool8020Bpt: pool };
}

async function deployPhase4(
    hre: HardhatRuntimeEnvironment,
    signer: Signer,
    deployment: Phase3Deployed,
    config: ExtSystemConfig,
    debug = false,
    waitForBlocks = 0,
): Promise<SystemDeployed> {
    const deployer = signer;

    const { token, gauges, feeDistribution } = config;
    const { cvx, cvxCrv, cvxLocker, cvxCrvRewards, poolManager, litDepositorHelper } = deployment;

    // PRE-4: daoMultisig.setProtectPool(false)
    //        daoMultisig.setFeeInfo(bbaUSD distro)
    //        daoMultisig.setFeeInfo($BAL distro)
    // -----------------------------
    // 4. Pool creation etc
    //     - Claimzap
    //     - All initial gauges
    // -----------------------------

    const claimZap = await deployContract<AuraClaimZap>(
        hre,
        new AuraClaimZap__factory(deployer),
        "AuraClaimZap",
        [token, cvx.address, cvxCrv.address, litDepositorHelper.address, cvxCrvRewards.address, cvxLocker.address],
        {},
        debug,
        waitForBlocks,
    );

    let tx = await claimZap.setApprovals();
    await waitForTx(tx, debug, waitForBlocks);

    const gaugeLength = gauges.length;
    const gaugeController = IGaugeController__factory.connect(config.gaugeController, deployer);
    for (let i = 0; i < gaugeLength; i++) {
        if (gaugeLength > 10) {
            const weight = await gaugeController.get_gauge_weight(gauges[i]);
            if (weight.lt(simpleToExactAmount(15000))) continue;
        }
        tx = await poolManager["addPool(address)"](gauges[i]);
        await waitForTx(tx, debug, waitForBlocks);
    }

    const feeCollector = await deployContract<ClaimFeesHelper>(
        hre,
        new ClaimFeesHelper__factory(deployer),
        "ClaimFeesHelper",
        [deployment.booster.address, deployment.voterProxy.address, feeDistribution || ZERO_ADDRESS],
        {},
        debug,
        waitForBlocks,
    );

    return { ...deployment, claimZap, feeCollector };
}

async function deployTempBooster(
    hre: HardhatRuntimeEnvironment,
    signer: Signer,
    debug = false,
    waitForBlocks = 0,
): Promise<TempBooster> {
    const deployer = signer;
    return deployContract<TempBooster>(
        hre,
        new TempBooster__factory(deployer),
        "TempBooster",
        [],
        {},
        debug,
        waitForBlocks,
    );
}

async function deployPhase5(
    hre: HardhatRuntimeEnvironment,
    signer: Signer,
    deployment: Phase4Deployed,
    multisigs: MultisigConfig,
    config: ExtSystemConfig,
    debug = false,
    waitForBlocks = 0,
): Promise<Phase5Deployed> {
    const deployer = signer;

    const { token } = config;
    const { booster } = deployment;

    // -----------------------------
    // 5. Helpers
    //     - boosterHelper
    //     - gaugeMigrator
    //     - uniswapMigrator
    // -----------------------------
    const boosterHelper = await deployContract<BoosterHelper>(
        hre,
        new BoosterHelper__factory(deployer),
        "BoosterHelper",
        [booster.address, token],
        {},
        debug,
        waitForBlocks,
    );

    const gaugeMigrator = await deployContract<GaugeMigrator>(
        hre,
        new GaugeMigrator__factory(deployer),
        "GaugeMigrator",
        [booster.address],
        {},
        debug,
        waitForBlocks,
    );

    return { ...deployment, boosterHelper, gaugeMigrator };
}

// -----------------------------
// 6   Upgrade of booster and dependencies
// 6.1 Core system:  Deployment
// 6.2 Core system:  Configurations
// -----------------------------
async function deployPhase6(
    hre: HardhatRuntimeEnvironment,
    signer: Signer,
    deployment: Phase2Deployed,
    multisigs: MultisigConfig,
    naming: NamingConfig,
    extConfig: ExtSystemConfig,
    debug = false,
    waitForBlocks = 0,
): Promise<Phase6Deployed> {
    // -----------------------------
    // 6.1 Core system:
    //     - booster
    //     - factories (reward, token, proxy, stash, stashV3)
    //     - cvxCrvRewards
    //     - pool management (poolManager + 2x proxies)
    //     - boosterOwner
    //     - helpers (boosterHelper, feeCollector, claimZap, poolMigrator)
    // -----------------------------

    const deployer = signer;
    const deployerAddress = await deployer.getAddress();

    const { token, gaugeController, feeDistribution } = extConfig;

    const { arbitratorVault, booster: boosterV1, cvxLocker, voterProxy, cvx, cvxCrv, litDepositorHelper } = deployment;

    let tx: ContractTransaction;

    const booster = await deployContract<Booster>(
        hre,
        new Booster__factory(deployer),
        "Booster",
        [voterProxy.address, cvx.address, token],
        {},
        debug,
        waitForBlocks,
    );

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

    const cvxCrvRewards = await deployContract<BaseRewardPool>(
        hre,
        new BaseRewardPool__factory(deployer),
        "BaseRewardPool",
        [0, cvxCrv.address, token, booster.address, rewardFactory.address],
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

    const poolManagerSecondaryProxy = await deployContract<PoolManagerSecondaryProxy>(
        hre,
        new PoolManagerSecondaryProxy__factory(deployer),
        "PoolManagerProxy",
        [gaugeController, poolManagerProxy.address, booster.address, deployerAddress],
        {},
        debug,
        waitForBlocks,
    );

    const poolManager = await deployContract<PoolManagerV3>(
        hre,
        new PoolManagerV3__factory(deployer),
        "PoolManagerV3",
        [poolManagerSecondaryProxy.address, gaugeController, multisigs.daoMultisig],
        {},
        debug,
        waitForBlocks,
    );

    const boosterOwner = await deployContract<BoosterOwner>(
        hre,
        new BoosterOwner__factory(deployer),
        "BoosterOwner",
        [
            multisigs.daoMultisig,
            poolManagerSecondaryProxy.address,
            booster.address,
            stashFactory.address,
            ZERO_ADDRESS,
            true,
        ],
        {},
        debug,
        waitForBlocks,
    );

    const boosterHelper = await deployContract<BoosterHelper>(
        hre,
        new BoosterHelper__factory(deployer),
        "BoosterHelper",
        [booster.address, token],
        {},
        debug,
        waitForBlocks,
    );

    const feeCollector = await deployContract<ClaimFeesHelper>(
        hre,
        new ClaimFeesHelper__factory(deployer),
        "ClaimFeesHelper",
        [booster.address, voterProxy.address, feeDistribution || ZERO_ADDRESS],
        {},
        debug,
        waitForBlocks,
    );

    const claimZap = await deployContract<AuraClaimZap>(
        hre,
        new AuraClaimZap__factory(deployer),
        "AuraClaimZap",
        [token, cvx.address, cvxCrv.address, litDepositorHelper.address, cvxCrvRewards.address, cvxLocker.address],
        {},
        debug,
        waitForBlocks,
    );

    const poolMigrator = await deployContract<PoolMigrator>(
        hre,
        new PoolMigrator__factory(deployer),
        "PoolMigrator",
        [boosterV1.address, booster.address],
        {},
        debug,
        waitForBlocks,
    );

    // -----------------------------
    // 6.2: Configurations
    //     - booster (setRewardContracts, setPoolManager, setVoteDelegate, setFees, setFeeInfo, setFeeInfo, setTreasury, setFeeManager, setOwner)
    //     - factories (stashFactory.setImplementation)
    //     - pool management (poolManagerProxy.setOperator poolManagerProxy.setOwner, poolManagerSecondaryProxy.setOperator,  poolManagerSecondaryProxy.setOwner)
    // -----------------------------

    tx = await claimZap.setApprovals();
    await waitForTx(tx, debug, waitForBlocks);

    tx = await booster.setRewardContracts(cvxCrvRewards.address, cvxLocker.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await booster.setPoolManager(poolManagerProxy.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await poolManagerProxy.setOperator(poolManagerSecondaryProxy.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await poolManagerProxy.setOwner(ZERO_ADDRESS);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await poolManagerSecondaryProxy.setOperator(poolManager.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await poolManagerSecondaryProxy.setUsedAddress([token, cvx.address]);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await poolManagerSecondaryProxy.setOwner(multisigs.daoMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await booster.setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await booster.setArbitrator(arbitratorVault.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await booster.setVoteDelegate(multisigs.daoMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await stashFactory.setImplementation(ZERO_ADDRESS, ZERO_ADDRESS, stashV3.address);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await booster.setFees(2050, 400, 50, 0);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await booster.setFeeInfo(extConfig.token, extConfig.feeDistribution);
    await waitForTx(tx, debug, waitForBlocks);

    if (extConfig.feeToken) {
        tx = await booster.setFeeInfo(extConfig.feeToken, extConfig.feeDistribution);
        await waitForTx(tx, debug, waitForBlocks);
    } else {
        console.log("!warning feeToken not provided");
    }

    tx = await booster.setTreasury(multisigs.treasuryMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await booster.setFeeManager(multisigs.daoMultisig);
    await waitForTx(tx, debug, waitForBlocks);

    tx = await booster.setOwner(boosterOwner.address);
    await waitForTx(tx, debug, waitForBlocks);

    return {
        booster,
        boosterOwner,
        boosterHelper,
        feeCollector,
        factories: {
            rewardFactory,
            stashFactory,
            tokenFactory,
            proxyFactory,
        },
        cvxCrvRewards,
        poolManager,
        poolManagerProxy,
        poolManagerSecondaryProxy,
        claimZap,
        stashV3,
        poolMigrator,
    };
}

export {
    DistroList,
    MultisigConfig,
    ExtSystemConfig,
    BalancerPoolDeployed,
    NamingConfig,
    deployPhase1,
    Phase1Deployed,
    deployPhase2,
    Phase2Deployed,
    deployPhase3,
    Phase3Deployed,
    deployPhase4,
    SystemDeployed,
    Phase4Deployed,
    deployTempBooster,
    deployPhase5,
    Phase5Deployed,
    deployPhase6,
    Phase6Deployed,
    Phase8Deployed,
    PoolsSnapshot,
};
