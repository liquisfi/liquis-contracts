/* eslint-disable max-classes-per-file */
import { BigNumber as BN } from "ethers";

export const fullScale: BN = BN.from(10).pow(18);

export const DEFAULT_DECIMALS = 18;

export const DEAD_ADDRESS = "0x0000000000000000000000000000000000000001";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const ZERO_KEY = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const MAX_UINT256 = BN.from(2).pow(256).sub(1);
export const MAX_INT128 = BN.from(2).pow(127).sub(1);
export const MIN_INT128 = BN.from(2).pow(127).mul(-1);

export const e4: BN = BN.from(10).pow(4);
export const e6: BN = BN.from(10).pow(6);
export const e15: BN = BN.from(10).pow(15);
export const e18: BN = BN.from(10).pow(18);
export const gwei: BN = BN.from(10).pow(9);

export const SIX_HOURS: number = 6 * 60 * 60;
const P: number = 100000;

export const e18ToDecimal = (number: BN): number => number.mul(P).div(e18).toNumber() / P;
export const bnToDecimal = (number: BN, decimals?: BN): number =>
    number
        .mul(P)
        .div(BN.from(10).pow(decimals || 18))
        .toNumber() / P;

export const ZERO = BN.from(0);
export const ONE_MIN = BN.from(60);
export const TEN_MINS = BN.from(60 * 10);
export const ONE_HOUR = BN.from(60 * 60);
export const ONE_DAY = BN.from(60 * 60 * 24);
export const FIVE_DAYS = BN.from(60 * 60 * 24 * 5);
export const TEN_DAYS = BN.from(60 * 60 * 24 * 10);
export const ONE_WEEK = BN.from(60 * 60 * 24 * 7);
export const ONE_YEAR = BN.from(60 * 60 * 24 * 365);
