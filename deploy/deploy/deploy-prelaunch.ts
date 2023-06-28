import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, tenderly } from "hardhat";
import { getConfig, writeConfigFile } from "../config";
import { Contract, BigNumber } from "ethers";

const config = getConfig();

const naming = {
    cvxName: "Liq",
    cvxSymbol: "LIQ",
    vlCvxName: "Vote Locked Liq",
    vlCvxSymbol: "vlLiq",
    cvxCrvName: "Liq LIT",
    cvxCrvSymbol: "liqLIT",
    tokenFactoryNamePostfix: "Liquis Deposit",
};

// yarn hardhat deploy --network tenderly --no-compile --reset --tags prelaunch

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const deployer = (await ethers.getSigners())[0];

    console.log(`Deploying Liq Contract to ${hre.network.name}`);

    let liq: Contract;
    if (hre.network.name == "mainnet") {
        const Liq = await ethers.getContractFactory("Liq", deployer);
        liq = await Liq.deploy(config.Deployments.voterProxy, naming.cvxName, naming.cvxSymbol);
        await liq.deployed();
    } else {
        const Liq = await ethers.getContractFactory("MockERC20", deployer);
        liq = await Liq.deploy(
            naming.cvxName,
            naming.cvxSymbol,
            BigNumber.from(18),
            deployer.address,
            BigNumber.from(100000),
        );
        await liq.deployed();
    }
    console.log(`Deployed at: ${liq.address}`);

    config.Deployments.liq = liq.address;
    writeConfigFile(config);

    await tenderly.verify({
        address: liq.address,
        name: hre.network.name == "mainnet" ? "LiqToken" : "MockERC20",
    });

    console.log(`Deploying LitConvertor Contract to ${hre.network.name}`);
    const LitConvertor = await ethers.getContractFactory("LitConvertor", deployer);
    const litConvertor = await LitConvertor.deploy(
        config.External.balancerVault,
        config.External.lit,
        config.External.weth,
        config.External.balancerPoolId,
    );
    await litConvertor.deployed();
    console.log(`Deployed at: ${litConvertor.address}`);

    config.Deployments.litConvertor = litConvertor.address;
    writeConfigFile(config);

    await tenderly.verify({
        address: litConvertor.address,
        name: "LitConvertor",
    });

    console.log(`Deploying PrelaunchRewardsPool Contract to ${hre.network.name}`);
    const PrelaunchRewardsPool = await ethers.getContractFactory("PrelaunchRewardsPool", deployer);
    const prelaunchRewardsPool = await PrelaunchRewardsPool.deploy(
        config.External.tokenBpt,
        config.Deployments.liq,
        config.Deployments.litConvertor,
        config.External.lit,
        config.Deployments.crvDepositor,
        config.Deployments.voterProxy,
        config.External.votingEscrow,
    );
    await prelaunchRewardsPool.deployed();
    console.log(`Deployed at: ${prelaunchRewardsPool.address}`);

    config.Deployments.prelaunchRewardsPool = prelaunchRewardsPool.address;
    writeConfigFile(config);

    await tenderly.verify({
        address: prelaunchRewardsPool.address,
        name: "PrelaunchRewardsPool",
    });
};

export default func;
func.tags = ["prelaunch"];
