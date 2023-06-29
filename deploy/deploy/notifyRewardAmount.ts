import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getConfig } from "../config";
import { e18 } from "../../test-utils";

import { PrelaunchRewardsPool__factory, MockERC20__factory } from "../../types/generated";

const config = getConfig();

// yarn hardhat deploy --network tenderly --no-compile --reset --tags notifyRewardAmount

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const deployer = (await ethers.getSigners())[0];

    console.log(`Executing approval and notifyRewardAmount to ${hre.network.name}`);

    const liq = MockERC20__factory.connect(config.Deployments.liq, deployer);

    const liqBal = await liq.balanceOf(deployer.address);
    console.log("Deployer LIT balance: ", +liqBal);

    const amount = e18.mul(10000);
    console.log("amount:", +amount);

    let tx = await liq.approve(config.Deployments.prelaunchRewardsPool, amount);
    await tx.wait();
    console.log(`Approval for ${amount} is done`);

    const prelaunchRewardsPool = PrelaunchRewardsPool__factory.connect(
        config.Deployments.prelaunchRewardsPool,
        deployer,
    );

    tx = await prelaunchRewardsPool.notifyRewardAmount(amount);
    await tx.wait();
    console.log(`NotifyRewardAmount for ${amount} is done`);
};

export default func;
func.tags = ["notifyRewardAmount"];
