import { expect } from "chai";
import hre, { ethers, network } from "hardhat";
import { Signer } from "ethers";
import {
    deployCanonicalPhase,
    deploySidechainSystem,
    SidechainDeployed,
    CanonicalPhaseDeployed,
} from "../../scripts/deploySidechain";
import { Phase2Deployed, Phase6Deployed } from "../../scripts/deploySystem";
import { AuraBalVaultDeployed, config as mainnetConfig } from "../../tasks/deploy/mainnet-config";
import {
    impersonateAccount,
    ZERO_ADDRESS,
    ONE_WEEK,
    ONE_HOUR,
    simpleToExactAmount,
    ONE_DAY,
    ZERO_KEY,
    getBal,
} from "../../test-utils";
import {
    Account,
    AuraOFT,
    L2Coordinator,
    Create2Factory,
    Create2Factory__factory,
    ExtraRewardStashV3__factory,
    LZEndpointMock,
    LZEndpointMock__factory,
    ERC20__factory,
    MockERC20__factory,
    BaseRewardPool4626__factory,
    BaseRewardPool__factory,
} from "../../types";
import { sidechainNaming } from "../../tasks/deploy/sidechain-constants";
import { SidechainConfig } from "../../types/sidechain-types";
import { increaseTime } from "./../../test-utils/time";
import { deploySimpleBridgeDelegates, SimplyBridgeDelegateDeployed } from "../../scripts/deployBridgeDelegates";
describe("Canonical", () => {
    const L1_CHAIN_ID = 111;
    const L2_CHAIN_ID = 222;
    let alice: Signer;
    let aliceAddress: string;
    let deployer: Account;
    let dao: Account;
    // phases
    let phase2: Phase2Deployed;
    let phase6: Phase6Deployed;
    let vaultDeployment: AuraBalVaultDeployed;
    let canonical: CanonicalPhaseDeployed;
    let bridgeDelegate: SimplyBridgeDelegateDeployed;
    // LayerZero endpoints
    let l1LzEndpoint: LZEndpointMock;
    let l2LzEndpoint: LZEndpointMock;
    let create2Factory: Create2Factory;
    let sidechain: SidechainDeployed;
    let l2Coordinator: L2Coordinator;
    let auraOFT: AuraOFT;
    let sidechainConfig: SidechainConfig;

    const ethBlockNumber: number = 17096880;

    /* ---------------------------------------------------------------------
     * Helper Functions
     * --------------------------------------------------------------------- */

    before(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: process.env.NODE_URL,
                        blockNumber: ethBlockNumber,
                    },
                },
            ],
        });

        const accounts = await ethers.getSigners();
        alice = accounts[1];
        aliceAddress = await alice.getAddress();
        deployer = await impersonateAccount(await accounts[0].getAddress());
        dao = await impersonateAccount(mainnetConfig.multisigs.daoMultisig);
        phase2 = await mainnetConfig.getPhase2(deployer.signer);
        phase6 = await mainnetConfig.getPhase6(deployer.signer);
        vaultDeployment = await mainnetConfig.getAuraBalVault(deployer.signer);

        // deploy layerzero mocks
        l1LzEndpoint = await new LZEndpointMock__factory(deployer.signer).deploy(L1_CHAIN_ID);
        l2LzEndpoint = await new LZEndpointMock__factory(deployer.signer).deploy(L2_CHAIN_ID);

        // deploy Create2Factory
        create2Factory = await new Create2Factory__factory(deployer.signer).deploy();
        await create2Factory.updateDeployer(deployer.address, true);

        // setup sidechain config
        sidechainConfig = {
            chainId: 123,
            multisigs: { daoMultisig: dao.address, pauseGaurdian: dao.address },
            naming: { ...sidechainNaming },
            extConfig: {
                canonicalChainId: L1_CHAIN_ID,
                lzEndpoint: l2LzEndpoint.address,
                create2Factory: create2Factory.address,
                token: mainnetConfig.addresses.token,
                minter: mainnetConfig.addresses.minter,
            },
            bridging: {
                l1Receiver: "0x0000000000000000000000000000000000000000",
                l2Sender: "0x0000000000000000000000000000000000000000",
                nativeBridge: "0x0000000000000000000000000000000000000000",
            },
        };

        // deploy canonicalPhase
        const l1Addresses = { ...mainnetConfig.addresses, lzEndpoint: l1LzEndpoint.address };
        canonical = await deployCanonicalPhase(
            hre,
            deployer.signer,
            mainnetConfig.multisigs,
            l1Addresses,
            phase2,
            phase6,
            vaultDeployment,
        );

        // deploy sidechain
        sidechain = await deploySidechainSystem(
            hre,
            deployer.signer,
            sidechainConfig.naming,
            sidechainConfig.multisigs,
            sidechainConfig.extConfig,
        );

        l2Coordinator = sidechain.l2Coordinator;
        auraOFT = sidechain.auraOFT;

        bridgeDelegate = await deploySimpleBridgeDelegates(
            hre,
            mainnetConfig.addresses,
            canonical,
            L2_CHAIN_ID,
            deployer.signer,
        );

        phase6 = await mainnetConfig.getPhase6(deployer.signer);

        // Connect contracts to its owner signer.
        canonical.l1Coordinator = canonical.l1Coordinator.connect(dao.signer);
        canonical.auraProxyOFT = canonical.auraProxyOFT.connect(dao.signer);
        canonical.auraBalProxyOFT = canonical.auraBalProxyOFT.connect(dao.signer);
    });

    describe("setup", () => {
        it("----", async () => {
            console.log(canonical);
            canonical.auraBalProxyOFT;
            canonical.l1Coordinator;
            canonical.auraProxyOFT;
        });

        it("add trusted remotes to layerzero endpoints", async () => {
            const owner = await impersonateAccount(await sidechain.l2Coordinator.owner());
            // L1 Stuff
            await canonical.l1Coordinator
                .connect(owner.signer)
                .setTrustedRemote(
                    L2_CHAIN_ID,
                    ethers.utils.solidityPack(
                        ["address", "address"],
                        [sidechain.l2Coordinator.address, canonical.l1Coordinator.address],
                    ),
                );

            await canonical.auraProxyOFT
                .connect(owner.signer)
                .setTrustedRemote(
                    L2_CHAIN_ID,
                    ethers.utils.solidityPack(
                        ["address", "address"],
                        [sidechain.auraOFT.address, canonical.auraProxyOFT.address],
                    ),
                );

            await canonical.auraProxyOFT
                .connect(owner.signer)
                .setTrustedRemote(
                    L2_CHAIN_ID,
                    ethers.utils.solidityPack(
                        ["address", "address"],
                        [sidechain.auraOFT.address, canonical.auraProxyOFT.address],
                    ),
                );

            await l1LzEndpoint.connect(owner.signer).setDestLzEndpoint(l2Coordinator.address, l2LzEndpoint.address);
            await l1LzEndpoint.connect(owner.signer).setDestLzEndpoint(auraOFT.address, l2LzEndpoint.address);

            // L2 Stuff

            await sidechain.l2Coordinator
                .connect(owner.signer)
                .setTrustedRemote(
                    L1_CHAIN_ID,
                    ethers.utils.solidityPack(
                        ["address", "address"],
                        [canonical.l1Coordinator.address, sidechain.l2Coordinator.address],
                    ),
                );

            await sidechain.auraOFT
                .connect(owner.signer)
                .setTrustedRemote(
                    L1_CHAIN_ID,
                    ethers.utils.solidityPack(
                        ["address", "address"],
                        [canonical.auraProxyOFT.address, sidechain.auraOFT.address],
                    ),
                );

            await sidechain.auraBalOFT
                .connect(owner.signer)
                .setTrustedRemote(
                    L1_CHAIN_ID,
                    ethers.utils.solidityPack(
                        ["address", "address"],
                        [canonical.auraBalProxyOFT.address, sidechain.auraBalOFT.address],
                    ),
                );

            await l2LzEndpoint
                .connect(owner.signer)
                .setDestLzEndpoint(canonical.l1Coordinator.address, l1LzEndpoint.address);
            await l2LzEndpoint
                .connect(owner.signer)
                .setDestLzEndpoint(canonical.auraProxyOFT.address, l1LzEndpoint.address);
        });
        it("set bridge delegates", async () => {
            await canonical.l1Coordinator.setBridgeDelegate(L2_CHAIN_ID, bridgeDelegate.bridgeDelegateReceiver.address);
            expect(await canonical.l1Coordinator.bridgeDelegates(L2_CHAIN_ID)).to.eq(
                bridgeDelegate.bridgeDelegateReceiver.address,
            );
        });
    });
    describe("Check configs", () => {
        it("auraBalProxyOFT has correct config", async () => {
            expect(await canonical.auraBalProxyOFT.lzEndpoint()).eq(l1LzEndpoint.address);
            expect(await canonical.auraBalProxyOFT.vault()).eq(vaultDeployment.vault.address);
            expect(await canonical.auraBalProxyOFT.internalTotalSupply()).eq(0);
        });

        it("AuraProxyOFT has correct config", async () => {
            expect(await canonical.auraProxyOFT.lzEndpoint()).eq(l1LzEndpoint.address);
            expect(await canonical.auraProxyOFT.token()).eq(phase2.cvx.address);
            expect(await canonical.auraProxyOFT.locker()).eq(phase2.cvxLocker.address);
            // Allowances
            expect(await phase2.cvx.allowance(canonical.auraProxyOFT.address, phase2.cvxLocker.address)).eq(
                ethers.constants.MaxUint256,
            );
        });
        it("L1Coordinator has correct config", async () => {
            expect(await canonical.l1Coordinator.booster()).eq(phase6.booster.address);
            expect(await canonical.l1Coordinator.balToken()).eq(mainnetConfig.addresses.token);
            expect(await canonical.l1Coordinator.auraToken()).eq(phase2.cvx.address);
            expect(await canonical.l1Coordinator.auraOFT()).eq(canonical.auraProxyOFT.address);
            expect(await canonical.l1Coordinator.lzEndpoint()).eq(l1LzEndpoint.address);
            // Allowances
            expect(await phase2.cvx.allowance(canonical.l1Coordinator.address, canonical.auraProxyOFT.address)).eq(
                ethers.constants.MaxUint256,
            );
            const crv = MockERC20__factory.connect(mainnetConfig.addresses.token, deployer.signer);
            expect(await crv.allowance(canonical.l1Coordinator.address, phase6.booster.address)).eq(
                ethers.constants.MaxUint256,
            );
        });
    });
    describe("Setup: Protocol DAO transactions", () => {
        it("set auraOFT as booster bridge delegate", async () => {
            expect(await phase6.booster.bridgeDelegate()).not.eq(canonical.l1Coordinator.address);
            await phase6.booster.connect(dao.signer).setBridgeDelegate(canonical.l1Coordinator.address);
            expect(await phase6.booster.bridgeDelegate()).eq(canonical.l1Coordinator.address);
        });
    });
    describe("L1Coordinator tests", () => {
        it("set l2coordinator", async () => {
            expect(await canonical.l1Coordinator.l2Coordinators(L2_CHAIN_ID)).not.eq(sidechain.l2Coordinator.address);
            await canonical.l1Coordinator.setL2Coordinator(L2_CHAIN_ID, sidechain.l2Coordinator.address);
            expect(await canonical.l1Coordinator.l2Coordinators(L2_CHAIN_ID)).eq(sidechain.l2Coordinator.address);
        });
        it("Can Notify Fees", async () => {
            const endpoint = await impersonateAccount(await canonical.l1Coordinator.lzEndpoint());
            console.log(endpoint.address);
            const payload = ethers.utils.defaultAbiCoder.encode(
                ["bytes4", "uint8", "uint256"],
                ["0x7a7f9946", "1", (100e18).toString()],
            );
            await canonical.l1Coordinator
                .connect(endpoint.signer)
                .lzReceive(L2_CHAIN_ID, await canonical.l1Coordinator.trustedRemoteLookup(L2_CHAIN_ID), 0, payload);
            expect(Number(await canonical.l1Coordinator.feeDebt(L2_CHAIN_ID))).to.eq(Number(100e18));
        });
        it("Can Settle Fee Debt", async () => {
            await getBal(mainnetConfig.addresses, bridgeDelegate.bridgeDelegateReceiver.address, (100e18).toString());
            await bridgeDelegate.bridgeDelegateReceiver.settleFeeDebt((100e18).toString());

            const crv = MockERC20__factory.connect(mainnetConfig.addresses.token, dao.signer);

            expect(Number(await canonical.l1Coordinator.feeDebt(L2_CHAIN_ID))).to.eq(Number(0));
            expect(await crv.balanceOf(bridgeDelegate.bridgeDelegateReceiver.address)).to.eq(0);
            expect(await crv.balanceOf(canonical.l1Coordinator.address)).to.eq(100e18);
        });
        it("booster can recieve l2 fees and distribute aura to l1coordinator", async () => {
            const crv = MockERC20__factory.connect(mainnetConfig.addresses.token, dao.signer);
            const cvx = MockERC20__factory.connect(phase2.cvx.address, dao.signer);

            const feeAmount = await crv.balanceOf(canonical.l1Coordinator.address);
            const totalSupplyStart = await cvx.totalSupply();
            const crvBalBefore = await crv.balanceOf(dao.address);
            const startOFTBalance = await cvx.balanceOf(canonical.auraProxyOFT.address);

            await canonical.l1Coordinator.distributeAura(L2_CHAIN_ID, { value: simpleToExactAmount("0.2") });

            const endAura = await cvx.balanceOf(canonical.l1Coordinator.address);
            const endBal = await crv.balanceOf(canonical.l1Coordinator.address);
            const crvBalAfter = await crv.balanceOf(dao.address);
            const endTotalSupply = await cvx.totalSupply();
            const endOFTBalance = await cvx.balanceOf(canonical.auraProxyOFT.address);

            //expect(endTotalSupply).to.be.gt(totalSupplyStart)
            expect(endAura).eq(0);
            expect(endBal).eq(0);
            expect(crvBalBefore.sub(crvBalAfter)).eq(feeAmount);
            expect(endOFTBalance).to.be.gt(startOFTBalance);
        });
    });
});