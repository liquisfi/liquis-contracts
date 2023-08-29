import { Signer } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
    BoosterOwnerSecondary,
    BoosterOwnerSecondary__factory,
    ExtraRewardStashV3,
    ExtraRewardStashV3__factory,
    PoolManager,
    PoolManager__factory,
} from "../types";
import { deployContract } from "../tasks/utils";
import { config } from "../tasks/deploy/mainnet-config";

export async function deployUpgrade01(
    hre: HardhatRuntimeEnvironment,
    signer: Signer,
    debug = false,
    waitForBlocks = 0,
) {
    const { addresses, multisigs } = config;
    const phase6 = await config.getPhase6(signer);

    const extraRewardStashV3 = await deployContract<ExtraRewardStashV3>(
        hre,
        new ExtraRewardStashV3__factory(signer),
        "ExtraRewardStashV3",
        [addresses.token],
        {},
        debug,
        waitForBlocks,
    );

    const poolManager = await deployContract<PoolManager>(
        hre,
        new PoolManager__factory(signer),
        "PoolManager",
        [phase6.poolManagerProxy.address, phase6.booster.address, addresses.gaugeController, multisigs.daoMultisig],
        {},
        debug,
        waitForBlocks,
    );

    const boosterOwnerSecondary = await deployContract<BoosterOwnerSecondary>(
        hre,
        new BoosterOwnerSecondary__factory(signer),
        "BoosterOwnerSecondary",
        [multisigs.daoMultisig, phase6.boosterOwner.address, phase6.booster.address],
        {},
        debug,
        waitForBlocks,
    );

    return {
        extraRewardStashV3,
        boosterOwnerSecondary,
        poolManager,
    };
}
