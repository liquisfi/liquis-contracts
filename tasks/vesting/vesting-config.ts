import { simpleToExactAmount } from "../../test-utils/math";
import { ONE_WEEK, ZERO_ADDRESS } from "../../test-utils/constants";

const multisigs = {
    treasuryMultisig: "0xcd3010D150B9674294A0589678E020372D8E5d8c",
    daoMultisig: "0xd9dDB1129941377166C7Aa5834F6c9B56BA100fe",
};

const liqLockerAddress = "0x748A0F458B9E71061ca0aC543B984473F203E1CB";

const specialPartners = [
    { address: "0xcd3010D150B9674294A0589678E020372D8E5d8c", amount: simpleToExactAmount(10_000_000) }, // Liquis
    { address: "0x5592cB82f5B11A4E42B1275A973E6B712194e239", amount: simpleToExactAmount(2_000_000) }, // Moneta
    { address: "0xfc78f8e1Af80A3bF5A1783BB59eD2d1b10f78cA9", amount: simpleToExactAmount(1_000_000) }, // Aura
];

const teamAndVotersVesting = [
    { address: "0x9a8FEe232DCF73060Af348a1B62Cdb0a19852d13", amount: simpleToExactAmount(1_000_000) },
    { address: "0x9958A330F640Af224f03dd9218A51208F77c3CFc", amount: simpleToExactAmount(1_244_564.90025801) },
    { address: "0xBe48c91215eA411eF648f93829cD5aF6E5f48498", amount: simpleToExactAmount(1_244_564.90025801) },
    { address: "0x297Eca4d5a103ce0941119b9Cb056aBa3DCc8A71", amount: simpleToExactAmount(1_058_823.52941176) },
    { address: "0x00AD7539ae2163D3Bd71Bf74635B838e2FC422a3", amount: simpleToExactAmount(1_058_823.52941176) },
    { address: "0x70115b724f7e187aa73504d96125d1b84720e1ec", amount: simpleToExactAmount(571_249.829473204) },
    { address: "0xfe9A318e1d7EEE138359c137195EA2Bee9fA5200", amount: simpleToExactAmount(1_058_823.52941176) },
    { address: "0x13900D21774402731959Bc2Ec6D8166c0E86B87c", amount: simpleToExactAmount(1_244_564.90025801) },
    { address: "0x8F68e0CFd779125b984BBE15229a7872A6187A68", amount: simpleToExactAmount(1_244_564.90025801) },
    { address: "0x9595b576c42708FE012aFc5d017d4100323B06F1", amount: simpleToExactAmount(1_274_019.98125948) },
    { address: "0xf78Ef3831f42F36402a7c17436B8A32C3Ee7ded1", amount: simpleToExactAmount(431.5496522817503) },
    { address: "0xF6Ee1A630BC3eCd8C3fB11520d5952031D7b4C24", amount: simpleToExactAmount(17064.059570000452) },
    { address: "0xDda8901508211dfd3a2A912fEb0b913a6558c113", amount: simpleToExactAmount(10766.089356479693) },
    { address: "0xde6EA9A2992df0DFa3Ca5Cf09F9f7c2592930342", amount: simpleToExactAmount(21555.84463007588) },
    { address: "0xAD0f62D1841529EA7442de3f967A42A8410a48dA", amount: simpleToExactAmount(7860.178680112838) },
    { address: "0x34c9c2E48F43DacE5192002c0d1C3C40EdF463Bd", amount: simpleToExactAmount(111228.07552683375) },
    { address: "0x5592cB82f5B11A4E42B1275A973E6B712194e239", amount: simpleToExactAmount(102491.70218440043) },
    { address: "0x9b295791419933c5451a0C503132AfB64366Cc4e", amount: simpleToExactAmount(3543.7010860385617) },
    { address: "0xAfD5f60aA8eb4F488eAA0eF98c1C5B0645D9A0A0", amount: simpleToExactAmount(92671.36323521685) },
    { address: "0x770569f85346B971114e11E4Bb5F7aC776673469", amount: simpleToExactAmount(601.3854334659753) },
    { address: "0x1bfD64aB61EACf714B2Aa37347057203f3AcA71f", amount: simpleToExactAmount(57247.26747115835) },
    { address: "0xCa398e17D838F26A7e39eFC31d67FAe20118272b", amount: simpleToExactAmount(93477.57173151025) },
    { address: "0x20907A020A4A85669F2940D645e94C5B6490d1ad", amount: simpleToExactAmount(33719.64303766072) },
    { address: "0x8E64Cb7ba3FA9e92Ac22C8e7D8e07f758c60B27A", amount: simpleToExactAmount(10.659842732034246) },
    { address: "0x009d13E9bEC94Bf16791098CE4E5C168D27A9f07", amount: simpleToExactAmount(1610.7724551945566) },
    { address: "0x13d64c4063785695733f9c04a5cB0c03789CA5e6", amount: simpleToExactAmount(550.0716225371614) },
    { address: "0x6dB995701fc2e6EF646A801322C78E2E8172EA34", amount: simpleToExactAmount(23280.515056086366) },
    { address: "0x66F576C1eDa4044A01bF68A78564F39bA3BbF65b", amount: simpleToExactAmount(25698.58000406718) },
    { address: "0xf578475B51f9f77b2421C321D4c0D530942a5448", amount: simpleToExactAmount(2464.0728387251384) },
    { address: "0x860001218D2476481629B7c64960bd6eDbEdD848", amount: simpleToExactAmount(55804.17885081639) },
    { address: "0x9E8784794cd73B52886cBB1A3538A4594A6c9e8d", amount: simpleToExactAmount(19631.322605023368) },
    { address: "0x43E0eeD8ef9f6A3BAE31151dbCcb778b809c5b7b", amount: simpleToExactAmount(81624.69788928398) },
    { address: "0x5f350bF5feE8e254D6077f8661E9C7B83a30364e", amount: simpleToExactAmount(68750.19456778484) },
    { address: "0x49072cd3Bf4153DA87d5eB30719bb32bdA60884B", amount: simpleToExactAmount(793.2851788117973) },
    { address: "0x359B0ceb2daBcBB6588645de3B480c8203aa5b76", amount: simpleToExactAmount(22547.795567697427) },
    { address: "0x6B12e9D58bB0fFbbDdAaF0F9461c00EA4c4b563f", amount: simpleToExactAmount(140146.36986864795) },
    { address: "0x4421E6f16A59582c8108D153aAB0Fb7B4A3EDDbe", amount: simpleToExactAmount(249.12033877060003) },
    { address: "0x80C5f123248E5E196948c3d1a09Cb4FF0C437Dc2", amount: simpleToExactAmount(4161.903941219958) },
    { address: "0x994B5C8B30766EaCe220B76f8C1DE27849f05aB3", amount: simpleToExactAmount(18.027777365510445) },
];

