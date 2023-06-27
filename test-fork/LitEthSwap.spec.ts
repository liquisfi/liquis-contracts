import { simpleToExactAmount } from "../test-utils/math";
import hre, { ethers, network } from "hardhat";
import { expect } from "chai";
import { MockBalInvestor, MockBalInvestor__factory, ERC20__factory, ERC20 } from "../types/generated";
import { deployContract } from "../tasks/utils";
import { impersonateAccount, fullScale } from "../test-utils";
import { Signer } from "ethers";

const debug = false;

const ALCHEMY_API_KEY = process.env.NODE_URL;

const LitWhale = "0x63F2695207f1d625a9B0B8178D95cD517bC5E82C";

describe("TestLitEth", () => {
    let testEthLit: MockBalInvestor;
    let litToken: ERC20;
    let signer: Signer;

    const amount = ethers.utils.parseEther("100");

    before(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: ALCHEMY_API_KEY,
                        blockNumber: 16875673,
                    },
                },
            ],
        });

        await impersonateAccount(LitWhale);

        signer = await ethers.getSigner(LitWhale);

        const poolId = "0x9232a548dd9e81bac65500b5e0d918f8ba93675c000200000000000000000423";
        const vault = "0xba12222222228d8ba445958a75a0704d566bf2c8";
        const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
        const lit = "0xfd0205066521550D7d7AB19DA8F72bb004b4C341";

        litToken = ERC20__factory.connect(lit, signer);

        testEthLit = await deployContract<MockBalInvestor>(
            hre,
            new MockBalInvestor__factory(signer),
            "testEthLit",
            [vault, lit, weth, poolId],
            {},
            debug,
        );
    });

    describe("join LIT:ETH 80/20 pool with LIT", () => {
        it("transfer LIT to contract", async () => {
            const tx = await litToken.approve(testEthLit.address, amount);
            await tx.wait();
        });

        it("add LIT to pool", async () => {
            const bptAddress = await testEthLit.BALANCER_POOL_TOKEN();
            const bpt = ERC20__factory.connect(bptAddress, signer);

            const bptBalanceBefore = await bpt.balanceOf(testEthLit.address);

            let tx = await testEthLit.approveToken();
            await tx.wait();

            const minOut = await testEthLit.getMinOut(amount, 9980);
            tx = await testEthLit.addBalToPool(amount.toString(), minOut);
            await tx.wait();

            const bptBalanceAfter = await bpt.balanceOf(testEthLit.address);
            const bptBalanceDelta = bptBalanceAfter.sub(bptBalanceBefore);

            const bptPrice = await testEthLit.getBptPrice();

            const bptBalValue = bptPrice.mul(bptBalanceDelta).div(fullScale);
            const minAmount = amount.mul("9950").div("10000");
            expect(bptBalValue).gt(minAmount);
        });

        it("fails if incorrect minout passed", async () => {
            const tx = await litToken.approve(testEthLit.address, amount);
            await tx.wait();

            let minOut = await testEthLit.getMinOut(amount, 10005);

            await expect(testEthLit.addBalToPool(amount.toString(), minOut)).to.be.revertedWith("BAL#208");

            minOut = await testEthLit.getMinOut(amount, 9980);

            await testEthLit.addBalToPool(amount.toString(), minOut);
        });

        it("fails if slippage not met (large deposit)", async () => {
            const tx = await litToken.approve(testEthLit.address, simpleToExactAmount(1, 24));
            await tx.wait();

            const minOut = await testEthLit.getMinOut(simpleToExactAmount(1, 24), 9980);

            await expect(testEthLit.addBalToPool(simpleToExactAmount(1, 24), minOut)).to.be.revertedWith("BAL#208");
        });
    });
});
