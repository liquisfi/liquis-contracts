import hre, { ethers } from "hardhat";
import { expect } from "chai";
import {
    VoterProxy,
    VoterProxy__factory,
    Booster,
    Booster__factory,
    LiqToken,
    LiqToken__factory,
    LiqMinter,
    LiqMinter__factory,
    CvxCrvToken,
    CvxCrvToken__factory,
    CrvDepositor,
    CrvDepositor__factory,
    PrelaunchRewardsPool,
    PrelaunchRewardsPool__factory,
    BaseRewardPool,
    BaseRewardPool__factory,
    BaseRewardPool4626,
    BaseRewardPool4626__factory,
    LitDepositorHelper,
    IERC20Extra,
    PoolManagerV3,
    PoolManagerV3__factory,
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
    PoolManagerSecondaryProxy,
    PoolManagerSecondaryProxy__factory,
    BoosterOwner,
    BoosterOwner__factory,
    ArbitratorVault,
    ArbitratorVault__factory,
    ExtraRewardsDistributor,
    ExtraRewardsDistributor__factory,
    AuraPenaltyForwarder,
    AuraPenaltyForwarder__factory,
    FlashOptionsExerciser,
    FlashOptionsExerciser__factory,
    PooledOptionsExerciser,
    PooledOptionsExerciser__factory,
} from "../../types/generated";
import { Signer } from "ethers";
import { increaseTime } from "../../test-utils/time";
import { ZERO_ADDRESS, ONE_WEEK, ZERO, e18, e15, e6 } from "../../test-utils/constants";
import { deployContract, waitForTx } from "../../tasks/utils";
import { impersonateAccount } from "../../test-utils";

import { MultisigConfig, ExtSystemConfig } from "../../scripts/deploySystem";

import smartWalletCheckerABI from "../../abi/smartWalletChecker.json";
import bunniHubABI from "../../abi/bunniHub.json";

// yarn hardhat --config hardhat-fork.config.ts test ./test-fork/post-deploy/PostDeployTest.spec.ts

const hreAddress: string = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

const mainnetDeployment = {
    voterProxy: "0x37aeB332D6E57112f1BFE36923a7ee670Ee9278b",
    liq: "0xD82fd4D6D62f89A1E50b1db69AD19932314aa408",
    minter: "0x2e8617079e97Ac78fCE7a2A2ec7c4a84492b805e",
    booster: "0x631e58246A88c3957763e1469cb52f93BC1dDCF2",
    liqLit: "0x03C6F0Ca0363652398abfb08d154F114e61c4Ad8",
    crvDepositor: "0xB96Bce10480d2a8eb2995Ee4f04a70d48997856a",
    litDepositorHelper: "0x97a2585Ddb121db8E9a3B6575E302F9c610AF08c",
    prelaunchRewardsPool: "0x5c988c4E1F3cf1CA871A54Af3a1DcB5FeF2612Fc",
};

const externalAddresses: ExtSystemConfig = {
    token: "0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa", // oLIT
    lit: "0xfd0205066521550D7d7AB19DA8F72bb004b4C341", // LIT
    tokenBpt: "0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C", // BAL 20-80 WETH/LIT
    tokenWhale: "0xb8F26C1Cc45ab62fd750E08957fBa5738094bbDB",
    minter: "0xF087521Ffca0Fa8A43F5C445773aB37C5f574DA0",
    votingEscrow: "0xf17d23136B4FeAd139f54fB766c8795faae09660",
    feeDistribution: "0x951f99350d816c0E160A2C71DEfE828BdfC17f12", // Bunni FeeDistro
    gaugeController: "0x901c8aA6A61f74aC95E7f397E22A0Ac7c1242218",
    gauges: ["0xd4d8E88bf09efCf3F5bf27135Ef12c1276d9063C", "0x471A34823DDd9506fe8dFD6BC5c2890e4114Fafe"], // Liquidity Gauge USDC/WETH & FRAX/USDC
    balancerVault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
    balancerPoolId: "0x9232a548dd9e81bac65500b5e0d918f8ba93675c000200000000000000000423",
    balancerMinOutBps: "9900",
    balancerPoolFactories: {
        weightedPool2Tokens: "0xA5bf2ddF098bb0Ef6d120C98217dD6B141c74EE0",
        weightedPool: "0xcC508a455F5b0073973107Db6a878DdBDab957bC",
        stablePool: "0x8df6EfEc5547e31B0eb7d1291B511FF8a2bf987c",
        bootstrappingPool: "0x751A0bC0e3f75b38e01Cf25bFCE7fF36DE1C87DE",
    },
    balancerHelpers: "0x5aDDCCa35b7A0D07C74063c48700C8590E87864E",
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    wethWhale: "0x57757E3D981446D585Af0D9Ae4d7DF6D64647806",
    voteOwnership: hreAddress,
    voteParameter: hreAddress,
};

