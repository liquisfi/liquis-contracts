import hre, { ethers, network } from "hardhat";
import { expect, assert } from "chai";
import {
    Booster,
    BoosterOwner,
    VoterProxy,
    VoterProxy__factory,
    CvxCrvToken,
    CrvDepositor,
    BaseRewardPool,
    CrvDepositorWrapper,
    IERC20Extra,
    PoolManagerV3,
    OptionsExerciser,
    LiqLocker,
} from "../types/generated";
import { Signer } from "ethers";
import { increaseTime, increaseTimeTo } from "../test-utils/time";
import { ONE_WEEK, ZERO_ADDRESS, ZERO, e18, e15, e6 } from "../test-utils/constants";
import { deployContract, waitForTx } from "../tasks/utils";
import { impersonateAccount, fullScale } from "../test-utils";

import { deployPhase2, Phase1Deployed, MultisigConfig, ExtSystemConfig } from "../scripts/deploySystem";
import { getMockDistro } from "../scripts/deployMocks";
import { logContracts } from "../tasks/utils/deploy-utils";

import smartWalletCheckerABI from "../abi/smartWalletChecker.json";
import bunniHubABI from "../abi/bunniHub.json";

// yarn hardhat --config hardhat-fork.config.ts test ./test-liquis/OptionsExerciser.spec.ts

const hreAddress: string = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

const externalAddresses: ExtSystemConfig = {
    token: "0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa", // oLIT
    lit: "0xfd0205066521550D7d7AB19DA8F72bb004b4C341", // LIT
    tokenBpt: "0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C", // BAL 20-80 WETH/LIT
    tokenWhale: "0xb8F26C1Cc45ab62fd750E08957fBa5738094bbDB",
    minter: "0xF087521Ffca0Fa8A43F5C445773aB37C5f574DA0",
    votingEscrow: "0xf17d23136B4FeAd139f54fB766c8795faae09660",
    feeDistribution: hreAddress,
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
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    wethWhale: "0x57757E3D981446D585Af0D9Ae4d7DF6D64647806",
    voteOwnership: hreAddress,
    voteParameter: hreAddress,
};

const naming = {
    cvxName: "Aura",
    cvxSymbol: "AURA",
    vlCvxName: "Vote Locked Aura",
    vlCvxSymbol: "vlAURA",
    cvxCrvName: "Aura BAL",
    cvxCrvSymbol: "auraBAL",
    tokenFactoryNamePostfix: " Aura Deposit",
};

type Pool = {
    lptoken: string;
    token: string;
    gauge: string;
    crvRewards: string;
    stash: string;
    shutdown: boolean;
};

const debug = false;
const waitForBlocks = 0;

