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

    function getBptPrice() external view returns (uint256) {
        uint256 bptOraclePrice = _getBptPrice(); // e.g bptOraclePrice = 3.52e14
        uint256 pairOraclePrice = _getPairPrice(); // e.g pairOraclePrice = 0.56e14
        return (bptOraclePrice * 1e18) / pairOraclePrice; // e.g bptOraclePriceInLit = 6.28e18
    }

    function getMinOut(
        uint256 _amount,
        uint256 _outputBps,
        uint256 _asset
    ) public view returns (uint256) {
        return _getMinOut(_amount, _outputBps, _asset);
    }

    function addBalToPool(uint256 amount, uint256 _minOut) external {
        IERC20(LIT).transferFrom(msg.sender, address(this), amount);
        _investSingleToPool(amount, _minOut, 1);
    }
}
