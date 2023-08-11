import {
    ExtSystemConfig,
    Phase1Deployed,
    Phase2Deployed,
    Phase3Deployed,
    Phase6Deployed,
    Phase8Deployed,
    SystemDeployed,
} from "../../scripts/deploySystem";
import {
    VoterProxy__factory,
    LiqToken__factory,
    LiqMinter__factory,
    Booster__factory,
    BoosterOwner__factory,
    CvxCrvToken__factory,
    CrvDepositor__factory,
    LitDepositorHelper__factory,
    LiqLocker__factory,
    LiqMerkleDrop__factory,
    AuraPenaltyForwarder__factory,
    LiqVestedEscrow__factory,
    BalLiquidityProvider__factory,
    BaseRewardPool__factory,
    ExtraRewardsDistributor__factory,
    PoolManagerV3__factory,
    PoolManagerProxy__factory,
    PoolManagerSecondaryProxy__factory,
    RewardFactory__factory,
    StashFactoryV2__factory,
    TokenFactory__factory,
    ProxyFactory__factory,
    ArbitratorVault__factory,
    AuraClaimZap__factory,
    ClaimFeesHelper__factory,
    TempBooster__factory,
    TempBooster,
    BoosterHelper__factory,
    ExtraRewardStashV3__factory,
    PoolMigrator__factory,
    PoolManagerV4__factory,
    BoosterOwnerSecondary__factory,
    FlashOptionsExerciser__factory,
    PooledOptionsExerciser__factory,
    PrelaunchRewardsPool__factory,
} from "../../types/generated";
import { Signer, BigNumber } from "ethers";
import { simpleToExactAmount } from "../../test-utils/math";
import { ONE_WEEK, ZERO_ADDRESS, ZERO_KEY } from "../../test-utils/constants";

