import hardhatConfig from "./hardhat.config";

export default {
    ...hardhatConfig,
    networks: {
        ...hardhatConfig.networks,
        hardhat: {
            allowUnlimitedContractSize: false,
            forking: {
                url: process.env.NODE_URL || "",
            },
            // needed for testing deploy scripts locally
            mining: {
                auto: true,
                interval: 1000,
            },
        },
        localhost: {
            chainId: 1,
            url: "http://127.0.0.1:8545/",
            allowUnlimitedContractSize: false,
            timeout: 1000 * 60,
        },
        tenderly: {
            // tenderly fork
            chainId: Number.parseInt(process.env.TENDERLY_FORK_CHAINID || "SET ME"),
            url: process.env.TENDERLY_FORK_URL || "SET ME",
        },
        devnet: {
            // tenderly devnet
            chainId: Number.parseInt(process.env.TENDERLY_FORK_CHAINID || "SET ME"),
            url: process.env.DEVNET_RPC_URL || "SET ME",
        },
    },
    mocha: {
        timeout: 480000, // 4 min timeout
    },
};
