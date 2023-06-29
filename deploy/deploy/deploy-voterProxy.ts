import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, tenderly } from "hardhat";
import { getConfig, writeConfigFile } from "../config";
import { readFileSync } from "fs";

import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();

const config = getConfig();

const FORK_ID = process.env.TENDERLY_FORK_ID || "";

// yarn hardhat deploy --network tenderly --no-compile --reset --tags VoterProxy

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
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

    await tenderly.verifyForkAPI(
        {
            config: {
                compiler_version: "0.6.12",
                evm_version: "default",
                optimizations_count: 200,
                optimizations_used: false,
            },
            root: "",
            contracts: [
                {
                    contractName: "VoterProxy",
                    source: readFileSync("convex-platform/contracts/contracts/VoterProxy.sol", "utf-8").toString(),
                    sourcePath: "convex-platform/contracts/contracts",
                    networks: {
                        // important: key is the Fork ID (UUID-like string)
                        [FORK_ID]: {
                            // using ES6 computed properties
                            address: voterProxy.address,
                            links: {},
                        },
                    },
                    compiler: {
                        name: "solc",
                        version: "0.6.12",
                    },
                },
            ],
        },
        process.env.TENDERLY_PROJECT || "",
        process.env.TENDERLY_USERNAME || "",
        FORK_ID,
    );

    console.log(`✅ Done!`);
};

export default func;
func.tags = ["VoterProxy"];
