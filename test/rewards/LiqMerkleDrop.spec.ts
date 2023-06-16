import { assertBNClose, assertBNClosePercent } from "../../test-utils/assertions";
import hre, { ethers } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { expect } from "chai";
import { MerkleTree } from "merkletreejs";
import { deployPhase1, deployPhase2, DistroList, Phase2Deployed } from "../../scripts/deploySystem";
import { deployMocks, getMockDistro, getMockMultisigs } from "../../scripts/deployMocks";
import { LiqLocker, ERC20, LiqMerkleDrop__factory, LiqMerkleDrop } from "../../types/generated";
import { ONE_WEEK, ZERO_ADDRESS, ZERO, e18, ONE_DAY } from "../../test-utils/constants";
import { getTimestamp, increaseTime, increaseTimeTo } from "../../test-utils/time";
import { BN, simpleToExactAmount } from "../../test-utils/math";
import { impersonateAccount } from "../../test-utils/fork";
import { createTreeWithAccounts, getAccountBalanceProof } from "../../test-utils/merkle";

interface User {
    address: string;
    amount: BigNumber;
}

const users: User[] = [
    {
        address: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
        amount: e18.mul(1000),
    },
    {
        address: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        amount: e18.mul(2000),
    },
    {
        address: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
        amount: e18.mul(3000),
    },
    {
        address: "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
        amount: e18.mul(4000),
    },
    {
        address: "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
        amount: e18.mul(5000),
    },
    {
        address: "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc",
        amount: e18.mul(6000),
    },
];

