// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

contract MockFeeTokenVerifier {
    bool public valid;

    function setValid(bool _valid) external {
        valid = _valid;
    }

    function checkToken(address) external view returns (bool) {
        return valid;
    }
}
