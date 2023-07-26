import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getConfig } from "../config";

import { PrelaunchRewardsPool__factory, MockERC20__factory } from "../../types/generated";

const config = getConfig();

// yarn hardhat deploy --network tenderly --no-compile --reset --tags getters

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const deployer = (await ethers.getSigners())[0];

    console.log(`Getters on ${hre.network.name}`);

    const prelaunchRewardsPool = PrelaunchRewardsPool__factory.connect(
        config.Deployments.prelaunchRewardsPool,
        deployer,
    );

    const START_VESTING_DATE = await prelaunchRewardsPool.START_VESTING_DATE();
    console.log(`Start of vesting date: ${START_VESTING_DATE.toString()}`);

    const START_WITHDRAWALS = await prelaunchRewardsPool.START_WITHDRAWALS();
    console.log(`Start of withdrawals date: ${START_WITHDRAWALS.toString()}`);

    const rewardRate = await prelaunchRewardsPool.rewardRate();
    console.log(`rewardRate: ${rewardRate.toString()}`);

    const historicalRewards = await prelaunchRewardsPool.historicalRewards();
    console.log(`historicalRewards: ${historicalRewards.toString()}`);

    const earnedDeployer = await prelaunchRewardsPool.earned(deployer.address);
    console.log(`earnedDeployer: ${earnedDeployer.toString()}`);

    const block = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
    console.log("Current timestamp:", block.timestamp);

    const periodFinish = await prelaunchRewardsPool.periodFinish();
    console.log("Current periodFinish:", +periodFinish);

    const liq = MockERC20__factory.connect(config.Deployments.liq, deployer);
    const preLaunchLiqBal = await liq.balanceOf(prelaunchRewardsPool.address);
    console.log("preLaunchLiqBal:", preLaunchLiqBal.toString());

    const crvDepositor = await prelaunchRewardsPool.crvDepositor();
    console.log("Current crvDepositor:", crvDepositor);
};

export default func;
func.tags = ["getters"];
