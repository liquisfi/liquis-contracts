// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import { Ownable } from "@openzeppelin/contracts-0.8/access/Ownable.sol";
import { LiqToken } from "./Liq.sol";

/**
 * @title   LiqMinter
 * @notice  Wraps the LiqToken minterMint function and protects from inflation until
 *          3 years have passed.
 * @dev     Ownership initially owned by the DAO, but likely transferred to smart contract
 *          wrapper or additional value system at some stage as directed by token holders.
 */
contract LiqMinter is Ownable {
    /// @dev Liq token
    LiqToken public immutable liq;
    /// @dev Timestamp upon which minting will be possible
    uint256 public immutable inflationProtectionTime;

    constructor(address _liq, address _dao) Ownable() {
        liq = LiqToken(_liq);
        _transferOwnership(_dao);
        inflationProtectionTime = block.timestamp + 156 weeks;
    }

    /**
     * @dev Mint function allows the owner of the contract to inflate LIQ post protection time
     * @param _to Recipient address
     * @param _amount Amount of tokens
     */
    function mint(address _to, uint256 _amount) external onlyOwner {
        require(block.timestamp > inflationProtectionTime, "Inflation protected for now");
        liq.minterMint(_to, _amount);
    }
}