const addresses: ExtSystemConfig = {
    token: "0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa",
    lit: "0xfd0205066521550D7d7AB19DA8F72bb004b4C341",
    tokenBpt: "0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C",
    tokenWhale: "0xC128a9954e6c874eA3d62ce62B468bA073093F25",
    minter: "0xF087521Ffca0Fa8A43F5C445773aB37C5f574DA0",
    votingEscrow: "0xf17d23136B4FeAd139f54fB766c8795faae09660",
    feeDistribution: "0x951f99350d816c0E160A2C71DEfE828BdfC17f12",
    gaugeController: "0x901c8aA6A61f74aC95E7f397E22A0Ac7c1242218",
    voteOwnership: ZERO_ADDRESS,
    voteParameter: ZERO_ADDRESS,
    gauges: [
        "0xd4d8E88bf09efCf3F5bf27135Ef12c1276d9063C",
        "0x5ef860746a5f2ea24ddbD54EaeF0dDa65d5157a0",
        "0x4420689Dc6b5CDE6Ff3B873CDbfD8519383a1681",
        "0x44971D8903125Dcad768c130090C7480608D422d",
        "0xEbC60e3DD7b90382461F49fb98787CA81a30CA23",
        "0x345ECB6aB8EF4B5cBE4b5AA31D533EED894790B4",
        "0x6e868d1A902Da6b26521bf92E437b9b6DCC6955A",
        "0x9E3b20Afe88f823614FB3bDe416c69A806F8D090",
        "0xecdfE2FB3D5542026E415e3813C4CFdedA19e7d3",
        "0xdc4AdbA5722144542fCBe86bdB57D28154aDF7E5",
        "0x36B88F590CAaCAa2E855DB449Cdb7b0a0D0cE4E6",
        "0xE61C1E33dF4921F8B4EF0ee3f7031b472AFB52cF",
        "0x1c78EfD3B11baC329ffD8CCa15FAE26dbD54A720",
        "0x6c30636d750D63A1361D5885c8aA33f922ACC9A3",
        "0x471A34823DDd9506fe8dFD6BC5c2890e4114Fafe",
        "0x4A0f5be682622c659c4A3C5996071d8E55695D4c",
        "0x7a5252e430C58E527016B2cFF68641C8b8BE21B7",
        "0xAD879AEC78BFEAad11715D097fd82e00e52327a6",
        "0x4Bf0082080d937897330BAB735c2Baa99FF16F19",
        "0xD20a7dcdDeF53142e7Cb5474Ba469B800Ea8DFeb",
        "0x3aCFa22E2d6573C15298A19C0e51506248696DeB",
        "0xE410b7577882dD1d5c9a00bB1D806A4EA02FAB30",
        "0xC118C27C5e364054C0e206049c7e09C7D9D18989",
        "0x4CF5CB105D8baC299d010C71E1932a859d731B7b",
        "0x3b5F433940eD3f57F9ab73e725cf91cfaaef8789",
        "0xc0Bbfa70b31Bd1645B4f5ddC93b6Da14A5D46a29",
        "0x46f10e7Bc133191cAAF58FA6cf064014b7BDeBA6",
        "0xf59Dfd237c7a8cf8f47bF6304815F2182F56Ae78",
        "0x9Ca4f7c8CCFd421D84ACD355Ea819C8d37c0B598",
        "0x2F99bc91fCBEC71BBDb997ce1E7AA73dB93a75Ad",
        "0xa718193E1348FD4dEF3063E7F4b4154BAAcB0214",
        "0x42Bafd7c5793Ae2c883A3163D0A37f5969d0BCE1",
        "0xA1A4BAb0768A089f633Fcb196D428001D2C4Fe6a",
        "0x53F36500141765f74E4745aCd7195d12a2DA6f42",
        "0xCb619EEB54cA6E9e8bdf0B1BD17811752d685310",
        "0xC900F482F7D037366D24f7aca44425d775E500b5",
        "0x0DD538156cc4b0966d4aB60358Ad2B12f57B0961",
        "0xb98FE645C7e2c39b726747dCb72848a9fd8c425F",
        "0x3f28CA531Cb4767EEBFD8974a7a782058C53AF6a",
        "0x3090124ffA5aaDbb1Bf3006e06599cB8E9633df8",
        "0x270D9A0b9137c99bdFe8dD14FC527D3922a91678",
        "0xa665F67e1743415d7FD0b3c40c7Cf90bc1e7Bb39",
        "0x79DE2381b7181178555905319db7dA8a1Af72645",
        "0xd614e32088C5f5Dc389014Ec5727E03a0811b8c8",
        "0x082c0198B69e8e321A409A7dC5AD3238E4CD7D81",
        "0x00B20FFd6c2d27a5B9764ad2367f60e16e08eD3B",
        "0x5fb10C79c7198D18F69a9aeB64e3FeaB66778e48",
        "0x846b89167040e655de785C8dDda57866182E268B",
        "0x6fFaC7b1DB79460093c06ceaE86d3BacA2F3CDFD",
        "0x677ed6De139058ede31B2fB296F827F8C35A632a",
        "0xa9092a2cfd11f8e42cFD84c0217743f28b3c285C",
        "0x04D20FfF44c6FdDB4aFfecc56960Bb87B381bcc3",
    ], // Gauges not killed as of 11/08/23
    balancerVault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
    balancerPoolId: "0x9232a548dd9e81bac65500b5e0d918f8ba93675c000200000000000000000423",
    balancerMinOutBps: "9950",
    balancerPoolOwner: "0xBA1BA1ba1BA1bA1bA1Ba1BA1ba1BA1bA1ba1ba1B",
    balancerPoolFactories: {
        weightedPool2Tokens: "0xA5bf2ddF098bb0Ef6d120C98217dD6B141c74EE0",
        weightedPool: "0xcC508a455F5b0073973107Db6a878DdBDab957bC",
        stablePool: "0x8df6EfEc5547e31B0eb7d1291B511FF8a2bf987c",
        bootstrappingPool: "0x751A0bC0e3f75b38e01Cf25bFCE7fF36DE1C87DE",
    },
    balancerGaugeFactory: "0xf1665E19bc105BE4EDD3739F88315cC699cc5b65",
    balancerHelpers: "0x5aDDCCa35b7A0D07C74063c48700C8590E87864E",
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    wethWhale: "0xC564EE9f21Ed8A2d8E7e76c085740d5e4c5FaFbE",
    treasury: "0x10A19e7eE7d7F8a52822f6817de8ea18204F2e4f",
    keeper: "0xc3f4D7b4EF10Dfe1dFfc4Ac2EC4D3Ee29CBF67aE",
    staBAL3: "0x06df3b2bbb68adc8b0e302443692037ed9f91b42", //  Balancer USD Stable Pool (staBAL3)
    staBAL3Whale: "0x4086e3e1e99a563989a9390facff553a4f29b6ee",
    feeToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    feeTokenWhale: "0x3a3eE61F7c6e1994a2001762250A5E17B2061b6d",
    ldo: "0x5a98fcbea516cf06857215779fd812ca3bef1b32",
    ldoWhale: "0x09f82ccd6bae2aebe46ba7dd2cf08d87355ac430",
    stEthGaugeLdoDepositor: "0x86F6c353A0965eB069cD7f4f91C1aFEf8C725551",
    uniswapRouter: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    sushiswapRouter: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
    auraBalGauge: "0x0312AA8D0BA4a1969Fddb382235870bF55f7f242",
    feeTokenHandlerPath: {
        poolIds: [
            "0x25accb7943fd73dda5e23ba6329085a3c24bfb6a000200000000000000000387",
            "0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080",
        ],
        assetsIn: ["0xA13a9247ea42D743238089903570127DdA72fE44", "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"],
    },
};

