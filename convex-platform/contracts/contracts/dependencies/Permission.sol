// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

abstract contract Permission {
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event ModifyPermission(address owner, address caller, bool grant);

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    // User Permissions
    /// @notice Map specifying whether a `caller` has the permission to perform an action on the `owner`'s behalf
    /// mapping(address owner => mapping(address caller => bool permitted)) private _permitted;
    mapping(address => mapping(address => bool)) private _permitted;

    /*//////////////////////////////////////////////////////////////
                               FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Gives or revokes the permission for `caller` to perform an action on behalf of `msg.sender`
    /// @param caller Address of the caller to grant or revoke permission for
    /// @param permitted Whether to grant or revoke permission
    function modifyPermission(address caller, bool permitted) external {
        _permitted[msg.sender][caller] = permitted;
        emit ModifyPermission(msg.sender, caller, permitted);
    }

    /// @notice Checks if `caller` has the permission to perform an action on behalf of `owner`
    /// @param owner Address of the owner
    /// @param caller Address of the caller
    /// @return _ whether `caller` has the permission
    function hasPermission(address owner, address caller) public view returns (bool) {
        return owner == caller || _permitted[owner][caller];
    }
}
