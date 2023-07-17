import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import "solidity-coverage";
import "@nomiclabs/hardhat-etherscan";
import "./tasks/coverage";
import "solidity-docgen";
import * as tenderly from "@tenderly/hardhat-tenderly";

tenderly.setup({ automaticVerifications: false });

import { resolve } from "path";

import { config as dotenvConfig } from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenvConfig({ path: resolve(__dirname, "./.env") });

const chainIds = {
    goerli: 5,
    hardhat: 31337,
    mainnet: 1,
};

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    gasReporter: {
        currency: "USD",
        enabled: false,
        excludeContracts: [],
        src: "./contracts",
    },
    networks: {
        hardhat: {
            chainId: chainIds.hardhat,
            allowUnlimitedContractSize: true,
        },
        mainnet: {
            url: process.env.NODE_URL || "",
        },
        kovan: {
            url: process.env.NODE_URL || "",
            gasPrice: 3000000000,
        },
        goerli: {
            url: process.env.NODE_URL || "",
            gasPrice: 3000000000,
        },
        forking: {
            url: process.env.NODE_URL || "",
        },
        rinkeby: { url: process.env.NODE_URL || "", gasPrice: 3000000000 },
        localhost: {
            chainId: 1,
            url: "http://127.0.0.1:8545/",
            allowUnlimitedContractSize: true,
            timeout: 1000 * 60,
        },
        tenderly: {
            // tenderly fork
            chainId: Number.parseInt(process.env.TENDERLY_FORK_CHAINID || "SET ME"),
            url: process.env.TENDERLY_FORK_URL || "SET ME",
            accounts: process.env.TENDERLY_PRIVATE_KEY !== undefined ? [process.env.TENDERLY_PRIVATE_KEY] : [],
        },
    },
    tenderly: {
        project: process.env.TENDERLY_PROJECT,
        username: process.env.TENDERLY_USERNAME,
        privateVerification: true,
    },
    paths: {
        artifacts: "./artifacts",
        cache: "./cache",
        sources: "./contracts",
        tests: "./test",
    },
    solidity: {
        compilers: [
            {
                version: "0.6.12",
                settings: {
                    optimizer: { enabled: true, runs: 200 },
                },
            },
            {
                version: "0.8.11",
                settings: {
                    optimizer: { enabled: true, runs: 1000 },
                },
            },
        ],
    },
    typechain: {
        outDir: "types/generated",
        target: "ethers-v5",
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_KEY,
    },
    contractSizer: {
        alphaSort: true,
        disambiguatePaths: false,
        runOnCompile: false,
        strict: true,
    },
    mocha: {
        timeout: 480000, // 8 min timeout
    },
};

export default config;
