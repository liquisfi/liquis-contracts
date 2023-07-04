import { expect, assert } from "chai";
import { BigNumber } from "ethers";
import hre, { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ONE_WEEK, ONE_DAY, ZERO_ADDRESS, ZERO, e18 } from "../test-utils/constants";
import { impersonateAccount, increaseTime, increaseTimeTo, getTimestamp, assertBNClosePercent } from "../test-utils";
import { deployContract } from "../tasks/utils";

import {
    IERC20Extra,
    MockERC20,
    MockERC20__factory,
    LitDepositorHelper,
    LitDepositorHelper__factory,
    PrelaunchRewardsPool,
    PrelaunchRewardsPool__factory,
    VoterProxy,
    VoterProxy__factory,
    CvxCrvToken,
    CvxCrvToken__factory,
    CrvDepositor,
    CrvDepositor__factory,
} from "../types/generated";

import smartWalletCheckerABI from "../abi/smartWalletChecker.json";

interface Holder {
    address: string;
    amount: BigNumber;
}

const bptHolders: Holder[] = [
    {
        address: "0xb84dfdD51d18B1613432bfaE91dfcC48899D4151",
        amount: e18.mul(22305),
    },
    {
        address: "0xe118E6681D1B169e90B7401DFB2bdf47723e9a65",
        amount: e18.mul(21230),
    },
    {
        address: "0x532Cf52D70Add4C0E0fE5eC64Df8fcf4Ba21Ae28",
        amount: e18.mul(12129),
    },
    {
        address: "0x223C381a3aaE44F7E073e66a8295DCe2955E0098",
        amount: e18.mul(11318),
    },
    {
        address: "0x65f0DB365664733F0A83DD9FE5e6f4e0218cb58C",
        amount: e18.mul(5102),
    },
];

const litHolders: Holder[] = [
    {
        address: "0x63F2695207f1d625a9B0B8178D95cD517bC5E82C",
        amount: e18.mul(10761228),
    },
    {
        address: "0xCa398e17D838F26A7e39eFC31d67FAe20118272b",
        amount: e18.mul(5988639),
    },
    {
        address: "0x8b187EA19C93091a4D6B426b71871648182b5Fac",
        amount: e18.mul(2831),
    },
];

const FORK_BLOCK_NUMBER: number = 17415300;