const multisigs = {
    vestingMultisig: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    treasuryMultisig: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    daoMultisig: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
};

const contributorDistro = [
    { address: "0xe3B6c287C1369C6A4fa8d4e857813695C52948EF", amount: simpleToExactAmount(0.275, 24) }, //
    { address: "0x023320e0C9Ac45644c3305cE574360E901c7f582", amount: simpleToExactAmount(0.5, 24) }, //
    { address: "0xB1f881f47baB744E7283851bC090bAA626df931d", amount: simpleToExactAmount(3.5, 24) }, //
    { address: "0xE4b32828B558F17BcaF5efD52f0C067dba38833c", amount: simpleToExactAmount(0.45, 24) }, //
    { address: "0xcc6548f1b572968f9539d604ec9ff4b933c1be74", amount: simpleToExactAmount(0.075, 24) }, //
    { address: "0x51d63958a63a31eb4028917f049ce477c8dd07bb", amount: simpleToExactAmount(0.5, 24) }, //
    { address: "0x3078c3b436511152d86675f9cbfd89ec1672f804", amount: simpleToExactAmount(0.3, 24) }, //
    { address: "0x3000d9b2c0e6b9f97f30abe379eaaa8a85a04afc", amount: simpleToExactAmount(0.325, 24) }, //
    { address: "0x3CBFFF3E75881c1619eaa82DC724BDEE6fF6ED19", amount: simpleToExactAmount(0.06, 24) }, //
    { address: "0xaf3824e8401299B25C4D59a8a035Cf9312a3B454", amount: simpleToExactAmount(0.175, 24) }, //
    { address: "0x738175DB2C999581f29163e6D4D3516Ad4aF8834", amount: simpleToExactAmount(0.125, 24) }, //
    { address: "0x0d9A5678E73e5BbC0ee09FAF8e550B196c76fDad", amount: simpleToExactAmount(0.5, 24) }, //
    { address: "0x285b7EEa81a5B66B62e7276a24c1e0F83F7409c1", amount: simpleToExactAmount(1.5, 24) }, //
    { address: "0xbee5a45271cc66a5b0e9dc4164a4f9df196d94fa", amount: simpleToExactAmount(0.125, 24) }, //
    { address: "0x2fB09D2fD9e4Ca5C0597c6F81CDa7ed537469aaA", amount: simpleToExactAmount(0.04, 24) }, //
];

