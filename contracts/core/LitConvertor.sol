// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IBalancerVault } from "../interfaces/balancer/IBalancerCore.sol";
import { BalInvestor } from "./BalInvestor.sol";

/**
 * @title   LitConvertor
 * @notice  Converts BAL -> balBPT
 */
contract LitConvertor is BalInvestor {
    using SafeERC20 for IERC20;

    constructor(
        IBalancerVault _balancerVault,
        address _lit,
        address _weth,
        bytes32 _litETHPoolId
    ) BalInvestor(_balancerVault, _lit, _weth, _litETHPoolId) {
        _setApprovals();
    }

    /**
     * @dev Gets minimum output based on BPT oracle price
     * @param _amount Units of LIT to deposit
     * @param _outputBps Multiplier where 100% == 10000, 99.5% == 9950 and 98% == 9800
     * @return minOut Units of BPT to expect as output
     */
    function getMinOut(uint256 _amount, uint256 _outputBps) external view returns (uint256) {
        return _getMinOut(_amount, _outputBps);
    }

    /**
     * @dev Converts LIT to LIT/WETH and sends BPT to user
     * @param _amount Units of LIT to deposit
     * @param _minOut Units of BPT to expect as output
     */
    function convertLitToBpt(uint256 _amount, uint256 _minOut) external returns (uint256 bptBalance) {
        _investBalToPool(_amount, _minOut);

        bptBalance = IERC20(BALANCER_POOL_TOKEN).balanceOf(address(this));
        if (bptBalance > 0) {
            IERC20(BALANCER_POOL_TOKEN).safeTransfer(msg.sender, bptBalance);
        }
    }
}
