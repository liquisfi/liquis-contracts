import { hashMessage } from "@ethersproject/hash";
import hre, { network } from "hardhat";
import { expect } from "chai";
import {
    ERC20__factory,
    MockVoting__factory,
    VoterProxy__factory,
    LiqToken__factory,
    LiqMinter__factory,
    Booster__factory,
    BoosterOwner__factory,
    CrvDepositor__factory,
    LitDepositorHelper__factory,
    LiqLocker__factory,
    LiqVestedEscrow,
    LiqVestedEscrow__factory,
    BaseRewardPool__factory,
    PoolManager__factory,
    PoolManagerProxy__factory,
    RewardFactory__factory,
    StashFactoryV2__factory,
    TokenFactory__factory,
    ProxyFactory__factory,
    ExtraRewardStashV3__factory,
    FlashOptionsExerciser__factory,
    PooledOptionsExerciser__factory,
    LiquisClaimZap__factory,
    LiquisViewHelpers__factory,
    CvxCrvToken__factory,
} from "../types/generated";
import { impersonate, impersonateAccount, ZERO_ADDRESS, BN, ONE_WEEK, simpleToExactAmount } from "../test-utils";
import { Signer } from "ethers";
import { waitForTx } from "../tasks/utils";
import { getTimestamp } from "./../test-utils/time";
import { FullSystemDeployed } from "../scripts/deployFullSystem";
import { Account } from "./../types/common";
import { config } from "../tasks/deploy/mainnet-config";
import { vestingConfig } from "../tasks/vesting/vesting-config";
import mainnetConfig from "../scripts/contracts.json";

const debug = false;

const testAccounts = {
    swapper: "0x0000000000000000000000000000000000000002",
    alice: "0x0000000000000000000000000000000000000003",
    eoa: "0x0000000000000000000000000000000000000004",
    staker: "0x0000000000000000000000000000000000000006",
};

const getFullSystem = async (deployer: Signer): Promise<FullSystemDeployed> => ({
    voterProxy: VoterProxy__factory.connect(mainnetConfig.Deployments.voterProxy, deployer),
    liq: LiqToken__factory.connect(mainnetConfig.Deployments.liq, deployer),
    minter: LiqMinter__factory.connect(mainnetConfig.Deployments.minter, deployer),
    booster: Booster__factory.connect(mainnetConfig.Deployments.booster, deployer),
    liqLit: CvxCrvToken__factory.connect(mainnetConfig.Deployments.liqLit, deployer),
    boosterOwner: BoosterOwner__factory.connect(mainnetConfig.Deployments.boosterOwner, deployer),
    rewardFactory: RewardFactory__factory.connect(mainnetConfig.Deployments.rewardFactory, deployer),
    stashFactory: StashFactoryV2__factory.connect(mainnetConfig.Deployments.stashFactory, deployer),
    stashV3: ExtraRewardStashV3__factory.connect(mainnetConfig.Deployments.stashV3, deployer),
    tokenFactory: TokenFactory__factory.connect(mainnetConfig.Deployments.tokenFactory, deployer),
    proxyFactory: ProxyFactory__factory.connect(mainnetConfig.Deployments.proxyFactory, deployer),
    liqLitRewards: BaseRewardPool__factory.connect(mainnetConfig.Deployments.liqLitRewards, deployer),
    crvDepositor: CrvDepositor__factory.connect(mainnetConfig.Deployments.crvDepositor, deployer),
    litDepositorHelper: LitDepositorHelper__factory.connect(mainnetConfig.Deployments.litDepositorHelper, deployer),
    poolManager: PoolManager__factory.connect(mainnetConfig.Deployments.poolManager, deployer),
    poolManagerProxy: PoolManagerProxy__factory.connect(mainnetConfig.Deployments.poolManagerProxy, deployer),
    liqLocker: LiqLocker__factory.connect(mainnetConfig.Deployments.liqLocker, deployer),
    flashOptionsExerciser: FlashOptionsExerciser__factory.connect(
        mainnetConfig.Deployments.flashOptionsExerciser,
        deployer,
    ),
    pooledOptionsExerciser: PooledOptionsExerciser__factory.connect(
        mainnetConfig.Deployments.pooledOptionsExerciser,
        deployer,
    ),
    claimZap: LiquisClaimZap__factory.connect(mainnetConfig.Deployments.claimZap, deployer),
    liquisViewHelpers: LiquisViewHelpers__factory.connect(mainnetConfig.Deployments.liquisViewHelpers, deployer),
});

