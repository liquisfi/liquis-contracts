import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getConfig } from "../config";

import { PrelaunchRewardsPool__factory } from "../../types/generated";

const config = getConfig();

// yarn hardhat deploy --network tenderly --no-compile --reset --tags setCrvDepositor

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const deployer = (await ethers.getSigners())[0];

    console.log(`Executing setCrvDepositor to ${hre.network.name}`);

    const prelaunchRewardsPool = PrelaunchRewardsPool__factory.connect(
        config.Deployments.prelaunchRewardsPool,
        deployer,
    );

    // Need to setCrvDepositor as the approval is in the setCrvDepositor
    const tx = await prelaunchRewardsPool.setCrvDepositor(config.Deployments.crvDepositor);
    await tx.wait();

    console.log("CrvDepositor set in PrelaunchRewardsPool");
};

export default func;
func.tags = ["setCrvDepositor"];
