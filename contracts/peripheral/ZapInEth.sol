// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
pragma abicoder v2;

import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts-0.8/security/ReentrancyGuard.sol";
import { IBalancerVault, IAsset } from "../interfaces/balancer/IBalancerCore.sol";

interface IWETH {
    function deposit() external payable;
}

interface IPrelaunchRewardsPool {
    function stakeFor(address _for, uint256 _amount) external returns (bool);
}

/**
 * @title   EthInvestor
 * @notice  Deposits WETH into a LIT/WETH BPT
 * @dev     Contract for depositing WETH -> balBPT -> prelaunchRewardsPool
 */
contract EthInvestor is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IBalancerVault public immutable BALANCER_VAULT;
    address public immutable LIT;
    address public immutable WETH;
    address public immutable BALANCER_POOL_TOKEN;
    bytes32 public immutable BAL_ETH_POOL_ID;

    address public prelaunchRewardsPool = 0x5c988c4E1F3cf1CA871A54Af3a1DcB5FeF2612Fc;

    constructor(
        IBalancerVault _balancerVault,
        address _lit,
        address _weth,
        bytes32 _balETHPoolId
    ) {
        (
            address poolAddress, /* */

        ) = _balancerVault.getPool(_balETHPoolId);
        require(poolAddress != address(0), "!poolAddress");

        BALANCER_VAULT = _balancerVault;
        LIT = _lit;
        WETH = _weth;
        BALANCER_POOL_TOKEN = poolAddress;
        BAL_ETH_POOL_ID = _balETHPoolId;

        _setApprovals();
    }

    function _setApprovals() internal {
        IERC20(WETH).safeApprove(address(BALANCER_VAULT), type(uint256).max);
        IERC20(LIT).safeApprove(address(BALANCER_VAULT), type(uint256).max);
        IERC20(BALANCER_POOL_TOKEN).safeApprove(address(prelaunchRewardsPool), type(uint256).max);
    }

    function _investWETHToPool(uint256 amount, uint256 minOut) internal {
        IAsset[] memory assets = new IAsset[](2);
        assets[0] = IAsset(WETH);
        assets[1] = IAsset(LIT);
        uint256[] memory maxAmountsIn = new uint256[](2);
        maxAmountsIn[0] = amount;
        maxAmountsIn[1] = 0;

        BALANCER_VAULT.joinPool(
            BAL_ETH_POOL_ID,
            address(this),
            address(this),
            IBalancerVault.JoinPoolRequest(
                assets,
                maxAmountsIn,
                abi.encode(IBalancerVault.JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT, maxAmountsIn, minOut),
                false // Don't use internal balances
            )
        );
    }

    function zapInWeth(uint256 amount, uint256 minOut) external {
        IERC20(WETH).safeTransferFrom(msg.sender, address(this), amount);
        _investWETHToPool(amount, minOut);
        IPrelaunchRewardsPool(prelaunchRewardsPool).stakeFor(msg.sender, _balanceOfBpt());
    }

    function zapInEth(uint256 minOut) external payable nonReentrant {
        IWETH(WETH).deposit{ value: msg.value }();
        _investWETHToPool(msg.value, minOut);
        IPrelaunchRewardsPool(prelaunchRewardsPool).stakeFor(msg.sender, _balanceOfBpt());
    }

    function _balanceOfBpt() internal returns (uint256) {
        return IERC20(BALANCER_POOL_TOKEN).balanceOf(address(this));
    }
}
