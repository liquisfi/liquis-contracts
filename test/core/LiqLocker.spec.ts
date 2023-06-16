import { expect } from "chai";
import { ContractTransaction, Signer } from "ethers";
import hre, { ethers } from "hardhat";
import { Account } from "types";
import { deployMocks, DeployMocksResult, getMockDistro, getMockMultisigs } from "../../scripts/deployMocks";
import { deployPhase1, deployPhase2, deployPhase3, deployPhase4 } from "../../scripts/deploySystem";
import { deployContract } from "../../tasks/utils";
import {
    BN,
    getTimestamp,
    increaseTime,
    ONE_DAY,
    ONE_WEEK,
    simpleToExactAmount,
    ZERO,
    ZERO_ADDRESS,
    e15,
} from "../../test-utils";
import { impersonateAccount } from "../../test-utils/fork";
import {
    LiqLocker,
    LiqStakingProxy,
    LiqToken,
    BaseRewardPool,
    Booster,
    CrvDepositor,
    CvxCrvToken,
    MockLiqLocker,
    MockLiqLocker__factory,
    MockERC20,
    MockERC20__factory,
} from "../../types/generated";
interface UserLock {
    amount: BN;
    unlockTime: number;
}
interface SnapshotData {
    account: {
        liqLockerBalance: BN;
        balances: { locked: BN; nextUnlockIndex: number };
        cvxBalance: BN;
        claimableRewards: Array<{ token: string; amount: BN }>;
        delegatee: string;
        locks: UserLock[];
        votes: BN;
    };
    delegatee: {
        checkpointedVotes: Array<{ votes: BN; epochStart: number }>;
        unlocks: BN[];
        votes: BN;
    };
    cvxBalance: BN;
    lockedSupply: BN;
    totalSupply: BN;
    epochs: Array<{ supply: BN; date: number }>;
}