const distroList = {
    miningRewards: simpleToExactAmount(50, 24),
    lpIncentives: simpleToExactAmount(10, 24),
    cvxCrvBootstrap: simpleToExactAmount(2, 24),
    lbp: {
        tknAmount: simpleToExactAmount(2.2, 24),
        wethAmount: simpleToExactAmount(100),
        matching: simpleToExactAmount(2.8, 24),
    },
    airdrops: [
        {
            merkleRoot: "0xdbfebc726c41a2647b8cf9ad7a770535e1fc3b8900e752147f7e14848720fe78",
            startDelay: ONE_WEEK,
            length: ONE_WEEK.mul(4),
            totalClaims: BigNumber.from(15),
            amount: simpleToExactAmount(2.5, 24),
        },
        {
            merkleRoot: ZERO_KEY,
            startDelay: ONE_WEEK.mul(26),
            length: ONE_WEEK.mul(26),
            totalClaims: BigNumber.from(15),
            amount: simpleToExactAmount(1, 24),
        },
    ],
    immutableVesting: [
        {
            period: ONE_WEEK.mul(104),
            recipients: [
                { address: addresses.treasury, amount: simpleToExactAmount(2, 24) }, // Partner Treasury
            ],
        },
        {
            period: ONE_WEEK.mul(208),
            recipients: [
                { address: multisigs.treasuryMultisig, amount: simpleToExactAmount(17.5, 24) }, // Treasury
            ],
        },
    ],
    vesting: [
        // 4 MONTHS - 0.016%
        {
            period: ONE_WEEK.mul(16),
            recipients: [
                { address: "0xb64f3884ceed18594bd707122988e913fa26f4bf", amount: simpleToExactAmount(0.008, 24) }, // Temp
                { address: "0x498f95A7b752A6FcF97559C815914cE4777b2390", amount: simpleToExactAmount(0.008, 24) }, // Temp
            ],
        },
        // 6 MONTHS - 0.0825% + 1.4515% future
        {
            period: ONE_WEEK.mul(26),
            recipients: [
                { address: "0x33c7B2c7Bf017FA8BF31A4a412A36f39124411d8", amount: simpleToExactAmount(0.0675, 24) }, // Temp
                { address: "0x337F8f3316E1326B3188E534913F759460bd57CB", amount: simpleToExactAmount(0.015, 24) }, // Temp
                { address: multisigs.vestingMultisig, amount: simpleToExactAmount(1.4515, 24) }, // Vesting dao - future
            ],
        },
        // 24 MONTHS - 8.45%
        {
            period: ONE_WEEK.mul(104),
            recipients: contributorDistro,
        },
    ],
};

const naming = {
    cvxName: "Liquis",
    cvxSymbol: "LIQ",
    vlCvxName: "Vote Locked Liq",
    vlCvxSymbol: "vlLIQ",
    cvxCrvName: "Liq Lit",
    cvxCrvSymbol: "liqLit",
    tokenFactoryNamePostfix: " Liquis Deposit",
};

const getPhase1 = async (deployer: Signer): Promise<Phase1Deployed> => ({
    voterProxy: VoterProxy__factory.connect("0xfB12F7170FF298CDed84C793dAb9aBBEcc01E798", deployer),
});

