import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getConfig } from "../config";

import { VoterProxy__factory } from "../../types/generated";

const config = getConfig();

// yarn hardhat deploy --network tenderly --no-compile --reset --tags voterProxySet

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const deployer = (await ethers.getSigners())[0];

    console.log(`Executing setDepositor to ${hre.network.name}`);

    const voterProxy = VoterProxy__factory.connect(config.Deployments.voterProxy, deployer);

    const tx = await voterProxy.setDepositor(config.Deployments.crvDepositor);
    await tx.wait();

    console.log("Depositor set in VoterProxy");
};

export default func;
func.tags = ["voterProxySet"];
