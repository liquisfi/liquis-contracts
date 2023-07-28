import hre, { ethers, network } from "hardhat";
import { expect } from "chai";
import {
    EthInvestor,
    EthInvestor__factory,
    ERC20__factory,
    ERC20,
    PrelaunchRewardsPool,
    PrelaunchRewardsPool__factory,
} from "../../types/generated";
import { deployContract } from "../../tasks/utils";
import { impersonateAccount, e18 } from "../../test-utils";
import { Signer } from "ethers";

// yarn hardhat --config hardhat-fork.config.ts test ./test-fork/peripheral/ZapInEth.spec.ts

const debug = false;

const wethWhale: string = "0x57757E3D981446D585Af0D9Ae4d7DF6D64647806";

describe("TestLitEth", () => {
    let zapInEth: EthInvestor;

    let wethToken: ERC20;
    let bptToken: ERC20;

    let deployer: Signer;
    let whaleSigner: Signer;

    let deployerAddress: string;

    let prelaunchRewardsPool: PrelaunchRewardsPool;

    const amount = ethers.utils.parseEther("10");

    before(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: process.env.NODE_URL,
                        blockNumber: 17790567,
                    },
                },
            ],
        });

        [deployer] = await ethers.getSigners();
        deployerAddress = await deployer.getAddress();

        await impersonateAccount(wethWhale);
        whaleSigner = await ethers.getSigner(wethWhale);

        const poolId = "0x9232a548dd9e81bac65500b5e0d918f8ba93675c000200000000000000000423";
        const vault = "0xba12222222228d8ba445958a75a0704d566bf2c8";
        const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
        const lit = "0xfd0205066521550D7d7AB19DA8F72bb004b4C341";
        const bpt = "0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C";

        const prelaunchRewardsPoolAddress = "0x5c988c4E1F3cf1CA871A54Af3a1DcB5FeF2612Fc";

        wethToken = ERC20__factory.connect(weth, whaleSigner);
        bptToken = ERC20__factory.connect(bpt, deployer);

        zapInEth = await deployContract<EthInvestor>(
            hre,
            new EthInvestor__factory(deployer),
            "zapInEth",
            [vault, lit, weth, poolId],
            {},
            debug,
        );

        prelaunchRewardsPool = PrelaunchRewardsPool__factory.connect(prelaunchRewardsPoolAddress, deployer);
    });

    describe("ZapInEth contract allows to zap into PrelaunchRewardsPool", () => {
        it("allows to deposit ETH", async () => {
            await zapInEth.zapInEth(0, { value: e18.mul(1) });
            const bptBal = await prelaunchRewardsPool.balances(deployerAddress);
            console.log("Bpt balance of deployer:", +bptBal);
            expect(bptBal).gt(0);
        });

        it("allows to deposit WETH", async () => {
            await wethToken.connect(whaleSigner).approve(zapInEth.address, e18.mul(1));
            await zapInEth.connect(whaleSigner).zapInWeth(e18.mul(1), 0);
            const bptBal = await prelaunchRewardsPool.balances(wethWhale);
            console.log("Bpt balance of wethWhale:", +bptBal);
            expect(bptBal).gt(0);
        });
    });
});
