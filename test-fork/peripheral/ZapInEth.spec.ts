import hre, { ethers, network } from "hardhat";
import { expect } from "chai";
import {
    EthInvestor,
    EthInvestor__factory,
    ERC20,
    ERC20__factory,
    PrelaunchRewardsPool,
    PrelaunchRewardsPool__factory,
    IBalancerHelpers,
    IBalancerHelpers__factory,
} from "../../types/generated";
import { deployContract } from "../../tasks/utils";
import { impersonateAccount, e18, ZERO } from "../../test-utils";
import { Signer, BigNumber, BigNumberish } from "ethers";
import { WeightedPoolEncoder } from "@balancer-labs/balancer-js";
import { JoinPoolRequestStruct } from "../../types/generated/IBalancerVault";

// yarn hardhat --config hardhat-fork.config.ts test ./test-fork/peripheral/ZapInEth.spec.ts

const debug = false;

const wethWhale: string = "0x57757E3D981446D585Af0D9Ae4d7DF6D64647806";

const poolId = "0x9232a548dd9e81bac65500b5e0d918f8ba93675c000200000000000000000423";
const vault = "0xba12222222228d8ba445958a75a0704d566bf2c8";
const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const lit = "0xfd0205066521550D7d7AB19DA8F72bb004b4C341";

const prelaunchRewardsPoolAddress = "0x5c988c4E1F3cf1CA871A54Af3a1DcB5FeF2612Fc";
const balancerHelpersAddress = "0x5aDDCCa35b7A0D07C74063c48700C8590E87864E";

const SLIPPAGE_SCALE: BigNumberish = 10000;

describe("TestLitEth", () => {
    let zapInEth: EthInvestor;

    let wethToken: ERC20;

    let deployer: Signer;
    let whaleSigner: Signer;

    let deployerAddress: string;

    let prelaunchRewardsPool: PrelaunchRewardsPool;

    let balancerHelpers: IBalancerHelpers;

    const amount = ethers.utils.parseEther("1");

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

        wethToken = ERC20__factory.connect(weth, whaleSigner);

        zapInEth = await deployContract<EthInvestor>(
            hre,
            new EthInvestor__factory(deployer),
            "zapInEth",
            [vault, lit, weth, poolId],
            {},
            debug,
        );

        prelaunchRewardsPool = PrelaunchRewardsPool__factory.connect(prelaunchRewardsPoolAddress, deployer);

        balancerHelpers = IBalancerHelpers__factory.connect(balancerHelpersAddress, deployer);
    });

    async function getBptMinOut(maxAmountsIn: BigNumber[], sender: string, recipient: string): Promise<BigNumber> {
        // Use a minimumBPT of 1 because we need to call queryJoin with amounts in to get the BPT amount out
        const userData = WeightedPoolEncoder.joinExactTokensInForBPTOut(maxAmountsIn, 1);
        const joinPoolRequest: JoinPoolRequestStruct = {
            assets: [weth, lit],
            maxAmountsIn,
            userData,
            fromInternalBalance: false,
        };

        const [bptOut] = await balancerHelpers.callStatic.queryJoin(poolId, sender, recipient, joinPoolRequest);

        return bptOut;
    }

    describe("ZapInEth contract allows to zap into PrelaunchRewardsPool", () => {
        it("allows to deposit ETH", async () => {
            const amountsIn: BigNumber[] = [amount, ZERO];
            const minBptOut = await getBptMinOut(amountsIn, deployerAddress, deployerAddress);
            console.log("minBptOut: ", +minBptOut);

            const SLIPPAGE: BigNumberish = 9950;

            const minBptOutWithSlippage = minBptOut.mul(SLIPPAGE).div(SLIPPAGE_SCALE);
            console.log("minBptOutWithSlippage: ", +minBptOutWithSlippage);

            await zapInEth.zapInEth(minBptOutWithSlippage, { value: amount });
            const bptBal = await prelaunchRewardsPool.balances(deployerAddress);
            console.log("Bpt balance of deployer:", +bptBal);
            expect(bptBal).gt(minBptOutWithSlippage);
        });

        it("allows to deposit WETH", async () => {
            const amountsIn: BigNumber[] = [e18.mul(10), ZERO];
            const minBptOut = await getBptMinOut(amountsIn, deployerAddress, deployerAddress);
            console.log("minBptOut: ", +minBptOut);

            const SLIPPAGE: BigNumberish = 9950;

            const minBptOutWithSlippage = minBptOut.mul(SLIPPAGE).div(SLIPPAGE_SCALE);
            console.log("minBptOutWithSlippage: ", +minBptOutWithSlippage);

            await wethToken.connect(whaleSigner).approve(zapInEth.address, e18.mul(10));
            await zapInEth.connect(whaleSigner).zapInWeth(e18.mul(10), minBptOutWithSlippage);
            const bptBal = await prelaunchRewardsPool.balances(wethWhale);
            console.log("Bpt balance of wethWhale:", +bptBal);
            expect(bptBal).gt(minBptOutWithSlippage);
        });
    });
});
