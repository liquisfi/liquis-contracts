// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

/// @notice A library for performing overflow-/underflow-safe math,
/// updated with awesomeness from of DappHub (https://github.com/dapphub/ds-math).
library AuraMath {
    /**
     * @dev Returns the smallest of two numbers.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
        c = a + b;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256 c) {
        c = a - b;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
        c = a * b;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return a / b;
    }

    function to224(uint256 a) internal pure returns (uint224 c) {
        require(a <= type(uint224).max, "AuraMath: uint224 Overflow");
        c = uint224(a);
    }

    function to216(uint256 a) internal pure returns (uint216 c) {
        require(a <= type(uint216).max, "AuraMath: uint216 Overflow");
        c = uint216(a);
    }

    function to208(uint256 a) internal pure returns (uint208 c) {
        require(a <= type(uint208).max, "AuraMath: uint208 Overflow");
        c = uint208(a);
    }

    function to128(uint256 a) internal pure returns (uint128 c) {
        require(a <= type(uint128).max, "AuraMath: uint128 Overflow");
        c = uint128(a);
    }

    function to112(uint256 a) internal pure returns (uint112 c) {
        require(a <= type(uint112).max, "AuraMath: uint112 Overflow");
        c = uint112(a);
    }

    function to64(uint256 a) internal pure returns (uint64 c) {
        require(a <= type(uint64).max, "AuraMath: uint64 Overflow");
        c = uint64(a);
    }

    function to40(uint256 a) internal pure returns (uint40 c) {
        require(a <= type(uint40).max, "AuraMath: uint40 Overflow");
        c = uint40(a);
    }

    function to32(uint256 a) internal pure returns (uint32 c) {
        require(a <= type(uint32).max, "AuraMath: uint32 Overflow");
        c = uint32(a);
    }
}

/// @notice A library for performing overflow-/underflow-safe addition and subtraction on uint128.
library AuraMath128 {
    function add(uint128 a, uint128 b) internal pure returns (uint128 c) {
        c = a + b;
    }

    function sub(uint128 a, uint128 b) internal pure returns (uint128 c) {
        c = a - b;
    }
}

/// @notice A library for performing overflow-/underflow-safe addition and subtraction on uint64.
library AuraMath64 {
    function add(uint64 a, uint64 b) internal pure returns (uint64 c) {
        c = a + b;
    }

    function sub(uint64 a, uint64 b) internal pure returns (uint64 c) {
        c = a - b;
    }
}

/// @notice A library for performing overflow-/underflow-safe addition and subtraction on uint32.
library AuraMath32 {
    function add(uint32 a, uint32 b) internal pure returns (uint32 c) {
        c = a + b;
    }

    function sub(uint32 a, uint32 b) internal pure returns (uint32 c) {
        c = a - b;
    }

    function mul(uint32 a, uint32 b) internal pure returns (uint32 c) {
        c = a * b;
    }

    function div(uint32 a, uint32 b) internal pure returns (uint32) {
        return a / b;
    }
}

/// @notice A library for performing overflow-/underflow-safe addition and subtraction on uint112.
library AuraMath112 {
    function add(uint112 a, uint112 b) internal pure returns (uint112 c) {
        c = a + b;
    }

    function sub(uint112 a, uint112 b) internal pure returns (uint112 c) {
        c = a - b;
    }

    function mul(uint112 a, uint112 b) internal pure returns (uint112 c) {
        c = a * b;
    }

    function div(uint112 a, uint112 b) internal pure returns (uint112) {
        return a / b;
    }
}

/// @notice A library for performing overflow-/underflow-safe addition and subtraction on uint224.
library AuraMath224 {
    function add(uint224 a, uint224 b) internal pure returns (uint224 c) {
        c = a + b;
    }

    function sub(uint224 a, uint224 b) internal pure returns (uint224 c) {
        c = a - b;
    }

    function mul(uint224 a, uint224 b) internal pure returns (uint224 c) {
        c = a * b;
    }

    function div(uint224 a, uint224 b) internal pure returns (uint224) {
        return a / b;
    }
}