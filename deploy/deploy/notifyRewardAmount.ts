import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getConfig } from "../config";

import { PrelaunchRewardsPool__factory, MockERC20__factory } from "../../types/generated";

const config = getConfig();

// yarn hardhat deploy --network tenderly --no-compile --reset --tags notifyRewardAmount

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const deployer = (await ethers.getSigners())[0];

    console.log(`Executing approval and notifyRewardAmount to ${hre.network.name}`);

    const liq = MockERC20__factory.connect(config.Deployments.liq, deployer);

    const liqBal = await liq.balanceOf(deployer.address);

    let tx = await liq.approve(config.Deployments.prelaunchRewardsPool, liqBal);
    await tx.wait();
    console.log(`Approval for ${liqBal} is done`);

    const prelaunchRewardsPool = PrelaunchRewardsPool__factory.connect(
        config.Deployments.prelaunchRewardsPool,
        deployer,
    );

    tx = await prelaunchRewardsPool.notifyRewardAmount(liqBal);
    await tx.wait();
    console.log(`NotifyRewardAmount for ${liqBal} is done`);
};

export default func;
func.tags = ["notifyRewardAmount"];