const naming = {
    cvxName: "Liquis",
    cvxSymbol: "LIQ",
    vlCvxName: "Vote Locked Liq",
    vlCvxSymbol: "vlLIQ",
    cvxCrvName: "Liq Lit",
    cvxCrvSymbol: "liqLit",
    tokenFactoryNamePostfix: " Liquis Deposit",
};

const multisigs: MultisigConfig = {
    vestingMultisig: hreAddress,
    treasuryMultisig: hreAddress,
    daoMultisig: hreAddress,
};

const debug = false;
const waitForBlocks = 0;

describe("Post deploy", () => {
    let booster: Booster;
    let liq: LiqToken;
    let voterProxy: VoterProxy;
    let minter: LiqMinter;
    let liqLit: CvxCrvToken;
    let crvDepositor: CrvDepositor;
    let litDepositorHelper: LitDepositorHelper;
    let prelaunchRewardsPool: PrelaunchRewardsPool;

    let cvxCrvRewards: BaseRewardPool;
    let liqLocker: LiqLocker;

    let poolManager: PoolManagerV3;

    let lit: IERC20Extra;
    let olit: IERC20Extra;
    let velit: IERC20Extra;
    let crvBpt: IERC20Extra;

    let usdc: IERC20Extra;
    let weth: IERC20Extra;
    let lpTokenUsdcWeth: IERC20Extra;
    let lpTokenFraxUsdc: IERC20Extra;

    let deployer: Signer;
    let deployerAddress: string;

    let alice: Signer;
    let aliceAddress: string;

    let bob: Signer;
    let bobAddress: string;

    let rewardPool1: BaseRewardPool;
    let rewardPool2: BaseRewardPool;

    let rewardPool4626_1: BaseRewardPool4626;
    let rewardPool4626_2: BaseRewardPool4626;

    let rewardFactory: RewardFactory;
    let tokenFactory: TokenFactory;
    let proxyFactory: ProxyFactory;
    let stashFactory: StashFactoryV2;
    let stashV3: ExtraRewardStashV3;
    let poolManagerProxy: PoolManagerProxy;
    let poolManagerSecondaryProxy: PoolManagerSecondaryProxy;
    let boosterOwner: BoosterOwner;
    let arbitratorVault: ArbitratorVault;
    let extraRewardsDistributor: ExtraRewardsDistributor;
    let penaltyForwarder: AuraPenaltyForwarder;
    let pooledOptionsExerciser: PooledOptionsExerciser;
    let flashOptionsExerciser: FlashOptionsExerciser;

    const smartWalletCheckerContractAddress: string = "0x0ccdf95baf116ede5251223ca545d0ed02287a8f";
    const smartWalletCheckerOwnerAddress: string = "0x9a8fee232dcf73060af348a1b62cdb0a19852d13";

    const olitAddress: string = "0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa";
    const litAddress: string = "0xfd0205066521550D7d7AB19DA8F72bb004b4C341";
    const tokenBptAddress: string = "0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C";
    const votingEscrowAddress: string = "0xf17d23136B4FeAd139f54fB766c8795faae09660";

    const litHolderAddress: string = "0x63F2695207f1d625a9B0B8178D95cD517bC5E82C"; // 10M
    const usdcHolderAddress: string = "0x55FE002aefF02F77364de339a1292923A15844B8";
    const wethHolderAddress: string = "0x57757E3D981446D585Af0D9Ae4d7DF6D64647806";
    const crvBptHolderAddress: string = "0xb84dfdD51d18B1613432bfaE91dfcC48899D4151"; // 32k

    const lpTokenUsdcWethAddress: string = "0x680026A1C99a1eC9878431F730706810bFac9f31"; // Bunni USDC/WETH LP (BUNNI-LP)
    const lpTokenFraxUsdcAddress: string = "0x088DCFE115715030d441a544206CD970145F3941"; // Bunni FRAX/USDC LP (BUNNI-LP)
    const lpTokenFraxUsdcHolder: string = "0x5180db0237291A6449DdA9ed33aD90a38787621c";

    const usdcAddress: string = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

    const daoMultisigAddress: string = "0xd9dDB1129941377166C7Aa5834F6c9B56BA100fe";
    const liquisDeployerAddress: string = "0xA35E14f9D731ddB1994B5590574B32A838646Ccf";

    const bunniHubContractAddress: string = "0xb5087F95643A9a4069471A28d32C569D9bd57fE4";

    const FORK_BLOCK_NUMBER: number = 17778750;

    const setup = async () => {
        // Populate already deployed contracts
        voterProxy = VoterProxy__factory.connect(mainnetDeployment.voterProxy, deployer);
        liq = LiqToken__factory.connect(mainnetDeployment.liq, deployer);
        minter = LiqMinter__factory.connect(mainnetDeployment.minter, deployer);
        booster = Booster__factory.connect(mainnetDeployment.booster, deployer);
        liqLit = CvxCrvToken__factory.connect(mainnetDeployment.liqLit, deployer);
        crvDepositor = CrvDepositor__factory.connect(mainnetDeployment.crvDepositor, deployer);
        litDepositorHelper = LitDepositorHelper__factory.connect(mainnetDeployment.litDepositorHelper, deployer);
        prelaunchRewardsPool = PrelaunchRewardsPool__factory.connect(mainnetDeployment.prelaunchRewardsPool, deployer);

        // Deploy rest of the s
        rewardFactory = await deployContract<RewardFactory>(
            hre,
            new RewardFactory__factory(deployer),
            "RewardFactory",
            [booster.address, externalAddresses.token],
            {},
            debug,
            waitForBlocks,
        );

        tokenFactory = await deployContract<TokenFactory>(
            hre,
            new TokenFactory__factory(deployer),
            "TokenFactory",
            [booster.address, naming.tokenFactoryNamePostfix, naming.cvxSymbol.toLowerCase()],
            {},
            debug,
            waitForBlocks,
        );

        proxyFactory = await deployContract<ProxyFactory>(
            hre,
            new ProxyFactory__factory(deployer),
            "ProxyFactory",
            [],
            {},
            debug,
            waitForBlocks,
        );

        stashFactory = await deployContract<StashFactoryV2>(
            hre,
            new StashFactoryV2__factory(deployer),
            "StashFactory",
            [booster.address, rewardFactory.address, proxyFactory.address],
            {},
            debug,
            waitForBlocks,
        );

        stashV3 = await deployContract<ExtraRewardStashV3>(
            hre,
            new ExtraRewardStashV3__factory(deployer),
            "ExtraRewardStashV3",
            [externalAddresses.token],
            {},
            debug,
            waitForBlocks,
        );

        cvxCrvRewards = await deployContract<BaseRewardPool>(
            hre,
            new BaseRewardPool__factory(deployer),
            "BaseRewardPool",
            [0, liqLit.address, externalAddresses.token, booster.address, rewardFactory.address],
            {},
            debug,
            waitForBlocks,
        );

        poolManagerProxy = await deployContract<PoolManagerProxy>(
            hre,
            new PoolManagerProxy__factory(deployer),
            "PoolManagerProxy",
            [booster.address, deployerAddress],
            {},
            debug,
            waitForBlocks,
        );

        poolManagerSecondaryProxy = await deployContract<PoolManagerSecondaryProxy>(
            hre,
            new PoolManagerSecondaryProxy__factory(deployer),
            "PoolManagerProxy",
            [externalAddresses.gaugeController, poolManagerProxy.address, booster.address, deployerAddress],
            {},
            debug,
            waitForBlocks,
        );

        poolManager = await deployContract<PoolManagerV3>(
            hre,
            new PoolManagerV3__factory(deployer),
            "PoolManagerV3",
            [poolManagerSecondaryProxy.address, externalAddresses.gaugeController, multisigs.daoMultisig],
            {},
            debug,
            waitForBlocks,
        );

        boosterOwner = await deployContract<BoosterOwner>(
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

        arbitratorVault = await deployContract<ArbitratorVault>(
            hre,
            new ArbitratorVault__factory(deployer),
            "ArbitratorVault",
            [booster.address],
            {},
            debug,
            waitForBlocks,
        );

        liqLocker = await deployContract<LiqLocker>(
            hre,
            new LiqLocker__factory(deployer),
            "LiqLocker",
            [
                naming.vlCvxName,
                naming.vlCvxSymbol,
                liq.address,
                liqLit.address,
                cvxCrvRewards.address,
                externalAddresses.token,
            ],
            {},
            debug,
            waitForBlocks,
        );

        extraRewardsDistributor = await deployContract<ExtraRewardsDistributor>(
            hre,
            new ExtraRewardsDistributor__factory(deployer),
            "ExtraRewardsDistributor",
            [liqLocker.address],
            {},
            debug,
            waitForBlocks,
        );

        penaltyForwarder = await deployContract<AuraPenaltyForwarder>(
            hre,
            new AuraPenaltyForwarder__factory(deployer),
            "AuraPenaltyForwarder",
            [extraRewardsDistributor.address, liq.address, ONE_WEEK.mul(7).div(2), multisigs.daoMultisig],
            {},
            debug,
            waitForBlocks,
        );

        flashOptionsExerciser = await deployContract<FlashOptionsExerciser>(
            hre,
            new FlashOptionsExerciser__factory(deployer),
            "FlashOptionsExerciser",
            [liqLit.address, booster.address, litDepositorHelper.address, cvxCrvRewards.address, liqLocker.address],
            {},
            debug,
            waitForBlocks,
        );

        pooledOptionsExerciser = await deployContract<PooledOptionsExerciser>(
            hre,
            new PooledOptionsExerciser__factory(deployer),
            "PooledOptionsExerciser",
            [liqLit.address, booster.address, litDepositorHelper.address, cvxCrvRewards.address, liqLocker.address],
            {},
            debug,
            waitForBlocks,
        );

        let tx = await liqLocker.addReward(externalAddresses.token, booster.address);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await liqLocker.setApprovals();
        await waitForTx(tx, debug, waitForBlocks);

        tx = await liqLocker.transferOwnership(multisigs.daoMultisig);
        await waitForTx(tx, debug, waitForBlocks);

        // Impersonate
        await impersonateAccount(daoMultisigAddress, true);
        const daoMultisigSigner = await ethers.getSigner(daoMultisigAddress);

        tx = await stashFactory
            .connect(daoMultisigSigner)
            .setImplementation(ZERO_ADDRESS, ZERO_ADDRESS, stashV3.address);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await booster.connect(daoMultisigSigner).setRewardContracts(cvxCrvRewards.address, liqLocker.address);
        await waitForTx(tx, debug, waitForBlocks);

        // Impersonate
        await impersonateAccount(liquisDeployerAddress, true);
        const liquisDeployerSigner = await ethers.getSigner(liquisDeployerAddress);

        tx = await booster.connect(liquisDeployerSigner).setPoolManager(poolManagerProxy.address);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await poolManagerProxy.setOperator(poolManagerSecondaryProxy.address);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await poolManagerProxy.setOwner(ZERO_ADDRESS);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await poolManagerSecondaryProxy.setOperator(poolManager.address);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await poolManagerSecondaryProxy.setOwner(multisigs.daoMultisig);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await booster
            .connect(daoMultisigSigner)
            .setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await arbitratorVault.setOperator(multisigs.daoMultisig);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await booster.connect(daoMultisigSigner).setArbitrator(arbitratorVault.address);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await booster
            .connect(daoMultisigSigner)
            .setFeeInfo(externalAddresses.weth, externalAddresses.feeDistribution);
        await waitForTx(tx, debug, waitForBlocks);

        // Set final owner to BoosterOwner contract
        tx = await booster.connect(daoMultisigSigner).setOwner(boosterOwner.address);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await extraRewardsDistributor.modifyWhitelist(penaltyForwarder.address, true);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await extraRewardsDistributor.transferOwnership(multisigs.daoMultisig);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await pooledOptionsExerciser.setOwner(multisigs.daoMultisig);
        await waitForTx(tx, debug, waitForBlocks);

        tx = await flashOptionsExerciser.setOwner(multisigs.daoMultisig);
        await waitForTx(tx, debug, waitForBlocks);

        // Impersonate Bunni governance and fund it with 10 ETH
        await impersonateAccount(smartWalletCheckerOwnerAddress, true);
        const smartWalletCheckerGovernance = await ethers.getSigner(smartWalletCheckerOwnerAddress);

        // Whitelist Liq VoterProxy in Bunni Voting Escrow
        const smartWalletChecker = await ethers.getContractAt(
            smartWalletCheckerABI,
            smartWalletCheckerContractAddress,
            smartWalletCheckerGovernance,
        );
        await smartWalletChecker.connect(smartWalletCheckerGovernance).allowlistAddress(voterProxy.address);
        console.log("smartWalletChecker: ", smartWalletChecker.address);

        // Instance of crvBpt
        crvBpt = (await ethers.getContractAt("IERC20Extra", tokenBptAddress)) as IERC20Extra;

        // Impersonate and fund crvBpt whale
        await impersonateAccount(crvBptHolderAddress, true);
        const crvBptHolder = await ethers.getSigner(crvBptHolderAddress);
        await crvBpt.connect(crvBptHolder).transfer(deployerAddress, e18.mul(32000));
        console.log("deployer funded with crvBpt: ", (await crvBpt.balanceOf(deployerAddress)).toString());

        // Need to create the initial lock
        tx = await crvBpt.transfer(voterProxy.address, e18.mul(100));
        await waitForTx(tx, debug, waitForBlocks);
        tx = await crvDepositor.connect(daoMultisigSigner).initialLock();
        await waitForTx(tx, debug, waitForBlocks);

        // Instance of weth
        weth = (await ethers.getContractAt("IERC20Extra", externalAddresses.weth)) as IERC20Extra;

        // Need to fund with weth as well
        await impersonateAccount(wethHolderAddress, true);
        const wethHolder = await ethers.getSigner(wethHolderAddress);
        await weth.connect(wethHolder).transfer(deployerAddress, e18.mul(1000));

        console.log(`\n~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
        console.log(`~~~~ DEPLOYMENT FINISH ~~~~`);
        console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~\n`);

        // Need to make an initial lock require(lockedSupply >= 1e20, "!balance");
        const operatorAccount = await impersonateAccount(booster.address);
        tx = await liq.connect(operatorAccount.signer).mint(deployerAddress, e18.mul(1000));
        await tx.wait();
        tx = await liq.approve(liqLocker.address, e18.mul(1000));
        await tx.wait();
        tx = await liqLocker.lock(aliceAddress, e18.mul(100));
        await tx.wait();
        tx = await liqLocker.lock(deployerAddress, e18.mul(100));
        await tx.wait();

        // Instance of LIT & oLIT & veLIT
        lit = (await ethers.getContractAt("IERC20Extra", litAddress)) as IERC20Extra;
        olit = (await ethers.getContractAt("IERC20Extra", olitAddress)) as IERC20Extra;
        velit = (await ethers.getContractAt("IERC20Extra", votingEscrowAddress)) as IERC20Extra;

        // Initial lock already created in
        console.log("deployer crvBptBalance: ", (await crvBpt.balanceOf(deployerAddress)).toString());
        console.log("voterProxyInitialVeLitBalance: ", (await velit.balanceOf(voterProxy.address)).toString());

        // Impersonate LIT whale
        await impersonateAccount(litHolderAddress, true);
        const litHolder = await ethers.getSigner(litHolderAddress);
        await lit.connect(litHolder).transfer(deployerAddress, e18.mul(1000000));
        console.log("deployerLitBalance: ", (await lit.balanceOf(deployerAddress)).toString());

        await lit.connect(deployer).approve(litDepositorHelper.address, e18.mul(1000000));
        const minOut = await litDepositorHelper.getMinOut(e18.mul(1000000), 9900);
        await litDepositorHelper.deposit(e18.mul(1000000), ZERO, true, ZERO_ADDRESS);
        console.log("deployerBptMinOut: ", +minOut);
        console.log("deployerVeLitBalance: ", (await velit.balanceOf(deployerAddress)).toString());
        console.log("voterProxyVeLitBalance: ", (await velit.balanceOf(voterProxy.address)).toString());

        // Register the array of pools in the Booster
        const gaugeLength = externalAddresses.gauges.length;
        for (let i = 0; i < gaugeLength; i++) {
            const tx = await poolManager["addPool(address)"](externalAddresses.gauges[i]);
            await waitForTx(tx, debug, waitForBlocks);
        }
        console.log("poolLength: ", (await booster.poolLength()).toNumber());

        // Create liquidity in Bunni
        usdc = (await ethers.getContractAt("IERC20Extra", usdcAddress)) as IERC20Extra;
        lpTokenUsdcWeth = (await ethers.getContractAt("IERC20Extra", lpTokenUsdcWethAddress)) as IERC20Extra;

        // Impersonate USDC whale
        await impersonateAccount(usdcHolderAddress, true);
        const usdcHolder = await ethers.getSigner(usdcHolderAddress);
        await usdc.connect(usdcHolder).transfer(deployerAddress, e6.mul(1000000));
        console.log("deployerUsdcBalance: ", (await usdc.balanceOf(deployerAddress)).toString());

        // Instance of bunniHub
        const bunniHub = await ethers.getContractAt(bunniHubABI, bunniHubContractAddress, deployer);

        await usdc.connect(deployer).approve(bunniHub.address, e6.mul(1000000));
        await weth.connect(deployer).approve(bunniHub.address, e18.mul(1000));

        const blockNumber = (await ethers.provider.getBlock("latest")).number; // works in 16854887
        const blockTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
        console.log("blockTimestamp: ", blockTimestamp);
        console.log("blockNumber: ", blockNumber);
        await bunniHub.deposit([
            ["0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640", 191150, 214170],
            e6.mul(1000000),
            e18.mul(1000),
            ZERO,
            ZERO,
            blockTimestamp + 100,
            deployerAddress,
        ]);
        const lpTokenUsdcWethBalance = await lpTokenUsdcWeth.balanceOf(deployerAddress);
        console.log("deployerLpTokenBalance: ", lpTokenUsdcWethBalance.toString());

        await lpTokenUsdcWeth.connect(deployer).transfer(aliceAddress, e15.mul(10));
        await lpTokenUsdcWeth.connect(deployer).approve(booster.address, e15.mul(20));
        tx = await booster.connect(deployer).deposit(0, e15.mul(20), true);
        let txData = await tx.wait();
        console.log("gasUsed deposited Booster:", txData.cumulativeGasUsed.toNumber());

        const poolInfo1 = await booster.poolInfo(0);

        rewardPool4626_1 = BaseRewardPool4626__factory.connect(poolInfo1.crvRewards, deployer);
        await lpTokenUsdcWeth.connect(deployer).approve(rewardPool4626_1.address, e15.mul(10));
        tx = await rewardPool4626_1.connect(deployer).deposit(e15.mul(10), deployerAddress);
        txData = await tx.wait();
        console.log("gasUsed deposited BaseReward:", txData.cumulativeGasUsed.toNumber());

        const depositTokenAddress = poolInfo1.token;
        const depositToken = (await ethers.getContractAt("IERC20Extra", depositTokenAddress)) as IERC20Extra;
        console.log("deployerDepositTokenBalance: ", (await depositToken.balanceOf(deployerAddress)).toString());

        // Instance of litRewardPool1
        rewardPool1 = (await ethers.getContractAt("BaseRewardPool", poolInfo1.crvRewards, deployer)) as BaseRewardPool;
        console.log("deployerRewardPool1TokenBalance: ", (await rewardPool1.balanceOf(deployerAddress)).toString());
        console.log("totalSupplyRewardPool1: ", (await rewardPool1.totalSupply()).toString());

        // allow flashOptionsExerciser permissions in rewardPools
        tx = await cvxCrvRewards.modifyPermission(flashOptionsExerciser.address, true);
        tx = await rewardPool1.modifyPermission(flashOptionsExerciser.address, true);
        await waitForTx(tx, debug, waitForBlocks);

        // Instance of new lpToken
        lpTokenFraxUsdc = (await ethers.getContractAt("IERC20Extra", lpTokenFraxUsdcAddress)) as IERC20Extra;

        // Impersonate and fund fraxUsdc whale
        await impersonateAccount(lpTokenFraxUsdcHolder, true);
        const fraxUsdcHolder = await ethers.getSigner(lpTokenFraxUsdcHolder);
        await lpTokenFraxUsdc.connect(fraxUsdcHolder).transfer(aliceAddress, e15.mul(350));
        console.log("alice funded with lpTokenFraxUsdc: ", (await lpTokenFraxUsdc.balanceOf(aliceAddress)).toString());

        await lpTokenFraxUsdc.connect(alice).approve(booster.address, e15.mul(350));
        await booster.connect(alice).deposit(1, e15.mul(350), true);

        // Also deposit with Alice in pid 0
        await lpTokenUsdcWeth.connect(alice).approve(booster.address, e15.mul(10));
        await booster.connect(alice).deposit(0, e15.mul(10), true);

        await increaseTime(60 * 60 * 24 * 3);

        const poolInfo2 = await booster.poolInfo(1);

        rewardPool4626_2 = BaseRewardPool4626__factory.connect(poolInfo2.crvRewards, deployer);

        // Instance of litRewardPool2
        rewardPool2 = (await ethers.getContractAt("BaseRewardPool", poolInfo2.crvRewards, deployer)) as BaseRewardPool;
        console.log("aliceRewardPool2TokenBalance: ", (await rewardPool2.balanceOf(aliceAddress)).toString());
        console.log("totalSupplyRewardPool2: ", (await rewardPool2.totalSupply()).toString());

        // allow flashOptionsExerciser permissions in rewardPools
        tx = await rewardPool1.connect(alice).modifyPermission(flashOptionsExerciser.address, true);
        tx = await rewardPool2.connect(alice).modifyPermission(flashOptionsExerciser.address, true);
        tx = await cvxCrvRewards.connect(alice).modifyPermission(flashOptionsExerciser.address, true);
        await waitForTx(tx, debug, waitForBlocks);

        await booster.connect(bob).earmarkRewards(0); // Bob will receive some tokens for being the caller

        console.log("oLitBoosterBalance: ", (await olit.balanceOf(booster.address)).toString());
        console.log("bobOLitBalance: ", (await olit.balanceOf(bobAddress)).toString());

        await booster.connect(bob).earmarkRewards(1); // Bob will receive some tokens for being the caller

        console.log("oLitBoosterBalance: ", (await olit.balanceOf(booster.address)).toString());
        console.log("bobOLitBalance: ", (await olit.balanceOf(bobAddress)).toString());
    };

    before(async () => {
        // As we are impersonating different accounts, we fix the block number in which we run the test
        await hre.network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: process.env.NODE_URL,
                        blockNumber: FORK_BLOCK_NUMBER,
                    },
                },
            ],
        });

        [deployer, alice, bob] = await ethers.getSigners();
        deployerAddress = await deployer.getAddress();
        aliceAddress = await alice.getAddress();
        bobAddress = await bob.getAddress();
    });

    describe("Post PrelaunchDeploy", async () => {
        before(async () => {
            await setup();
        });

        it("Contracts are deployed, a couple of pools added and rewards are earmarked", async () => {
            const bobOLitBalance = await olit.balanceOf(bobAddress);
            const lockingOLitBalance = await olit.balanceOf(liqLocker.address);
            const stakingOLitBalance = await olit.balanceOf(cvxCrvRewards.address);
            const aliceOLitBalance = await olit.balanceOf(aliceAddress);
            const deployerOLitBalance = await olit.balanceOf(deployerAddress);

            expect(bobOLitBalance).gt(ZERO); // bob calls the earmarkRewards
            expect(lockingOLitBalance).gt(ZERO);
            expect(stakingOLitBalance).gt(ZERO);

            expect(aliceOLitBalance).eq(ZERO); // alice does not intervene
            expect(deployerOLitBalance).eq(ZERO); // deployer does not intervene
        });
    });
});
