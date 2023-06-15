// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface ILitConvertor {
    function getMinOut(uint256 _amount, uint256 _outputBps) external view returns (uint256);

    function convertLitToBpt(uint256 _amount, uint256 _minOut) external returns (uint256 bptBalance);
}
