import { BN, simpleToExactAmount } from "../../test-utils/math";
import { ethers, network } from "hardhat";
import { expect } from "chai";
import { LiqMining, LiqMining__factory, LiqToken, LiqToken__factory } from "../../types/generated";
import { impersonateAccount, ZERO_ADDRESS } from "../../test-utils";
import { Signer } from "ethers";
import { Account } from "types/common";

const EMISSIONS_MAX_SUPPLY = 50000000;
const EMISSIONS_INIT_SUPPLY = 50000000;
const ALCHEMY_API_KEY = process.env.NODE_URL;

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

const multisigs = {
    treasuryMultisig: "0xcd3010D150B9674294A0589678E020372D8E5d8c",
    daoMultisig: "0xd9dDB1129941377166C7Aa5834F6c9B56BA100fe",
};

describe("LiqMining", () => {
    let cvxMining: LiqMining;
    let signer: Signer;
    let operatorAccount: Account;
    let aliceAddress: string;

    let liq: LiqToken;

    before(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: ALCHEMY_API_KEY,
                        blockNumber: 17926100,
                    },
                },
            ],
        });

        await impersonateAccount(multisigs.daoMultisig);
        signer = await ethers.getSigner(multisigs.daoMultisig);

        liq = LiqToken__factory.connect(mainnetDeployment.liq, signer);

        cvxMining = await new LiqMining__factory(signer).deploy();

        operatorAccount = await impersonateAccount(mainnetDeployment.booster);
        aliceAddress = (await ethers.getSigners())[0].address;
    });
    const expectMint = async (crvAmount: BN, expectedCvxAmount: BN, desc: string) => {
        const cvxCalculated = await cvxMining.convertCrvToCvx(crvAmount);
        const tx = await liq.connect(operatorAccount.signer).mint(aliceAddress, crvAmount);
        await expect(tx).to.emit(liq, "Transfer").withArgs(ZERO_ADDRESS, aliceAddress, cvxCalculated);
        expect(cvxCalculated, `${desc} cvxCalculated`).to.be.eq(expectedCvxAmount);
    };

    describe("converts oLIT to LIQ", async () => {
        it("calculate mints per LIQ yearly schedule ", async () => {
            const beforeTotalSupply = await liq.totalSupply();
            // Year 1 - LIQ emissions
            await expectMint(simpleToExactAmount(17575680, 18), simpleToExactAmount(6854515.2, 18), "Year 1"); // 6.85m

            // Year 2 - LIQ emissions
            await expectMint(simpleToExactAmount(48032810, 18), simpleToExactAmount(17099680.36, 18), "Year 2"); // 17.1m

            // Year 3 - LIQ emissions
            await expectMint(simpleToExactAmount(40390618, 18), simpleToExactAmount(10905466.86, 18), "Year 3"); // 10.9m

            // Year 4 - LIQ emissions
            await expectMint(simpleToExactAmount(33964326, 18), simpleToExactAmount(7336294.416, 18), "Year 4"); // 7.3m

            // Year 5 - LIQ emissions
            await expectMint(simpleToExactAmount(28560480, 18), simpleToExactAmount(5083765.44, 18), "Year 5"); // 5.1m

            // Year 6 - LIQ emissions
            await expectMint(simpleToExactAmount(24016405, 18), simpleToExactAmount(2720277.724, 18), "Year 6"); // 2.7m

            const afterTotalSupply = await liq.totalSupply();

            expect(beforeTotalSupply, "total supply does change").to.lt(afterTotalSupply);
            expect(afterTotalSupply, "max supply reached").to.eq(
                simpleToExactAmount(EMISSIONS_MAX_SUPPLY + EMISSIONS_INIT_SUPPLY),
            );
        });
    });
});