describe("LiqMerkleDrop", () => {
    let accounts: Signer[];

    let contracts: Phase2Deployed;
    let aura: ERC20;
    let liqLocker: LiqLocker;
    let merkleDrop: LiqMerkleDrop;

    let deployTime: BN;
    let dropAmount: BN;

    let deployer: Signer;
    let deployerAddress: string;

    let admin: Signer;
    let adminAddress: string;

    let alice: Signer;
    let aliceAddress: string;

    let bob: Signer;
    let bobAddress: string;

    let dave: Signer;
    let daveAddress: string;

    let paul: Signer;

    let distro: DistroList;

    before(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];

        const mocks = await deployMocks(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[0], accounts[0], accounts[0]);
        distro = getMockDistro();

        const phase1 = await deployPhase1(hre, deployer, mocks.addresses);
        contracts = await deployPhase2(hre, deployer, phase1, distro, multisigs, mocks.namingConfig, mocks.addresses);

        deployerAddress = await deployer.getAddress();

        admin = accounts[1];
        adminAddress = await admin.getAddress();

        alice = accounts[2];
        aliceAddress = await alice.getAddress();

        bob = accounts[3];
        bobAddress = await bob.getAddress();

        dave = accounts[4];
        daveAddress = await dave.getAddress();

        paul = accounts[5];

        aura = contracts.cvx.connect(deployer) as ERC20;
        liqLocker = contracts.cvxLocker.connect(deployer);

        const operatorAccount = await impersonateAccount(contracts.booster.address);
        await contracts.cvx
            .connect(operatorAccount.signer)
            .mint(operatorAccount.address, simpleToExactAmount(1000000, 18));
        await contracts.cvx.connect(operatorAccount.signer).transfer(deployerAddress, simpleToExactAmount(100000));

        deployTime = await getTimestamp();

        dropAmount = users.reduce((p, c) => p.add(c.amount), BN.from(0));
    });
    describe("constructor fails", async () => {
        let tree: MerkleTree;
        before(async () => {
            tree = createTreeWithAccounts({
                [users[0].address]: users[0].amount,
                [users[1].address]: users[1].amount,
                [users[2].address]: users[2].amount,
                [users[3].address]: users[3].amount,
                [users[4].address]: users[4].amount,
                [users[5].address]: users[5].amount,
            });
        });
        it("if the expire date is less than 2 weeks", async () => {
            await expect(
                new LiqMerkleDrop__factory(deployer).deploy(
                    adminAddress,
                    tree.getHexRoot(),
                    aura.address,
                    liqLocker.address,
                    ONE_WEEK,
                    ONE_WEEK.mul(2),
                    users.length,
                    dropAmount,
                ),
            ).to.be.revertedWith("!expiry");
        });
        it("if zero address on any argument", async () => {
            await expect(
                new LiqMerkleDrop__factory(deployer).deploy(
                    ZERO_ADDRESS,
                    tree.getHexRoot(),
                    aura.address,
                    liqLocker.address,
                    ONE_WEEK,
                    ONE_WEEK.mul(3),
                    users.length,
                    dropAmount,
                ),
                "Wrong _dao",
            ).to.be.revertedWith("!dao");
            await expect(
                new LiqMerkleDrop__factory(deployer).deploy(
                    adminAddress,
                    tree.getHexRoot(),
                    ZERO_ADDRESS,
                    liqLocker.address,
                    ONE_WEEK,
                    ONE_WEEK.mul(3),
                    users.length,
                    dropAmount,
                ),
                "Wrong aura",
            ).to.be.revertedWith("!aura");
        });
    });
    describe("basic MerkleDrop interactions", () => {
        let tree: MerkleTree;
        before(async () => {
            tree = createTreeWithAccounts({
                [users[0].address]: users[0].amount,
                [users[1].address]: users[1].amount,
                [users[2].address]: users[2].amount,
                [users[3].address]: users[3].amount,
                [users[4].address]: users[4].amount,
                [users[5].address]: users[5].amount,
            });
            merkleDrop = await new LiqMerkleDrop__factory(deployer).deploy(
                adminAddress,
                tree.getHexRoot(),
                aura.address,
                liqLocker.address,
                ONE_WEEK,
                ONE_WEEK.mul(16),
                users.length,
                dropAmount,
            );
            await aura.transfer(merkleDrop.address, dropAmount);
        });
        it("initial configuration is correct", async () => {
            expect(await merkleDrop.aura()).eq(aura.address);
            expect(await merkleDrop.dao(), "dao").to.eq(adminAddress);
            expect(await merkleDrop.merkleRoot(), "merkleRoot").to.eq(tree.getHexRoot());
            expect(await merkleDrop.aura(), "aura").to.eq(aura.address);
            expect(await merkleDrop.liqLocker(), "liqLocker").to.eq(liqLocker.address);
            assertBNClose(await merkleDrop.startTime(), deployTime.add(ONE_WEEK), 5);
            assertBNClose(await merkleDrop.expiryTime(), deployTime.add(ONE_WEEK.mul(17)), 5);
            expect(await aura.balanceOf(merkleDrop.address), "aura balance").to.eq(dropAmount);
        });
        it("allows claiming and locking ", async () => {
            await increaseTime(ONE_WEEK);
            const amount = users[2].amount;
            const lock = true;
            const aliceAuraBalanceBefore = await aura.balanceOf(aliceAddress);
            const aliceBalanceBefore = await liqLocker.balances(aliceAddress);
            expect(await merkleDrop.hasClaimed(aliceAddress), "user  has not claimed").to.eq(false);

            const [adjustedAmount, tx] = await Promise.all([
                merkleDrop.calculateAdjustedAmount(amount),
                merkleDrop.connect(alice).claim(getAccountBalanceProof(tree, aliceAddress, amount), amount, lock),
            ]);

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

            const amountClaimed = args[1];

            await expect(tx).to.emit(merkleDrop, "Claimed").withArgs(aliceAddress, amountClaimed, lock);
            expect(await aura.balanceOf(aliceAddress), "alice aura balance").to.eq(aliceAuraBalanceBefore);
            expect((await liqLocker.balances(aliceAddress)).locked, "alice aura locked balance").to.eq(
                aliceBalanceBefore.locked.add(amountClaimed),
            );
            expect(await merkleDrop.hasClaimed(aliceAddress), "user claimed").to.eq(true);
            assertBNClosePercent(amountClaimed, adjustedAmount[0], 0.1);
        });
        it("allows claiming no lock", async () => {
            const amount = users[3].amount;
            const lock = false;
            const userAuraBalanceBefore = await aura.balanceOf(bobAddress);
            const userBalanceBefore = await liqLocker.balances(bobAddress);
            expect(await merkleDrop.hasClaimed(bobAddress), "user  has not claimed").to.eq(false);

            const [adjustedAmount, tx] = await Promise.all([
                merkleDrop.calculateAdjustedAmount(amount),
                merkleDrop.connect(bob).claim(getAccountBalanceProof(tree, bobAddress, amount), amount, lock),
            ]);

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

            const amountClaimed = args[1];

            await expect(tx).to.emit(merkleDrop, "Claimed").withArgs(bobAddress, amountClaimed, lock);
            expect(await aura.balanceOf(bobAddress), "user aura balance").to.eq(
                userAuraBalanceBefore.add(amountClaimed),
            );
            expect((await liqLocker.balances(bobAddress)).locked, "user aura locked balance").to.eq(
                userBalanceBefore.locked,
            );
            expect(await merkleDrop.hasClaimed(bobAddress), "user claimed").to.eq(true);
            assertBNClosePercent(amountClaimed, adjustedAmount[0], 0.1);
        });
        it("does not allow claiming on behalf", async () => {
            const amount = users[4].amount;
            const lock = false;
            const userAuraBalanceBefore = await aura.balanceOf(daveAddress);
            const userBalanceBefore = await liqLocker.balances(daveAddress);
            expect(await merkleDrop.hasClaimed(daveAddress), "user has not claimed").to.eq(false);

            const failingTx = merkleDrop
                .connect(paul)
                .claim(getAccountBalanceProof(tree, daveAddress, amount), amount, true);
            await expect(failingTx).to.be.revertedWith("invalid proof");

            const [adjustedAmount, tx] = await Promise.all([
                merkleDrop.calculateAdjustedAmount(amount),
                merkleDrop.connect(dave).claim(getAccountBalanceProof(tree, daveAddress, amount), amount, lock),
            ]);

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

            const amountClaimed = args[1];

            await expect(tx).to.emit(merkleDrop, "Claimed").withArgs(daveAddress, amountClaimed, lock);
            expect(await aura.balanceOf(daveAddress), "user aura balance").to.eq(
                userAuraBalanceBefore.add(amountClaimed),
            );
            expect((await liqLocker.balances(daveAddress)).locked, "user aura locked balance").to.eq(
                userBalanceBefore.locked,
            );
            expect(await merkleDrop.hasClaimed(daveAddress), "user claimed").to.eq(true);
            assertBNClosePercent(amountClaimed, adjustedAmount[0], 0.1);
        });
        it("if block.timestamp is near expiry, left users claim more than assigned amount", async () => {
            const expiryTime = await merkleDrop.expiryTime();
            await increaseTimeTo(expiryTime.sub(ONE_DAY));

            const amount = users[5].amount;
            const paulAddress = users[5].address;
            const lock = false;
            const userAuraBalanceBefore = await aura.balanceOf(paulAddress);
            const userBalanceBefore = await liqLocker.balances(paulAddress);
            expect(await merkleDrop.hasClaimed(paulAddress), "user has not claimed").to.eq(false);

            const [adjustedAmount, tx] = await Promise.all([
                merkleDrop.calculateAdjustedAmount(amount),
                merkleDrop.connect(paul).claim(getAccountBalanceProof(tree, users[5].address, amount), amount, lock),
            ]);

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

            const amountClaimed = args[1];

            await expect(tx)
                .to.emit(merkleDrop, "Claimed")
                .withArgs(await paul.getAddress(), amountClaimed, lock);
            expect(await aura.balanceOf(paulAddress), "user aura balance").to.eq(
                userAuraBalanceBefore.add(amountClaimed),
            );
            expect((await liqLocker.balances(paulAddress)).locked, "user aura locked balance").to.eq(
                userBalanceBefore.locked,
            );
            expect(await merkleDrop.hasClaimed(paulAddress), "user claimed").to.eq(true);
            assertBNClosePercent(amountClaimed, adjustedAmount[0], 0.1);
            expect(amountClaimed).gt(amount);
        });
        it("the last user empties the contract and left amount is zero", async () => {
            const expiryTime = await merkleDrop.expiryTime();
            await increaseTimeTo(expiryTime);

            const merkleInitBalance = await aura.balanceOf(merkleDrop.address);
            expect(merkleInitBalance).gt(ZERO);

            for (const user of users) {
                const claimed = await merkleDrop.hasClaimed(user.address);

                if (!claimed) {
                    const balanceBefore = await aura.balanceOf(user.address);

                    const holder = await ethers.getSigner(user.address);
                    await merkleDrop
                        .connect(holder)
                        .claim(getAccountBalanceProof(tree, user.address, user.amount), user.amount, false);

                    const balanceAfter = await aura.balanceOf(user.address);

                    expect(balanceAfter.sub(balanceBefore)).gt(user.amount);
                }
            }

            const merkleEndBalance = await aura.balanceOf(merkleDrop.address);
            expect(merkleEndBalance).eq(ZERO);
        });
    });
    describe("edge MerkleDrop interactions", () => {
        let tree: MerkleTree;
        before(async () => {
            tree = createTreeWithAccounts({
                [users[0].address]: users[0].amount,
                [users[1].address]: users[1].amount,
                [users[2].address]: users[2].amount,
                [users[3].address]: users[3].amount,
                [users[4].address]: users[4].amount,
                [users[5].address]: users[5].amount,
            });
            merkleDrop = await new LiqMerkleDrop__factory(deployer).deploy(
                adminAddress,
                ethers.constants.HashZero,
                aura.address,
                ZERO_ADDRESS,
                ONE_WEEK,
                ONE_WEEK.mul(16),
                users.length,
                dropAmount,
            );
            await aura.transfer(merkleDrop.address, dropAmount);
        });
        it("fails claiming drop without a root", async () => {
            const amount = users[3].amount;
            const lock = false;
            await expect(
                merkleDrop.connect(bob).claim(getAccountBalanceProof(tree, bobAddress, amount), amount, lock),
            ).to.be.revertedWith("!root");
        });
        it("fails claiming a drop that has not started", async () => {
            await merkleDrop.connect(admin).setRoot(tree.getHexRoot());

            const amount = users[3].amount;
            const lock = false;
            await expect(
                merkleDrop.connect(bob).claim(getAccountBalanceProof(tree, bobAddress, amount), amount, lock),
            ).to.be.revertedWith("!started");
        });
        it("fails claiming a drop when amount is zero", async () => {
            await increaseTime(ONE_WEEK);
            const amount = simpleToExactAmount(0);
            const lock = false;
            await expect(
                merkleDrop.connect(bob).claim(getAccountBalanceProof(tree, bobAddress, amount), amount, lock),
            ).to.be.revertedWith("!amount");
        });
        it("fails claiming with an invalid proof", async () => {
            const amount = users[3].amount;
            const lock = false;
            await expect(
                merkleDrop.connect(alice).claim(getAccountBalanceProof(tree, bobAddress, amount), amount, lock),
            ).to.be.revertedWith("invalid proof");
        });
        it("allows claiming no lock", async () => {
            const amount = users[3].amount;
            const lock = false;
            const userAuraBalanceBefore = await aura.balanceOf(bobAddress);
            const userBalanceBefore = await liqLocker.balances(bobAddress);
            expect(await merkleDrop.hasClaimed(bobAddress), "user  has not claimed").to.eq(false);
            expect(await merkleDrop.liqLocker(), "liqLocker not set").to.eq(ZERO_ADDRESS);

            const [adjustedAmount, tx] = await Promise.all([
                merkleDrop.calculateAdjustedAmount(amount),
                merkleDrop.connect(bob).claim(getAccountBalanceProof(tree, bobAddress, amount), amount, lock),
            ]);

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

            const amountClaimed = args[1];

            await expect(tx).to.emit(merkleDrop, "Claimed").withArgs(bobAddress, amountClaimed, lock);
            expect(await aura.balanceOf(bobAddress), "user aura balance").to.eq(
                userAuraBalanceBefore.add(amountClaimed),
            );
            expect((await liqLocker.balances(bobAddress)).locked, "user aura locked balance").to.eq(
                userBalanceBefore.locked,
            );
            expect(await merkleDrop.hasClaimed(bobAddress), "user claimed").to.eq(true);
            assertBNClosePercent(amountClaimed, adjustedAmount[0], 0.1);
        });
        it("fails claiming drop more than once", async () => {
            const amount = users[3].amount;
            const lock = false;
            expect(await merkleDrop.hasClaimed(bobAddress), "user has claimed").to.eq(true);

            await expect(
                merkleDrop.connect(bob).claim(getAccountBalanceProof(tree, bobAddress, amount), amount, lock),
            ).to.be.revertedWith("already claimed");
        });
        it("fails claiming a drop that is expired", async () => {
            const expiryTime = await merkleDrop.expiryTime();
            const gracePeriod = await merkleDrop.gracePeriod();
            await increaseTimeTo(expiryTime.add(gracePeriod));

            const amount = users[2].amount;
            const lock = false;
            await expect(
                merkleDrop.connect(alice).claim(getAccountBalanceProof(tree, aliceAddress, amount), amount, lock),
            ).to.be.revertedWith("!active");
        });
    });
    describe("admin", () => {
        let tree: MerkleTree;
        before(async () => {
            tree = createTreeWithAccounts({
                [users[0].address]: users[0].amount,
                [users[1].address]: users[1].amount,
                [users[2].address]: users[2].amount,
                [users[3].address]: users[3].amount,
                [users[4].address]: users[4].amount,
                [users[5].address]: users[5].amount,
            });
            merkleDrop = await new LiqMerkleDrop__factory(deployer).deploy(
                adminAddress,
                tree.getHexRoot(),
                aura.address,
                liqLocker.address,
                ONE_WEEK,
                ONE_WEEK.mul(16),
                users.length,
                dropAmount,
            );
            await aura.transfer(merkleDrop.address, dropAmount);
        });
        it("sets a new dao ", async () => {
            const tx = await merkleDrop.connect(admin).setDao(bobAddress);
            // expect to emit event DaoSet
            await expect(tx).to.emit(merkleDrop, "DaoSet").withArgs(bobAddress);
            expect(await merkleDrop.dao()).to.eq(bobAddress);

            // revert to original admin dao
            await merkleDrop.connect(bob).setDao(adminAddress);
        });
        it("sets a new root if it was not previously set ", async () => {
            merkleDrop = await new LiqMerkleDrop__factory(deployer).deploy(
                adminAddress,
                ethers.constants.HashZero,
                aura.address,
                liqLocker.address,
                ONE_WEEK,
                ONE_WEEK.mul(16),
                users.length,
                dropAmount,
            );
            const newRoot = tree.getHexRoot();
            const tx = await merkleDrop.connect(admin).setRoot(newRoot);
            // expect to emit event RootSet
            await expect(tx).to.emit(merkleDrop, "RootSet").withArgs(newRoot);
            expect(await merkleDrop.merkleRoot()).to.eq(newRoot);
        });
        it("rescue rewards", async () => {
            const tx = await merkleDrop.connect(admin).rescueReward();
            await expect(tx).to.emit(merkleDrop, "Rescued");
        });
        it("starts early the drop ", async () => {
            const timestamp = await getTimestamp();
            const tx = await merkleDrop.connect(admin).startEarly();
            // expect to emit event StartEarly
            await expect(tx).to.emit(merkleDrop, "StartedEarly");
            assertBNClose(await merkleDrop.startTime(), timestamp, 5);
        });
        it("fails to withdraw expired if the expire time has not been reached", async () => {
            await expect(merkleDrop.connect(admin).withdrawExpired()).to.be.revertedWith("!expired");
        });
        it("withdraw expired", async () => {
            // move forward to expiry time
            const expiryTime = await merkleDrop.expiryTime();
            const gracePeriod = await merkleDrop.gracePeriod();
            await increaseTimeTo(expiryTime.add(gracePeriod));
            // get aura balance before withdraw
            const dropBalance = await aura.balanceOf(merkleDrop.address);
            const daoBalance = await aura.balanceOf(adminAddress);
            const tx = await merkleDrop.connect(admin).withdrawExpired();
            await expect(tx).to.emit(merkleDrop, "ExpiredWithdrawn").withArgs(dropBalance);
            expect(await aura.balanceOf(merkleDrop.address)).to.eq(0);
            expect(await aura.balanceOf(adminAddress)).to.eq(daoBalance.add(dropBalance));
        });
        it("set a new locker", async () => {
            const tx = await merkleDrop.connect(admin).setLocker(bobAddress);
            await expect(tx).to.emit(merkleDrop, "LockerSet").withArgs(bobAddress);
            expect(await merkleDrop.liqLocker()).to.eq(bobAddress);
        });
        it("fails to rescue rewards one week after deployment", async () => {
            await expect(merkleDrop.connect(admin).rescueReward()).to.be.revertedWith("too late");
        });
        it("fails if admin is not the sender", async () => {
            await expect(merkleDrop.connect(bob).setDao(bobAddress)).to.be.revertedWith("!auth");
            await expect(merkleDrop.connect(bob).setRoot(ethers.constants.HashZero)).to.be.revertedWith("!auth");
            await expect(merkleDrop.connect(bob).startEarly()).to.be.revertedWith("!auth");
            await expect(merkleDrop.connect(bob).withdrawExpired()).to.be.revertedWith("!auth");
            await expect(merkleDrop.connect(bob).setLocker(bobAddress)).to.be.revertedWith("!auth");
            await expect(merkleDrop.connect(bob).rescueReward()).to.be.revertedWith("!auth");
        });
        it("fails to set a new root if it was previously set ", async () => {
            await expect(merkleDrop.connect(admin).setRoot(tree.getHexRoot())).to.be.revertedWith("already set");
        });
    });
});
