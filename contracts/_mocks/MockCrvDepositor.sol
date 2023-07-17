// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockCrvDepositor {
    using SafeERC20 for IERC20;
    address public stakingToken;

    constructor(address _stakingToken) {
        stakingToken = _stakingToken;
    }

    function depositFor(
        address to,
        uint256 _amount,
        bool,
        address
    ) external {
        IERC20(stakingToken).safeTransferFrom(msg.sender, address(this), _amount);
    }
}
