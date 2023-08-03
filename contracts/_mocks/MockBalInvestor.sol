// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import "../peripheral/BalInvestor.sol";

contract MockBalInvestor is BalInvestor {
    constructor(
        IBalancerVault _balancerVault,
        address _bal,
        address _weth,
        bytes32 _balETHPoolId
    ) BalInvestor(_balancerVault, _bal, _weth, _balETHPoolId) {}

    function approveToken() external {
        _setApprovals();
    }

    function addBalToPool(uint256 amount, uint256 _minOut) external {
        _investSingleToPool(amount, _minOut, 1);
    }
}
