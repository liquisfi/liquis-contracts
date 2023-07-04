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
            BigNumber.from(1000000),
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

    console.log(`Deploying LiqLit Contract to ${hre.network.name}`);
    const CvxCrvToken = await ethers.getContractFactory("CvxCrvToken", deployer);
    const cvxCrv = await CvxCrvToken.deploy(naming.cvxCrvName, naming.cvxCrvSymbol);

    await cvxCrv.deployed();
    console.log(`Deployed at: ${cvxCrv.address}`);

    config.Deployments.cvxCrv = cvxCrv.address;
    writeConfigFile(config);

    await tenderly.verify({
        address: cvxCrv.address,
        name: "CvxCrvToken",
    });

    console.log(`Deploying CrvDepositor Contract to ${hre.network.name}`);
    const CrvDepositor = await ethers.getContractFactory("CrvDepositor", deployer);
    const crvDepositor = await CrvDepositor.deploy(
        config.Deployments.voterProxy,
        cvxCrv.address,
        config.External.weth,
        config.External.votingEscrow,
        deployer.address,
    );

    await crvDepositor.deployed();
    console.log(`Deployed at: ${crvDepositor.address}`);

    config.Deployments.crvDepositor = crvDepositor.address;
    writeConfigFile(config);

    await tenderly.verify({
        address: crvDepositor.address,
        name: "CrvDepositor",
    });

    console.log(`Deploying LitDepositorHelper Contract to ${hre.network.name}`);
    const LitDepositorHelper = await ethers.getContractFactory("LitDepositorHelper", deployer);
    const litDepositorHelper = await LitDepositorHelper.deploy(
        crvDepositor.address,
        config.External.balancerVault,
        config.External.lit,
        config.External.weth,
        config.External.balancerPoolId,
    );
    await litDepositorHelper.deployed();
    console.log(`Deployed at: ${litDepositorHelper.address}`);

    config.Deployments.litDepositorHelper = litDepositorHelper.address;
    writeConfigFile(config);

    await tenderly.verify({
        address: litDepositorHelper.address,
        name: "LitDepositorHelper",
    });

    console.log(`Deploying PrelaunchRewardsPool Contract to ${hre.network.name}`);
    const PrelaunchRewardsPool = await ethers.getContractFactory("PrelaunchRewardsPool", deployer);
    const prelaunchRewardsPool = await PrelaunchRewardsPool.deploy(
        config.External.tokenBpt,
        config.Deployments.liq,
        litDepositorHelper.address,
        config.External.lit,
        crvDepositor.address,
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
