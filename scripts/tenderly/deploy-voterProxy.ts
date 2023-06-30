import { HardhatRuntimeEnvironment } from "hardhat/types";
import hre, { ethers, tenderly } from "hardhat";
import { getConfig, writeConfigFile } from "./config";

import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();

const config = getConfig();

async function main(hre: HardhatRuntimeEnvironment) {
    const deployer = (await ethers.getSigners())[0];

    console.log(`Deploying VoterProxy Contract to ${hre.network.name}`);
    const VoterProxy = await ethers.getContractFactory("VoterProxy", deployer);
    const voterProxy = await VoterProxy.deploy(
        config.External.minter,
        config.External.token,
        config.External.tokenBpt,
        config.External.votingEscrow,
        config.External.gaugeController,
    );
    await voterProxy.deployed();
    console.log(`Deployed at: ${voterProxy.address}`);

    config.Deployments.voterProxy = voterProxy.address;
    writeConfigFile(config);

    console.log(`Verifying contract on Tenderly...`);
    await tenderly.verify({
        address: voterProxy.address,
        name: "VoterProxy",
    });

    console.log(`✅ Done!`);
}

main(hre).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