const getPhase2 = async (deployer: Signer): Promise<Phase2Deployed> => ({
    ...(await getPhase1(deployer)),
    cvx: LiqToken__factory.connect("0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF", deployer),
    minter: LiqMinter__factory.connect("0x59A5ccD34943CD0AdCf5ce703EE9F06889E13707", deployer),
    booster: Booster__factory.connect("0x7818A1DA7BD1E64c199029E86Ba244a9798eEE10", deployer),
    boosterOwner: BoosterOwner__factory.connect("0xFa838Af70314135159b309bf27f1DbF1F954eC34", deployer),
    factories: {
        rewardFactory: RewardFactory__factory.connect("0x45aaD11F2FA2C215bc9686eb6f06D46E0474F356", deployer),
        stashFactory: StashFactoryV2__factory.connect("0x95171c9Ef5cA540A6d3502e9547fcFE022458Eb5", deployer),
        tokenFactory: TokenFactory__factory.connect("0xb6CE51DEE8BD4A2Fd11c01205414dc26f0b453AC", deployer),
        proxyFactory: ProxyFactory__factory.connect("0x7eD9003C6003EaCe1e8C3ae99F0Bb19894377b0F", deployer),
    },
    arbitratorVault: ArbitratorVault__factory.connect("0x5d208cD54f5132f2BD0c1F1e8d8c864Bb6BEdc40", deployer),
    cvxCrv: CvxCrvToken__factory.connect("0x616e8BfA43F920657B3497DBf40D6b1A02D4608d", deployer),
    cvxCrvRewards: BaseRewardPool__factory.connect("0x5e5ea2048475854a5702F5B8468A51Ba1296EFcC", deployer),
    crvDepositor: CrvDepositor__factory.connect("0xeAd792B55340Aa20181A80d6a16db6A0ECd1b827", deployer),
    litDepositorHelper: LitDepositorHelper__factory.connect("0x68655AD9852a99C87C0934c7290BB62CFa5D4123", deployer),
    poolManager: PoolManagerV3__factory.connect("0xf843F61508Fc17543412DE55B10ED87f4C28DE50", deployer),
    poolManagerProxy: PoolManagerProxy__factory.connect("0x16A04E58a77aB1CE561A37371dFb479a8594947A", deployer),
    poolManagerSecondaryProxy: PoolManagerSecondaryProxy__factory.connect(
        "0xdc274F4854831FED60f9Eca12CaCbD449134cF67",
        deployer,
    ),
    cvxLocker: LiqLocker__factory.connect("0x3Fa73f1E5d8A792C80F426fc8F84FBF7Ce9bBCAC", deployer),
    vestedEscrows: [
        LiqVestedEscrow__factory.connect("0x5bd3fCA8D3d8c94a6419d85E0a76ec8Da52d836a", deployer),
        LiqVestedEscrow__factory.connect("0x24346652e0e2aE0CE05c781501fDF4Fe4553fAc6", deployer),
        LiqVestedEscrow__factory.connect("0x45025Ebc38647bcf7Edd2b40CfDaF3fbfE1538F5", deployer),
        LiqVestedEscrow__factory.connect("0xFd72170339AC6d7bdda09D1eACA346B21a30D422", deployer),
        LiqVestedEscrow__factory.connect("0x43B17088503F4CE1AED9fB302ED6BB51aD6694Fa", deployer),
    ],
    drops: [
        LiqMerkleDrop__factory.connect("0x45EB1A004373b1D8457134A2C04a42d69D287724", deployer),
        LiqMerkleDrop__factory.connect("0x1a661CF8D8cd69dD2A423F3626A461A24280a8fB", deployer),
    ],
    balLiquidityProvider: BalLiquidityProvider__factory.connect("0xa7429af4DeB16827dAd0e71D8AEEa9C2bF70e32c", deployer),
    penaltyForwarder: AuraPenaltyForwarder__factory.connect("0x4043569200F7a7a1D989AbbaBC2De2Bde1C20D1E", deployer),
    extraRewardsDistributor: ExtraRewardsDistributor__factory.connect(
        "0xA3739b206097317c72EF416F0E75BB8f58FbD308",
        deployer,
    ),
    flashOptionsExerciser: FlashOptionsExerciser__factory.connect(ZERO_ADDRESS, deployer),
    pooledOptionsExerciser: PooledOptionsExerciser__factory.connect(ZERO_ADDRESS, deployer),
    prelaunchRewardsPool: PrelaunchRewardsPool__factory.connect(ZERO_ADDRESS, deployer),
});

