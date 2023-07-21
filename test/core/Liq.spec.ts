import hre, { ethers } from "hardhat";
import { BigNumberish, Signer } from "ethers";
import { expect } from "chai";
import { deployPhase1, deployPhase2, deployPhase3, deployPhase4 } from "../../scripts/deploySystem";
import { deployMocks, DeployMocksResult, getMockDistro, getMockMultisigs } from "../../scripts/deployMocks";
import { Booster, VoterProxy, LiqToken, LiqMinter, LiqToken__factory } from "../../types/generated";
import { DEAD_ADDRESS, simpleToExactAmount, ZERO_ADDRESS } from "../../test-utils";
import { impersonateAccount } from "../../test-utils/fork";
import { Account } from "types";

const EMISSIONS_MAX_SUPPLY = 50000000;
const EMISSIONS_INIT_SUPPLY = 50000000;

describe("LiqToken", () => {
    let accounts: Signer[];
    let booster: Booster;
    let cvx: LiqToken;
    let minter: LiqMinter;
    let mocks: DeployMocksResult;
    let voterProxy: VoterProxy;
    let deployer: Signer;
    let alice: Signer;
    let aliceAddress: string;
    let aliceInitialCvxBalance: BigNumberish;
    let operatorAccount: Account;

    before(async () => {
        accounts = await ethers.getSigners();

        deployer = accounts[0];
        mocks = await deployMocks(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[0], accounts[0], accounts[0]);
        const distro = getMockDistro();
        const phase1 = await deployPhase1(hre, deployer, mocks.addresses);
        const phase2 = await deployPhase2(
            hre,
            deployer,
            phase1,
            distro,
            multisigs,
            mocks.namingConfig,
            mocks.addresses,
        );
        const phase3 = await deployPhase3(hre, deployer, phase2, multisigs, mocks.addresses);
        await phase3.poolManager.setProtectPool(false);
        const contracts = await deployPhase4(hre, deployer, phase3, mocks.addresses);

        alice = accounts[1];
        aliceAddress = await alice.getAddress();

        booster = contracts.booster;
        cvx = contracts.cvx;
        voterProxy = contracts.voterProxy;
        minter = contracts.minter;

        aliceInitialCvxBalance = await cvx.balanceOf(aliceAddress);
        operatorAccount = await impersonateAccount(booster.address);
    });

    it("initial configuration is correct", async () => {
        expect(await cvx.name()).to.equal(mocks.namingConfig.cvxName);
        expect(await cvx.symbol()).to.equal(mocks.namingConfig.cvxSymbol);
        expect(await cvx.operator()).to.equal(booster.address);
        expect(await cvx.vecrvProxy()).to.equal(voterProxy.address);
        // Expects to be pre-mined with 50 m tokens. (as per deployment script)
        expect(await cvx.totalSupply()).to.eq(simpleToExactAmount(EMISSIONS_INIT_SUPPLY));
        expect(await cvx.EMISSIONS_MAX_SUPPLY()).to.equal(simpleToExactAmount(EMISSIONS_MAX_SUPPLY));
        expect(await cvx.INIT_MINT_AMOUNT()).to.equal(simpleToExactAmount(EMISSIONS_INIT_SUPPLY));
        expect(await cvx.reductionPerCliff()).to.equal(simpleToExactAmount(EMISSIONS_MAX_SUPPLY).div(500));
    });
    describe("@method LiqToken.init fails if ", async () => {
        it("caller is not the operator", async () => {
            await expect(cvx.connect(deployer).init(DEAD_ADDRESS, DEAD_ADDRESS)).to.revertedWith("Only operator");
        });
        it("called more than once", async () => {
            const operator = await impersonateAccount(await cvx.operator());
            expect(await cvx.totalSupply()).to.not.eq(0);
            await expect(cvx.connect(operator.signer).init(DEAD_ADDRESS, DEAD_ADDRESS)).to.revertedWith("Only once");
        });
        it("wrong minter address", async () => {
            const liqToken = await new LiqToken__factory(deployer).deploy(voterProxy.address, "LiqToken", "LIQ");
            const operator = await impersonateAccount(await liqToken.operator());
            await expect(liqToken.connect(operator.signer).init(DEAD_ADDRESS, ZERO_ADDRESS)).to.revertedWith(
                "Invalid minter",
            );
        });
    });

    it("@method LiqToken.updateOperator fails to set new operator", async () => {
        const previousOperator = await cvx.operator();
        expect(previousOperator).eq(booster.address);
        await expect(cvx.connect(deployer).updateOperator()).to.be.revertedWith("!operator");
    });
    it("@method LiqToken.updateOperator only if it is initialized", async () => {
        const liqToken = await new LiqToken__factory(deployer).deploy(voterProxy.address, "LiqToken", "LIQ");
        const operator = await impersonateAccount(await liqToken.operator());
        expect(await liqToken.totalSupply()).to.eq(0);
        await expect(liqToken.connect(operator.signer).updateOperator()).to.be.revertedWith("!init");
    });
    it("@method LiqToken.mint does not mint if sender is not the operator", async () => {
        const beforeBalance = await cvx.balanceOf(aliceAddress);
        const beforeTotalSupply = await cvx.totalSupply();
        await cvx.mint(aliceAddress, 1000);
        const afterBalance = await cvx.balanceOf(aliceAddress);
        const afterTotalSupply = await cvx.totalSupply();
        expect(beforeBalance, "balance does not change").to.eq(afterBalance);
        expect(beforeTotalSupply, "total supply does not change").to.eq(afterTotalSupply);
    });
    it("@method LiqToken.minterMint fails if minter is not the caller", async () => {
        await expect(cvx.connect(alice).minterMint(aliceAddress, simpleToExactAmount(1))).to.revertedWith(
            "Only minter",
        );
    });
    it("@method LiqToken.mint mints per oLIT yearly schedule ", async () => {
        const beforeTotalSupply = await cvx.totalSupply();
        // Year 1 - LIT emissions
        let tx = await cvx.connect(operatorAccount.signer).mint(aliceAddress, simpleToExactAmount(17575680, 18));
        await expect(tx).to.emit(cvx, "Transfer").withArgs(
            ZERO_ADDRESS,
            aliceAddress,
            simpleToExactAmount(6854515.2, 18), // 6.85m
        );

        // Year 2 - LIT emissions
        tx = await cvx.connect(operatorAccount.signer).mint(aliceAddress, simpleToExactAmount(48032810, 18));
        await expect(tx)
            .to.emit(cvx, "Transfer")
            .withArgs(ZERO_ADDRESS, aliceAddress, simpleToExactAmount(17099680.36, 18)); // 17.1m

        // Year 3 - LIT emissions
        tx = await cvx.connect(operatorAccount.signer).mint(aliceAddress, simpleToExactAmount(40390618, 18));
        await expect(tx)
            .to.emit(cvx, "Transfer")
            .withArgs(ZERO_ADDRESS, aliceAddress, simpleToExactAmount(10905466.86, 18)); // 10.9m

        // Year 4 - LIT emissions
        tx = await cvx.connect(operatorAccount.signer).mint(aliceAddress, simpleToExactAmount(33964326, 18));
        await expect(tx)
            .to.emit(cvx, "Transfer")
            .withArgs(ZERO_ADDRESS, aliceAddress, simpleToExactAmount(7336294.416, 18)); // 7.3m

        // Year 5 - LIT emissions
        tx = await cvx.connect(operatorAccount.signer).mint(aliceAddress, simpleToExactAmount(28560480, 18));
        await expect(tx)
            .to.emit(cvx, "Transfer")
            .withArgs(ZERO_ADDRESS, aliceAddress, simpleToExactAmount(5083765.44, 18)); // 5.1m

        // Year 6 - LIT emissions -> EOY 2028 total minted = 6.85 + 17.1 + 10.9 + 7.3 + 5.1 + 2.7 = 49.95m
        tx = await cvx.connect(operatorAccount.signer).mint(aliceAddress, simpleToExactAmount(24016405, 18));
        await expect(tx)
            .to.emit(cvx, "Transfer")
            .withArgs(ZERO_ADDRESS, aliceAddress, simpleToExactAmount(2720277.724, 18)); // 2.7m

        const afterBalance = await cvx.balanceOf(aliceAddress);
        const afterTotalSupply = await cvx.totalSupply();

        expect(aliceInitialCvxBalance, "balance does change").to.lt(afterBalance);
        expect(beforeTotalSupply, "total supply does change").to.lt(afterTotalSupply);
        expect(afterTotalSupply, "max supply reached").to.eq(
            simpleToExactAmount(EMISSIONS_MAX_SUPPLY + EMISSIONS_INIT_SUPPLY),
        );
    });
    it("@method LiqToken.minterMint mints additional LIQ", async () => {
        // It should mint via minter
        const amount = simpleToExactAmount(100);
        const minterAccount = await impersonateAccount(minter.address);
        const tx = await cvx.connect(minterAccount.signer).minterMint(aliceAddress, amount);
        await expect(tx).to.emit(cvx, "Transfer").withArgs(ZERO_ADDRESS, aliceAddress, amount);
    });
    it("@method LiqToken.mint does not mint additional LIQ", async () => {
        // it should does not to mint more tokens via scheduled mints as the max amount has been reached previously,
        const totalSupply = await cvx.totalSupply();
        await cvx.connect(operatorAccount.signer).mint(aliceAddress, simpleToExactAmount(1, 18));
        expect(await cvx.totalSupply()).to.eq(totalSupply);
    });
});
