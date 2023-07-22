import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getConfig } from "../config";
import { e18 } from "../../test-utils";

import { CrvDepositor__factory, MockERC20__factory } from "../../types/generated";

const config = getConfig();

// yarn hardhat deploy --network tenderly --no-compile --reset --tags voterProxyInitialLock

// Note VoterProxy address must be whitelisted previously
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const deployer = (await ethers.getSigners())[0];

    console.log(`Executing InitialLock to ${hre.network.name}`);

    const litBpt = MockERC20__factory.connect(config.External.tokenBpt, deployer);

    const litBptBal = await litBpt.balanceOf(deployer.address);
    const litBptName = await litBpt.name();
    console.log(`Deployer BPT ${litBptName} balance: `, +litBptBal);

    const amount = e18.mul(10);

    console.log(`Transfer of ${amount} ${litBptName} is done`);

    let tx = await litBpt.transfer(config.Deployments.voterProxy, amount);
    await tx.wait();

    const balanceOfBptInProxy = await litBpt.balanceOf(config.Deployments.voterProxy);
    console.log(`VoterProxy BPT ${litBptName} balance: `, +balanceOfBptInProxy);

    const crvDepositor = CrvDepositor__factory.connect(config.Deployments.crvDepositor, deployer);

    tx = await crvDepositor.initialLock();
    await tx.wait();

    console.log(`Initial BPT ${litBptName} lock for ${amount} done`);
};

export default func;
func.tags = ["voterProxyInitialLock"];
