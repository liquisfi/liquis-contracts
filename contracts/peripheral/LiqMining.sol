// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
import { Math } from "../utils/Math.sol";

// Forked of https://etherscan.io/address/0x3c75bfe6fbfda3a94e7e7e8c2216afc684de5343#code
//  - Refactor based on Liq emissions schedule.

// solhint-disable func-name-mixedcase
interface ILiq {
    function reductionPerCliff() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function totalCliffs() external view returns (uint256);

    function INIT_MINT_AMOUNT() external view returns (uint256);

    function EMISSIONS_MAX_SUPPLY() external view returns (uint256);
}

/**
 * @notice Utility library to calculate how many Liq will be minted based on the amount of oLIT.
 * Do not use this on-chain, as LiqMinter after can mint additional tokens after `inflationProtectionTime`
 * has passed, those new tokens are not taken into consideration in this library.
 */
library LiqMining {
    ILiq public constant liq = ILiq(0xD82fd4D6D62f89A1E50b1db69AD19932314aa408);
    using Math for uint256;

    /**
     * @dev Calculates the amount of LIQ to mint based on the oLIT supply schedule.
     * Do not use this on chain.
     */
    function convertLitToLiq(uint256 _amount) external view returns (uint256 amount) {
        uint256 supply = liq.totalSupply();
        uint256 totalCliffs = liq.totalCliffs();
        uint256 maxSupply = liq.EMISSIONS_MAX_SUPPLY();
        uint256 initMintAmount = liq.INIT_MINT_AMOUNT();

        // After LiqMinter.inflationProtectionTime has passed, this calculation might not be valid.
        // uint256 emissionsMinted = supply - initMintAmount - minterMinted;
        uint256 emissionsMinted = supply - initMintAmount;

        uint256 cliff = emissionsMinted.div(liq.reductionPerCliff());

        // e.g. 100 < 500
        if (cliff < totalCliffs) {
            // e.g. (new) reduction = (500 - 100) * 0.25 + 70 = 170;
            // e.g. (new) reduction = (500 - 250) * 0.25 + 70 = 132.5;
            // e.g. (new) reduction = (500 - 400) * 0.25 + 70 = 95;
            uint256 reduction = totalCliffs.sub(cliff).div(4).add(70);
            // e.g. (new) amount = 1e19 * 170 / 500 =  34e17;
            // e.g. (new) amount = 1e19 * 132.5 / 500 =  26.5e17;
            // e.g. (new) amount = 1e19 * 95 / 500  =  19e16;
            amount = _amount.mul(reduction).div(totalCliffs);
            // e.g. amtTillMax = 5e25 - 1e25 = 4e25
            uint256 amtTillMax = maxSupply.sub(emissionsMinted);
            if (amount > amtTillMax) {
                amount = amtTillMax;
            }
        }
    }
}