const partnersVesting = [
    { address: "0x6FcE4c6CDd8C4e6C7486553D09BdD9aEE61cF095", amount: simpleToExactAmount(100_000) }, // Abachi
    { address: "0xA9ed98B5Fb8428d68664f3C5027c62A10d45826b", amount: simpleToExactAmount(1_000_000) }, // Badger
    { address: "0x11cC283d06FA762061df2B0D2f0787651ceef659", amount: simpleToExactAmount(1_000_000) }, // Frax
    { address: "0x7EE02ce5ccce84B892DC42d9FE3B938AcA9C2933", amount: simpleToExactAmount(360_000) }, // Gravita
    { address: "0x4a266739E40664e80470CC335120a2A1fA0B3F3f", amount: simpleToExactAmount(250_000) }, // Mimo
    { address: "0x5592cB82f5B11A4E42B1275A973E6B712194e239", amount: simpleToExactAmount(1_000_000) }, // Moneta
    { address: "0x1Ae6DCBc88d6f81A7BCFcCC7198397D776F3592E", amount: simpleToExactAmount(450_000) }, // Paladin
];

const extraPartners = [
    { address: "0x5Be9631FBAd536F0e38Bf456517C8d249990e2F4", amount: simpleToExactAmount(100_000) }, // Davos
    { address: "0xFb3bD022D5DAcF95eE28a6B07825D4Ff9C5b3814", amount: simpleToExactAmount(100_000) }, // Idle
    { address: "0x2364963e6b99281def39aeda6a8acee790d93af4", amount: simpleToExactAmount(425_000) }, // Swell
];

const thirdPartners = [
    { address: "0x926dF14a23BE491164dCF93f4c468A50ef659D5B", amount: simpleToExactAmount(1_000_000) }, // Inverse
    { address: "0xFdC004B6B92b45B224d37dc45dBA5cA82c1e08f2", amount: simpleToExactAmount(100_000) }, // BlueBerry
];

const distroList = {
    immutableVesting: [
        {
            period: ONE_WEEK.mul(208),
            recipients: [
                { address: multisigs.treasuryMultisig, amount: simpleToExactAmount(0) }, // Treasury
            ],
        },
    ],
    vesting: [
        // 24 MONTHS
        // {
        //     period: ONE_WEEK.mul(104),
        //     recipients: teamAndVotersVesting,
        // },
        // 48 MONTHS
        // {
        //     period: ONE_WEEK.mul(208),
        //     recipients: partnersVesting,
        // },
        // 48 MONTHS
        {
            period: ONE_WEEK.mul(208),
            recipients: thirdPartners,
        },
    ],
};

export const vestingConfig = {
    multisigs,
    distroList,
    liqLockerAddress,
};
