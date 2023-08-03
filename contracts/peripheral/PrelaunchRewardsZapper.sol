// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
pragma abicoder v2;

import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts-0.8/security/ReentrancyGuard.sol";
import { ILitDepositorHelper } from "../interfaces/ILitDepositorHelper.sol";

interface IWETH {
    function deposit() external payable;
}

interface IPrelaunchRewardsPool {
    function stakeFor(address _for, uint256 _amount) external returns (bool);
}

/**
 * @title   EthInvestor
 * @notice  Deposits $WETH into a LIT/WETH BPT. Hooks into TWAP to determine minOut.
 * @dev     Contract for depositing WETH -> balBPT -> prelaunchPool
 */
contract PrelaunchRewardsZapper is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable LIT;
    address public immutable WETH;
    address public immutable BALANCER_POOL_TOKEN;
    address public immutable prelaunchRewardsPool;
    address public immutable litDepositorHelper;

    constructor(
        address _lit,
        address _weth,
        address _balancerPoolToken,
        address _prelaunchRewardsPool,
        address _litDepositorHelper
    ) {
        LIT = _lit;
        WETH = _weth;
        BALANCER_POOL_TOKEN = _balancerPoolToken;
        prelaunchRewardsPool = _prelaunchRewardsPool;
        litDepositorHelper = _litDepositorHelper;
    }

    function zapInWeth(uint256 amount, uint256 minOut) external {
        IERC20(WETH).safeTransferFrom(msg.sender, address(this), amount);
        ILitDepositorHelper(litDepositorHelper).convertWethToBpt(amount, minOut);
        IPrelaunchRewardsPool(prelaunchRewardsPool).stakeFor(msg.sender, _balanceOfBpt());
    }

    function zapInEth(uint256 minOut) external payable nonReentrant {
        IWETH(WETH).deposit{ value: msg.value }();
        ILitDepositorHelper(litDepositorHelper).convertWethToBpt(msg.value, minOut);
        IPrelaunchRewardsPool(prelaunchRewardsPool).stakeFor(msg.sender, _balanceOfBpt());
    }

    function _balanceOfBpt() internal view returns (uint256) {
        return IERC20(BALANCER_POOL_TOKEN).balanceOf(address(this));
    }
}
