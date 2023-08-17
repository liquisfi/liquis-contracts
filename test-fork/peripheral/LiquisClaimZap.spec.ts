import hre, { ethers } from "hardhat";
import { expect } from "chai";
import {
    Booster,
    VoterProxy,
    VoterProxy__factory,
    CvxCrvToken,
    BaseRewardPool,
    BaseRewardPool4626,
    BaseRewardPool4626__factory,
    LitDepositorHelper,
    IERC20Extra,
    PoolManagerV3,
    LiqLocker,
    LiquisClaimZap,
    LiquisClaimZap__factory,
    LiqToken,
} from "../../types/generated";
import { Signer } from "ethers";
import { increaseTime } from "../../test-utils/time";
import { ZERO_ADDRESS, ZERO, e18, e15, e6 } from "../../test-utils/constants";
import { deployContract, waitForTx } from "../../tasks/utils";
import { impersonateAccount, assertBNClosePercent } from "../../test-utils";

import { deployPhase2, Phase1Deployed, MultisigConfig, ExtSystemConfig } from "../../scripts/deploySystem";
import { getMockDistro } from "../../scripts/deployMocks";
import { logContracts } from "../../tasks/utils/deploy-utils";

import smartWalletCheckerABI from "../../abi/smartWalletChecker.json";
import bunniHubABI from "../../abi/bunniHub.json";

// yarn hardhat --config hardhat-fork.config.ts test ./test-fork/peripheral/LiquisClaimZap.spec.ts

const hreAddress: string = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

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

const debug = false;
const waitForBlocks = 0;

const Options = {
    None: 0,
    ClaimLiqLit: 1,
    ClaimLockedLiq: 2,
    UseAllLiqFunds: 4,
    LockLiq: 8,
};

