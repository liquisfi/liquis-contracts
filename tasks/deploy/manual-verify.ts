import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import { verifyEtherscan } from "../utils/etherscan";
import { getSigner } from "../utils";
import { DepositToken__factory, StashToken__factory, VirtualBalanceRewardPool__factory } from "../../types/generated";

task("verify:mainnet").setAction(async function (_: TaskArguments, hre) {
    const deployer = await getSigner(hre);

    // const contract = DepositToken__factory.connect("0x3301E18b6f05AF0caa5744ecBFb64CAe0C1392C5", deployer);

    // const constructorArgs = [
    //     "0x631e58246A88c3957763e1469cb52f93BC1dDCF2",
    //     "0x05058071E3E799f0C6341F44843636e7c441c1fB",
    //     " Liquis Deposit",
    //     "liq",
    // ];

    // const contract = StashToken__factory.connect("0x799ba7dd6fa77cb12ccb1cbe5b3687e2433df8f7", deployer);

    // const constructorArgs = ["0x0cde7f7d31f0440651f7253bd61ca762e86bad38"];

    const contract = VirtualBalanceRewardPool__factory.connect("0x271B96395f53fb14cDD41C654ef15e83DE57dEDf", deployer);

    const constructorArgs = [
        "0x7Ea6930a9487ce8d039f7cC89432435E6D5AcB23",
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        "0x631e58246A88c3957763e1469cb52f93BC1dDCF2",
    ];

    const abiEncodedConstructorArgs = contract.interface.encodeDeploy(constructorArgs);

    console.log(`\nVerifying ${contract.address}`);
    console.log(`ABI encoded args: ${abiEncodedConstructorArgs.slice(2)}`);

    await verifyEtherscan(hre, {
        address: contract.address,
        constructorArguments: constructorArgs,
    });
});
