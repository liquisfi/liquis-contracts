import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import { logContracts } from "../utils/deploy-utils";
import { BigNumber as BN } from "ethers";
import { getSigner, deployContract, waitForTx } from "../utils";
import { LiqVestedEscrow, LiqVestedEscrow__factory, LiqToken__factory } from "../../types/generated";
import { ZERO_ADDRESS, ONE_WEEK, e18 } from "../../test-utils/constants";
import { config } from "./vesting-config";

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

const debug = true;
const waitForBlocks = 3;

task("vesting:deploy").setAction(async function (_: TaskArguments, hre) {
    const deployer = await getSigner(hre);
    const { ethers } = hre;

    // ------------------------
    // Vesting escrow streams
    // ------------------------

    const { distroList, multisigs } = config;

    const liq = LiqToken__factory.connect(mainnetDeployment.liq, deployer);
    const liqLockerAddress = ZERO_ADDRESS;

    const currentTime = BN.from((await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp);
    const DELAY = ONE_WEEK;
    const vestingStart = currentTime.add(DELAY);
    const vestedEscrows = [];

    const vestingDistro = distroList.vesting.map(v => ({ ...v, admin: multisigs.treasuryMultisig }));
    //.concat(distroList.immutableVesting.map(v => ({ ...v, admin: ZERO_ADDRESS })));

    let totalAmount: BN = BN.from(0);

    for (let i = 0; i < vestingDistro.length; i++) {
        const vestingGroup = vestingDistro[i];
        const groupVestingAmount = vestingGroup.recipients.reduce((p, c) => p.add(c.amount), BN.from(0));
        const vestingEnd = vestingStart.add(vestingGroup.period);

        const vestedEscrow = await deployContract<LiqVestedEscrow>(
            hre,
            new LiqVestedEscrow__factory(deployer),
            "LiqVestedEscrow",
            [liq.address, vestingGroup.admin, liqLockerAddress, vestingStart, vestingEnd],
            {},
            debug,
            waitForBlocks,
        );

        let tx = await liq.approve(vestedEscrow.address, groupVestingAmount);
        await waitForTx(tx, debug, waitForBlocks);
        const vestingAddr = vestingGroup.recipients.map(m => m.address);
        const vestingAmounts = vestingGroup.recipients.map(m => m.amount);
        tx = await vestedEscrow.fund(vestingAddr, vestingAmounts);
        await waitForTx(tx, debug, waitForBlocks);

        totalAmount = totalAmount.add(groupVestingAmount);
        console.log("TotalAmount of Liq committed", totalAmount.div(e18).toString());

        vestedEscrows.push(vestedEscrow);
    }

    logContracts(vestedEscrows as unknown as { [key: string]: { address: string } });
});