describe("Booster", () => {
    let accounts: Signer[];
    let booster: Booster;
    let boosterOwner: BoosterOwner;
    let optionsExerciser: OptionsExerciser;

    let cvxCrvRewards: BaseRewardPool;
    let cvxCrv: CvxCrvToken;
    let cvxLocker: LiqLocker;

    let crvDepositor: CrvDepositor;
    let crvDepositorWrapper: CrvDepositorWrapper;
    let poolManager: PoolManagerV3;

    let pool: Pool;
    let daoSigner: Signer;

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

    const smartWalletCheckerContractAddress: string = "0x0ccdf95baf116ede5251223ca545d0ed02287a8f";
    const smartWalletCheckerOwnerAddress: string = "0x9a8fee232dcf73060af348a1b62cdb0a19852d13";

    const minterAddress: string = "0xF087521Ffca0Fa8A43F5C445773aB37C5f574DA0";
    const olitAddress: string = "0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa";
    const litAddress: string = "0xfd0205066521550D7d7AB19DA8F72bb004b4C341";
    const tokenBptAddress: string = "0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C";
    const votingEscrowAddress: string = "0xf17d23136B4FeAd139f54fB766c8795faae09660";
    const gaugeControllerAddress: string = "0x901c8aA6A61f74aC95E7f397E22A0Ac7c1242218";

    const litHolderAddress: string = "0x63F2695207f1d625a9B0B8178D95cD517bC5E82C";
    const usdcHolderAddress: string = "0x55FE002aefF02F77364de339a1292923A15844B8";
    const wethHolderAddress: string = "0x57757E3D981446D585Af0D9Ae4d7DF6D64647806";
    const crvBptHolderAddress: string = "0xb8F26C1Cc45ab62fd750E08957fBa5738094bbDB";
    const olitHolderAddress: string = "0x5f350bF5feE8e254D6077f8661E9C7B83a30364e"; // 224k

    const lpTokenUsdcWethAddress: string = "0x680026A1C99a1eC9878431F730706810bFac9f31"; // Bunni USDC/WETH LP (BUNNI-LP)
    const lpTokenFraxUsdcAddress: string = "0x088DCFE115715030d441a544206CD970145F3941"; // Bunni FRAX/USDC LP (BUNNI-LP)
    const lpTokenFraxUsdcHolder: string = "0x5180db0237291A6449DdA9ed33aD90a38787621c";

    const usdcAddress: string = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

    const bunniHubContractAddress: string = "0xb5087F95643A9a4069471A28d32C569D9bd57fE4";

    const FORK_BLOCK_NUMBER: number = 16875673;

    const setup = async () => {
        // Deploy Voter Proxy, get whitelisted on Bunni system
        const voterProxy = await deployContract<VoterProxy>(
            hre,
            new VoterProxy__factory(deployer),
            "VoterProxy",
            [minterAddress, olitAddress, tokenBptAddress, votingEscrowAddress, gaugeControllerAddress],
            {},
            debug,
            waitForBlocks,
        );
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
        await crvBpt.connect(crvBptHolder).transfer(deployerAddress, e18.mul(100000));
        console.log("deployer funded with crvBpt: ", (await crvBpt.balanceOf(deployerAddress)).toString());

        // Instance of weth
        weth = (await ethers.getContractAt("IERC20Extra", externalAddresses.weth)) as IERC20Extra;

        // Need to fund with weth as well
        await impersonateAccount(wethHolderAddress, true);
        const wethHolder = await ethers.getSigner(wethHolderAddress);
        await weth.connect(wethHolder).transfer(deployerAddress, e18.mul(1000));

        const phase1: Phase1Deployed = {
            voterProxy: voterProxy,
        };

        const multisigs: MultisigConfig = {
            vestingMultisig: deployerAddress,
            treasuryMultisig: deployerAddress,
            daoMultisig: deployerAddress,
        };

        const distroList = getMockDistro();

        const phase2 = await deployPhase2(
            hre,
            deployer,
            phase1,
            distroList,
            multisigs,
            naming,
            externalAddresses,
            debug,
            waitForBlocks,
        );
        logContracts(phase2 as unknown as { [key: string]: { address: string } });

        ({
            booster,
            boosterOwner,
            crvDepositor,
            crvDepositorWrapper,
            poolManager,
            optionsExerciser,
            cvxCrvRewards,
            cvxCrv,
            cvxLocker,
        } = phase2);

        console.log(`\n~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
        console.log(`~~~~ DEPLOYMENT FINISH ~~~~`);
        console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~\n`);

        // Need to make an initial lock require(lockedSupply >= 1e20, "!balance");
        const operatorAccount = await impersonateAccount(booster.address);
        let tx = await phase2.cvx.connect(operatorAccount.signer).mint(operatorAccount.address, e18.mul(1000));
        await tx.wait();
        tx = await phase2.cvx.connect(operatorAccount.signer).transfer(deployerAddress, e18.mul(1000));
        await tx.wait();
        tx = await phase2.cvx.approve(phase2.cvxLocker.address, e18.mul(1000));
        await tx.wait();
        tx = await phase2.cvxLocker.lock(aliceAddress, e18.mul(100));
        await tx.wait();
        tx = await phase2.cvxLocker.lock(deployerAddress, e18.mul(100));
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

        await lit.connect(deployer).approve(crvDepositorWrapper.address, e18.mul(1000000));
        const minOut = await crvDepositorWrapper.getMinOut(e18.mul(1000000), 9900);
        await crvDepositorWrapper.deposit(e18.mul(1000000), ZERO, true, ZERO_ADDRESS);
        console.log("deployerBptMinOut: ", +minOut);
        console.log("deployerVeLitBalance: ", (await velit.balanceOf(deployerAddress)).toString());
        console.log("voterProxyVeLitBalance: ", (await velit.balanceOf(voterProxy.address)).toString());

        // Register the array of pools in the Booster
        const gaugeLength = externalAddresses.gauges.length;
        for (let i = 0; i < gaugeLength; i++) {
            let tx = await poolManager["addPool(address)"](externalAddresses.gauges[i]);
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

        let blockNumber = (await ethers.provider.getBlock("latest")).number; // works in 16854887
        let blockTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
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
        await lpTokenUsdcWeth.connect(deployer).approve(booster.address, e15.mul(40));
        await booster.connect(deployer).deposit(0, e15.mul(40), true);

        const poolInfo1 = await booster.poolInfo(0);
        const depositTokenAddress = poolInfo1.token;
        const depositToken = (await ethers.getContractAt("IERC20Extra", depositTokenAddress)) as IERC20Extra;
        console.log("deployerDepositTokenBalance: ", (await depositToken.balanceOf(deployerAddress)).toString());

        // Instance of litRewardPool1
        rewardPool1 = (await ethers.getContractAt("BaseRewardPool", poolInfo1.crvRewards, deployer)) as BaseRewardPool;
        console.log("deployerRewardPool1TokenBalance: ", (await rewardPool1.balanceOf(deployerAddress)).toString());
        console.log("totalSupplyRewardPool1: ", (await rewardPool1.totalSupply()).toString());

        // allow optionsExerciser permissions in rewardPool2
        tx = await rewardPool1.modifyPermission(optionsExerciser.address, true);
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

        // Instance of litRewardPool2
        rewardPool2 = (await ethers.getContractAt("BaseRewardPool", poolInfo2.crvRewards, deployer)) as BaseRewardPool;
        console.log("aliceRewardPool2TokenBalance: ", (await rewardPool2.balanceOf(aliceAddress)).toString());
        console.log("totalSupplyRewardPool2: ", (await rewardPool2.totalSupply()).toString());

        // allow optionsExerciser permissions in rewardPools
        tx = await rewardPool1.connect(alice).modifyPermission(optionsExerciser.address, true);
        tx = await rewardPool2.connect(alice).modifyPermission(optionsExerciser.address, true);
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

        [deployer, alice, bob, daoSigner] = await ethers.getSigners();
        deployerAddress = await deployer.getAddress();
        aliceAddress = await alice.getAddress();
        bobAddress = await bob.getAddress();
    });

    describe("new OptionsExerciser with flashloan functionality", async () => {
        before(async () => {
            await setup();
        });

        it("distributes oLIT to BaseRewardPool, to caller, to locking and to staker address", async () => {
            const bobOLitBalance = await olit.balanceOf(bobAddress);
            const lockingOLitBalance = await olit.balanceOf(cvxLocker.address);
            const stakingOLitBalance = await olit.balanceOf(cvxCrvRewards.address);
            const aliceOLitBalance = await olit.balanceOf(aliceAddress);
            const deployerOLitBalance = await olit.balanceOf(deployerAddress);

            expect(bobOLitBalance).gt(ZERO); // bob calls the earmarkRewards
            expect(lockingOLitBalance).gt(ZERO);
            expect(stakingOLitBalance).gt(ZERO);

            expect(aliceOLitBalance).eq(ZERO); // alice does not intervene
            expect(deployerOLitBalance).eq(ZERO); // deployer does not intervene
        });

        it("optionsExerciser address is properly initialized in BaseRewardPools", async () => {
            const hasRole1 = await rewardPool1.hasPermission(deployerAddress, optionsExerciser.address);
            const hasRole2 = await rewardPool2.hasPermission(aliceAddress, optionsExerciser.address);

            assert.isTrue(hasRole1);
            assert.isTrue(hasRole2);
        });

        it("deployer earned in rewardPool1 increases with time", async () => {
            // Balance should be > 0 as an extra earmarkRewards call has been done
            const earnedDeployer1 = await rewardPool1.earned(deployerAddress);
            console.log("earnedOLitBalance: ", earnedDeployer1.toString());
            expect(earnedDeployer1).gt(ZERO);

            await increaseTime(1000);

            const earnedDeployer1AfterTime = await rewardPool1.earned(deployerAddress);
            console.log("earnedOLitBalance after some blocks (1000s): ", earnedDeployer1AfterTime.toString());
            expect(earnedDeployer1AfterTime).gt(earnedDeployer1);

            // In the second pool deployer did not deposit
            const earnedDeployer2 = await rewardPool2.earned(deployerAddress);
            expect(earnedDeployer2).eq(ZERO);
        });

        it("deployer claims LIT from rewardPool claimExtra false", async () => {
            await rewardPool1["getReward(address,bool)"](deployerAddress, false);

            const deployerLitBalance = await lit.balanceOf(deployerAddress);
            const deployerOLitBalance = await olit.balanceOf(deployerAddress);

            console.log("deployerLitBalance: ", deployerLitBalance.toString());
            console.log("deployerOLitBalance: ", deployerOLitBalance.toString());

            expect(deployerLitBalance).eq(ZERO);
            expect(deployerOLitBalance).gt(ZERO);
        });

        it("olit rewards are in rewardPool1 contract", async () => {
            const rewardPool1Bal = await olit.balanceOf(rewardPool1.address);
            console.log("rewardPoolOLitBalance: ", rewardPool1Bal.toString());
            expect(rewardPool1Bal).gt(ZERO);
        });

        it("exerciseAndLock function works properly, liqLit balance increases", async () => {
            const olitWhaleBalBefore = await olit.balanceOf(olitHolderAddress);
            const liqLitWhaleBalBefore = await cvxCrv.balanceOf(olitHolderAddress);
            console.log("liqLitWhaleBalBefore: ", liqLitWhaleBalBefore.toString());

            const stakingBalBefore = await cvxCrvRewards.balanceOf(olitHolderAddress);

            await impersonateAccount(olitHolderAddress, true);
            const olitWhale = await ethers.getSigner(olitHolderAddress);

            await olit.connect(olitWhale).approve(optionsExerciser.address, e18.mul(10000));
            await optionsExerciser.connect(olitWhale).exerciseAndLock(e18.mul(10000), 9800, false);

            const olitWhaleBalAfter = await olit.balanceOf(olitHolderAddress);
            const liqLitWhaleBalAfter = await cvxCrv.balanceOf(olitHolderAddress);
            console.log("liqLitWhaleBalAfter: ", liqLitWhaleBalAfter.toString());

            expect(olitWhaleBalBefore.sub(olitWhaleBalAfter)).eq(e18.mul(10000));
            expect(liqLitWhaleBalAfter).gt(liqLitWhaleBalBefore);

            expect(stakingBalBefore).eq(ZERO);

            const stakingBalAfter = await cvxCrvRewards.balanceOf(olitHolderAddress);
            expect(stakingBalAfter.sub(stakingBalBefore)).eq(ZERO); // staking bal does not change

            // Check that no funds are left in the contract
            const litContractBalAfter = await lit.balanceOf(optionsExerciser.address);
            const olitContractBalAfter = await olit.balanceOf(optionsExerciser.address);
            const liqLitContractBalAfter = await cvxCrv.balanceOf(optionsExerciser.address);
            expect(litContractBalAfter).eq(ZERO);
            expect(olitContractBalAfter).eq(ZERO);
            expect(liqLitContractBalAfter).eq(ZERO);

            expect(await weth.balanceOf(optionsExerciser.address)).eq(ZERO);
        });

        it("exerciseAndLock function with staking works properly", async () => {
            const olitWhaleBalBefore = await olit.balanceOf(olitHolderAddress);
            const liqLitWhaleBalBefore = await cvxCrv.balanceOf(olitHolderAddress);

            const stakingBalBefore = await cvxCrvRewards.balanceOf(olitHolderAddress);
            console.log("stakingBalBefore: ", stakingBalBefore.toString());

            await impersonateAccount(olitHolderAddress, true);
            const olitWhale = await ethers.getSigner(olitHolderAddress);

            await olit.connect(olitWhale).approve(optionsExerciser.address, e18.mul(10000));
            await optionsExerciser.connect(olitWhale).exerciseAndLock(e18.mul(10000), 9800, true);

            const olitWhaleBalAfter = await olit.balanceOf(olitHolderAddress);
            const liqLitWhaleBalAfter = await cvxCrv.balanceOf(olitHolderAddress);

            expect(olitWhaleBalAfter).lt(olitWhaleBalBefore);
            expect(liqLitWhaleBalAfter).eq(liqLitWhaleBalBefore);

            const stakingBalAfter = await cvxCrvRewards.balanceOf(olitHolderAddress);
            expect(stakingBalAfter.sub(stakingBalBefore)).gt(ZERO); // staking bal increases
            console.log("stakingBalAfter: ", stakingBalAfter.toString());

            // Check that no funds are left in the contract
            const litContractBalAfter = await lit.balanceOf(optionsExerciser.address);
            const olitContractBalAfter = await olit.balanceOf(optionsExerciser.address);
            const liqLitContractBalAfter = await cvxCrv.balanceOf(optionsExerciser.address);
            expect(litContractBalAfter).eq(ZERO);
            expect(olitContractBalAfter).eq(ZERO);
            expect(liqLitContractBalAfter).eq(ZERO);

            expect(await weth.balanceOf(optionsExerciser.address)).eq(ZERO);
        });

        it("claimAndExercise function works properly, lit balance increases", async () => {
            await increaseTime(60 * 60 * 24 * 1);
            await booster.connect(bob).earmarkRewards(0);
            await increaseTime(60 * 60 * 24 * 1);

            const litDeployerBalBefore = await lit.balanceOf(deployerAddress);
            const olitDeployerBalBefore = await olit.balanceOf(deployerAddress);
            const liqLitDeployerBalBefore = await cvxCrv.balanceOf(deployerAddress);
            console.log("litDeployerBalBefore: ", litDeployerBalBefore.toString());

            await optionsExerciser.claimAndExercise(0);

            const litDeployerBalAfter = await lit.balanceOf(deployerAddress);
            const olitDeployerBalAfter = await olit.balanceOf(deployerAddress);
            const liqLitDeployerBalAfter = await cvxCrv.balanceOf(deployerAddress);
            console.log("litDeployerBalAfter: ", litDeployerBalAfter.toString());

            expect(litDeployerBalBefore).eq(ZERO);

            expect(litDeployerBalAfter).gt(litDeployerBalBefore);
            expect(olitDeployerBalAfter).eq(olitDeployerBalBefore);
            expect(liqLitDeployerBalAfter).eq(liqLitDeployerBalBefore);

            // Check that no funds are left in the contract
            const litContractBalAfter = await lit.balanceOf(optionsExerciser.address);
            const olitContractBalAfter = await olit.balanceOf(optionsExerciser.address);
            const liqLitContractBalAfter = await cvxCrv.balanceOf(optionsExerciser.address);
            expect(litContractBalAfter).eq(ZERO);
            expect(olitContractBalAfter).eq(ZERO);
            expect(liqLitContractBalAfter).eq(ZERO);
        });

        it("claimAndLock function works properly, liqLit balance increases", async () => {
            await increaseTime(60 * 60 * 24 * 1);
            await booster.connect(bob).earmarkRewards(0);
            await increaseTime(60 * 60 * 24 * 1);

            const litDeployerBalBefore = await lit.balanceOf(deployerAddress);
            const olitDeployerBalBefore = await olit.balanceOf(deployerAddress);
            const liqLitDeployerBalBefore = await cvxCrv.balanceOf(deployerAddress);
            console.log("liqLitDeployerBalBefore: ", liqLitDeployerBalBefore.toString());

            await optionsExerciser.claimAndLock(0, 9800, false);

            const litDeployerBalAfter = await lit.balanceOf(deployerAddress);
            const olitDeployerBalAfter = await olit.balanceOf(deployerAddress);
            const liqLitDeployerBalAfter = await cvxCrv.balanceOf(deployerAddress);
            console.log("liqLitDeployerBalAfter: ", liqLitDeployerBalAfter.toString());

            expect(litDeployerBalAfter).eq(litDeployerBalBefore);
            expect(olitDeployerBalAfter).eq(olitDeployerBalBefore);
            expect(liqLitDeployerBalAfter).gt(liqLitDeployerBalBefore);

            // Check that no funds are left in the contract
            const litContractBalAfter = await lit.balanceOf(optionsExerciser.address);
            const olitContractBalAfter = await olit.balanceOf(optionsExerciser.address);
            const liqLitContractBalAfter = await cvxCrv.balanceOf(optionsExerciser.address);
            expect(litContractBalAfter).eq(ZERO);
            expect(olitContractBalAfter).eq(ZERO);
            expect(liqLitContractBalAfter).eq(ZERO);
        });

        it("claimAndLockMultiple function works properly, locker false", async () => {
            await increaseTime(60 * 60 * 24 * 1);
            await booster.connect(bob).earmarkRewards(0);
            await booster.connect(bob).earmarkRewards(1);
            await increaseTime(60 * 60 * 24 * 1);

            const earnedAlice0 = await rewardPool1.earned(aliceAddress);
            const earnedAlice1 = await rewardPool2.earned(aliceAddress);

            // Alice has rewards from both pools
            expect(earnedAlice0).gt(ZERO);
            expect(earnedAlice1).gt(ZERO);

            const liqLitAliceBalBefore = await cvxCrv.balanceOf(aliceAddress);
            console.log("liqLitAliceBalBefore: ", liqLitAliceBalBefore.toString());

            await optionsExerciser.connect(alice).claimAndLockMultiple([0, 1], false, 9800, false);

            const liqLitAliceBalAfter = await cvxCrv.balanceOf(aliceAddress);
            console.log("liqLitAliceBalAfter: ", liqLitAliceBalAfter.toString());

            expect(liqLitAliceBalAfter).gt(liqLitAliceBalBefore);

            // Check that no funds are left in the contract
            const litContractBalAfter = await lit.balanceOf(optionsExerciser.address);
            const olitContractBalAfter = await olit.balanceOf(optionsExerciser.address);
            const liqLitContractBalAfter = await cvxCrv.balanceOf(optionsExerciser.address);
            expect(litContractBalAfter).eq(ZERO);
            expect(olitContractBalAfter).eq(ZERO);
            expect(liqLitContractBalAfter).eq(ZERO);
        });

        it("fails to call protected functions if is not OptionsExerciser", async () => {
            const accounts = await ethers.getSigners();
            const randomUser = accounts[10];
            const randomUserAddress = await randomUser.getAddress();

            await expect(rewardPool1.connect(randomUser).getRewardFor(deployerAddress, true)).to.be.revertedWith(
                "permission not granted",
            );
            await expect(rewardPool2.connect(randomUser).getRewardFor(aliceAddress, true)).to.be.revertedWith(
                "permission not granted",
            );
        });

        it("fails to call protected functions if is not Owner", async () => {
            const accounts = await ethers.getSigners();
            const randomUser = accounts[12];
            const randomUserAddress = await randomUser.getAddress();

            const owner = await optionsExerciser.owner();
            expect(owner).eq(deployerAddress);

            await expect(optionsExerciser.connect(randomUser).setOwner(randomUserAddress)).to.be.revertedWith("!auth");
            await expect(optionsExerciser.connect(randomUser).setOracleParams(100, 10)).to.be.revertedWith("!auth");
            await expect(
                optionsExerciser.connect(randomUser).setOperationalParams(1000, 100, "0x00"),
            ).to.be.revertedWith("!auth");
        });

        it("random user has no permission in BaseRewardPools", async () => {
            const accounts = await ethers.getSigners();
            const randomUser = accounts[14];
            const randomUserAddress = await randomUser.getAddress();

            const hasPermission1 = await rewardPool1.hasPermission(deployerAddress, randomUserAddress);
            const hasPermission2 = await rewardPool2.hasPermission(aliceAddress, randomUserAddress);

            assert.isFalse(hasPermission1);
            assert.isFalse(hasPermission2);
        });
    });
});
