import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getConfig } from "../config";

import { PrelaunchRewardsPool__factory } from "../../types/generated";

const config = getConfig();

// yarn hardhat deploy --network tenderly --no-compile --reset --tags increaseTime

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const deployer = (await ethers.getSigners())[0];

    console.log(`Increasing time in network ${hre.network.name}`);

    const prelaunchRewardsPool = PrelaunchRewardsPool__factory.connect(
        config.Deployments.prelaunchRewardsPool,
        deployer,
    );

    const START_VESTING_DATE = await prelaunchRewardsPool.START_VESTING_DATE();
    const START_WITHDRAWALS = await prelaunchRewardsPool.START_WITHDRAWALS();

    console.log(`Start of vesting date: ${START_VESTING_DATE.toString()}`);
    console.log(`Start of withdrawals date: ${START_WITHDRAWALS.toString()}`);

    let block = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
    console.log("Current timestamp: ", block.timestamp);

    const duration = parseInt(START_VESTING_DATE.sub(block.timestamp).toString()) || 86400;

    const periodFinish = await prelaunchRewardsPool.periodFinish();
    console.log("Current periodFinish: ", +periodFinish);

    await ethers.provider.send("evm_increaseTime", [duration]);
    await ethers.provider.send("evm_mine", []);

    block = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
    console.log("New timestamp:", block.timestamp);
};

export default func;
func.tags = ["increaseTime"];