const getPhase3 = async (deployer: Signer): Promise<Phase3Deployed> => ({
    ...(await getPhase2(deployer)),
    pool8020Bpt: {
        poolId: "0xc29562b045d80fd77c69bec09541f5c16fe20d9d000200000000000000000251",
        address: "0xc29562b045d80fd77c69bec09541f5c16fe20d9d",
    },
});

const getPhase4 = async (deployer: Signer): Promise<SystemDeployed> => ({
    ...(await getPhase3(deployer)),
    claimZap: AuraClaimZap__factory.connect("0x623B83755a39B12161A63748f3f595A530917Ab2", deployer),
    feeCollector: ClaimFeesHelper__factory.connect("0xa96CCC5B7f04c7Ab74a43F81e07C342fb9808cF1", deployer),
});

const getTempBooster = async (deployer: Signer): Promise<TempBooster> =>
    TempBooster__factory.connect("0xFfDE3F862e1397E81b140906F334De6Dd567aB22", deployer);

const getPhase6 = async (deployer: Signer): Promise<Phase6Deployed> => ({
    booster: Booster__factory.connect("0xA57b8d98dAE62B26Ec3bcC4a365338157060B234", deployer),
    boosterOwner: BoosterOwner__factory.connect("0x228a142081b456a9fF803d004504955032989f04", deployer),
    boosterHelper: BoosterHelper__factory.connect("0x82bbbC3c7B459913Ae6063858832a6C2c43D0Bd0", deployer),
    feeCollector: ClaimFeesHelper__factory.connect("0xAf824c80aA77Ae7F379DA3Dc05fea0dC1941c200", deployer),
    factories: {
        rewardFactory: RewardFactory__factory.connect("0xBC8d9cAf4B6bf34773976c5707ad1F2778332DcA", deployer),
        stashFactory: StashFactoryV2__factory.connect("0x54da426EFBB93fbaB5CF81bef03F9B9F00A3E915", deployer),
        tokenFactory: TokenFactory__factory.connect("0x3eC040DbF7D953216F4C89A2e665d5073445f5Ba", deployer),
        proxyFactory: ProxyFactory__factory.connect("0xf5E2cFde016bd55BEF42a5A4bAad7E21cd39720d", deployer),
    },
    cvxCrvRewards: BaseRewardPool__factory.connect("0x00A7BA8Ae7bca0B10A32Ea1f8e2a1Da980c6CAd2", deployer),
    poolManager: PoolManagerV3__factory.connect("0xB58Eb197c35157E6F3351718C4C387D284562BE5", deployer),
    poolManagerProxy: PoolManagerProxy__factory.connect("0x2c809Ec701C088099c911AF9DdfA4A1Db6110F3c", deployer),
    poolManagerSecondaryProxy: PoolManagerSecondaryProxy__factory.connect(
        "0xa72932Aea1392b0Da9eDc34178dA2B29EcE2de54",
        deployer,
    ),
    claimZap: AuraClaimZap__factory.connect("0x2E307704EfaE244c4aae6B63B601ee8DA69E92A9", deployer),
    stashV3: ExtraRewardStashV3__factory.connect("0x4A53301Fe213ECA70f904cD3766C07DB3A621bF8", deployer),
    poolMigrator: PoolMigrator__factory.connect("0x12addE99768a82871EAaecFbDB065b12C56F0578", deployer),
});

const getPhase8 = async (deployer: Signer): Promise<Phase8Deployed> => ({
    poolManagerV4: PoolManagerV4__factory.connect("0x8Dd8cDb1f3d419CCDCbf4388bC05F4a7C8aEBD64", deployer),
    boosterOwnerSecondary: BoosterOwnerSecondary__factory.connect(
        "0xCe96e48A2893C599fe2601Cc1918882e1D001EaD",
        deployer,
    ),
});

export const config = {
    addresses,
    naming,
    multisigs,
    distroList,
    getPhase1,
    getPhase2,
    getPhase3,
    getPhase4,
    getTempBooster,
    getPhase6,
    getPhase8,
};