describe("PrelaunchRewardsPool", () => {
    const LIT_ADDRESS = "0xfd0205066521550D7d7AB19DA8F72bb004b4C341"; // LIT
    const BPT_ADDRESS = "0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C"; // BAL 20-80 WETH/LIT

    const lit: string = "0xfd0205066521550D7d7AB19DA8F72bb004b4C341"; // LIT
    const bpt: string = "0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C"; // BAL 20-80 WETH/LIT
    const balancerVault: string = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
    const balancerPoolId: string = "0x9232a548dd9e81bac65500b5e0d918f8ba93675c000200000000000000000423";
    const weth: string = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

    const smartWalletCheckerContractAddress: string = "0x0ccdf95baf116ede5251223ca545d0ed02287a8f";
    const smartWalletCheckerOwnerAddress: string = "0x9a8fee232dcf73060af348a1b62cdb0a19852d13";

    const minterAddress: string = "0xF087521Ffca0Fa8A43F5C445773aB37C5f574DA0";
    const olitAddress: string = "0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa";
    const tokenBptAddress: string = "0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C";
    const votingEscrowAddress: string = "0xf17d23136B4FeAd139f54fB766c8795faae09660";
    const gaugeControllerAddress: string = "0x901c8aA6A61f74aC95E7f397E22A0Ac7c1242218";
    const crvBptHolderAddress: string = "0xb84dfdD51d18B1613432bfaE91dfcC48899D4151";

    let stakingToken: IERC20Extra;
    let litToken: IERC20Extra;

    let liq: MockERC20;
    let litDepositorHelper: LitDepositorHelper;
    let prelaunchRewardsPool: PrelaunchRewardsPool;

    let deployer: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;

    let deployerAddress: string;
    let aliceAddress: string;
    let bobAddress: string;

    let crvBpt: IERC20Extra;
    let crvDepositor: CrvDepositor;
    let cvxCrv: CvxCrvToken;

    let voterProxy: VoterProxy;

    const debug = false;
    const waitForBlocks = 0;

    const setup = async () => {
        // as we are impersonating different accounts, we fix the block number in which we run each describe block
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

        // Deploy Voter Proxy, get whitelisted on Bunni system
        voterProxy = await deployContract<VoterProxy>(
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

        // Instance of crvBpt
        crvBpt = (await ethers.getContractAt("IERC20Extra", tokenBptAddress)) as IERC20Extra;

        // Impersonate and fund crvBpt whale
        await impersonateAccount(crvBptHolderAddress, true);
        const crvBptHolder = await ethers.getSigner(crvBptHolderAddress);
        await crvBpt.connect(crvBptHolder).transfer(deployerAddress, e18.mul(10000));

        cvxCrv = await deployContract<CvxCrvToken>(
            hre,
            new CvxCrvToken__factory(deployer),
            "CvxCrv",
            ["Liq LIT", "liqLIT"],
            {},
            debug,
            waitForBlocks,
        );

        crvDepositor = await deployContract<CrvDepositor>(
            hre,
            new CrvDepositor__factory(deployer),
            "CrvDepositor",
            [voterProxy.address, cvxCrv.address, tokenBptAddress, votingEscrowAddress, deployerAddress],
            {},
            debug,
            waitForBlocks,
        );

        // stakingToken & lit instances
        stakingToken = (await ethers.getContractAt("IERC20Extra", bpt)) as IERC20Extra;
        litToken = (await ethers.getContractAt("IERC20Extra", lit)) as IERC20Extra;

        // deploy contracts
        liq = await deployContract<MockERC20>(
            hre,
            new MockERC20__factory(deployer),
            "MockERC20",
            ["LiqToken", "LIQ", 18, deployerAddress, 10000000],
            {},
            debug,
            waitForBlocks,
        );

        litDepositorHelper = await deployContract<LitDepositorHelper>(
            hre,
            new LitDepositorHelper__factory(deployer),
            "LitDepositorHelper",
            [crvDepositor.address, balancerVault, lit, weth, balancerPoolId],
            {},
            debug,
            waitForBlocks,
        );

        await litDepositorHelper.setApprovals();

        prelaunchRewardsPool = await deployContract<PrelaunchRewardsPool>(
            hre,
            new PrelaunchRewardsPool__factory(deployer),
            "PrelaunchRewardsPool",
            [bpt, liq.address, litDepositorHelper.address, lit, ZERO_ADDRESS, voterProxy.address, votingEscrowAddress],
            {},
            debug,
            waitForBlocks,
        );
    };

    describe("PrelaunchRewardsPool Test for external methods", () => {
        before(async () => {
            await setup();
        });

        describe("External variables, functions and methods", () => {
            it("variables are properly initialized", async () => {
                const litAddress = await prelaunchRewardsPool.lit();
                expect(litAddress).eq(LIT_ADDRESS);

                const ownerAddress = await prelaunchRewardsPool.owner();
                expect(ownerAddress).eq(await deployer.getAddress());

                const stakingTokenAddress = await prelaunchRewardsPool.stakingToken();
                expect(stakingTokenAddress).eq(stakingToken.address);

                const rewardTokenAddress = await prelaunchRewardsPool.rewardToken();
                expect(rewardTokenAddress).eq(liq.address);

                const litDepositorHelperAddress = await prelaunchRewardsPool.litConvertor();
                expect(litDepositorHelperAddress).eq(litDepositorHelper.address);
            });

            it("deadlines and target dates are properly initialized", async () => {
                const timestamp = await getTimestamp();

                const START_VESTING_DATE = await prelaunchRewardsPool.START_VESTING_DATE();
                const END_VESTING_DATE = await prelaunchRewardsPool.END_VESTING_DATE();
                const START_WITHDRAWALS = await prelaunchRewardsPool.START_WITHDRAWALS();

                expect(START_VESTING_DATE).gt(timestamp);

                assertBNClosePercent(START_VESTING_DATE, timestamp.add(ONE_WEEK.mul(4)), "0.001");
                assertBNClosePercent(END_VESTING_DATE, START_VESTING_DATE.add(ONE_DAY.mul(180)), "0.001");
                assertBNClosePercent(START_WITHDRAWALS, START_VESTING_DATE.add(ONE_WEEK.mul(4)), "0.001");
            });

            it("allows bpt holders to stake their LIT/WETH lpTokens", async () => {
                let totalAmount: BigNumber = ZERO;
                for (const bptHolder of bptHolders) {
                    await impersonateAccount(bptHolder.address, true);

                    const holder = await ethers.getSigner(bptHolder.address);
                    const amount = await stakingToken.balanceOf(holder.address);

                    await stakingToken.connect(holder).approve(prelaunchRewardsPool.address, amount);
                    await prelaunchRewardsPool.connect(holder).stake(bptHolder.amount);

                    const stakes = await prelaunchRewardsPool.balances(await holder.getAddress());
                    expect(stakes).eq(bptHolder.amount);

                    totalAmount = totalAmount.add(bptHolder.amount);
                    const totalSupplyContract = await prelaunchRewardsPool.totalSupply();
                    expect(totalAmount).eq(totalSupplyContract);
                }
            });

            it("allows lit holders to zap in with their lit", async () => {
                let totalAmount: BigNumber = ZERO;
                const totalAmountPrev = await prelaunchRewardsPool.totalSupply();
                for (const litHolder of litHolders) {
                    await impersonateAccount(litHolder.address, true);

                    const holder = await ethers.getSigner(litHolder.address);
                    const amount = e18.mul(100000);

                    const minOut = await litDepositorHelper.getMinOut(amount, 9850);

                    await litToken.connect(holder).approve(prelaunchRewardsPool.address, amount);
                    await prelaunchRewardsPool.connect(holder).stakeLit(amount, minOut);

                    const stakes = await prelaunchRewardsPool.balances(await holder.getAddress());
                    expect(stakes).gt(minOut);
                    assertBNClosePercent(stakes, minOut, "1"); // 1%

                    totalAmount = totalAmount.add(stakes);
                }
                const totalSupplyContract = await prelaunchRewardsPool.totalSupply();
                expect(totalAmount).eq(totalSupplyContract.sub(totalAmountPrev));
            });
        });

        describe("Protected functions and methods", () => {
            it("reverts when trying to withdraw before start withdrawals target date", async () => {
                for (const bptHolder of bptHolders) {
                    await impersonateAccount(bptHolder.address, true);

                    const holder = await ethers.getSigner(bptHolder.address);

                    const timestamp = await getTimestamp();
                    const startWithdrawalsTimestamp = await prelaunchRewardsPool.START_WITHDRAWALS();
                    expect(timestamp).lt(startWithdrawalsTimestamp);

                    await expect(prelaunchRewardsPool.connect(holder).withdraw()).to.be.revertedWith(
                        "Currently not possible",
                    );
                }
            });

            it("reverts when trying to claimRewards before start vesting target date", async () => {
                for (const bptHolder of bptHolders) {
                    await impersonateAccount(bptHolder.address, true);

                    const holder = await ethers.getSigner(bptHolder.address);

                    const timestamp = await getTimestamp();
                    const startVestingTimestamp = await prelaunchRewardsPool.START_VESTING_DATE();
                    expect(timestamp).lt(startVestingTimestamp);

                    await expect(prelaunchRewardsPool.connect(holder).claim()).to.be.revertedWith(
                        "Currently not possible",
                    );
                }
            });
        });
    });

    describe("StakingRewardsPool Test for rewards distribution", () => {
        before(async () => {
            await setup();
        });

        describe("Reward handling functions", () => {
            it("variables are properly initialized", async () => {
                const rewardTokenAddress = await prelaunchRewardsPool.rewardToken();
                expect(rewardTokenAddress).eq(liq.address);

                const deployerLiqAmount = await liq.balanceOf(deployerAddress);
                expect(deployerLiqAmount).eq(e18.mul(10000000)); // 1M amount the mock mints
            });

            it("allows bpt holders to stake their LIT/WETH lpTokens", async () => {
                let totalAmount: BigNumber = ZERO;
                for (const bptHolder of bptHolders) {
                    await impersonateAccount(bptHolder.address, true);

                    const holder = await ethers.getSigner(bptHolder.address);
                    const amount = await stakingToken.balanceOf(holder.address);

                    await stakingToken.connect(holder).approve(prelaunchRewardsPool.address, amount);
                    await prelaunchRewardsPool.connect(holder).stake(bptHolder.amount);

                    const stakes = await prelaunchRewardsPool.balances(await holder.getAddress());
                    expect(stakes).eq(bptHolder.amount);

                    totalAmount = totalAmount.add(bptHolder.amount);
                    const totalSupplyContract = await prelaunchRewardsPool.totalSupply();
                    expect(totalAmount).eq(totalSupplyContract);
                }
            });

            it("notifies rewardAmount if called by owner", async () => {
                await liq.approve(prelaunchRewardsPool.address, e18.mul(100000));
                await prelaunchRewardsPool.notifyRewardAmount(e18.mul(100000));

                const periodFinish = await prelaunchRewardsPool.periodFinish();
                expect(periodFinish).gt(ZERO);

                const rewardRate = await prelaunchRewardsPool.rewardRate();
                expect(rewardRate).gt(ZERO);

                const lastUpdateTime = await prelaunchRewardsPool.lastUpdateTime();
                expect(lastUpdateTime).gt(ZERO);

                const currentRewards = await prelaunchRewardsPool.currentRewards();
                expect(currentRewards).gt(ZERO);

                const historicalRewards = await prelaunchRewardsPool.historicalRewards();
                expect(historicalRewards).eq(e18.mul(100000));

                expect(currentRewards).eq(historicalRewards);
                expect(periodFinish.sub(lastUpdateTime)).eq(await prelaunchRewardsPool.duration());

                const expectedRewardRate = historicalRewards.div(ONE_WEEK);

                assertBNClosePercent(rewardRate, expectedRewardRate, "0.01");
            });

            it("updates rewards according the different users stake", async () => {
                for (const bptHolder of bptHolders) {
                    // increase one week to finish first reward distribution
                    await increaseTime(ONE_WEEK);

                    const totalStaked = await prelaunchRewardsPool.totalSupply();
                    const currentRewards = await prelaunchRewardsPool.currentRewards();

                    const earned = await prelaunchRewardsPool.earned(bptHolder.address);

                    const stakes = await prelaunchRewardsPool.balances(bptHolder.address);

                    assertBNClosePercent(earned, stakes.mul(currentRewards).div(totalStaked), "0.01");
                }
            });

            it("after one row of rewards earned amounts are proportional to stakes", async () => {
                await liq.approve(prelaunchRewardsPool.address, e18.mul(100000));
                await prelaunchRewardsPool.notifyRewardAmount(e18.mul(100000));

                for (const bptHolder of bptHolders) {
                    // increase one week to finish first reward distribution
                    await increaseTime(ONE_WEEK);

                    const totalStaked = await prelaunchRewardsPool.totalSupply();
                    const historicalRewards = await prelaunchRewardsPool.historicalRewards();

                    const earned = await prelaunchRewardsPool.earned(bptHolder.address);

                    const stakes = await prelaunchRewardsPool.balances(bptHolder.address);

                    assertBNClosePercent(earned, stakes.mul(historicalRewards).div(totalStaked), "0.01");
                }
            });

            it("if a new user stakes earned is zero and rewardPerTokenStored is updated to actual", async () => {
                const initialSupply = await prelaunchRewardsPool.totalSupply();
                const historicalRewards = await prelaunchRewardsPool.historicalRewards();

                for (const litHolder of litHolders) {
                    await impersonateAccount(litHolder.address, true);

                    const holder = await ethers.getSigner(litHolder.address);
                    const amount = e18.mul(100000);

                    const minOut = await litDepositorHelper.getMinOut(amount, 9850);

                    await litToken.connect(holder).approve(prelaunchRewardsPool.address, amount);
                    await prelaunchRewardsPool.connect(holder).stakeLit(amount, minOut);

                    const userRewardPerTokenPaid = await prelaunchRewardsPool.userRewardPerTokenPaid(litHolder.address);
                    const rewardPerTokenStored = await prelaunchRewardsPool.rewardPerTokenStored();

                    expect(userRewardPerTokenPaid).eq(rewardPerTokenStored);
                    assertBNClosePercent(rewardPerTokenStored, historicalRewards.mul(e18).div(initialSupply), "0.01");
                }
            });

            it("it reverts when converting if balanceOf(voterProxy) == 0", async () => {
                await prelaunchRewardsPool.setCrvDepositor(crvDepositor.address);
                expect(await prelaunchRewardsPool.crvDepositor()).eq(crvDepositor.address);

                for (const bptHolder of bptHolders) {
                    await impersonateAccount(bptHolder.address, true);
                    const holder = await ethers.getSigner(bptHolder.address);

                    await expect(prelaunchRewardsPool.connect(holder).convert()).to.be.revertedWith("Not activated");
                }
            });

            it("if users convert to liqLit stakes are reduced, tokens are pulled into crvDepositor", async () => {
                // Create the initial lock
                await crvBpt.transfer(voterProxy.address, e18.mul(10000));
                await voterProxy.setDepositor(crvDepositor.address);
                await cvxCrv.setOperator(crvDepositor.address);
                await crvDepositor.initialLock();

                const initialSupply = await prelaunchRewardsPool.totalSupply();
                let reducedSupply: BigNumber = ZERO;

                const balanceDepositorBefore = await stakingToken.balanceOf(votingEscrowAddress);

                for (const bptHolder of bptHolders) {
                    await impersonateAccount(bptHolder.address, true);
                    const holder = await ethers.getSigner(bptHolder.address);

                    const earned = await prelaunchRewardsPool.earned(bptHolder.address);

                    await prelaunchRewardsPool.connect(holder).convert();

                    const stakes = await prelaunchRewardsPool.balances(bptHolder.address);
                    expect(stakes).eq(ZERO);

                    const isVestingUser = await prelaunchRewardsPool.isVestingUser(bptHolder.address);
                    assert.isTrue(isVestingUser); // users are now vestingUsers

                    const rewardsUser = await prelaunchRewardsPool.rewards(bptHolder.address);
                    expect(earned).eq(rewardsUser);
                }

                for (let i = 0; i < bptHolders.length; i++) {
                    reducedSupply = reducedSupply.add(bptHolders[i].amount);
                }

                const endSupply = await prelaunchRewardsPool.totalSupply();
                expect(endSupply).eq(initialSupply.sub(reducedSupply));

                const balanceDepositorAfter = await stakingToken.balanceOf(votingEscrowAddress);
                expect(balanceDepositorAfter.sub(balanceDepositorBefore)).eq(reducedSupply); // tokens are pulled from the prelaunchRewardsPool
            });
        });

        describe("Vesting of rewards", () => {
            it("if timestamp is after startVesting getClaimableVesting returns correct amount", async () => {
                const timestamp = await getTimestamp();

                const START_VESTING_DATE = await prelaunchRewardsPool.START_VESTING_DATE();
                const END_VESTING_DATE = await prelaunchRewardsPool.END_VESTING_DATE();
                const duration = END_VESTING_DATE.sub(START_VESTING_DATE);

                expect(timestamp).gt(START_VESTING_DATE);

                const diff = timestamp.sub(START_VESTING_DATE);

                for (const bptHolder of bptHolders) {
                    const claimable = await prelaunchRewardsPool.getClaimableLiqVesting(bptHolder.address);
                    const rewardsUser = await prelaunchRewardsPool.rewards(bptHolder.address);

                    assertBNClosePercent(claimable, rewardsUser.mul(diff).div(duration), "0.01");
                }
            });

            it("vesting users can claim the rewards unvested, balance increases", async () => {
                const timestamp = await getTimestamp();

                const START_VESTING_DATE = await prelaunchRewardsPool.START_VESTING_DATE();
                const END_VESTING_DATE = await prelaunchRewardsPool.END_VESTING_DATE();
                const duration = END_VESTING_DATE.sub(START_VESTING_DATE);

                expect(timestamp).gt(START_VESTING_DATE);

                const diff = timestamp.sub(START_VESTING_DATE);

                for (const bptHolder of bptHolders) {
                    const initialLiqBal = await liq.balanceOf(bptHolder.address);

                    await impersonateAccount(bptHolder.address, true);
                    const holder = await ethers.getSigner(bptHolder.address);

                    const claimable = await prelaunchRewardsPool.getClaimableLiqVesting(bptHolder.address);
                    const rewardsUser = await prelaunchRewardsPool.rewards(bptHolder.address);

                    const tx = await prelaunchRewardsPool.connect(holder).claim();
                    const receipt = await tx.wait();

                    const events = receipt.events?.filter(x => {
                        return x.event == "Claimed";
                    });
                    if (!events) {
                        throw new Error("No events found");
                    }

                    const args = events[0].args;
                    if (!args) {
                        throw new Error("Event has no args");
                    }

                    const liqClaimed = args[1];

                    const endLiqBal = await liq.balanceOf(bptHolder.address);

                    assertBNClosePercent(liqClaimed, claimable, "0.01");
                    assertBNClosePercent(liqClaimed, rewardsUser.mul(diff).div(duration), "0.01");
                    assertBNClosePercent(liqClaimed, endLiqBal.sub(initialLiqBal), "0.01");

                    const claimableAfter = await prelaunchRewardsPool.getClaimableLiqVesting(bptHolder.address);
                    expect(claimableAfter).eq(ZERO);
                }
            });

            it("if timestamp is over endVesting getClaimableVesting returns rewards sub claimed", async () => {
                const END_VESTING_DATE = await prelaunchRewardsPool.END_VESTING_DATE();

                await increaseTimeTo(END_VESTING_DATE.add(1));

                const timestamp = await getTimestamp();
                expect(timestamp).gt(END_VESTING_DATE);

                for (const bptHolder of bptHolders) {
                    const claimable = await prelaunchRewardsPool.getClaimableLiqVesting(bptHolder.address);
                    const rewardsUser = await prelaunchRewardsPool.rewards(bptHolder.address);
                    const claimedUser = await prelaunchRewardsPool.claimed(bptHolder.address);

                    assertBNClosePercent(claimable, rewardsUser.sub(claimedUser), "0.01");

                    await impersonateAccount(bptHolder.address, true);
                    const holder = await ethers.getSigner(bptHolder.address);

                    const tx = await prelaunchRewardsPool.connect(holder).claim();
                    const receipt = await tx.wait();

                    const events = receipt.events?.filter(x => {
                        return x.event == "Claimed";
                    });
                    if (!events) {
                        throw new Error("No events found");
                    }

                    const args = events[0].args;
                    if (!args) {
                        throw new Error("Event has no args");
                    }

                    const liqClaimed = args[1];

                    assertBNClosePercent(liqClaimed, claimable, "0.01");

                    // after the vesting period liq balance is equal to rewards amount
                    const endLiqBal = await liq.balanceOf(bptHolder.address);
                    assertBNClosePercent(rewardsUser, endLiqBal, "0.01");
                }
            });

            it("getClaimableAmount for external users returns zero", async () => {
                const claimableAlice = await prelaunchRewardsPool.getClaimableLiqVesting(aliceAddress);
                const claimableBob = await prelaunchRewardsPool.getClaimableLiqVesting(bobAddress);

                expect(claimableAlice).eq(ZERO);
                expect(claimableBob).eq(ZERO);
            });

            it("reverts when trying to claim if is not vesting user", async () => {
                for (const litHolder of litHolders) {
                    await impersonateAccount(litHolder.address, true);

                    const holder = await ethers.getSigner(litHolder.address);

                    const claimable = await prelaunchRewardsPool.getClaimableLiqVesting(litHolder.address);
                    expect(claimable).eq(ZERO);

                    await expect(prelaunchRewardsPool.connect(holder).claim()).to.be.revertedWith("Not vesting User");
                }
            });
        });
    });

    describe("StakingRewardsPool Test for withdraws", () => {
        before(async () => {
            await setup();
        });

        describe("Reward handling functions", () => {
            it("reverts when withdrawing if target address is not set", async () => {
                for (const bptHolder of bptHolders) {
                    await impersonateAccount(bptHolder.address, true);

                    const holder = await ethers.getSigner(bptHolder.address);
                    const amount = await stakingToken.balanceOf(holder.address);

                    // add some stakes to the stakingPool
                    await stakingToken.connect(holder).approve(prelaunchRewardsPool.address, amount);
                    await prelaunchRewardsPool.connect(holder).stake(bptHolder.amount);

                    const stakes = await prelaunchRewardsPool.balances(await holder.getAddress());
                    expect(stakes).eq(bptHolder.amount);

                    // add some rewards to distribute
                    await liq.approve(prelaunchRewardsPool.address, e18.mul(100000));
                    await prelaunchRewardsPool.notifyRewardAmount(e18.mul(100000));

                    const timestamp = await getTimestamp();

                    const START_WITHDRAWALS = await prelaunchRewardsPool.START_WITHDRAWALS();
                    expect(timestamp).lt(START_WITHDRAWALS);

                    await expect(prelaunchRewardsPool.connect(holder).claim()).to.be.revertedWith(
                        "Currently not possible",
                    );
                }
            });

            it("reverts when withdrawing if users stake is zero", async () => {
                await increaseTime(ONE_WEEK.mul(9));

                // set crvDepositor to address(0)
                await prelaunchRewardsPool.setCrvDepositor(ZERO_ADDRESS);
                expect(await prelaunchRewardsPool.crvDepositor()).eq(ZERO_ADDRESS);

                await expect(prelaunchRewardsPool.connect(alice).withdraw()).to.be.revertedWith("Cannot withdraw 0");
                await expect(prelaunchRewardsPool.connect(bob).withdraw()).to.be.revertedWith("Cannot withdraw 0");
            });

            it("users can withdraw if conditions are met", async () => {
                for (const bptHolder of bptHolders) {
                    await impersonateAccount(bptHolder.address, true);
                    const holder = await ethers.getSigner(bptHolder.address);

                    const initStakes = await prelaunchRewardsPool.balances(bptHolder.address);
                    const initStakingTokenBal = await stakingToken.balanceOf(bptHolder.address);

                    const tx = await prelaunchRewardsPool.connect(holder).withdraw();
                    const receipt = await tx.wait();

                    const events = receipt.events?.filter(x => {
                        return x.event == "Withdrawn";
                    });
                    if (!events) {
                        throw new Error("No events found");
                    }

                    const args = events[0].args;
                    if (!args) {
                        throw new Error("Event has no args");
                    }

                    const userWithdrawn = args[0];
                    const amountWithdrawn = args[1];

                    const endStakes = await prelaunchRewardsPool.balances(bptHolder.address);
                    const endStakingTokenBal = await stakingToken.balanceOf(bptHolder.address);

                    expect(userWithdrawn).eq(bptHolder.address);

                    expect(initStakes).eq(bptHolder.amount);
                    expect(endStakes).eq(ZERO);

                    assertBNClosePercent(amountWithdrawn, endStakingTokenBal.sub(initStakingTokenBal), "0.01");
                }
            });

            it("reverts when claiming any liq as reward", async () => {
                for (const bptHolder of bptHolders) {
                    const rewards = await prelaunchRewardsPool.rewards(bptHolder.address);
                    expect(rewards).eq(ZERO); // no assigned rewards

                    const claimable = await prelaunchRewardsPool.getClaimableLiqVesting(bptHolder.address);
                    expect(claimable).eq(ZERO);

                    await impersonateAccount(bptHolder.address, true);
                    const holder = await ethers.getSigner(bptHolder.address);

                    await expect(prelaunchRewardsPool.connect(holder).claim()).to.be.revertedWith("Not vesting User");
                }
            });
        });
    });
});
