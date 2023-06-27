import hre, { ethers } from "hardhat";
import { expect } from "chai";
import {
    Booster,
    VoterProxy,
    VoterProxy__factory,
    CvxCrvToken,
    CrvDepositor,
    BaseRewardPool,
    CrvDepositorWrapper,
    IERC20Extra,
    PoolManagerV3,
} from "../types/generated";
import { Signer } from "ethers";
import { ZERO_ADDRESS, ZERO, e18 } from "../test-utils/constants";
import { deployContract, waitForTx } from "../tasks/utils";
import { impersonateAccount, assertBNClosePercent } from "../test-utils";

import { deployPhase2, Phase1Deployed, MultisigConfig, ExtSystemConfig } from "../scripts/deploySystem";
import { getMockDistro } from "../scripts/deployMocks";
import { logContracts } from "../tasks/utils/deploy-utils";

import smartWalletCheckerABI from "../abi/smartWalletChecker.json";

// yarn hardhat --config hardhat-fork.config.ts test ./test-fork/LitDepositorWrapper.spec.ts

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

const debug = false;
const waitForBlocks = 0;

describe("Booster", () => {
    let accounts: Signer[];
    let booster: Booster;

    let voterProxy: VoterProxy;

    let crvDepositor: CrvDepositor;
    let crvDepositorWrapper: CrvDepositorWrapper;
    let poolManager: PoolManagerV3;

    let cvxCrvStaking: BaseRewardPool;
    let cvxCrv: CvxCrvToken;

    let lit: IERC20Extra;
    let velit: IERC20Extra;
    let crvBpt: IERC20Extra;

    let weth: IERC20Extra;

    let deployer: Signer;
    let deployerAddress: string;

    let alice: Signer;
    let aliceAddress: string;

    const smartWalletCheckerContractAddress: string = "0x0ccdf95baf116ede5251223ca545d0ed02287a8f";
    const smartWalletCheckerOwnerAddress: string = "0x9a8fee232dcf73060af348a1b62cdb0a19852d13";

    const minterAddress: string = "0xF087521Ffca0Fa8A43F5C445773aB37C5f574DA0";
    const olitAddress: string = "0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa";
    const litAddress: string = "0xfd0205066521550D7d7AB19DA8F72bb004b4C341";
    const tokenBptAddress: string = "0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C";
    const votingEscrowAddress: string = "0xf17d23136B4FeAd139f54fB766c8795faae09660";
    const gaugeControllerAddress: string = "0x901c8aA6A61f74aC95E7f397E22A0Ac7c1242218";

    const litHolderAddress: string = "0x63F2695207f1d625a9B0B8178D95cD517bC5E82C";
    const wethHolderAddress: string = "0x57757E3D981446D585Af0D9Ae4d7DF6D64647806";
    const crvBptHolderAddress: string = "0xb8F26C1Cc45ab62fd750E08957fBa5738094bbDB";

    const FORK_BLOCK_NUMBER: number = 16875673;

    const setup = async () => {
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
        console.log("smartWalletChecker: ", smartWalletChecker.address);

        // Instance of crvBpt
        crvBpt = (await ethers.getContractAt("IERC20Extra", tokenBptAddress)) as IERC20Extra;

        // Impersonate and fund crvBpt whale
        await impersonateAccount(crvBptHolderAddress, true);
        const crvBptHolder = await ethers.getSigner(crvBptHolderAddress);
        await crvBpt.connect(crvBptHolder).transfer(deployerAddress, e18.mul(100000));
        console.log("Deployer funded with crvBpt: ", (await crvBpt.balanceOf(deployerAddress)).toString());

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

        ({ booster, cvxCrv, crvDepositor, crvDepositorWrapper, poolManager } = phase2);

        console.log(`\n~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
        console.log(`~~~~ DEPLOYMENT FINISH ~~~~`);
        console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~\n`);

        // Instance of LIT & oLIT & veLIT
        lit = (await ethers.getContractAt("IERC20Extra", litAddress)) as IERC20Extra;
        velit = (await ethers.getContractAt("IERC20Extra", votingEscrowAddress)) as IERC20Extra;

        // Need to create an initial lock
        let tx = await crvDepositor.initialLock();
        await waitForTx(tx, debug, waitForBlocks);

        // Impersonate LIT whale and airdrop 1M LIT to the deployer
        await impersonateAccount(litHolderAddress, true);
        const litHolder = await ethers.getSigner(litHolderAddress);
        await lit.connect(litHolder).transfer(deployerAddress, e18.mul(1000000));

        // Register a pool in the Booster
        tx = await poolManager["addPool(address)"](externalAddresses.gauges[0]);
        await waitForTx(tx, debug, waitForBlocks);

        accounts = await ethers.getSigners();
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

        [deployer, alice] = await ethers.getSigners();
        deployerAddress = await deployer.getAddress();
        aliceAddress = await alice.getAddress();
    });

    describe("Lit depositor: converts LIT -> balBPT and then wraps to liqLIT (auraBAL / cvxCrv)", async () => {
        before(async () => {
            await setup();
        });

        it("increases veLit balance on VoterProxy after a LIT deposit", async () => {
            const initLitVotingEscrowBal = await velit.balanceOf(voterProxy.address);
            const cvxCrvBalInit = await cvxCrv.balanceOf(deployerAddress);
            const amount = e18.mul(100000);
            const minOut = await crvDepositorWrapper.getMinOut(amount, "9900");

            await lit.connect(deployer).approve(crvDepositorWrapper.address, amount);
            await crvDepositorWrapper.deposit(amount, minOut, true, ZERO_ADDRESS);
            const deployerVeLitBalance = await velit.balanceOf(deployerAddress);

            const endLitVotingEscrowBal = await velit.balanceOf(voterProxy.address);
            const diffVeLit = endLitVotingEscrowBal.sub(initLitVotingEscrowBal);

            expect(deployerVeLitBalance).eq(ZERO); // veLit remains in the VoterProxy
            expect(diffVeLit).gt(minOut);

            // Deployer did not stake his cvxCrv
            const cvxCrvBalEnd = await cvxCrv.balanceOf(deployerAddress);
            const diffCvxCrvBal = cvxCrvBalEnd.sub(cvxCrvBalInit);
            expect(diffCvxCrvBal).gt(minOut);

            assertBNClosePercent(diffVeLit, diffCvxCrvBal, "1");
        });

        it("stakes cvxCrv on behalf of user in the stakingRewardPool", async () => {
            // Address where a small percentage of CRV is sent and distributed to cvxCrv stakers
            const stakeAddress = await booster.lockRewards();

            await lit.connect(deployer).transfer(aliceAddress, e18.mul(50000));
            await lit.connect(alice).approve(crvDepositorWrapper.address, e18.mul(10000));

            cvxCrvStaking = (await ethers.getContractAt("BaseRewardPool", stakeAddress, deployer)) as BaseRewardPool;

            const stakedBalanceBefore = await cvxCrvStaking.balanceOf(aliceAddress);

            const minOut = await crvDepositorWrapper.getMinOut(e18.mul(10000), "9900");

            await crvDepositorWrapper.connect(alice).deposit(e18.mul(10000), minOut, true, stakeAddress);

            const stakedBalanceAfter = await cvxCrvStaking.balanceOf(aliceAddress);

            expect(stakedBalanceAfter.sub(stakedBalanceBefore)).gt(minOut);
        });

        it("allows deposits on behalf of another user, amounts match", async () => {
            const user = accounts[7];
            const userAddress = await user.getAddress();

            const lock = true;
            const stakeAddress = ZERO_ADDRESS; // No stake

            await crvBpt.connect(deployer).transfer(aliceAddress, e18.mul(10000));
            await crvBpt.connect(alice).approve(crvDepositor.address, e18.mul(10000));

            const crvBptBalance = await crvBpt.balanceOf(aliceAddress);
            const amount = crvBptBalance.mul(10).div(100);

            const cvxCrvBalanceBefore = await cvxCrv.balanceOf(userAddress);

            await crvDepositor.connect(alice).depositFor(userAddress, amount, lock, stakeAddress);

            const cvxCrvBalanceAfter = await cvxCrv.balanceOf(userAddress);
            const cvxCrvBalanceDelta = cvxCrvBalanceAfter.sub(cvxCrvBalanceBefore);
            expect(cvxCrvBalanceDelta).eq(amount);
        });

        it("stakes on behalf of another user", async () => {
            const user = accounts[8];
            const userAddress = await user.getAddress();

            const lock = true;
            const stakeAddress = cvxCrvStaking.address;

            const crvBptBalance = await crvBpt.balanceOf(aliceAddress);
            const amount = crvBptBalance.mul(10).div(100);

            const stakedBalanceBefore = await cvxCrvStaking.balanceOf(userAddress);

            await crvDepositor.connect(alice).depositFor(userAddress, amount, lock, stakeAddress);

            const stakedBalanceAfter = await cvxCrvStaking.balanceOf(userAddress);
            expect(stakedBalanceAfter.sub(stakedBalanceBefore)).eq(amount);
        });

        it("zapIn with Lit reverts if slippage is to high", async () => {
            const lock = true;
            const stakeAddress = cvxCrvStaking.address;

            const amount = e18.mul(1000);

            const minOut = await crvDepositorWrapper.getMinOut(amount, "10000");

            await lit.connect(alice).approve(crvDepositorWrapper.address, amount);

            await expect(
                crvDepositorWrapper.connect(alice).deposit(amount, minOut, lock, stakeAddress),
            ).to.be.revertedWith("BAL#208");
        });

        it("zapIn with Lit works if slippage is reasonable", async () => {
            const lock = true;
            const stakeAddress = cvxCrvStaking.address;

            const amount = e18.mul(1000);
            const minOut = await crvDepositorWrapper.getMinOut(amount, "9950");

            const initBalStaked = await cvxCrvStaking.balanceOf(aliceAddress);

            await lit.connect(alice).approve(crvDepositorWrapper.address, amount);
            await crvDepositorWrapper.connect(alice).deposit(amount, minOut, lock, stakeAddress);

            const endBalStaked = await cvxCrvStaking.balanceOf(aliceAddress);
            expect(endBalStaked.sub(initBalStaked).gt(minOut));
        });

        it("zapIn with Lit works with decent slippage in big amounts (1M LIT)", async () => {
            const lock = true;
            const stakeAddress = cvxCrvStaking.address;

            // Impersonate LIT whale and airdrop 1M LIT to alice
            await impersonateAccount(litHolderAddress, true);
            const litHolder = await ethers.getSigner(litHolderAddress);
            await lit.connect(litHolder).transfer(aliceAddress, e18.mul(1000000));

            const amount = e18.mul(1000000);
            const minOut = await crvDepositorWrapper.getMinOut(amount, "9900");

            const initBalStaked = await cvxCrvStaking.balanceOf(aliceAddress);

            await lit.connect(alice).approve(crvDepositorWrapper.address, amount);
            await crvDepositorWrapper.connect(alice).deposit(amount, minOut, lock, stakeAddress);

            const endBalStaked = await cvxCrvStaking.balanceOf(aliceAddress);

            expect(endBalStaked.sub(initBalStaked).gt(minOut));
        });
    });

    describe("System cool down", () => {
        it("setCooldown only callable by daoMultisig", async () => {
            const tx = crvDepositor.connect(accounts[5]).setCooldown(true);
            await expect(tx).to.revertedWith("!auth");
        });

        it("setCooldown called, equals true", async () => {
            const daoOperator = await crvDepositor.daoOperator();

            expect(daoOperator).to.equal(deployerAddress);

            const tx = await crvDepositor.connect(deployer).setCooldown(true);
            await tx.wait();
            const cooldown = await crvDepositor.cooldown();
            expect(cooldown).to.equal(true);
        });

        it("lock reverts with cooldown", async () => {
            const tx = crvDepositor.lockCurve();
            await expect(tx).to.revertedWith("cooldown");
        });

        it("deposit skips lock", async () => {
            const tx = crvDepositor["deposit(uint256,bool,address)"](e18, true, ZERO_ADDRESS);
            await expect(tx).to.revertedWith("cooldown");
        });
    });
});