describe("Booster", () => {
    let booster: Booster;

    let cvx: LiqToken;
    let cvxCrvRewards: BaseRewardPool;
    let cvxCrv: CvxCrvToken;
    let cvxLocker: LiqLocker;

    let litDepositorHelper: LitDepositorHelper;
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

    let claimZap: LiquisClaimZap;

    const smartWalletCheckerContractAddress: string = "0x0ccdf95baf116ede5251223ca545d0ed02287a8f";
    const smartWalletCheckerOwnerAddress: string = "0x9a8fee232dcf73060af348a1b62cdb0a19852d13";

    const minterAddress: string = "0xF087521Ffca0Fa8A43F5C445773aB37C5f574DA0";
    const olitAddress: string = "0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa";
    const litAddress: string = "0xfd0205066521550D7d7AB19DA8F72bb004b4C341";
    const tokenBptAddress: string = "0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C";
    const votingEscrowAddress: string = "0xf17d23136B4FeAd139f54fB766c8795faae09660";
    const gaugeControllerAddress: string = "0x901c8aA6A61f74aC95E7f397E22A0Ac7c1242218";

    const litHolderAddress: string = "0x63F2695207f1d625a9B0B8178D95cD517bC5E82C"; // 10M
    const usdcHolderAddress: string = "0x55FE002aefF02F77364de339a1292923A15844B8";
    const wethHolderAddress: string = "0x57757E3D981446D585Af0D9Ae4d7DF6D64647806";
    const crvBptHolderAddress: string = "0xb84dfdD51d18B1613432bfaE91dfcC48899D4151"; // 32k

    const lpTokenUsdcWethAddress: string = "0x680026A1C99a1eC9878431F730706810bFac9f31"; // Bunni USDC/WETH LP (BUNNI-LP)
    const lpTokenFraxUsdcAddress: string = "0x088DCFE115715030d441a544206CD970145F3941"; // Bunni FRAX/USDC LP (BUNNI-LP)
    const lpTokenFraxUsdcHolder: string = "0x5180db0237291A6449DdA9ed33aD90a38787621c";

    const usdcAddress: string = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

    const bunniHubContractAddress: string = "0xb5087F95643A9a4069471A28d32C569D9bd57fE4";

    const FORK_BLOCK_NUMBER: number = 17641669;

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
        await crvBpt.connect(crvBptHolder).transfer(deployerAddress, e18.mul(32000));
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

        ({ booster, cvx, litDepositorHelper, poolManager, cvxCrvRewards, cvxCrv, cvxLocker } = phase2);

        console.log(`\n~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
        console.log(`~~~~ DEPLOYMENT FINISH ~~~~`);
        console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~\n`);

        // Need to make an initial lock require(lockedSupply >= 1e20, "!balance");
        const operatorAccount = await impersonateAccount(booster.address);
        let tx = await phase2.cvx.connect(operatorAccount.signer).mint(deployerAddress, e18.mul(10000));
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

        await lit.connect(deployer).approve(litDepositorHelper.address, e18.mul(1000000));
        const minOut = await litDepositorHelper.getMinOut(e18.mul(1000000), 9900, lit.address);
        await litDepositorHelper.deposit(e18.mul(1000000), ZERO, true, ZERO_ADDRESS, litAddress);
        console.log("deployerBptMinOut: ", +minOut);
        console.log("deployerVeLitBalance: ", (await velit.balanceOf(deployerAddress)).toString());
        console.log("deployerLiqLitBalance: ", (await cvxCrv.balanceOf(deployerAddress)).toString());
        console.log("voterProxyVeLitBalance: ", (await velit.balanceOf(voterProxy.address)).toString());

        await cvxCrv.transfer(aliceAddress, e18.mul(10000));
        await cvxCrv.connect(alice).approve(cvxCrvRewards.address, e18.mul(10000));
        await cvxCrvRewards.connect(alice).stakeAll();

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

        await booster.connect(bob).earmarkRewards(0); // Bob will receive some tokens for being the caller

        console.log("oLitBoosterBalance: ", (await olit.balanceOf(booster.address)).toString());
        console.log("bobOLitBalance: ", (await olit.balanceOf(bobAddress)).toString());

        await booster.connect(bob).earmarkRewards(1); // Bob will receive some tokens for being the caller

        console.log("oLitBoosterBalance: ", (await olit.balanceOf(booster.address)).toString());
        console.log("bobOLitBalance: ", (await olit.balanceOf(bobAddress)).toString());

        claimZap = await deployContract<LiquisClaimZap>(
            hre,
            new LiquisClaimZap__factory(deployer),
            "LiquisClaimZap",
            [phase2.cvx.address, cvxCrv.address, cvxCrvRewards.address, cvxLocker.address],
            {},
            debug,
            waitForBlocks,
        );
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

    describe("LiquisViewHelper", async () => {
        before(async () => {
            await setup();
        });

        it("allows to claim oLIT from two BaseRewardPools", async () => {
            await increaseTime(60 * 60 * 24 * 1);
            await booster.connect(bob).earmarkRewards(0);
            await booster.connect(bob).earmarkRewards(1);
            await increaseTime(60 * 60 * 24 * 1);

            const options = Options.None;

            const olitBalanceInit = await olit.balanceOf(aliceAddress);

            const earnedAlice0 = await rewardPool1.earned(aliceAddress);
            const earnedAlice1 = await rewardPool2.earned(aliceAddress);

            // Alice has rewards from both pools
            expect(earnedAlice0).gt(ZERO);
            expect(earnedAlice1).gt(ZERO);
            const totalEarned = earnedAlice0.add(earnedAlice1);

            await claimZap.connect(alice).claimRewards([rewardPool1.address, rewardPool2.address], [], [], [], options);

            const olitBalanceEnd = await olit.balanceOf(aliceAddress);
            const totalClaimed = olitBalanceEnd.sub(olitBalanceInit);

            expect(totalClaimed).gt(totalEarned);
            assertBNClosePercent(totalClaimed, totalEarned, "0.01");
        });

        it("allows to claim oLIT from two BaseRewardPools, liqLit staking and locker", async () => {
            await increaseTime(60 * 60 * 24 * 1);
            await booster.connect(bob).earmarkRewards(0);
            await booster.connect(bob).earmarkRewards(1);
            await increaseTime(60 * 60 * 24 * 1);

            const options = Options.ClaimLiqLit + Options.ClaimLockedLiq;

            const olitBalanceInit = await olit.balanceOf(aliceAddress);

            const earnedAlice0 = await rewardPool1.earned(aliceAddress);
            const earnedAlice1 = await rewardPool2.earned(aliceAddress);
            const earnedAlice2 = await cvxCrvRewards.earned(aliceAddress);
            const earnedAlice3 = await cvxLocker.earned(aliceAddress, olitAddress);

            // Alice has rewards from all pools
            expect(earnedAlice0).gt(ZERO);
            expect(earnedAlice1).gt(ZERO);
            expect(earnedAlice2).gt(ZERO);
            expect(earnedAlice3).gt(ZERO);
            const totalEarned = earnedAlice0.add(earnedAlice1).add(earnedAlice2).add(earnedAlice3);

            await claimZap.connect(alice).claimRewards([rewardPool1.address, rewardPool2.address], [], [], [], options);

            const olitBalanceEnd = await olit.balanceOf(aliceAddress);
            const totalClaimed = olitBalanceEnd.sub(olitBalanceInit);

            expect(totalClaimed).gt(totalEarned);
            assertBNClosePercent(totalClaimed, totalEarned, "0.01");
        });

        it("allows to claim oLIT from all sources and lock liq using only earned balance", async () => {
            await increaseTime(60 * 60 * 24 * 1);
            await booster.connect(bob).earmarkRewards(0);
            await booster.connect(bob).earmarkRewards(1);
            await increaseTime(60 * 60 * 24 * 1);

            const options = Options.ClaimLiqLit + Options.ClaimLockedLiq + Options.LockLiq;

            const liqBalanceInit = await cvx.balanceOf(aliceAddress);
            await cvx.connect(alice).approve(claimZap.address, liqBalanceInit);
            expect(liqBalanceInit).gt(ZERO);

            const olitBalanceInit = await olit.balanceOf(aliceAddress);

            const earnedAlice0 = await rewardPool1.earned(aliceAddress);
            const earnedAlice1 = await rewardPool2.earned(aliceAddress);
            const earnedAlice2 = await cvxCrvRewards.earned(aliceAddress);
            const earnedAlice3 = await cvxLocker.earned(aliceAddress, olitAddress);

            // Alice has rewards from all pools
            expect(earnedAlice0).gt(ZERO);
            expect(earnedAlice1).gt(ZERO);
            expect(earnedAlice2).gt(ZERO);
            expect(earnedAlice3).gt(ZERO);
            const totalEarned = earnedAlice0.add(earnedAlice1).add(earnedAlice2).add(earnedAlice3);

            await claimZap.connect(alice).claimRewards([rewardPool1.address, rewardPool2.address], [], [], [], options);

            const olitBalanceEnd = await olit.balanceOf(aliceAddress);
            const totalClaimed = olitBalanceEnd.sub(olitBalanceInit);

            const liqBalanceEnd = await cvx.balanceOf(aliceAddress);

            expect(liqBalanceEnd).eq(liqBalanceInit);
            assertBNClosePercent(totalClaimed, totalEarned, "0.01");
        });

        it("allows lock liq using all liq balance", async () => {
            const options = Options.UseAllLiqFunds + Options.LockLiq;

            const liqBalanceInit = await cvx.balanceOf(aliceAddress);
            await cvx.connect(alice).approve(claimZap.address, liqBalanceInit);
            expect(liqBalanceInit).gt(ZERO);

            const lockedBalanceInit = await cvxLocker.lockedBalances(aliceAddress);

            await claimZap.connect(alice).claimRewards([], [], [], [], options);

            const liqBalanceEnd = await cvx.balanceOf(aliceAddress);

            const lockedBalanceEnd = await cvxLocker.lockedBalances(aliceAddress);

            expect(liqBalanceEnd).eq(ZERO);
            expect(lockedBalanceEnd.locked).gt(lockedBalanceInit.locked);
        });
    });
});
