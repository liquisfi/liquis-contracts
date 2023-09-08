import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import { logContracts, deployContract } from "../utils/deploy-utils";
import { Signer } from "ethers";
import { getSigner } from "../utils";
import { deployFullSystem, ExtSystemConfig, PrelaunchDeployed } from "../../scripts/deployFullSystem";
import {
    VoterProxy__factory,
    LiqToken__factory,
    LiqMinter__factory,
    Booster__factory,
    CvxCrvToken__factory,
    CrvDepositor__factory,
    BoosterHelper,
    BoosterHelper__factory,
} from "../../types/generated";

const naming = {
    cvxName: "Liquis",
    cvxSymbol: "LIQ",
    vlCvxName: "Vote Locked Liquis",
    vlCvxSymbol: "vlLIQ",
    cvxCrvName: "Liquis LIT",
    cvxCrvSymbol: "liqLIT",
    tokenFactoryNamePostfix: " Liquis Deposit",
};

const externalAddresses: ExtSystemConfig = {
    token: "0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa", // oLIT
    lit: "0xfd0205066521550D7d7AB19DA8F72bb004b4C341", // LIT
    tokenBpt: "0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C", // BAL 20-80 WETH/LIT
    minter: "0xF087521Ffca0Fa8A43F5C445773aB37C5f574DA0",
    votingEscrow: "0xf17d23136B4FeAd139f54fB766c8795faae09660",
    feeDistribution: "0x951f99350d816c0E160A2C71DEfE828BdfC17f12", // Bunni FeeDistro
    gaugeController: "0x901c8aA6A61f74aC95E7f397E22A0Ac7c1242218",
    balancerVault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
    balancerPoolId: "0x9232a548dd9e81bac65500b5e0d918f8ba93675c000200000000000000000423",
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
};

const multisigs = {
    treasuryMultisig: "0xcd3010D150B9674294A0589678E020372D8E5d8c",
    daoMultisig: "0xd9dDB1129941377166C7Aa5834F6c9B56BA100fe",
};

const mainnetDeployment = {
    voterProxy: "0x37aeB332D6E57112f1BFE36923a7ee670Ee9278b",
    liq: "0xD82fd4D6D62f89A1E50b1db69AD19932314aa408",
    minter: "0x2e8617079e97Ac78fCE7a2A2ec7c4a84492b805e",
    booster: "0x631e58246A88c3957763e1469cb52f93BC1dDCF2",
    liqLit: "0x03C6F0Ca0363652398abfb08d154F114e61c4Ad8",
    crvDepositor: "0xB96Bce10480d2a8eb2995Ee4f04a70d48997856a",
    litDepositorHelper: "0x97a2585Ddb121db8E9a3B6575E302F9c610AF08c",
    prelaunchRewardsPool: "0x5c988c4E1F3cf1CA871A54Af3a1DcB5FeF2612Fc",
};

const getPrevDeployment = async (deployer: Signer): Promise<PrelaunchDeployed> => ({
    voterProxy: VoterProxy__factory.connect(mainnetDeployment.voterProxy, deployer),
    liq: LiqToken__factory.connect(mainnetDeployment.liq, deployer),
    minter: LiqMinter__factory.connect(mainnetDeployment.minter, deployer),
    booster: Booster__factory.connect(mainnetDeployment.booster, deployer),
    liqLit: CvxCrvToken__factory.connect(mainnetDeployment.liqLit, deployer),
    crvDepositor: CrvDepositor__factory.connect(mainnetDeployment.crvDepositor, deployer),
});

// Note waitForBlocks in tenderly network needs to be in 0, as their node does not mine auto

task("deploy:mainnet:fullSystem").setAction(async function (_: TaskArguments, hre) {
    const deployer = await getSigner(hre);

    // ~~~~~~~~~~~~~~~~~~~~
    // ~~~ FULL SYSTEM ~~~~
    // ~~~~~~~~~~~~~~~~~~~~
    const prevDeployment = await getPrevDeployment(deployer);

    const fullSystem = await deployFullSystem(
        hre,
        deployer,
        multisigs,
        naming,
        externalAddresses,
        prevDeployment,
        true,
        3,
    );
    logContracts(fullSystem as unknown as { [key: string]: { address: string } });
});

task("deploy:mainnet:boosterHelper").setAction(async function (taskArguments: TaskArguments, hre) {
    const deployer = await getSigner(hre);

    const constructorArguments = [mainnetDeployment.booster, externalAddresses.token];
    const boosterHelper = await deployContract<BoosterHelper>(
        hre,
        new BoosterHelper__factory(deployer),
        "BoosterHelper",
        constructorArguments,
        {},
        true,
        3,
    );

    console.log("deployed BoosterHelper to:", boosterHelper.address);
});

export const config = {
    externalAddresses,
    naming,
    multisigs,
};
