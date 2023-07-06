import { HardhatRuntimeEnvironment } from "hardhat/types";
import hre, { ethers, tenderly } from "hardhat";
import { getConfig, writeConfigFile } from "./config";
import { Contract, BigNumber } from "ethers";
import { config as dotEnvConfig } from "dotenv";

dotEnvConfig();

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

async function main(hre: HardhatRuntimeEnvironment) {
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
    const cvxCrvToken = await ethers.getContractFactory("cvxCrvToken", deployer);
    const cvxCrv = await cvxCrvToken.deploy(naming.cvxCrvName, naming.cvxCrvSymbol);

    await cvxCrv.deployed();
    console.log(`Deployed at: ${cvxCrv.address}`);

    config.Deployments.cvxCrv = cvxCrv.address;
    writeConfigFile(config);

    // await tenderly.verify({
    //     address: cvxCrv.address,
    //     name: "cvxCrvToken",
    // });

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

    // await tenderly.verify({
    //     address: crvDepositor.address,
    //     name: "CrvDepositor",
    // });

    // Set operator in cvxCrv token
    console.log("Setting crvDepositor as operator in liqLit token");
    let tx = await cvxCrv.setOperator(crvDepositor.address);
    await tx.wait();

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

    // Set contract approvals
    console.log("Setting approvals in litDepositorHelper");
    tx = await litDepositorHelper.setApprovals();
    await tx.wait();

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

    console.log(`✅ Done!`);
}

main(hre).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
