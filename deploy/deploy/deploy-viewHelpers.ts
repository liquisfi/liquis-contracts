import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

// yarn hardhat deploy --network tenderly --no-compile --reset --tags viewHelpers

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const deployer = (await ethers.getSigners())[0];

    console.log(`Deploying ViewHelpers to ${hre.network.name}`);

    const LiquisViewHelpers = await ethers.getContractFactory("LiquisViewHelpers", deployer);
    const liquisViewHelpers = await LiquisViewHelpers.deploy();
    await liquisViewHelpers.deployed();

    console.log(`Deployed at: ${liquisViewHelpers.address}`);
};

export default func;
func.tags = ["viewHelpers"];
