import { network } from "hardhat";
import * as fs from "fs";
import MainnetConfig from "./contracts.json";
import TenderlyConfig from "./contracts.tenderly.json";

export function getConfig() {
    if (network.name === "mainnet") {
        return MainnetConfig;
    }
    if (network.name === "tenderly") {
        return TenderlyConfig;
    }

    throw new Error("not found config");
}

export function writeConfigFile(config: any) {
    let filePath;
    switch (network.name) {
        case "mainnet":
            filePath = "deploy/contracts.json";
            break;
        case "tenderly":
            filePath = "deploy/contracts.tenderly.json";
            break;
        default:
            throw Error("Unsupported network");
    }
    console.log(`>> Writing ${filePath}`);
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    console.log("✅ Done");
}
