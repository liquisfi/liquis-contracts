// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface ICrvDepositorWrapper {
    function getMinOut(uint256, uint256) external view returns (uint256);

    function deposit(
        uint256 _amount,
        uint256 _minOut,
        bool _lock,
        address _stakeAddress
    ) external;

    function depositFor(
        address _for,
        uint256 _amount,
        uint256 _minOut,
        bool _lock,
        address _stakeAddress
    ) external;

    function convertLitToBpt(uint256 _amount, uint256 _minOut) external returns (uint256 bptBalance);
}