interface VestingEscrows {
    vestedEscrows: LiqVestedEscrow[];
}

const getVestingEscrows = async (deployer: Signer): Promise<VestingEscrows> => ({
    vestedEscrows: [
        LiqVestedEscrow__factory.connect("0x5bd3fCA8D3d8c94a6419d85E0a76ec8Da52d836a", deployer),
        LiqVestedEscrow__factory.connect("0x24346652e0e2aE0CE05c781501fDF4Fe4553fAc6", deployer),
        LiqVestedEscrow__factory.connect("0x45025Ebc38647bcf7Edd2b40CfDaF3fbfE1538F5", deployer),
        LiqVestedEscrow__factory.connect("0xFd72170339AC6d7bdda09D1eACA346B21a30D422", deployer),
    ],
});

describe("Full Deployment", () => {
    let deployer: Signer;
    let deployerAddress: string;
    let fullSystem: FullSystemDeployed;

    const phase2Timestamp = BN.from(1690275909);

    before(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: process.env.NODE_URL,
                        blockNumber: 18026022,
                    },
                },
            ],
        });
        deployerAddress = "0xA35E14f9D731ddB1994B5590574B32A838646Ccf";
        deployer = await impersonate(deployerAddress);
    });

    const getCrv = async (recipient: string, amount = simpleToExactAmount(250)) => {
        await getEth(config.addresses.balancerVault);

        const tokenWhaleSigner = await impersonateAccount(config.addresses.balancerVault);
        const crv = ERC20__factory.connect(config.addresses.token, tokenWhaleSigner.signer);
        const tx = await crv.transfer(recipient, amount);
        await waitForTx(tx, debug);
    };

    const getCrvBpt = async (recipient: string, amount = simpleToExactAmount(250)) => {
        const tokenWhaleSigner = await impersonateAccount(config.addresses.tokenWhale);
        const crvBpt = ERC20__factory.connect(config.addresses.tokenBpt, tokenWhaleSigner.signer);
        const tx = await crvBpt.transfer(recipient, amount);
        await waitForTx(tx, debug);
    };

    const getWeth = async (recipient: string, amount = simpleToExactAmount(100)) => {
        const wethWhaleSigner = await impersonateAccount(config.addresses.wethWhale);
        const weth = ERC20__factory.connect(config.addresses.weth, wethWhaleSigner.signer);
        const tx = await weth.transfer(recipient, amount);
        await waitForTx(tx, debug);
    };

    const getLpToken = async (recipient: string, amount = simpleToExactAmount(10)) => {
        const lpWhaleSigner = await impersonateAccount(config.addresses.staBAL3Whale);
        const lp = ERC20__factory.connect(config.addresses.staBAL3, lpWhaleSigner.signer);
        const tx = await lp.transfer(recipient, amount);
        await waitForTx(tx, debug);
    };

    const getLdo = async (recipient: string, amount = simpleToExactAmount(10)) => {
        const ldoWhale = await impersonateAccount(config.addresses.ldoWhale);
        const ldo = ERC20__factory.connect(config.addresses.ldo, ldoWhale.signer);
        const tx = await ldo.transfer(recipient, amount);
        await waitForTx(tx, debug);
    };

    const getEth = async (recipient: string) => {
        const ethWhale = await impersonate(config.addresses.weth);
        await ethWhale.sendTransaction({
            to: recipient,
            value: simpleToExactAmount(1),
        });
    };

    describe("Phase 2", () => {
        describe("DEPLOY-Phase 2", () => {
            before(async () => {
                fullSystem = await getFullSystem(deployer);
            });
            describe("verifying config", () => {
                it("VotingProxy has correct config", async () => {
                    const { voterProxy, booster, crvDepositor } = fullSystem;
                    const { multisigs, addresses } = config;

                    expect(await voterProxy.mintr()).eq(addresses.minter);
                    expect(await voterProxy.crv()).eq(addresses.token);
                    expect(await voterProxy.crvBpt()).eq(addresses.tokenBpt);
                    expect(await voterProxy.escrow()).eq(addresses.votingEscrow);
                    expect(await voterProxy.gaugeController()).eq(addresses.gaugeController);
                    expect(await voterProxy.rewardDeposit()).eq(ZERO_ADDRESS);
                    expect(await voterProxy.withdrawer()).eq(ZERO_ADDRESS);
                    expect(await voterProxy.owner()).eq(multisigs.daoMultisig);
                    expect(await voterProxy.operator()).eq(booster.address);
                    expect(await voterProxy.depositor()).eq(crvDepositor.address);
                });
                it("Liq Token has correct config", async () => {
                    const { liq, minter, booster, voterProxy } = fullSystem;
                    expect(await liq.operator()).eq(booster.address);
                    expect(await liq.vecrvProxy()).eq(voterProxy.address);
                    expect(await liq.minter()).eq(minter.address);
                    expect(await liq.totalSupply()).eq(simpleToExactAmount(50000000));
                });
                it.skip("Contracts have correct Liq balance", async () => {
                    const { liq } = fullSystem;
                    const { vestedEscrows } = await getVestingEscrows(deployer);
                    const { distroList } = vestingConfig;

                    const vestingBalances = await Promise.all(vestedEscrows.map(a => liq.balanceOf(a.address)));
                    const vestingSum = distroList.vesting
                        .concat(distroList.immutableVesting)
                        .reduce(
                            (p, c) => p.add(c.recipients.reduce((p2, c2) => p2.add(c2.amount), BN.from(0))),
                            BN.from(0),
                        );
                    expect(vestingBalances.reduce((p, c) => p.add(c), BN.from(0))).eq(vestingSum);
                });
                it("Minter has correct config", async () => {
                    const { minter, liq } = fullSystem;
                    const { multisigs } = config;
                    expect(await minter.liq()).eq(liq.address);
                    expect(await minter.owner()).eq(multisigs.daoMultisig);
                    const time = await getTimestamp();
                    expect(await minter.inflationProtectionTime()).gt(time.add(ONE_WEEK.mul(150)));
                });
                it("Booster has correct config", async () => {
                    const {
                        booster,
                        liq,
                        voterProxy,
                        liqLocker,
                        liqLitRewards,
                        rewardFactory,
                        stashFactory,
                        tokenFactory,
                        boosterOwner,
                        poolManagerProxy,
                    } = fullSystem;
                    const { multisigs, addresses } = config;
                    expect(await booster.crv()).eq(addresses.token);

                    expect(await booster.lockIncentive()).eq(1950);
                    expect(await booster.stakerIncentive()).eq(300);
                    expect(await booster.earmarkIncentive()).eq(50);
                    expect(await booster.platformFee()).eq(200);
                    expect(await booster.MaxFees()).eq(4000);
                    expect(await booster.FEE_DENOMINATOR()).eq(10000);

                    // expect(await booster.owner()).eq(boosterOwner.address);
                    expect(await booster.feeManager()).eq(multisigs.daoMultisig);
                    expect(await booster.poolManager()).eq(poolManagerProxy.address);
                    expect(await booster.staker()).eq(voterProxy.address);
                    expect(await booster.minter()).eq(liq.address);
                    // expect(await booster.rewardFactory()).eq(rewardFactory.address);
                    // expect(await booster.stashFactory()).eq(stashFactory.address);
                    // expect(await booster.tokenFactory()).eq(tokenFactory.address);
                    expect(await booster.voteDelegate()).eq(multisigs.daoMultisig);
                    expect(await booster.treasury()).eq(ZERO_ADDRESS);
                    // expect(await booster.stakerRewards()).eq(liqLocker.address);
                    // expect(await booster.lockRewards()).eq(liqLitRewards.address);

                    expect(await booster.isShutdown()).eq(false);
                    expect(await booster.poolLength()).eq(0);
                });
                it("Booster Owner has correct config", async () => {
                    const { booster, boosterOwner, poolManagerProxy, stashFactory } = fullSystem;
                    const { multisigs } = config;

                    expect(await boosterOwner.poolManager()).eq(poolManagerProxy.address);
                    expect(await boosterOwner.booster()).eq(booster.address);
                    expect(await boosterOwner.stashFactory()).eq(stashFactory.address);
                    expect(await boosterOwner.rescueStash()).eq(ZERO_ADDRESS);
                    expect(await boosterOwner.owner()).eq(multisigs.daoMultisig);
                    expect(await boosterOwner.pendingowner()).eq(ZERO_ADDRESS);
                    expect(await boosterOwner.isSealed()).eq(true);
                    expect(await boosterOwner.isForceTimerStarted()).eq(false);
                    expect(await boosterOwner.forceTimestamp()).eq(0);
                });
                it("Factories have correct config", async () => {
                    const { rewardFactory, stashFactory, tokenFactory, proxyFactory, booster } = fullSystem;
                    const { addresses } = config;

                    expect(await rewardFactory.operator()).eq(booster.address);
                    expect(await rewardFactory.crv()).eq(addresses.token);

                    expect(await stashFactory.operator()).eq(booster.address);
                    expect(await stashFactory.rewardFactory()).eq(rewardFactory.address);
                    expect(await stashFactory.proxyFactory()).eq(proxyFactory.address);
                    expect(await stashFactory.v1Implementation()).eq(ZERO_ADDRESS);
                    expect(await stashFactory.v2Implementation()).eq(ZERO_ADDRESS);

                    // const rewardsStashV3 = ExtraRewardStashV3__factory.connect(
                    //     await stashFactory.v3Implementation(),
                    //     deployer,
                    // );
                    // expect(await rewardsStashV3.crv()).eq(addresses.token);

                    expect(await tokenFactory.operator()).eq(booster.address);
                    expect(await tokenFactory.namePostfix()).eq(" Liquis Deposit");
                    expect(await tokenFactory.symbolPrefix()).eq("liq");
                });
                it("LiqLit has correct config", async () => {
                    const { liqLit, crvDepositor } = fullSystem;
                    const { naming } = config;
                    expect(await liqLit.operator()).eq(crvDepositor.address);
                    expect(await liqLit.name()).eq(naming.cvxCrvName);
                    expect(await liqLit.symbol()).eq(naming.cvxCrvSymbol);
                });
                it("LiqLitRewards has correct config", async () => {
                    const { liqLitRewards, liqLit, rewardFactory, booster } = fullSystem;
                    const { addresses } = config;
                    expect(await liqLitRewards.rewardToken()).eq(addresses.token);
                    expect(await liqLitRewards.stakingToken()).eq(liqLit.address);
                    expect(await liqLitRewards.operator()).eq(booster.address);
                    expect(await liqLitRewards.rewardManager()).eq(rewardFactory.address);
                    expect(await liqLitRewards.pid()).eq(0);
                    expect(await liqLitRewards.extraRewardsLength()).eq(0);
                });

                it("CrvDepositor has correct config", async () => {
                    const { voterProxy, liqLit, crvDepositor } = fullSystem;
                    const { multisigs, addresses } = config;
                    expect(await crvDepositor.crvBpt()).eq(addresses.tokenBpt);
                    expect(await crvDepositor.escrow()).eq(addresses.votingEscrow);
                    expect(await crvDepositor.lockIncentive()).eq(10);
                    expect(await crvDepositor.feeManager()).eq(multisigs.daoMultisig);
                    expect(await crvDepositor.daoOperator()).eq(multisigs.daoMultisig);
                    expect(await crvDepositor.staker()).eq(voterProxy.address);
                    expect(await crvDepositor.minter()).eq(liqLit.address);
                    expect(await crvDepositor.incentiveCrv()).eq(0);
                    expect(await crvDepositor.cooldown()).eq(false);
                });
                it("LitDepositorHelper has correct config", async () => {
                    const { litDepositorHelper, crvDepositor } = fullSystem;
                    const { addresses } = config;
                    expect(await litDepositorHelper.crvDeposit()).eq(crvDepositor.address);
                    expect(await litDepositorHelper.BALANCER_VAULT()).eq(addresses.balancerVault);
                    expect(await litDepositorHelper.LIT()).eq(addresses.lit);
                    expect(await litDepositorHelper.WETH()).eq(addresses.weth);
                    expect(await litDepositorHelper.BAL_ETH_POOL_ID()).eq(addresses.balancerPoolId);
                });
                it("PoolManagerProxy has correct config", async () => {
                    const { booster, poolManagerProxy, poolManager } = fullSystem;
                    const { multisigs } = config;
                    expect(await poolManagerProxy.pools()).eq(booster.address);
                    expect(await poolManagerProxy.owner()).eq(multisigs.daoMultisig);
                    expect(await poolManagerProxy.operator()).eq(poolManager.address);
                    expect(await poolManagerProxy.isShutdown()).eq(false);
                });
                it("PoolManager has correct config", async () => {
                    const { booster, poolManagerProxy, poolManager } = fullSystem;
                    const { multisigs, addresses } = config;
                    expect(await poolManager.gaugeController()).eq(addresses.gaugeController);
                    expect(await poolManager.pools()).eq(poolManagerProxy.address);
                    expect(await poolManager.booster()).eq(booster.address);
                    expect(await poolManager.operator()).eq(multisigs.daoMultisig);
                    expect(await poolManager.protectAddPool()).eq(true);
                });
                it("LiqLocker has correct config", async () => {
                    const { liqLocker, liqLit, booster, liq, liqLitRewards } = fullSystem;
                    const { naming, multisigs, addresses } = config;
                    expect(await liqLocker.rewardTokens(0)).eq(addresses.token);
                    await expect(liqLocker.rewardTokens(1)).to.be.reverted;
                    expect(await liqLocker.queuedRewards(liqLit.address)).eq(0);
                    expect(await liqLocker.rewardDistributors(addresses.token, booster.address)).eq(true);
                    expect(await liqLocker.lockedSupply()).eq(0);
                    expect(await liqLocker.stakingToken()).eq(liq.address);
                    expect(await liqLocker.cvxCrv()).eq(liqLit.address);
                    expect(await liqLocker.cvxcrvStaking()).eq(liqLitRewards.address);
                    expect(await liqLocker.name()).eq(naming.vlCvxName);
                    expect(await liqLocker.symbol()).eq(naming.vlCvxSymbol);
                    expect(await liqLocker.owner()).eq(multisigs.daoMultisig);
                });
                it.skip("VestedEscrows have correct config", async () => {
                    const { vestedEscrows } = await getVestingEscrows(deployer);
                    expect(vestedEscrows.length).eq(5);

                    // [ 0 ] = 16 weeks
                    const escrow0 = vestedEscrows[0];
                    expect(await escrow0.rewardToken()).eq(fullSystem.liq.address);
                    expect(await escrow0.admin()).eq(config.multisigs.vestingMultisig);
                    expect(await escrow0.liqLocker()).eq(fullSystem.liqLocker.address);
                    expect(await escrow0.startTime()).gt(phase2Timestamp.add(ONE_WEEK).sub(5400));
                    expect(await escrow0.startTime()).lt(phase2Timestamp.add(ONE_WEEK).add(5400));
                    expect(await escrow0.endTime()).gt(phase2Timestamp.add(ONE_WEEK.mul(17)).sub(5400));
                    expect(await escrow0.endTime()).lt(phase2Timestamp.add(ONE_WEEK.mul(17)).add(5400));
                    expect(await escrow0.totalTime()).eq(ONE_WEEK.mul(16));
                    expect(await escrow0.initialised()).eq(true);
                    expect(await escrow0.remaining("0xb64f3884ceed18594bd707122988e913fa26f4bf")).eq(
                        simpleToExactAmount(0.008, 24),
                    );
                    // [ 1 ] = 26 weeks
                    const escrow1 = vestedEscrows[1];
                    expect(await escrow1.rewardToken()).eq(fullSystem.liq.address);
                    expect(await escrow1.admin()).eq(config.multisigs.vestingMultisig);
                    expect(await escrow1.liqLocker()).eq(fullSystem.liqLocker.address);
                    expect(await escrow1.startTime()).gt(phase2Timestamp.add(ONE_WEEK).sub(5400));
                    expect(await escrow1.startTime()).lt(phase2Timestamp.add(ONE_WEEK).add(5400));
                    expect(await escrow1.endTime()).gt(phase2Timestamp.add(ONE_WEEK.mul(27)).sub(5400));
                    expect(await escrow1.endTime()).lt(phase2Timestamp.add(ONE_WEEK.mul(27)).add(5400));
                    expect(await escrow1.totalTime()).eq(ONE_WEEK.mul(26));
                    expect(await escrow1.initialised()).eq(true);
                    expect(await escrow1.remaining(config.multisigs.vestingMultisig)).eq(
                        simpleToExactAmount(1.4515, 24),
                    );
                    // [ 2 ] = 104 weeks
                    const escrow2 = vestedEscrows[2];
                    expect(await escrow2.rewardToken()).eq(fullSystem.liq.address);
                    expect(await escrow2.admin()).eq(config.multisigs.vestingMultisig);
                    expect(await escrow2.liqLocker()).eq(fullSystem.liqLocker.address);
                    expect(await escrow2.startTime()).gt(phase2Timestamp.add(ONE_WEEK).sub(5400));
                    expect(await escrow2.startTime()).lt(phase2Timestamp.add(ONE_WEEK).add(5400));
                    expect(await escrow2.endTime()).gt(phase2Timestamp.add(ONE_WEEK.mul(105)).sub(5400));
                    expect(await escrow2.endTime()).lt(phase2Timestamp.add(ONE_WEEK.mul(105)).add(5400));
                    expect(await escrow2.totalTime()).eq(ONE_WEEK.mul(104));
                    expect(await escrow2.initialised()).eq(true);
                    expect(await escrow2.remaining("0xB1f881f47baB744E7283851bC090bAA626df931d")).eq(
                        simpleToExactAmount(3.5, 24),
                    );
                    // [ 3 ] = 104 weeks, 2%
                    const escrow3 = vestedEscrows[3];
                    expect(await escrow3.rewardToken()).eq(fullSystem.liq.address);
                    expect(await escrow3.admin()).eq(ZERO_ADDRESS);
                    expect(await escrow3.liqLocker()).eq(fullSystem.liqLocker.address);
                    expect(await escrow3.startTime()).gt(phase2Timestamp.add(ONE_WEEK).sub(5400));
                    expect(await escrow3.startTime()).lt(phase2Timestamp.add(ONE_WEEK).add(5400));
                    expect(await escrow3.endTime()).gt(phase2Timestamp.add(ONE_WEEK.mul(105)).sub(5400));
                    expect(await escrow3.endTime()).lt(phase2Timestamp.add(ONE_WEEK.mul(105)).add(5400));
                    expect(await escrow3.totalTime()).eq(ONE_WEEK.mul(104));
                    expect(await escrow3.initialised()).eq(true);
                    expect(await escrow3.remaining(config.addresses.treasury)).eq(simpleToExactAmount(2, 24));
                    // [ 4 ] = 208 weeks, 17.5%
                    const escrow4 = vestedEscrows[4];
                    expect(await escrow4.rewardToken()).eq(fullSystem.liq.address);
                    expect(await escrow4.admin()).eq(ZERO_ADDRESS);
                    expect(await escrow4.liqLocker()).eq(fullSystem.liqLocker.address);
                    expect(await escrow4.startTime()).gt(phase2Timestamp.add(ONE_WEEK).sub(5400));
                    expect(await escrow4.startTime()).lt(phase2Timestamp.add(ONE_WEEK).add(5400));
                    expect(await escrow4.endTime()).gt(phase2Timestamp.add(ONE_WEEK.mul(209)).sub(5400));
                    expect(await escrow4.endTime()).lt(phase2Timestamp.add(ONE_WEEK.mul(209)).add(5400));
                    expect(await escrow4.totalTime()).eq(ONE_WEEK.mul(208));
                    expect(await escrow4.initialised()).eq(true);
                    expect(await escrow4.remaining(config.multisigs.treasuryMultisig)).eq(
                        simpleToExactAmount(17.5, 24),
                    );
                });
            });
        });

        describe("TEST-Phase 2", () => {
            let daoSigner: Account;
            before(async () => {
                daoSigner = await impersonateAccount(config.multisigs.daoMultisig);
            });

            it.skip("doesn't allow dao to set more than 10k votes on gaugeController", async () => {
                const { booster } = fullSystem;
                const { addresses } = config;
                await expect(
                    booster
                        .connect(daoSigner.signer)
                        .voteGaugeWeight([addresses.gauges[0], addresses.gauges[1]], [5001, 5000]),
                ).to.be.revertedWith("Used too much power");
            });
            it.skip("allows dao to vote on gauge weights", async () => {
                const { booster, voterProxy } = fullSystem;
                const { addresses } = config;
                await booster
                    .connect(daoSigner.signer)
                    .voteGaugeWeight([addresses.gauges[0], addresses.gauges[1]], [5000, 5000]);
                const gaugeController = MockVoting__factory.connect(addresses.gaugeController, deployer);
                expect((await gaugeController.vote_user_slopes(voterProxy.address, addresses.gauges[0])).power).eq(
                    5000,
                );
                expect(await gaugeController.vote_user_power(voterProxy.address)).eq(10000);
                expect(await gaugeController.last_user_vote(voterProxy.address, addresses.gauges[1])).gt(0);
                expect(await gaugeController.last_user_vote(voterProxy.address, addresses.gauges[2])).eq(0);
            });
            it.skip("doesn't allow dao to set votes again so quickly on gaugeController", async () => {
                const { booster } = fullSystem;
                const { addresses } = config;
                await expect(
                    booster
                        .connect(daoSigner.signer)
                        .voteGaugeWeight([addresses.gauges[0], addresses.gauges[1]], [5001, 5000]),
                ).to.be.revertedWith("Cannot vote so often");
            });
            it("allows dao to setVotes for Snapshot", async () => {
                const msg = "message";
                const hash = hashMessage(msg);
                const daoMultisig = await impersonateAccount(config.multisigs.daoMultisig);

                const tx = await fullSystem.booster.connect(daoMultisig.signer).setVote(hash);
                await expect(tx).to.emit(fullSystem.voterProxy, "VoteSet").withArgs(hash, false);

                const isValid = await fullSystem.voterProxy.isValidSignature(hash, "0x00");
                expect(isValid).to.equal("0xffffffff");
            });
            it("doesn't allow pools to be added or rewards earmarked", async () => {
                const { poolManager, booster } = fullSystem;
                const { addresses } = config;

                await expect(poolManager["addPool(address)"](addresses.gauges[0])).to.be.revertedWith("!auth");

                await expect(booster.earmarkRewards(0)).to.be.reverted;
            });
            it("doesn't add feeInfo to Booster", async () => {
                const { booster } = fullSystem;
                const { addresses } = config;

                const balFee = await booster.feeTokens(addresses.token);
                expect(balFee.distro).eq(ZERO_ADDRESS);
                expect(balFee.rewards).eq(ZERO_ADDRESS);
                expect(balFee.active).eq(false);

                await expect(booster.earmarkFees(addresses.token)).to.be.revertedWith("Inactive distro");
            });
            it.skip("allows LIQ holders to stake in vlLIQ", async () => {
                const { liqLocker, liq } = fullSystem;

                const swapper = await impersonateAccount(testAccounts.swapper);

                await liq.connect(swapper.signer).approve(liqLocker.address, simpleToExactAmount(100000));
                await liqLocker.connect(swapper.signer).lock(testAccounts.swapper, simpleToExactAmount(100000));

                const lock = await liqLocker.lockedBalances(testAccounts.swapper);
                expect(lock.total).eq(simpleToExactAmount(100000));
                expect(lock.unlockable).eq(0);
                expect(lock.locked).eq(simpleToExactAmount(100000));
                expect(lock.lockData[0].amount).eq(simpleToExactAmount(100000));
                const balance = await liqLocker.balanceOf(testAccounts.swapper);
                expect(balance).eq(0);
            });
        });
    });
});
