import { simpleToExactAmount } from "../../test-utils/math";
import hre, { network } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import {
    CrvDepositorWrapperWithFee,
    ERC20__factory,
    ERC20,
    CrvDepositorWrapperWithFee__factory,
} from "../../types/generated";
import { impersonate, impersonateAccount } from "../../test-utils";
import { deployContract } from "../../tasks/utils";
import { config } from "../../tasks/deploy/mainnet-config";
import { SystemDeployed } from "scripts/deploySystem";

const debug = false;
const balWhaleAddress = "0xff052381092420b7f24cc97fded9c0c17b2cbbb9";
const keeperAddress = "0xcc247cde79624801169475c9ba1f716db3959b8f";

describe("CrvDepositorWrapperWithFee", () => {
    let protocolDao: Signer;
    let eoa: Signer;

    let system: SystemDeployed;

    let crvDepositorWrapperWithFee: CrvDepositorWrapperWithFee;

    before(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: process.env.NODE_URL,
                        blockNumber: 15433562,
                    },
                },
            ],
        });

        await impersonateAccount(config.multisigs.daoMultisig);
        protocolDao = await impersonate(config.multisigs.daoMultisig);

        await impersonateAccount(balWhaleAddress);
        eoa = await impersonate(balWhaleAddress);

        await impersonateAccount(keeperAddress);

        system = await config.getPhase4(protocolDao);
    });

    it("deploy CrvDepositorWrapperWithFee", async () => {
        crvDepositorWrapperWithFee = await deployContract<CrvDepositorWrapperWithFee>(
            hre,
            new CrvDepositorWrapperWithFee__factory(eoa),
            `CrvDepositorWrapperWithFee`,
            [
                system.crvDepositor.address,
                config.addresses.balancerVault,
                config.addresses.token,
                config.addresses.weth,
                config.addresses.balancerPoolId,
                system.booster.address,
                system.voterProxy.address,
                config.multisigs.daoMultisig,
            ],
            {},
            debug,
        );
        await crvDepositorWrapperWithFee.setApprovals();
    });

    it("updates overall fees", async () => {
        await system.booster.connect(protocolDao).setFees(1500, 950, 50, 0);
    });

    it("only lets protocolDAO update the feeRatio", async () => {
        await expect(crvDepositorWrapperWithFee.setFeeRatio(5000)).to.be.revertedWith(
            "Ownable: caller is not the owner",
        );

        await expect(crvDepositorWrapperWithFee.connect(protocolDao).setFeeRatio(15000)).to.be.revertedWith(
            "Invalid ratio",
        );

        await crvDepositorWrapperWithFee.connect(protocolDao).setFeeRatio(5789);

        const feeRatio = await crvDepositorWrapperWithFee.feeRatio();
        expect(feeRatio).eq(5789);
    });
});
