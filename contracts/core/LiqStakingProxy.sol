// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import { Address } from "@openzeppelin/contracts-0.8/utils/Address.sol";
import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts-0.8/utils/math/SafeMath.sol";
import { IAuraLocker } from "../interfaces/IAuraLocker.sol";

/**
 * @title   AuraStakingProxy
 * @author  adapted from ConvexFinance
 * @notice  Receives CRV (oLIT) from the Booster as overall reward, then distributes to vlCVX holders.
 */
contract LiqStakingProxy {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    //tokens
    address public immutable crv;
    address public immutable cvx;

    address public keeper;
    uint256 public constant denominator = 10000;

    address public rewards;

    address public owner;
    address public pendingOwner;
    uint256 public callIncentive = 25;

    event RewardsDistributed(address indexed token, uint256 amount);
    event CallIncentiveChanged(uint256 incentive);

    /* ========== CONSTRUCTOR ========== */

    /**
     * @param _rewards       vlCVX -> vlLIQ
     * @param _crv           CRV token -> oLIT received from Booster
     * @param _cvx           CVX token -> LIQ
     */
    constructor(
        address _rewards,
        address _crv,
        address _cvx
    ) {
        rewards = _rewards;
        owner = msg.sender;
        crv = _crv;
        cvx = _cvx;
    }

    /**
     * @notice Set keeper
     */
    function setKeeper(address _keeper) external {
        require(msg.sender == owner, "!auth");
        keeper = _keeper;
    }

    /**
     * @notice Set pending owner
     */
    function setPendingOwner(address _po) external {
        require(msg.sender == owner, "!auth");
        pendingOwner = _po;
    }

    /**
     * @notice Apply pending owner
     */
    function applyPendingOwner() external {
        require(msg.sender == owner, "!auth");
        require(pendingOwner != address(0), "invalid owner");

        owner = pendingOwner;
        pendingOwner = address(0);
    }

    /**
     * @notice Set call incentive
     * @param _incentive Incentive base points
     */
    function setCallIncentive(uint256 _incentive) external {
        require(msg.sender == owner, "!auth");
        require(_incentive <= 100, "too high");
        callIncentive = _incentive;
        emit CallIncentiveChanged(_incentive);
    }

    /**
     * @notice Set reward address
     */
    function setRewards(address _rewards) external {
        require(msg.sender == owner, "!auth");
        rewards = _rewards;
    }

    /**
     * @notice  Approve locker contract to pull oLIT from this contract
     */
    function setApprovals() external {
        IERC20(crv).safeApprove(rewards, 0);
        IERC20(crv).safeApprove(rewards, type(uint256).max);
    }

    /**
     * @notice Transfer stuck ERC20 tokens to `_to`
     */
    function rescueToken(address _token, address _to) external {
        require(msg.sender == owner, "!auth");
        require(_token != crv && _token != cvx, "not allowed");

        uint256 bal = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(_to, bal);
    }

    function distribute() external {
        // If keeper enabled, require
        if (keeper != address(0)) {
            require(msg.sender == keeper, "!auth");
        }
        _distribute();
    }

    function _distribute() internal {
        uint256 crvBal = IERC20(crv).balanceOf(address(this));

        if (crvBal > 0) {
            uint256 incentiveAmount = crvBal.mul(callIncentive).div(denominator);
            crvBal = crvBal.sub(incentiveAmount);

            //send incentives
            IERC20(crv).safeTransfer(msg.sender, incentiveAmount);

            //update rewards
            IAuraLocker(rewards).queueNewRewards(crv, crvBal);

            emit RewardsDistributed(crv, crvBal);
        }
    }

    /**
     * @notice Allow generic token distribution in case a new reward is ever added
     */
    function distributeOther(IERC20 _token) external {
        require(address(_token) != crv, "not allowed");

        uint256 bal = _token.balanceOf(address(this));

        if (bal > 0) {
            uint256 incentiveAmount = bal.mul(callIncentive).div(denominator);
            bal = bal.sub(incentiveAmount);

            //send incentives
            _token.safeTransfer(msg.sender, incentiveAmount);

            //approve
            _token.safeApprove(rewards, 0);
            _token.safeApprove(rewards, type(uint256).max);

            //update rewards
            IAuraLocker(rewards).queueNewRewards(address(_token), bal);

            emit RewardsDistributed(address(_token), bal);
        }
    }
}
