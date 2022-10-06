// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface IBridgeDelegate {
    function bridge(uint256 amount) external;
}
