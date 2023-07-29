import { expect } from "chai";
import { network } from "hardhat";
import {
    BoosterHelper,
    BoosterHelper__factory,
    Booster,
    Booster__factory,
    MockERC20__factory,
} from "../../types/generated";
import { impersonate, impersonateAccount, increaseTime, ONE_DAY, ZERO } from "../../test-utils";
import { Signer } from "ethers";
import { config } from "../mainnet-config";

const keeperAddress = "0xcc247cde79624801169475c9ba1f716db3959b8f";

const boosterAddress = "0x7818A1DA7BD1E64c199029E86Ba244a9798eEE10";

// yarn hardhat --config hardhat-fork.config.ts test ./test-fork/peripheral/BoosterHelper.spec.ts

describe("BoosterHelper", () => {
    let boosterHelper: BoosterHelper;
    let booster: Booster;
    let signer: Signer;
    let deployer: Signer;
    let keeper: Signer;
    let deployerAddress: string;

    before(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: process.env.NODE_URL,
                        blockNumber: 15225000,
                    },
                },
            ],
        });
        deployerAddress = "0xA28ea848801da877E1844F954FF388e857d405e5";
        deployer = await impersonate(deployerAddress);
        keeper = await impersonate(keeperAddress);

        signer = keeper;

        booster = Booster__factory.connect(boosterAddress, signer);
    });

    it("deploy Booster helper", async () => {
        const crv = MockERC20__factory.connect(config.addresses.token, deployer);
        boosterHelper = await new BoosterHelper__factory(deployer).deploy(booster.address, crv.address);
    });

    it("getActivePids - get active pids", async () => {
        // There are active pools
        expect((await boosterHelper.getActivePids()).length).to.be.gt(0);
    });

    it("getPoolInfo - get Info for specified pids", async () => {
        const activePids = await boosterHelper.getActivePids();

        const poolInfo = await boosterHelper.getPoolInfo([activePids[0], activePids[1]]);

        expect(poolInfo.length).to.be.eq(2);

        // Pools are active as expected
        for (const pool of poolInfo) {
            expect(pool.shutdown).to.be.eq(false);
            expect(pool.lptoken).to.not.eq(ZERO);
            expect(pool.token).to.not.eq(ZERO);
            expect(pool.gauge).to.not.eq(ZERO);
            expect(pool.crvRewards).to.not.eq(ZERO);
            expect(pool.stash).to.not.eq(ZERO);
        }
    });

    it("getActivePoolInfo - get Info for ALL active pids", async () => {
        const poolInfo = await boosterHelper.getActivePoolInfo();

        expect(poolInfo.length).to.be.gt(0);

        // Pools are active as expected
        for (const pool of poolInfo) {
            expect(pool.shutdown).to.be.eq(false);
            expect(pool.lptoken).to.not.eq(ZERO);
            expect(pool.token).to.not.eq(ZERO);
            expect(pool.gauge).to.not.eq(ZERO);
            expect(pool.crvRewards).to.not.eq(ZERO);
            expect(pool.stash).to.not.eq(ZERO);
        }

        const activePids = await boosterHelper.getActivePids();
        expect(poolInfo.length).to.be.eq(activePids.length);

        const poolInfo2 = await boosterHelper.getPoolInfo(activePids);

        // Same info as getPoolInfo
        expect(poolInfo).to.be.deep.eq(poolInfo2);
    });
});