// TODO -
// - [x] @LiqLocker.approveRewardDistributor
// - [x] @LiqLocker.setKickIncentive
// - [x] @LiqLocker.shutdown
// - [x] @LiqLocker.recoverERC20
// - [ ] @LiqLocker.getReward when _rewardsToken == cvxCrv && _stake
// - [ ] @LiqLocker._processExpiredLocks  when if (_checkDelay > 0)
// - [x] @LiqLocker.getPastTotalSupply
// - [ ] @LiqLocker.balanceOf when locks[i].unlockTime <= block.timestamp
// - [x] @LiqLocker.lockedBalances
// - [ ] @LiqLocker.totalSupply
// - [ ] @LiqLocker.totalSupplyAtEpoch
// - [x] @LiqLocker.findEpochId
// - [x] @LiqLocker.epochCount
// - [x] @LiqLocker.decimals()
// - [x] @LiqLocker.name()
// - [x] @LiqLocker.symbol()
// - [x] @LiqLocker.claimableRewards
// - [ ] @LiqLocker.queueNewRewards when NOT if(block.timestamp >= rdata.periodFinish)
// - [ ] @LiqLocker.notifyRewardAmount when NOT if (block.timestamp >= rdata.periodFinish)
// - [ ] Reward.rewardPerTokenStored changed from uint208=>uint96 , verify overflows
describe("LiqLocker", () => {
    let accounts: Signer[];
    let liqLocker: LiqLocker;
    let cvxStakingProxy: LiqStakingProxy;
    let cvxCrvRewards: BaseRewardPool;
    let booster: Booster;
    let cvx: LiqToken;
    let cvxCrv: CvxCrvToken;
    let olit: MockERC20;
    let crvDepositor: CrvDepositor;
    let mocks: DeployMocksResult;

    let deployer: Signer;

    let alice: Signer;
    let aliceInitialBalance: BN;
    let aliceAddress: string;
    let bob: Signer;
    let bobAddress: string;

    const boosterPoolId = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const logSnapShot = (data: SnapshotData, phase: string): SnapshotData => data;
    const getSnapShot = async (accountAddress: string, phase: string = "before"): Promise<SnapshotData> => {
        const delegateeAddress = await liqLocker.delegates(accountAddress);
        const locks = await getUserLocks(accountAddress, delegateeAddress);
        const checkpointedVotes = await getCheckpointedVotes(delegateeAddress);
        return logSnapShot(
            {
                account: {
                    balances: await liqLocker.balances(accountAddress),
                    liqLockerBalance: await liqLocker.balanceOf(accountAddress),
                    cvxBalance: await cvx.balanceOf(accountAddress),
                    delegatee: delegateeAddress,
                    // rewardData,
                    claimableRewards: await liqLocker.claimableRewards(accountAddress),
                    votes: await liqLocker.getVotes(accountAddress),
                    locks: locks.userLocks,
                },
                delegatee: {
                    unlocks: locks.delegateeUnlocks,
                    votes: await liqLocker.getVotes(delegateeAddress),
                    checkpointedVotes,
                },
                lockedSupply: await liqLocker.lockedSupply(),
                totalSupply: await liqLocker.totalSupply(),
                cvxBalance: await cvx.balanceOf(liqLocker.address),
                epochs: await getEpochs(),
            },
            phase,
        );
    };
    const getEpochs = async (): Promise<Array<{ supply: BN; date: number }>> => {
        const epochs = [];
        try {
            for (let i = 0; i < 128; i++) epochs.push(await liqLocker.epochs(i));
        } catch (error) {
            // do nothing
        }
        return epochs;
    };
    const getUserLocks = async (
        userAddress: string,
        delegateeAddress: string,
    ): Promise<{ userLocks: Array<UserLock>; delegateeUnlocks: Array<BN> }> => {
        const userLocks: Array<UserLock> = [];
        const delegateeUnlocks: Array<BN> = [];
        try {
            for (let i = 0; i < 128; i++) {
                const lock = await liqLocker.userLocks(userAddress, i);
                userLocks.push(lock);
                if (delegateeAddress !== ZERO_ADDRESS) {
                    delegateeUnlocks.push(await liqLocker.delegateeUnlocks(delegateeAddress, lock.unlockTime));
                }
            }
        } catch (error) {
            // do nothing
        }
        return { userLocks, delegateeUnlocks };
    };
    const getCheckpointedVotes = async (
        delegateeAddress: string,
    ): Promise<Array<{ votes: BN; epochStart: number }>> => {
        const checkpointedVotes: Array<{ votes: BN; epochStart: number }> = [];
        try {
            const len = await liqLocker.numCheckpoints(delegateeAddress);
            for (let i = 0; i < len; i++) checkpointedVotes.push(await liqLocker.checkpoints(delegateeAddress, i));
        } catch (error) {
            // do nothing
        }
        return checkpointedVotes;
    };
    const getCurrentEpoch = async (timeStamp?: BN) => {
        if (!timeStamp) {
            timeStamp = await getTimestamp();
        }
        const rewardsDuration = await liqLocker.rewardsDuration();
        return timeStamp.div(rewardsDuration).mul(rewardsDuration);
    };
    // ============================================================
    const verifyCheckpointDelegate = async (
        tx: ContractTransaction,
        dataBefore: SnapshotData,
        dataAfter: SnapshotData,
    ) => {
        await expect(tx).emit(liqLocker, "DelegateCheckpointed").withArgs(dataAfter.account.delegatee);
    };

    const verifyLock = async (
        tx: ContractTransaction,
        cvxAmount: BN,
        dataBefore: SnapshotData,
        dataAfter: SnapshotData,
    ) => {
        await expect(tx)
            .emit(liqLocker, "Staked")
            .withArgs(aliceAddress, simpleToExactAmount(10), simpleToExactAmount(10));
        expect(dataAfter.cvxBalance, "Staked CVX").to.equal(dataBefore.cvxBalance.add(cvxAmount));
        expect(dataAfter.lockedSupply, "Staked lockedSupply ").to.equal(dataBefore.lockedSupply.add(cvxAmount));
        expect(dataAfter.account.cvxBalance, "cvx balance").to.equal(dataBefore.account.cvxBalance.sub(cvxAmount));
        expect(dataAfter.account.balances.locked, "user cvx balances locked").to.equal(
            dataBefore.account.balances.locked.add(cvxAmount),
        );
        expect(dataAfter.account.balances.nextUnlockIndex, "user balances nextUnlockIndex").to.equal(
            dataBefore.account.balances.nextUnlockIndex,
        );

        const currentEpoch = await getCurrentEpoch();
        const lock = dataAfter.account.locks[dataAfter.account.locks.length - 1];
        const lockDuration = await liqLocker.lockDuration();
        const unlockTime = lockDuration.add(currentEpoch);
        expect(lock.amount, "user locked amount").to.equal(cvxAmount);
        expect(lock.unlockTime, "user unlockTime").to.equal(unlockTime);

        expect(dataAfter.account.delegatee, "user delegatee does not change").to.equal(dataBefore.account.delegatee);
        if (dataAfter.account.delegatee !== ZERO_ADDRESS) {
            const delegateeUnlocks = await liqLocker.delegateeUnlocks(dataAfter.account.delegatee, unlockTime);
            expect(delegateeUnlocks, "user unlockTime").to.equal(cvxAmount);
        }
    };

    const setup = async () => {
        mocks = await deployMocks(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[5], accounts[6], accounts[7]);
        const distro = getMockDistro();

        const phase1 = await deployPhase1(hre, deployer, mocks.addresses);
        const phase2 = await deployPhase2(
            hre,
            deployer,
            phase1,
            distro,
            multisigs,
            mocks.namingConfig,
            mocks.addresses,
        );
        const phase3 = await deployPhase3(hre, deployer, phase2, multisigs, mocks.addresses);
        await phase3.poolManager.connect(accounts[7]).setProtectPool(false);
        const contracts = await deployPhase4(hre, deployer, phase3, mocks.addresses);

        alice = accounts[1];
        aliceAddress = await alice.getAddress();
        bob = accounts[2];
        bobAddress = await bob.getAddress();

        booster = contracts.booster;
        liqLocker = contracts.cvxLocker;
        cvxStakingProxy = contracts.cvxStakingProxy;
        cvxCrvRewards = contracts.cvxCrvRewards;
        cvx = contracts.cvx;
        cvxCrv = contracts.cvxCrv;
        olit = mocks.crv;
        crvDepositor = contracts.crvDepositor;

        const operatorAccount = await impersonateAccount(booster.address);
        let tx = await cvx
            .connect(operatorAccount.signer)
            .mint(operatorAccount.address, simpleToExactAmount(100000, 18));
        await tx.wait();

        tx = await cvx.connect(operatorAccount.signer).transfer(aliceAddress, simpleToExactAmount(200));
        await tx.wait();
        aliceInitialBalance = simpleToExactAmount(200);

        tx = await cvx.connect(operatorAccount.signer).transfer(bobAddress, simpleToExactAmount(100));
        await tx.wait();
    };
    async function distributeRewardsFromBooster(): Promise<BN> {
        await booster.earmarkRewards(boosterPoolId);
        await increaseTime(ONE_DAY);

        const incentive = await booster.stakerIncentive();
        const rate = await mocks.crvMinter.rate();
        const stakingCrvBalance = await mocks.crv.balanceOf(cvxStakingProxy.address);

        expect(stakingCrvBalance).to.equal(rate.mul(incentive).div(10000));

        const tx = await cvxStakingProxy["distribute()"]();
        const receipt = await tx.wait();
        const event = receipt.events.find(e => e.event === "RewardsDistributed");

        return event.args[1];
    }
    before(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];

        await setup();
    });
    it("checks all initial config", async () => {
        expect(await liqLocker.name(), "LiqLocker name").to.equal(mocks.namingConfig.vlCvxName);
        expect(await liqLocker.symbol(), "LiqLocker symbol").to.equal(mocks.namingConfig.vlCvxSymbol);
        // hardcoded on smart contract.
        expect(await liqLocker.decimals(), "LiqLocker decimals").to.equal(18);
        expect(await liqLocker.stakingToken(), "LiqLocker staking token").to.equal(cvx.address);
        expect(await liqLocker.cvxCrv(), "LiqLocker cvxCrv").to.equal(cvxCrv.address);
        expect(await liqLocker.cvxcrvStaking(), "LiqLocker cvxCrvStaking").to.equal(cvxCrvRewards.address);
        expect(await liqLocker.epochCount(), "LiqLocker epoch counts").to.equal(1);
        expect(await liqLocker.queuedRewards(cvxCrv.address), "LiqLocker lockDuration").to.equal(0);
        expect(await liqLocker.rewardPerToken(cvxCrv.address), "LiqLocker rewardPerToken").to.equal(0);
        expect(await liqLocker.lastTimeRewardApplicable(cvxCrv.address), "cvxCrv lastTimeRewardApplicable").to.eq(0);
        expect(await liqLocker.lastTimeRewardApplicable(olit.address), "olit lastTimeRewardApplicable").to.gt(0);
        // expect(await liqLocker.rewardTokens(0),"LiqLocker lockDuration").to.equal( 86400 * 7 * 17);
        // constants
        expect(await liqLocker.newRewardRatio(), "LiqLocker newRewardRatio").to.equal(830);
        expect(await liqLocker.rewardsDuration(), "LiqLocker rewardsDuration").to.equal(86400 * 7);
        expect(await liqLocker.lockDuration(), "LiqLocker lockDuration").to.equal(86400 * 7 * 17);
    });

    context("performing basic flow", () => {
        before(async () => {
            await setup();
        });
        it("can't process locks if nothing has been locked", async () => {
            const resp = liqLocker.connect(alice).processExpiredLocks(false);
            await expect(resp).to.revertedWith("no locks");
        });

        it("lock CVX", async () => {
            const cvxAmount = simpleToExactAmount(100);
            let tx = await cvx.connect(alice).approve(liqLocker.address, cvxAmount);
            await tx.wait();
            const dataBefore = await getSnapShot(aliceAddress);
            tx = await liqLocker.connect(alice).lock(aliceAddress, cvxAmount);

            await expect(tx).emit(liqLocker, "Staked").withArgs(aliceAddress, cvxAmount, cvxAmount);
            const dataAfter = await getSnapShot(aliceAddress);

            const lockResp = await tx.wait();
            const lockBlock = await ethers.provider.getBlock(lockResp.blockNumber);
            const lockTimestamp = ethers.BigNumber.from(lockBlock.timestamp);

            expect(dataAfter.cvxBalance, "Staked CVX").to.equal(dataBefore.cvxBalance.add(cvxAmount));
            expect(dataAfter.lockedSupply, "Staked lockedSupply ").to.equal(dataBefore.lockedSupply.add(cvxAmount));
            expect(dataAfter.account.cvxBalance, "cvx balance").to.equal(dataBefore.account.cvxBalance.sub(cvxAmount));

            expect(dataAfter.account.balances.locked, "user cvx balances locked").to.equal(
                dataBefore.account.balances.locked.add(cvxAmount),
            );
            expect(dataAfter.account.balances.nextUnlockIndex, "user balances nextUnlockIndex").to.equal(
                dataBefore.account.balances.nextUnlockIndex,
            );

            const currentEpoch = await getCurrentEpoch(lockTimestamp);
            const lock = await liqLocker.userLocks(aliceAddress, 0);
            const lockDuration = await liqLocker.lockDuration();

            const unlockTime = lockDuration.add(currentEpoch);
            expect(lock.amount, "user locked amount").to.equal(cvxAmount);
            expect(lock.unlockTime, "user unlockTime").to.equal(unlockTime);

            expect(dataAfter.account.delegatee, "user delegatee does not change").to.equal(
                dataBefore.account.delegatee,
            );
            if (dataAfter.account.delegatee !== ZERO_ADDRESS) {
                const delegateeUnlocks = await liqLocker.delegateeUnlocks(dataAfter.account.delegatee, unlockTime);
                expect(delegateeUnlocks, "user unlockTime").to.equal(cvxAmount);
            }
            // If the last epoch date is before the current epoch, the epoch index should not be updated.
            const lenA = dataAfter.epochs.length;
            const lenB = dataBefore.epochs.length;
            expect(dataAfter.epochs[lenA - 1].supply, "epoch date does not change").to.equal(
                dataBefore.epochs[lenB - 1].supply.add(cvxAmount),
            );
            expect(dataAfter.epochs[lenA - 1].date, "epoch date does not change").to.equal(
                dataBefore.epochs[lenB - 1].date,
            );
        });

        it("supports delegation", async () => {
            const dataBefore = await getSnapShot(aliceAddress);

            const tx = await liqLocker.connect(alice).delegate(bobAddress);
            await expect(tx).emit(liqLocker, "DelegateChanged").withArgs(aliceAddress, ZERO_ADDRESS, bobAddress);

            const dataAfter = await getSnapShot(aliceAddress);

            expect(dataBefore.account.delegatee).eq(ZERO_ADDRESS);
            expect(dataBefore.account.liqLockerBalance).eq(dataAfter.account.liqLockerBalance);
            expect(dataBefore.account.votes).eq(0);
            expect(dataBefore.delegatee.votes).eq(0);
            expect(dataBefore.delegatee.unlocks.length, "delegatee unlocks").eq(0);

            expect(dataAfter.account.delegatee).eq(bobAddress);
            expect(dataAfter.account.votes).eq(0);
            expect(dataAfter.delegatee.votes).eq(0);

            await verifyCheckpointDelegate(tx, dataBefore, dataAfter);
        });

        it("distribute rewards from the booster", async () => {
            await booster.earmarkRewards(boosterPoolId);
            await increaseTime(ONE_DAY);

            const incentive = await booster.stakerIncentive();
            const rate = await mocks.crvMinter.rate();
            const stakingCrvBalance = await olit.balanceOf(cvxStakingProxy.address);
            expect(stakingCrvBalance).to.equal(rate.mul(incentive).div(10000));

            const balBefore = await olit.balanceOf(liqLocker.address);
            const tx = await cvxStakingProxy["distribute()"]();
            await tx.wait();

            const balAfter = await olit.balanceOf(liqLocker.address);
            expect(balAfter).gt(balBefore.add(stakingCrvBalance.div(3)));
        });

        it("can't process locks that haven't expired", async () => {
            const resp = liqLocker.connect(alice).processExpiredLocks(false);
            await expect(resp).to.revertedWith("no exp locks");
        });

        it("checkpoint CVX locker epoch", async () => {
            await liqLocker.checkpointEpoch();

            await increaseTime(ONE_DAY.mul(14));

            const dataBefore = await getSnapShot(aliceAddress);
            const tx = await liqLocker.checkpointEpoch();
            await tx.wait();
            const dataAfter = await getSnapShot(aliceAddress);

            expect(dataAfter.epochs.length, "new epochs added").to.equal(dataBefore.epochs.length + 2);

            const vlCVXBalance = await liqLocker.balanceAtEpochOf(0, aliceAddress);
            expect(vlCVXBalance, "vlCVXBalance at epoch is correct").to.equal(0);
            expect(
                await liqLocker.balanceAtEpochOf(dataAfter.epochs.length - 1, aliceAddress),
                "vlCVXBalance at epoch is correct",
            ).to.equal(simpleToExactAmount(100));
        });

        it("notify rewards ", async () => {
            const amount = simpleToExactAmount(100);
            const mockToken = await deployContract<MockERC20>(
                hre,
                new MockERC20__factory(deployer),
                "mockToken",
                ["mockToken", "mockToken", 18, await deployer.getAddress(), simpleToExactAmount(1000000)],
                {},
                false,
            );
            const distributor = accounts[3];
            const distributorAddress = await distributor.getAddress();

            await mockToken.connect(deployer).approve(distributorAddress, amount);
            await mockToken.connect(deployer).transfer(distributorAddress, amount);
            await mockToken.connect(distributor).approve(liqLocker.address, amount);

            await liqLocker.connect(accounts[7]).addReward(mockToken.address, distributorAddress);
            await liqLocker.connect(accounts[7]).approveRewardDistributor(mockToken.address, distributorAddress, true);

            const tx = await liqLocker.connect(distributor).queueNewRewards(mockToken.address, amount);
            await expect(tx).to.emit(liqLocker, "RewardAdded").withArgs(mockToken.address, amount);
            expect(await mockToken.balanceOf(liqLocker.address)).to.equal(amount);
        });

        it("get rewards from CVX locker", async () => {
            await increaseTime(ONE_DAY.mul(105));
            const olitBefore = await olit.balanceOf(aliceAddress);
            const dataBefore = await getSnapShot(aliceAddress);

            expect(await liqLocker.rewardPerToken(olit.address), "rewardPerToken").to.equal(
                dataBefore.account.claimableRewards[0].amount.div(100),
            );

            const tx = await liqLocker["getReward(address,bool[])"](aliceAddress, [false, false]);
            const dataAfter = await getSnapShot(aliceAddress);

            await tx.wait();
            const olitAfter = await olit.balanceOf(aliceAddress);
            const olitBalance = olitAfter.sub(olitBefore);
            expect(olitBalance.gt("0")).to.equal(true);
            expect(olitBalance).to.equal(dataBefore.account.claimableRewards[0].amount);
            expect(dataAfter.account.claimableRewards[0].amount).to.equal(0);
            await expect(tx)
                .emit(liqLocker, "RewardPaid")
                .withArgs(aliceAddress, await liqLocker.rewardTokens(0), olitBalance);
        });

        it("process expired locks", async () => {
            const relock = false;
            const dataBefore = await getSnapShot(aliceAddress);
            const tx = await liqLocker.connect(alice).processExpiredLocks(relock);
            await tx.wait();
            const dataAfter = await getSnapShot(aliceAddress);
            const balance = await cvx.balanceOf(aliceAddress);

            expect(dataAfter.account.balances.locked, "user cvx balances locked decreases").to.equal(0);
            expect(dataAfter.lockedSupply, "lockedSupply decreases").to.equal(
                dataBefore.lockedSupply.sub(dataBefore.account.balances.locked),
            );
            expect(balance).to.equal(aliceInitialBalance);
            await verifyCheckpointDelegate(tx, dataBefore, dataAfter);
            await expect(tx)
                .emit(liqLocker, "Withdrawn")
                .withArgs(aliceAddress, dataBefore.account.balances.locked, relock);
        });
    });

    context("smart contract deposits", () => {
        let lockor: MockLiqLocker;
        before(async () => {
            lockor = await deployContract<MockLiqLocker>(
                hre,
                new MockLiqLocker__factory(deployer),
                "Lockor",
                [cvx.address, liqLocker.address],
                {},
                false,
            );

            await cvx.connect(alice).approve(lockor.address, simpleToExactAmount(1000));
            await cvx.connect(alice).approve(liqLocker.address, simpleToExactAmount(1000));
        });
        it("allows smart contract deposits", async () => {
            await lockor.connect(alice).lock(simpleToExactAmount(10));
            await lockor.connect(alice).lockFor(aliceAddress, simpleToExactAmount(10));
        });
        it("allows blacklisting of contracts", async () => {
            const tx = await liqLocker.connect(accounts[7]).modifyBlacklist(lockor.address, true);
            await expect(tx).to.emit(liqLocker, "BlacklistModified").withArgs(lockor.address, true);
            expect(await liqLocker.blacklist(lockor.address)).eq(true);
        });
        it("blocks contracts from depositing when they are blacklisted", async () => {
            await expect(lockor.connect(alice).lockFor(bobAddress, simpleToExactAmount(10))).to.be.revertedWith(
                "blacklisted",
            );
        });
        it("blocks users from depositing for blacklisted contracts", async () => {
            await expect(liqLocker.connect(alice).lock(lockor.address, simpleToExactAmount(10))).to.be.revertedWith(
                "blacklisted",
            );
        });
        it("doesn't allow blacklisting of EOA's", async () => {
            await expect(liqLocker.connect(accounts[7]).modifyBlacklist(aliceAddress, true)).to.be.revertedWith(
                "Must be contract",
            );
            expect(await liqLocker.blacklist(aliceAddress)).eq(false);
            await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
        });
        it("blocks contracts from depositing for a blacklisted smart contract", async () => {
            const mockToken = await deployContract<MockERC20>(
                hre,
                new MockERC20__factory(deployer),
                "mockToken",
                ["mockToken", "mockToken", 18, await deployer.getAddress(), simpleToExactAmount(1000000)],
                {},
                false,
            );
            await liqLocker.connect(accounts[7]).modifyBlacklist(lockor.address, false);
            await liqLocker.connect(accounts[7]).modifyBlacklist(mockToken.address, true);
            await expect(lockor.connect(alice).lockFor(mockToken.address, simpleToExactAmount(10))).to.be.revertedWith(
                "blacklisted",
            );
        });
    });

    context("testing edge scenarios", () => {
        let dataBefore: SnapshotData;
        // t = 0.5, Lock, delegate to self, wait 15 weeks (1.5 weeks before lockup)
        beforeEach(async () => {
            await setup();
            // Given that alice locks cvx and delegates to herself
            await cvx.connect(alice).approve(liqLocker.address, simpleToExactAmount(100));
            await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(100));
            await liqLocker.connect(alice).delegate(aliceAddress);

            await increaseTime(ONE_WEEK.mul(15));
            await liqLocker.checkpointEpoch();
            dataBefore = await getSnapShot(aliceAddress, "beforeEach");
        });

        it("gives a 0 balance one lock has expired", async () => {
            // it gets votes (past votes of current epoch)
            // let totalSupply  = await liqLocker.totalSupply();
            expect(await liqLocker.getVotes(aliceAddress)).eq(dataBefore.delegatee.unlocks[0]);
            await increaseTime(ONE_WEEK.mul(2));
            expect(await liqLocker.getVotes(aliceAddress)).eq(0);
        });
        // t = 15.5, Confirm lock hasn't yet expired. Then try to withdraw (fails)
        // t = 16.5, Confirm lock hasn't yet expired. Then try to withdraw without relock (fails)
        // t = 16.5, relock
        it("allows locks to be processed one week before they are expired ONLY if relocking", async () => {
            expect(dataBefore.account.locks[0].unlockTime).gt(await getTimestamp());

            await expect(liqLocker.connect(alice).processExpiredLocks(true)).to.be.revertedWith("no exp locks");
            await expect(liqLocker.connect(alice).processExpiredLocks(false)).to.be.revertedWith("no exp locks");

            await increaseTime(ONE_WEEK);

            expect((await liqLocker.userLocks(aliceAddress, 0)).unlockTime).gt(await getTimestamp());
            await expect(liqLocker.connect(alice).processExpiredLocks(false)).to.be.revertedWith("no exp locks");

            expect(await liqLocker.getVotes(aliceAddress)).eq(simpleToExactAmount(100));
            expect((await liqLocker.balances(aliceAddress)).locked).eq(simpleToExactAmount(100));
            dataBefore = await getSnapShot(aliceAddress);

            const tx = await liqLocker.connect(alice).processExpiredLocks(true);
            const dataAfter = await getSnapShot(aliceAddress);

            const timeBefore = await getTimestamp();
            await increaseTime(ONE_WEEK);
            // as it is re-lock the cvx should not change.
            expect(dataAfter.account.cvxBalance, "cvx balance does not change").eq(dataBefore.account.cvxBalance);
            expect(await liqLocker.getVotes(aliceAddress)).eq(simpleToExactAmount(100));
            expect(await liqLocker.getPastVotes(aliceAddress, timeBefore)).eq(simpleToExactAmount(100));
            expect((await liqLocker.balances(aliceAddress)).locked).eq(simpleToExactAmount(100));
            await verifyCheckpointDelegate(tx, dataBefore, dataAfter);
            await expect(tx)
                .emit(liqLocker, "Withdrawn")
                .withArgs(aliceAddress, dataBefore.account.balances.locked, true);
        });
        it("allows locks to be processed after they are expired", async () => {
            await increaseTime(ONE_WEEK);

            expect(dataBefore.account.locks[0].unlockTime).gt(await getTimestamp());
            await expect(liqLocker.connect(alice).processExpiredLocks(false)).to.be.revertedWith("no exp locks");

            await increaseTime(ONE_WEEK);

            await liqLocker.connect(alice).processExpiredLocks(false);

            expect(await liqLocker.getVotes(aliceAddress)).eq(0);
            expect((await liqLocker.balances(aliceAddress)).locked).eq(0);
            expect(await liqLocker.balanceOf(aliceAddress)).eq(0);
        });
        it("allows lock to be processed with other unexpired locks following", async () => {
            await cvx.connect(alice).approve(liqLocker.address, simpleToExactAmount(100));
            // Lock 10 more cvx
            await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            expect(await liqLocker.totalSupply(), "totalSupply").to.eq(simpleToExactAmount(100));
            expect(
                await liqLocker.totalSupplyAtEpoch(await liqLocker.findEpochId(await getTimestamp())),
                "totalSupply",
            ).to.eq(simpleToExactAmount(100));

            await increaseTime(ONE_WEEK);
            // Lock 10 more cvx
            await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            await increaseTime(ONE_WEEK);

            const beforeCvxBalance = await cvx.balanceOf(aliceAddress);
            await liqLocker.connect(alice).processExpiredLocks(true);
            expect(await cvx.balanceOf(aliceAddress), "relock - cvx balance does not change").eq(beforeCvxBalance);
            expect(await liqLocker.totalSupply()).eq(simpleToExactAmount(20));
            expect(
                await liqLocker.totalSupplyAtEpoch(await liqLocker.findEpochId(await getTimestamp())),
                "totalSupply",
            ).to.eq(simpleToExactAmount(20));
            // Lock 10 more cvx
            await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            await increaseTime(ONE_WEEK);

            expect(await liqLocker.getVotes(aliceAddress)).eq(simpleToExactAmount(130));
            expect((await liqLocker.balances(aliceAddress)).locked).eq(simpleToExactAmount(130));
            expect(await liqLocker.totalSupply()).eq(simpleToExactAmount(130));
            expect(
                await liqLocker.totalSupplyAtEpoch(await liqLocker.findEpochId(await getTimestamp())),
                "totalSupply",
            ).to.eq(simpleToExactAmount(130));
        });
        it("doesn't allow processing of the same lock twice", async () => {
            await increaseTime(ONE_WEEK);

            const tx = await liqLocker.connect(alice).processExpiredLocks(true);
            await expect(tx)
                .emit(liqLocker, "Withdrawn")
                .withArgs(aliceAddress, dataBefore.account.balances.locked, true);

            await increaseTime(ONE_WEEK);

            await expect(liqLocker.connect(alice).processExpiredLocks(true)).to.be.revertedWith("no exp locks");
        });

        // e.g. unlockTime = 17, now = 15.5, kick > 20
        it("kicks user after sufficient time has elapsed", async () => {
            await increaseTime(ONE_WEEK.mul(4));

            // expect (17 + 3) > now
            const kickRewardEpochDelay = await liqLocker.kickRewardEpochDelay();
            expect(BN.from(dataBefore.account.locks[0].unlockTime).add(ONE_WEEK.mul(kickRewardEpochDelay))).gt(
                await getTimestamp(),
            );

            await expect(liqLocker.connect(alice).kickExpiredLocks(aliceAddress)).to.be.revertedWith("no exp locks");

            await increaseTime(ONE_WEEK);
            expect(dataBefore.lockedSupply, "Staked lockedSupply ").to.eq(simpleToExactAmount(100));

            const tx = await liqLocker.connect(alice).kickExpiredLocks(aliceAddress);
            const dataAfter = await getSnapShot(aliceAddress);

            expect(dataAfter.account.cvxBalance, "cvx reward should be kicked").gt(dataBefore.account.cvxBalance);
            expect(dataAfter.account.cvxBalance, "cvx reward should be kicked").eq(
                dataBefore.account.cvxBalance.add(dataBefore.account.balances.locked),
            );
            expect(dataAfter.lockedSupply, "Staked lockedSupply ").to.eq(0);
            await verifyCheckpointDelegate(tx, dataBefore, dataAfter);
            // Two events should be trigger, Withdrawn (locked amount) and KickReward (kick reward)
            // As the kicked user and lock user are the same, both amounts should be equal to the locked amount.
            await expect(tx)
                .emit(liqLocker, "Withdrawn")
                .withArgs(aliceAddress, dataBefore.account.balances.locked, false);
            await expect(tx).emit(liqLocker, "KickReward").withArgs(aliceAddress, aliceAddress, simpleToExactAmount(1));
        });

        const oneWeekInAdvance = async (): Promise<BN> => {
            const now = await getTimestamp();
            return now.add(ONE_WEEK);
        };
        const floorToWeek = t => Math.trunc(Math.trunc(t / ONE_WEEK.toNumber()) * ONE_WEEK.toNumber());

        // for example, delegate, then add a lock.. should keep the same checkpoint and update it
        it("combines multiple delegation checkpoints in the same epoch", async () => {
            // first lock
            await cvx.connect(alice).approve(liqLocker.address, simpleToExactAmount(100));
            await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            const nextEpoch = floorToWeek(await oneWeekInAdvance());
            const checkpointCount0 = await liqLocker.numCheckpoints(aliceAddress);
            const checkpoint0 = await liqLocker.checkpoints(aliceAddress, checkpointCount0 - 1);

            expect(checkpoint0.epochStart).eq(nextEpoch);
            expect(checkpoint0.votes).eq(simpleToExactAmount(110));

            // second lock - no need of a new checkpoint as it is  the same epoch.
            await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));

            const checkpointCount1 = await liqLocker.numCheckpoints(aliceAddress);
            const checkpoint1 = await liqLocker.checkpoints(aliceAddress, checkpointCount1 - 1);

            expect(checkpointCount1).eq(checkpointCount0);
            expect(checkpoint1.epochStart, "epoch is the same").eq(nextEpoch);
            expect(checkpoint1.votes, "votes increase").eq(simpleToExactAmount(130));

            const tx = await liqLocker.connect(alice).delegate(bobAddress);
            await expect(tx).emit(liqLocker, "DelegateChanged").withArgs(aliceAddress, aliceAddress, bobAddress);
            // old delegatee
            await expect(tx).emit(liqLocker, "DelegateCheckpointed").withArgs(aliceAddress);
            // new delegatee
            await expect(tx).emit(liqLocker, "DelegateCheckpointed").withArgs(bobAddress);

            const checkpointCount2 = await liqLocker.numCheckpoints(aliceAddress);
            const checkpointBobCount2 = await liqLocker.numCheckpoints(bobAddress);
            const checkpoint2 = await liqLocker.checkpoints(aliceAddress, checkpointCount2 - 1);
            const checkpointDel2 = await liqLocker.checkpoints(bobAddress, checkpointBobCount2 - 1);

            expect(checkpointCount2, "number of alice checkpoints").eq(checkpointCount0);
            expect(checkpoint2.epochStart, "epoch is the same").eq(nextEpoch);
            expect(checkpoint2.votes, "alice votes decrease").eq(0);
            expect(checkpointDel2.votes, "delegatee votes increase").eq(checkpoint1.votes);
        });
        it("allows for delegate checkpointing and balance lookup after 16 weeks have elapsed", async () => {
            // first lock
            const cvxAmount = simpleToExactAmount(10);
            const initialData = { ...dataBefore };

            await cvx.connect(alice).approve(liqLocker.address, simpleToExactAmount(100));
            let tx = await liqLocker.connect(alice).lock(aliceAddress, cvxAmount);
            let dataAfter = await getSnapShot(aliceAddress, "after lock week 1");
            await verifyLock(tx, cvxAmount, dataBefore, dataAfter);
            expect(dataAfter.account.liqLockerBalance, "user aura locker balanceOf").to.equal(simpleToExactAmount(100));
            dataBefore = { ...dataAfter };
            // t = 15.5 -> 16.5
            await increaseTime(ONE_WEEK);
            tx = await liqLocker.connect(alice).lock(aliceAddress, cvxAmount);
            dataAfter = await getSnapShot(aliceAddress, "after lock week 2");
            await verifyLock(tx, cvxAmount, dataBefore, dataAfter);
            expect(dataAfter.account.liqLockerBalance, "user aura locker balanceOf").to.equal(simpleToExactAmount(110));
            dataBefore = { ...dataAfter };

            // t = 16.5 -> 17.5
            await increaseTime(ONE_WEEK);
            await liqLocker.connect(alice).lock(aliceAddress, cvxAmount);
            dataAfter = await getSnapShot(aliceAddress, "after lock week 3");
            await verifyLock(tx, cvxAmount, dataBefore, dataAfter);
            expect(dataAfter.account.liqLockerBalance, "user aura locker balanceOf").to.equal(simpleToExactAmount(20));
            dataBefore = { ...dataAfter };
            // 16 weeks
            // t = 17.5 -> 31.5
            await increaseTime(ONE_WEEK.mul(14));
            await liqLocker.connect(alice).lock(aliceAddress, cvxAmount);
            dataAfter = await getSnapShot(aliceAddress, " after lock week 17");
            await verifyLock(tx, cvxAmount, dataBefore, dataAfter);
            expect(dataAfter.account.liqLockerBalance, "user aura locker balanceOf").to.equal(simpleToExactAmount(30));
            dataBefore = { ...dataAfter };

            const pastVotesAlice0 = await liqLocker.getVotes(aliceAddress);
            const pastVotesBob0 = await liqLocker.getVotes(bobAddress);

            expect(pastVotesAlice0, "account votes").to.equal(simpleToExactAmount(30));
            expect(pastVotesBob0, "delegatee votes").to.equal(0);

            tx = await liqLocker.connect(alice).delegate(bobAddress);
            await expect(tx).emit(liqLocker, "DelegateChanged").withArgs(aliceAddress, aliceAddress, bobAddress);
            // old delegatee
            await expect(tx).emit(liqLocker, "DelegateCheckpointed").withArgs(aliceAddress);
            // new delegatee
            await expect(tx).emit(liqLocker, "DelegateCheckpointed").withArgs(bobAddress);
            dataAfter = await getSnapShot(aliceAddress, "after delegate");
            dataBefore = { ...dataAfter };

            expect(dataAfter.account.delegatee, "new delegatee").to.equal(bobAddress);
            // Balances check after locking and delegation
            expect(dataAfter.account.liqLockerBalance, "user aura locker balanceOf").to.equal(simpleToExactAmount(30));
            expect(dataAfter.cvxBalance, "Staked CVX").to.equal(initialData.cvxBalance.add(simpleToExactAmount(40)));
            expect(dataAfter.lockedSupply, "Staked lockedSupply ").to.equal(
                initialData.lockedSupply.add(simpleToExactAmount(40)),
            );
            expect(dataAfter.account.cvxBalance, "cvx balance").to.equal(
                initialData.account.cvxBalance.sub(simpleToExactAmount(40)),
            );
            expect(dataAfter.account.balances.locked, "user cvx balances locked").to.equal(
                initialData.account.balances.locked.add(simpleToExactAmount(40)),
            );

            const pastVotesAlice1 = await liqLocker.getVotes(aliceAddress);
            const pastVotesBob1 = await liqLocker.getVotes(bobAddress);

            expect(pastVotesAlice1, "account votes").to.equal(pastVotesAlice0);
            expect(pastVotesBob1, "delegatee votes").to.equal(pastVotesBob0);

            // Verify it move past locks, as checkpoint is after next epoch, the `getPastVotes` does return the votes delegated.
            // t = 31.5 -> 32.5
            await increaseTime(ONE_WEEK);
            //
            const pastVotesAlice2 = await liqLocker.getVotes(aliceAddress);
            const pastVotesBob2 = await liqLocker.getVotes(bobAddress);
            expect(pastVotesAlice2, "account votes updated").to.equal(0);
            expect(pastVotesBob2, "delegatee votes updated").to.equal(simpleToExactAmount(30));

            expect(
                await liqLocker.getPastTotalSupply((await getTimestamp()).sub(ONE_DAY)),
                "past total supply",
            ).to.equal(simpleToExactAmount(30));
        });
        it("should allow re-delegating in the same period", async () => {
            const charlie = accounts[3];
            const charlieAddress = await charlie.getAddress();
            // first lock
            await cvx.connect(alice).approve(liqLocker.address, simpleToExactAmount(100));
            await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            const nextEpoch = floorToWeek(await oneWeekInAdvance());
            const checkpointCount0 = await liqLocker.numCheckpoints(aliceAddress);
            const checkpoint0 = await liqLocker.checkpoints(aliceAddress, checkpointCount0 - 1);

            expect(checkpoint0.epochStart).eq(nextEpoch);
            expect(checkpoint0.votes).eq(simpleToExactAmount(110));

            // second lock - no need of a new checkpoint as it is  the same epoch.
            await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));

            const checkpointCount1 = await liqLocker.numCheckpoints(aliceAddress);
            const checkpoint1 = await liqLocker.checkpoints(aliceAddress, checkpointCount1 - 1);

            expect(checkpointCount1).eq(checkpointCount0);
            expect(checkpoint1.epochStart, "epoch is the same").eq(nextEpoch);
            expect(checkpoint1.votes, "votes increase").eq(simpleToExactAmount(130));

            // First delegation
            let tx = await liqLocker.connect(alice).delegate(bobAddress);
            await expect(tx).emit(liqLocker, "DelegateChanged").withArgs(aliceAddress, aliceAddress, bobAddress);
            // old delegatee
            await expect(tx).emit(liqLocker, "DelegateCheckpointed").withArgs(aliceAddress);
            // new delegatee
            await expect(tx).emit(liqLocker, "DelegateCheckpointed").withArgs(bobAddress);

            const checkpointCount2 = await liqLocker.numCheckpoints(aliceAddress);
            const checkpointBobCount2 = await liqLocker.numCheckpoints(bobAddress);
            const checkpoint2 = await liqLocker.checkpoints(aliceAddress, checkpointCount2 - 1);
            const checkpointBob2 = await liqLocker.checkpoints(bobAddress, checkpointBobCount2 - 1);

            expect(checkpointCount2, "number of alice checkpoints").eq(checkpointCount0);
            expect(checkpoint2.epochStart, "epoch is the same").eq(nextEpoch);
            expect(checkpoint2.votes, "alice votes decrease").eq(0);
            expect(checkpointBob2.votes, "delegatee votes increase").eq(checkpoint1.votes);

            // Second delegation
            tx = await liqLocker.connect(alice).delegate(charlieAddress);
            await expect(tx).emit(liqLocker, "DelegateChanged").withArgs(aliceAddress, bobAddress, charlieAddress);
            // old delegatee
            await expect(tx).emit(liqLocker, "DelegateCheckpointed").withArgs(bobAddress);
            // new delegatee
            await expect(tx).emit(liqLocker, "DelegateCheckpointed").withArgs(charlieAddress);

            const checkpointCount3 = await liqLocker.numCheckpoints(aliceAddress);
            const checkpointBobCount3 = await liqLocker.numCheckpoints(bobAddress);
            const checkpointRobCount3 = await liqLocker.numCheckpoints(charlieAddress);

            const checkpoint3 = await liqLocker.checkpoints(aliceAddress, checkpointCount3 - 1);
            const checkpointBob3 = await liqLocker.checkpoints(bobAddress, checkpointBobCount3 - 1);
            const checkpointRob3 = await liqLocker.checkpoints(charlieAddress, checkpointRobCount3 - 1);

            expect(checkpointCount3, "number of alice checkpoints").eq(checkpointCount0);
            expect(checkpoint3.epochStart, "epoch is the same").eq(nextEpoch);
            expect(checkpoint3.votes, "alice votes decrease").eq(0);
            expect(checkpointBob3.votes, "old delegatee votes decrease").eq(0);
            expect(checkpointRob3.votes, "new delegatee votes increase").eq(checkpoint1.votes);

            //    Verify information matches with `lockedBalances`
            const aliceLockedBalances = await liqLocker.lockedBalances(aliceAddress);
            expect(aliceLockedBalances.total, "alice total balance").eq(simpleToExactAmount(130));
            expect(aliceLockedBalances.unlockable, "alice total balance").eq(0);
            expect(aliceLockedBalances.locked, "alice total balance").eq(simpleToExactAmount(130));
        });
        it("allows delegation even with 0 balance", async () => {
            expect(await liqLocker.getVotes(aliceAddress)).eq(dataBefore.delegatee.unlocks[0]);
            await increaseTime(ONE_WEEK.mul(2));
            expect(await liqLocker.getVotes(aliceAddress), "expect 0 balance").eq(0);
            const tx = await liqLocker.connect(alice).delegate(bobAddress);
            await expect(tx).emit(liqLocker, "DelegateChanged").withArgs(aliceAddress, aliceAddress, bobAddress);
            // old delegatee
            await expect(tx).emit(liqLocker, "DelegateCheckpointed").withArgs(aliceAddress);
            // new delegatee
            await expect(tx).emit(liqLocker, "DelegateCheckpointed").withArgs(bobAddress);

            const checkpointCount2 = await liqLocker.numCheckpoints(aliceAddress);
            const checkpointBobCount2 = await liqLocker.numCheckpoints(bobAddress);
            const checkpoint2 = await liqLocker.checkpoints(aliceAddress, checkpointCount2 - 1);
            const checkpointBob2 = await liqLocker.checkpoints(bobAddress, checkpointBobCount2 - 1);
            expect(checkpoint2.votes, "alice votes").eq(0);
            expect(checkpointBob2.votes, "delegatee votes").eq(0);
        });
        it("retrieves balance at a given epoch", async () => {
            expect(await liqLocker.balanceAtEpochOf(0, aliceAddress), "account balance at epoch 0").to.equal(0);
            expect(await liqLocker.totalSupplyAtEpoch(0), "account balance at epoch 0").to.equal(0);
            expect(await liqLocker.balanceAtEpochOf(0, bobAddress), "account balance is zero").to.equal(0);
        });
    });

    context("queueing new rewards", () => {
        let cvxStakingProxyAccount: Account;
        // t = 0.5, Lock, delegate to self, wait 15 weeks (1.5 weeks before lockup)
        beforeEach(async () => {
            await setup();
            cvxStakingProxyAccount = await impersonateAccount(cvxStakingProxy.address);

            await cvx.connect(alice).approve(liqLocker.address, simpleToExactAmount(1000));
        });
        it("fails if the sender is not rewardsDistributor", async () => {
            // Only the rewardsDistributor can queue cvxCRV rewards
            await expect(liqLocker.queueNewRewards(cvxCrv.address, simpleToExactAmount(100))).revertedWith(
                "!authorized",
            );
        });
        it("fails if the amount of rewards is 0", async () => {
            // Only the rewardsDistributor can queue cvxCRV rewards
            await expect(
                liqLocker.connect(cvxStakingProxyAccount.signer).queueNewRewards(olit.address, simpleToExactAmount(0)),
            ).revertedWith("No reward");
        });
        it("fails if balance is too low", async () => {
            await booster.earmarkRewards(boosterPoolId);
            await increaseTime(ONE_DAY);

            const incentive = await booster.stakerIncentive();
            const rate = await mocks.crvMinter.rate();
            const stakingCrvBalance = await mocks.crv.balanceOf(cvxStakingProxy.address);

            expect(stakingCrvBalance).to.equal(rate.mul(incentive).div(10000));

            await expect(cvxStakingProxy["distribute()"]()).to.be.revertedWith("!balance");
        });
        it("distribute rewards from the booster", async () => {
            await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(100));
            await distributeRewardsFromBooster();
        });
        it("queues rewards when cvxCrv period is finished", async () => {
            await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(100));

            let rewards = simpleToExactAmount(100);
            const rewardDistribution = await liqLocker.rewardsDuration();
            const olitLockerBalance0 = await olit.balanceOf(liqLocker.address);
            const queuedOLitRewards0 = await liqLocker.queuedRewards(olit.address);
            const rewardData0 = await liqLocker.rewardData(olit.address);
            const timeStamp = await getTimestamp();

            expect(timeStamp, "reward period finish").to.gte(rewardData0.periodFinish);

            // test queuing rewards
            rewards = await distributeRewardsFromBooster();
            // Validate
            const rewardData1 = await liqLocker.rewardData(olit.address);
            expect(await olit.balanceOf(liqLocker.address), "olit is transfer to locker").to.eq(
                olitLockerBalance0.add(rewards),
            );
            expect(await liqLocker.queuedRewards(olit.address), "queued olit rewards").to.eq(0);

            // Verify reward data is updated, reward rate, lastUpdateTime, periodFinish; when the lastUpdateTime is lt than now.
            expect(rewardData1.lastUpdateTime, "olit reward last update time").to.gt(rewardData0.lastUpdateTime);
            expect(rewardData1.periodFinish, "olit reward period finish").to.gt(rewardData0.periodFinish);
            expect(rewardData1.rewardPerTokenStored, "olit reward per token stored").to.eq(
                rewardData0.rewardPerTokenStored,
            );
            expect(rewardData1.rewardRate, "olit rewards rate").to.eq(
                queuedOLitRewards0.add(rewards).div(rewardDistribution),
            );
        });

        it("only starts distributing the rewards when the queued amount is over 83% of the remaining", async () => {
            await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(100));
            const olitLockerBalance0 = await olit.balanceOf(liqLocker.address);
            const rewardData0 = await liqLocker.rewardData(olit.address);
            const timeStamp = await getTimestamp();

            expect(timeStamp, "reward period finish").to.gte(rewardData0.periodFinish);

            // First distribution to update the reward finish period.
            let rewards = await distributeRewardsFromBooster();

            // Validate
            const olitLockerBalance1 = await olit.balanceOf(liqLocker.address);
            const queuedOLitRewards1 = await liqLocker.queuedRewards(olit.address);
            const rewardData1 = await liqLocker.rewardData(olit.address);

            // Verify reward data is updated, reward rate, lastUpdateTime, periodFinish; when the lastUpdateTime is lt than now.
            expect(rewardData1.lastUpdateTime, "olit reward last update time").to.gt(rewardData0.lastUpdateTime);
            expect(rewardData1.periodFinish, "olit reward period finish").to.gt(rewardData0.periodFinish);
            expect(rewardData1.rewardPerTokenStored, "olit reward per token stored").to.eq(
                rewardData0.rewardPerTokenStored,
            );
            expect(rewardData1.rewardRate, "olit rewards rate").to.gt(rewardData0.rewardRate);
            expect(olitLockerBalance1, "olit is transfer to locker").to.eq(olitLockerBalance0.add(rewards));
            expect(queuedOLitRewards1, "queued olit rewards").to.eq(0);

            // Second distribution of an small amount, without notification as the ratio is not reached.
            await increaseTime(ONE_DAY);
            // rewards = await distributeRewardsFromBooster();
            await olit.transfer(cvxStakingProxy.address, e15.mul(10));
            let tx = await cvxStakingProxy["distribute()"]();
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "RewardsDistributed");
            rewards = event.args[1];

            const olitLockerBalance2 = await olit.balanceOf(liqLocker.address);
            const queuedOLitRewards2 = await liqLocker.queuedRewards(olit.address);
            const rewardData2 = await liqLocker.rewardData(olit.address);

            // Verify reward data is not updated, as ratio is not reached.
            expect(rewardData2.lastUpdateTime, "olit reward last update time").to.eq(rewardData1.lastUpdateTime);
            expect(rewardData2.periodFinish, "olit reward period finish").to.eq(rewardData1.periodFinish);
            expect(rewardData2.rewardPerTokenStored, "olit reward per token stored").to.eq(
                rewardData1.rewardPerTokenStored,
            );
            expect(rewardData2.rewardRate, "olit rewards rate").to.eq(rewardData1.rewardRate);
            expect(olitLockerBalance2, "olit is transfer to locker").to.eq(olitLockerBalance1.add(rewards));
            expect(queuedOLitRewards2, "queued olit rewards").to.eq(queuedOLitRewards1.add(rewards));

            // Third distribution the ratio is reached, the reward is distributed.
            rewards = await distributeRewardsFromBooster();

            const olitLockerBalance3 = await olit.balanceOf(liqLocker.address);
            const queuedOLitRewards3 = await liqLocker.queuedRewards(olit.address);
            const rewardData3 = await liqLocker.rewardData(olit.address);

            // Verify reward data is updated, reward rate, lastUpdateTime, periodFinish; when the lastUpdateTime is lt than now.
            expect(rewardData3.lastUpdateTime, "olit reward last update time").to.gt(rewardData2.lastUpdateTime);
            expect(rewardData3.periodFinish, "olit reward period finish").to.gt(rewardData2.periodFinish);
            expect(rewardData3.rewardPerTokenStored, "olit reward per token stored").to.gt(
                rewardData2.rewardPerTokenStored,
            );
            expect(rewardData3.rewardRate, "olit rewards rate").to.gt(rewardData2.rewardRate);
            expect(olitLockerBalance3, "olit is transfer to locker").to.eq(olitLockerBalance2.add(rewards));
            expect(queuedOLitRewards3, "queued olit rewards").to.eq(0);

            // Process expired locks and claim rewards for user.
            await increaseTime(ONE_WEEK.mul(17));

            await liqLocker.connect(alice).processExpiredLocks(false);
            const userOLitData = await liqLocker.userData(aliceAddress, olit.address);
            const olitAliceBalance3 = await olit.balanceOf(aliceAddress);

            tx = await liqLocker["getReward(address)"](aliceAddress);
            await expect(tx)
                .to.emit(liqLocker, "RewardPaid")
                .withArgs(aliceAddress, olit.address, userOLitData.rewards);
            const olitAliceBalance4 = await olit.balanceOf(aliceAddress);
            const olitLockerBalance4 = await olit.balanceOf(liqLocker.address);
            expect(olitAliceBalance4, "olit claimed").to.eq(olitAliceBalance3.add(userOLitData.rewards));
            expect(olitLockerBalance4, "olit sent").to.eq(olitLockerBalance3.sub(userOLitData.rewards));
        });
    });

    const checkBalances = async (
        user: string,
        epochId: number,
        expectedBalance: BN | number,
        expectedSupply: BN | number,
        prevEpochBal?: BN | number,
        prevEpochSupply?: BN | number,
    ) => {
        const balCur = await liqLocker.balanceOf(user);
        expect(balCur).eq(expectedBalance);
        const balAtEpoch = await liqLocker.balanceAtEpochOf(epochId, user);
        expect(balAtEpoch).eq(expectedBalance);
        if (prevEpochBal) {
            const balAtPrevEpoch = await liqLocker.balanceAtEpochOf(epochId - 1, user);
            expect(balAtPrevEpoch).eq(prevEpochBal);
        }
        const supplyCur = await liqLocker.totalSupply();
        expect(supplyCur).eq(expectedSupply);
        const supplAtEpoch = await liqLocker.totalSupplyAtEpoch(epochId);
        expect(supplAtEpoch).eq(expectedSupply);
        if (prevEpochSupply) {
            const supplAtPrevEpoch = await liqLocker.totalSupplyAtEpoch(epochId - 1);
            expect(supplAtPrevEpoch).eq(prevEpochSupply);
        }
    };

    const checkBalanceAtEpoch = async (
        user: string,
        epochId: number,
        expectedBalance: BN | number,
        expectedSupply: BN | number,
    ) => {
        const balAtEpoch = await liqLocker.balanceAtEpochOf(epochId, user);
        expect(balAtEpoch).eq(expectedBalance);
        const supplAtEpoch = await liqLocker.totalSupplyAtEpoch(epochId);
        expect(supplAtEpoch).eq(expectedSupply);
    };

    context("checking delegation timelines", () => {
        let delegate0, delegate1, delegate2;

        /*                                **
         *  0   1   2   3   8   9 ... 16  17  18 <-- Weeks
         * alice    alice    bob                 <-- Locking
         *    ^
         * +alice ^           ^                  <-- delegate 0
         *      +alice      +bob        ^        <-- delegate 1
         *                            +alice     <-- delegate 2
         *
         * delegate0 has balance of 100 in 1
         * delegate1 has balance of 100 from 2, 200 from 3-8, 300 from 9-16 & 100 from 17
         * delegate2 has balance of 100 from 17
         */
        before(async () => {
            await setup();
            delegate0 = await accounts[2].getAddress();
            delegate1 = await accounts[3].getAddress();
            delegate2 = await accounts[4].getAddress();

            // Mint some cvxCRV and add as the reward token manually
            let tx = await cvx.connect(alice).approve(liqLocker.address, simpleToExactAmount(100));
            await tx.wait();
            tx = await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(100));
            await tx.wait();

            tx = await booster.earmarkRewards(boosterPoolId);
            await tx.wait();

            tx = await cvxStakingProxy["distribute()"]();
            await tx.wait();

            const lock = await liqLocker.userLocks(aliceAddress, 0);
            expect(lock.amount).to.equal(simpleToExactAmount(100));
        });
        it("has no delegation at the start", async () => {
            const delegate = await liqLocker.delegates(aliceAddress);
            expect(delegate).eq(ZERO_ADDRESS);

            expect((await liqLocker.rewardData(olit.address)).rewardRate).gt(0);
        });
        it("fails to delegate to 0", async () => {
            await expect(liqLocker.connect(alice).delegate(ZERO_ADDRESS)).to.be.revertedWith(
                "Must delegate to someone",
            );
        });
        it("fails when bob tries to delegate with no locks", async () => {
            await expect(liqLocker.connect(bob).delegate(delegate0)).to.be.revertedWith("Nothing to delegate");
        });
        // t = 0.5 -> 1.5
        it("delegates to 0", async () => {
            await checkBalances(aliceAddress, 0, 0, 0);

            const tx = await liqLocker.connect(alice).delegate(delegate0);
            await tx.wait();

            const aliceBal = (await liqLocker.balances(aliceAddress)).locked;
            const aliceVotes = await liqLocker.getVotes(aliceAddress);
            const delegatee = await liqLocker.delegates(aliceAddress);
            let delegateVotes = await liqLocker.getVotes(delegate0);
            expect(aliceBal).eq(simpleToExactAmount(100));
            expect(aliceVotes).eq(0);
            expect(delegatee).eq(delegate0);
            expect(delegateVotes).eq(0);

            await increaseTime(ONE_WEEK);

            await checkBalances(aliceAddress, 1, simpleToExactAmount(100), simpleToExactAmount(100), 0, 0);
            delegateVotes = await liqLocker.getVotes(delegate0);
            expect(delegateVotes).eq(simpleToExactAmount(100));
        });
        it("fails to delegate back to 0", async () => {
            await expect(liqLocker.connect(alice).delegate(ZERO_ADDRESS)).to.be.revertedWith(
                "Must delegate to someone",
            );
        });
        it("fails to delegate back to the same delegate", async () => {
            await expect(liqLocker.connect(alice).delegate(delegate0)).to.be.revertedWith("Must choose new delegatee");
        });
        // t = 1.5 -> 2.5
        it("changes delegation to delegate1", async () => {
            const tx = await liqLocker.connect(alice).delegate(delegate1);
            await tx.wait();

            const delegatee = await liqLocker.delegates(aliceAddress);
            let delegate0Votes = await liqLocker.getVotes(delegate0);
            let delegate1Votes = await liqLocker.getVotes(delegate1);
            expect(delegatee).eq(delegate1);
            expect(delegate0Votes).eq(simpleToExactAmount(100));
            expect(delegate1Votes).eq(0);

            const week1point5 = await getTimestamp();

            await increaseTime(ONE_WEEK);

            const week2point5 = await getTimestamp();

            await checkBalances(
                aliceAddress,
                2,
                simpleToExactAmount(100),
                simpleToExactAmount(100),
                simpleToExactAmount(100),
                simpleToExactAmount(100),
            );

            delegate0Votes = await liqLocker.getVotes(delegate0);
            const delegate0Historic = await liqLocker.getPastVotes(delegate0, week1point5);
            const delegate0Now = await liqLocker.getPastVotes(delegate0, week2point5);
            delegate1Votes = await liqLocker.getVotes(delegate1);
            const delegate1Historic = await liqLocker.getPastVotes(delegate1, week1point5);
            const delegate1Now = await liqLocker.getPastVotes(delegate1, week2point5);

            expect(delegate0Votes).eq(0);
            expect(delegate0Historic).eq(simpleToExactAmount(100));
            expect(delegate0Now).eq(0);
            expect(delegate1Votes).eq(simpleToExactAmount(100));
            expect(delegate1Historic).eq(0);
            expect(delegate1Now).eq(simpleToExactAmount(100));
        });

        // t = 2.5 -> 8.5
        it("deposits more for alice", async () => {
            let tx = await cvx.connect(alice).approve(liqLocker.address, simpleToExactAmount(100));
            await tx.wait();
            tx = await liqLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(100));
            await tx.wait();

            await checkBalances(
                aliceAddress,
                2,
                simpleToExactAmount(100),
                simpleToExactAmount(100),
                simpleToExactAmount(100),
                simpleToExactAmount(100),
            );

            const week2point5 = await getTimestamp();

            await increaseTime(ONE_WEEK);

            const week3point5 = await getTimestamp();

            await checkBalances(
                aliceAddress,
                3,
                simpleToExactAmount(200),
                simpleToExactAmount(200),
                simpleToExactAmount(100),
                simpleToExactAmount(100),
            );

            const delegate1Historic = await liqLocker.getPastVotes(delegate1, week2point5);
            const delegate1Now = await liqLocker.getPastVotes(delegate1, week3point5);

            expect(delegate1Historic).eq(simpleToExactAmount(100));
            expect(delegate1Now).eq(simpleToExactAmount(200));

            await increaseTime(ONE_WEEK.mul(5));

            await checkBalances(
                aliceAddress,
                8,
                simpleToExactAmount(200),
                simpleToExactAmount(200),
                simpleToExactAmount(200),
                simpleToExactAmount(200),
            );
        });
        // t = 8.5 -> 16.5
        it("deposits for bob and delegates", async () => {
            let tx = await cvx.connect(bob).approve(liqLocker.address, simpleToExactAmount(100));
            await tx.wait();
            tx = await liqLocker.connect(bob).lock(bobAddress, simpleToExactAmount(100));
            await tx.wait();
            tx = await liqLocker.connect(bob).delegate(delegate1);
            await tx.wait();

            const week8point5 = await getTimestamp();

            await increaseTime(ONE_WEEK);

            const week9point5 = await getTimestamp();

            const delegate1Historic = await liqLocker.getPastVotes(delegate1, week8point5);
            const delegate1Now = await liqLocker.getPastVotes(delegate1, week9point5);

            expect(delegate1Historic).eq(simpleToExactAmount(200));
            expect(delegate1Now).eq(simpleToExactAmount(300));

            await increaseTime(ONE_WEEK.mul(7));
        });

        // t = 16.5 -> 17.5
        it("delegates alice to 2 and omits upcoming release", async () => {
            const tx = await liqLocker.connect(alice).delegate(delegate2);
            await tx.wait();

            const week16point5 = await getTimestamp();

            await checkBalances(
                aliceAddress,
                16,
                simpleToExactAmount(200),
                simpleToExactAmount(300),
                simpleToExactAmount(200),
                simpleToExactAmount(300),
            );

            await increaseTime(ONE_WEEK);

            const week17point5 = await getTimestamp();

            await checkBalances(
                aliceAddress,
                17,
                simpleToExactAmount(100),
                simpleToExactAmount(200),
                simpleToExactAmount(200),
                simpleToExactAmount(300),
            );
            await checkBalanceAtEpoch(aliceAddress, 0, simpleToExactAmount(0), simpleToExactAmount(0));
            await checkBalanceAtEpoch(aliceAddress, 1, simpleToExactAmount(100), simpleToExactAmount(100));
            await checkBalanceAtEpoch(aliceAddress, 2, simpleToExactAmount(100), simpleToExactAmount(100));
            await checkBalanceAtEpoch(aliceAddress, 3, simpleToExactAmount(200), simpleToExactAmount(200));

            const delegate1Historic = await liqLocker.getPastVotes(delegate1, week16point5);
            const delegate1Now = await liqLocker.getPastVotes(delegate1, week17point5);
            const delegate2Historic = await liqLocker.getPastVotes(delegate2, week16point5);
            const delegate2Now = await liqLocker.getPastVotes(delegate2, week17point5);

            expect(delegate1Historic).eq(simpleToExactAmount(300));
            expect(delegate1Now).eq(simpleToExactAmount(100));

            expect(delegate2Historic).eq(simpleToExactAmount(0));
            expect(delegate2Now).eq(simpleToExactAmount(100));
        });
    });

    context("fails if", () => {
        before(async () => {
            await setup();
        });
        it("@queueNewRewards sender is not a distributor", async () => {
            await expect(liqLocker.queueNewRewards(cvx.address, 0)).revertedWith("!authorized");
        });
        it("@queueNewRewards sends wrong amount", async () => {
            const mockToken = await deployContract<MockERC20>(
                hre,
                new MockERC20__factory(deployer),
                "mockToken",
                ["mockToken", "mockToken", 18, await deployer.getAddress(), 10000000],
                {},
                false,
            );
            const distributor = accounts[3];
            await liqLocker.connect(accounts[7]).addReward(mockToken.address, await distributor.getAddress());
            await liqLocker
                .connect(accounts[7])
                .approveRewardDistributor(mockToken.address, await distributor.getAddress(), true);
            await expect(liqLocker.connect(distributor).queueNewRewards(mockToken.address, 0)).revertedWith(
                "No reward",
            );
        });
        it("@lock wrong amount of CVX", async () => {
            const cvxAmount = 0;
            await expect(liqLocker.connect(alice).lock(aliceAddress, cvxAmount)).revertedWith("Cannot stake 0");
        });
        it("get past supply before any lock.", async () => {
            await expect(liqLocker.connect(alice).getPastTotalSupply(await getTimestamp())).revertedWith(
                "ERC20Votes: block not yet mined",
            );
        });
        it("approves reward wrong arguments", async () => {
            const tx = liqLocker.connect(accounts[7]).approveRewardDistributor(ZERO_ADDRESS, ZERO_ADDRESS, false);
            await expect(tx).revertedWith("Reward does not exist");
        });
        it("non admin - shutdowns", async () => {
            await expect(liqLocker.connect(alice).shutdown()).revertedWith("Ownable: caller is not the owner");
        });
        it("non admin - add Reward", async () => {
            await expect(liqLocker.connect(alice).addReward(ZERO_ADDRESS, ZERO_ADDRESS)).revertedWith(
                "Ownable: caller is not the owner",
            );
        });
        it("non admin - set Kick Incentive", async () => {
            await expect(liqLocker.connect(alice).setKickIncentive(ZERO, ZERO)).revertedWith(
                "Ownable: caller is not the owner",
            );
        });
        it("non admin - approves reward distributor", async () => {
            await expect(
                liqLocker.connect(alice).approveRewardDistributor(ZERO_ADDRESS, ZERO_ADDRESS, false),
            ).revertedWith("Ownable: caller is not the owner");
        });
        it("non admin - recover ERC20", async () => {
            await expect(liqLocker.connect(alice).recoverERC20(ZERO_ADDRESS, ZERO)).revertedWith(
                "Ownable: caller is not the owner",
            );
        });
        it("non admin - modify Blacklist", async () => {
            await expect(liqLocker.connect(alice).modifyBlacklist(ZERO_ADDRESS, true)).revertedWith(
                "Ownable: caller is not the owner",
            );
        });
        it("set Kick Incentive with wrong rate", async () => {
            await expect(liqLocker.connect(accounts[7]).setKickIncentive(501, ZERO)).revertedWith("over max rate");
        });
        it("set Kick Incentive with wrong delay", async () => {
            await expect(liqLocker.connect(accounts[7]).setKickIncentive(100, 1)).revertedWith("min delay");
        });
        it("recover ERC20 with wrong token address", async () => {
            await expect(liqLocker.connect(accounts[7]).recoverERC20(cvx.address, ZERO)).revertedWith(
                "Cannot withdraw staking token",
            );
        });
        it("recover ERC20 cannot withdraw reward", async () => {
            await liqLocker.connect(accounts[7]).addReward(cvxCrvRewards.address, cvxCrvRewards.address);
            expect((await liqLocker.rewardData(cvxCrvRewards.address)).lastUpdateTime).to.not.eq(0);
            await expect(liqLocker.connect(accounts[7]).recoverERC20(cvxCrvRewards.address, ZERO)).revertedWith(
                "Cannot withdraw reward token",
            );
        });
        it("emergency withdraw is call and it is not shutdown", async () => {
            await expect(liqLocker.emergencyWithdraw()).revertedWith("Must be shutdown");
        });
        it("@addReward staking token", async () => {
            await expect(
                liqLocker.connect(accounts[7]).addReward(await liqLocker.stakingToken(), ZERO_ADDRESS),
            ).revertedWith("Cannot add StakingToken as reward");
        });
        it("@addReward reward already exist", async () => {
            await liqLocker.connect(accounts[7]).addReward("0x0000000000000000000000000000000000000001", ZERO_ADDRESS);
            await expect(
                liqLocker.connect(accounts[7]).addReward("0x0000000000000000000000000000000000000001", ZERO_ADDRESS),
            ).revertedWith("Reward already exists");
        });
        it("@addReward 5 or more rewards", async () => {
            await liqLocker.connect(accounts[7]).addReward("0x0000000000000000000000000000000000000002", ZERO_ADDRESS);
            await expect(
                liqLocker.connect(accounts[7]).addReward("0x0000000000000000000000000000000000000003", ZERO_ADDRESS),
            ).revertedWith("Max rewards length");
        });
        it("@getReward wrong skip index argument", async () => {
            await expect(
                liqLocker.connect(accounts[7])["getReward(address,bool[])"](aliceAddress, [false, false]),
            ).revertedWith("!arr");
        });
    });
    context("admin", () => {
        before(async () => {
            await setup();
        });
        it("approves reward distributor", async () => {
            const cvxAmount = simpleToExactAmount(100);
            await cvx.connect(alice).approve(liqLocker.address, cvxAmount);

            // approves  distributor
            await liqLocker.connect(accounts[7]).approveRewardDistributor(olit.address, cvxCrvRewards.address, true);
            expect(await liqLocker.rewardDistributors(olit.address, cvxCrvRewards.address)).to.eq(true);

            // disapproves  distributor
            await liqLocker.connect(accounts[7]).approveRewardDistributor(olit.address, cvxCrvRewards.address, false);
            expect(await liqLocker.rewardDistributors(olit.address, cvxCrvRewards.address)).to.eq(false);
        });
        it("set Kick Incentive", async () => {
            await expect(liqLocker.connect(accounts[7]).setKickIncentive(100, 3))
                .emit(liqLocker, "KickIncentiveSet")
                .withArgs(100, 3);
            expect(await liqLocker.kickRewardPerEpoch()).to.eq(100);
            expect(await liqLocker.kickRewardEpochDelay()).to.eq(3);
        });
        it("recover ERC20", async () => {
            const mockToken = await deployContract<MockERC20>(
                hre,
                new MockERC20__factory(deployer),
                "mockToken",
                ["mockToken", "mockToken", 18, await deployer.getAddress(), 10000000],
                {},
                false,
            );

            await mockToken.connect(deployer).approve(liqLocker.address, simpleToExactAmount(100));
            await mockToken.connect(deployer).transfer(liqLocker.address, simpleToExactAmount(10));

            const mockDeployerBalanceBefore = await mockToken.balanceOf(await accounts[7].getAddress());
            const mockLockerBalanceBefore = await mockToken.balanceOf(liqLocker.address);
            expect(mockLockerBalanceBefore, "locker external lp reward").to.eq(simpleToExactAmount(10));
            const tx = liqLocker.connect(accounts[7]).recoverERC20(mockToken.address, simpleToExactAmount(10));
            await expect(tx).emit(liqLocker, "Recovered").withArgs(mockToken.address, simpleToExactAmount(10));

            const mockDeployerBalanceAfter = await mockToken.balanceOf(await accounts[7].getAddress());
            const mockLockerBalanceAfter = await mockToken.balanceOf(liqLocker.address);

            expect(mockLockerBalanceAfter, "locker external lp reward").to.eq(0);
            expect(mockDeployerBalanceAfter, "owner external lp reward").to.eq(
                mockDeployerBalanceBefore.add(simpleToExactAmount(10)),
            );
        });
    });
    context("is shutdown", () => {
        beforeEach(async () => {
            await setup();
        });
        it("fails if lock", async () => {
            // Given that the aura locker is shutdown
            await liqLocker.connect(accounts[7]).shutdown();
            expect(await liqLocker.isShutdown()).to.eq(true);
            // Then it should fail to lock
            const cvxAmount = simpleToExactAmount(100);
            await cvx.connect(alice).approve(liqLocker.address, cvxAmount);
            const tx = liqLocker.connect(alice).lock(aliceAddress, cvxAmount);
            await expect(tx).revertedWith("shutdown");
        });
        it("process un-expired locks", async () => {
            const cvxAmount = simpleToExactAmount(100);
            const relock = false;
            await cvx.connect(alice).approve(liqLocker.address, cvxAmount);
            await liqLocker.connect(alice).lock(aliceAddress, cvxAmount);

            await expect(liqLocker.connect(alice).processExpiredLocks(relock)).revertedWith("no exp locks");

            // Given that the aura locker is shutdown
            await liqLocker.connect(accounts[7]).shutdown();
            expect(await liqLocker.isShutdown()).to.eq(true);
            // Then it should be able to process unexpired locks

            const dataBefore = await getSnapShot(aliceAddress);
            const tx = await liqLocker.connect(alice).processExpiredLocks(relock);

            const balance = await cvx.balanceOf(aliceAddress);
            expect(await liqLocker.balanceOf(aliceAddress), "liqLocker balance for user is zero").to.equal(0);
            expect(await liqLocker.lockedSupply(), "lockedSupply decreases").to.equal(
                dataBefore.lockedSupply.sub(dataBefore.account.balances.locked),
            );
            expect(balance).to.equal(aliceInitialBalance);
            await expect(tx)
                .emit(liqLocker, "Withdrawn")
                .withArgs(aliceAddress, dataBefore.account.balances.locked, relock);
        });
        it("emergencyWithdraw  when user has no locks", async () => {
            // Given that the aura locker is shutdown
            await liqLocker.connect(accounts[7]).shutdown();
            expect(await liqLocker.isShutdown()).to.eq(true);
            // It fails if the user has no locks
            await expect(liqLocker.connect(alice).emergencyWithdraw()).revertedWith("Nothing locked");
        });
        it("emergencyWithdraw  when user has locks", async () => {
            const cvxAmount = simpleToExactAmount(100);
            const relock = false;
            await cvx.connect(alice).approve(liqLocker.address, cvxAmount);
            await liqLocker.connect(alice).lock(aliceAddress, cvxAmount);
            // Given that the aura locker is shutdown
            await liqLocker.connect(accounts[7]).shutdown();
            expect(await liqLocker.isShutdown()).to.eq(true);
            // Then it should be able to withdraw in an emergency
            const dataBefore = await getSnapShot(aliceAddress);
            const tx = await liqLocker.connect(alice).emergencyWithdraw();
            expect(await liqLocker.balanceOf(aliceAddress)).eq(0);
            const balance = await cvx.balanceOf(aliceAddress);

            expect(await liqLocker.lockedSupply(), "lockedSupply decreases").to.equal(
                dataBefore.lockedSupply.sub(dataBefore.account.balances.locked),
            );
            expect(balance, "balance").to.equal(aliceInitialBalance);
            await expect(tx)
                .emit(liqLocker, "Withdrawn")
                .withArgs(aliceAddress, dataBefore.account.balances.locked, relock);
        });
    });
});
