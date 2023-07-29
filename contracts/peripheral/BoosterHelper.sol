// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";
import { IBooster } from "../interfaces/IBooster.sol";
import { IRewardStaking } from "../interfaces/IRewardStaking.sol";

/**
 * @title   BoosterHelper
 * @author  AuraFinance
 * @notice  Invokes booster.earmarkRewards for multiple pools.
 * @dev     Allows anyone to call `earmarkRewards`  via the booster.
 */
contract BoosterHelper {
    using SafeERC20 for IERC20;

    IBooster public immutable booster;
    address public immutable crv;

    /**
     * @param _booster      Booster.sol, e.g. 0xF403C135812408BFbE8713b5A23a04b3D48AAE31
     * @param _crv          Crv  e.g. 0xba100000625a3754423978a60c9317c58a424e3D
     */
    constructor(address _booster, address _crv) {
        booster = IBooster(_booster);
        crv = _crv;
    }

    function earmarkRewards(uint256[] memory _pids) external returns (uint256) {
        uint256 len = _pids.length;
        require(len > 0, "!pids");

        for (uint256 i = 0; i < len; i++) {
            require(booster.earmarkRewards(_pids[i]), "!earmark reward");
        }
        // Return all incentives to the sender
        uint256 crvBal = IERC20(crv).balanceOf(address(this));
        IERC20(crv).safeTransfer(msg.sender, crvBal);
        return crvBal;
    }

    /**
     * @notice Invoke processIdleRewards for each pool id.
     * @param _pids Array of pool ids
     */
    function processIdleRewards(uint256[] memory _pids) external {
        uint256 len = _pids.length;
        require(len > 0, "!pids");

        for (uint256 i = 0; i < len; i++) {
            IBooster.PoolInfo memory poolInfo = booster.poolInfo(_pids[i]);
            IRewardStaking baseRewardPool = IRewardStaking(poolInfo.crvRewards);
            baseRewardPool.processIdleRewards();
        }
    }

    /**
     * @notice Fetch all pool-IDs of active (not shutdown) pools
     * @return pids Array of pool ids
     */
    function getActivePids() external view returns (uint256[] memory pids) {
        return _getActivePids();
    }

    /**
     * @notice Fetch pool information for a set of pools
     * @param _pids Array of pool ids
     * @return poolInfo Array of pool information
     */
    function getPoolInfo(uint256[] memory _pids) external view returns (IBooster.PoolInfo[] memory poolInfo) {
        return _getPoolInfo(_pids);
    }

    /**
     * @notice Fetch all pool-IDs of active (not shutdown) pools, then fetch pool information for each pid
     * @return poolInfo Array of pool information of all active pools
     */
    function getActivePoolInfo() external view returns (IBooster.PoolInfo[] memory poolInfo) {
        return _getPoolInfo(_getActivePids());
    }

    function _getActivePids() internal view returns (uint256[] memory pids) {
        uint256 poolLength = booster.poolLength();
        uint256 idx;
        pids = new uint256[](poolLength);
        for (uint256 pid = 0; pid < poolLength; pid++) {
            if (!booster.poolInfo(pid).shutdown) {
                pids[idx] = pid;
                idx++;
            }
        }
        return pids;
    }

    function _getPoolInfo(uint256[] memory _pids) internal view returns (IBooster.PoolInfo[] memory poolInfo) {
        IBooster.PoolInfo memory pool;
        for (uint256 i = 0; i < _pids.length; i++) {
            pool = booster.poolInfo(_pids[i]);
            if (i == 0) {
                poolInfo = new IBooster.PoolInfo[](_pids.length);
            }
            poolInfo[i] = pool;
        }
        return poolInfo;
    }
}
