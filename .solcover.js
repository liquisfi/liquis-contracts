module.exports = {
    istanbulReporter: ["html", "lcov"],
    providerOptions: {
        mnemonic: process.env.MNEMONIC,
    },
    skipFiles: [
        "_mocks",
        "test",
        "convex-platform/contracts/contracts/interfaces",
        "convex-platform/contracts/contracts/ExtraRewardStashV3.sol",
        "convex-platform/contracts/contracts/ProxyFactory.sol",
        "convex-platform/contracts/contracts/RewardHook.sol",
        "interfaces",
        "chef",
        "peripheral/FlashOptionsExerciser.sol",
        "peripheral/GaugeMigrator.sol",
        "peripheral/LiquisClaimZap.sol",
        "peripheral/LiquisViewHelpers.sol",
        "peripheral/LitDepositorHelper.sol",
        "peripheral/PoolMigrator.sol",
        "peripheral/PooledOptionsExerciser.sol",
        "peripheral/ZapInEth.sol",
        "peripheral/BalLiquidityProvider.sol",
        "peripheral/BoosterHelper.sol",
        "peripheral/ClaimFeesHelper.sol",
        "peripheral/RewardPoolDepositWrapper.sol",
        "peripheral/UniswapMigrator.sol",
        "rewards/PrelaunchRewardsPool.sol",
        "utils/Math.sol",
        "utils/Permission.sol"
    ],
    configureYulOptimizer: true,
};


