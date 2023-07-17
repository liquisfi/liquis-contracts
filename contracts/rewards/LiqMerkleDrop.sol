// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import { MerkleProof } from "@openzeppelin/contracts-0.8/utils/cryptography/MerkleProof.sol";
import { ILiqLocker } from "../interfaces/ILiqLocker.sol";
import { AuraMath } from "../utils/AuraMath.sol";
import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts-0.8/security/ReentrancyGuard.sol";

/**
 * @title   LiqMerkleDropV2
 * @dev     Based on AuraMerkleDropV2.sol. Changes:
 *          - Added new dynamics to penalize early claimers with certain amount that is distributed
 *          to the rest of the participants.
 */
contract LiqMerkleDrop {
    using SafeERC20 for IERC20;
    using AuraMath for uint256;

    address public dao;
    bytes32 public merkleRoot;

    IERC20 public immutable aura;
    ILiqLocker public liqLocker;

    uint256 public startTime;
    uint256 public immutable expiryTime;
    uint256 public immutable deployTime;
    uint256 public immutable gracePeriod = 10 weeks;

    uint256 public constant MAX_BONUS = 0.999e18;
    uint256 public constant PERCENTAGE_BASE = 1e18;

    uint256 public totalClaims;
    uint256 public initialPoolSize;
    uint256 public currentPoolSize;
    uint256 public bonusSum;
    uint256 public claimed;
    uint256 public percentageIndex;

    mapping(address => bool) public hasClaimed;

    event DaoSet(address newDao);
    event RootSet(bytes32 newRoot);
    event StartedEarly();
    event ExpiredWithdrawn(uint256 amount);
    event LockerSet(address newLocker);
    event Claimed(address addr, uint256 amt, bool locked);
    event Rescued();
    event Initialized();

    /**
     * @param _dao                  The Aura Dao
     * @param _merkleRoot           Merkle root
     * @param _aura                 Aura token
     * @param _liqLocker            Liq locker contract
     * @param _startDelay           Delay until claim is live
     * @param _expiresAfter         Timestamp claim expires
     * @param _totalClaims          Number of eligible accounts
     * @param _initialPoolSize      Total amount to distribute
     */
    constructor(
        address _dao,
        bytes32 _merkleRoot,
        address _aura,
        address _liqLocker,
        uint256 _startDelay,
        uint256 _expiresAfter,
        uint256 _totalClaims,
        uint256 _initialPoolSize
    ) {
        require(_dao != address(0), "!dao");
        dao = _dao;
        merkleRoot = _merkleRoot;
        require(_aura != address(0), "!aura");
        aura = IERC20(_aura);
        liqLocker = ILiqLocker(_liqLocker);

        deployTime = block.timestamp;
        startTime = block.timestamp + _startDelay;

        require(_expiresAfter > 2 weeks, "!expiry");
        expiryTime = startTime + _expiresAfter;

        totalClaims = _totalClaims;

        initialPoolSize = _initialPoolSize;
        currentPoolSize = _initialPoolSize;
        percentageIndex = PERCENTAGE_BASE;

        emit Initialized();
    }

    /***************************************
                    CONFIG
    ****************************************/

    function setDao(address _newDao) external {
        require(msg.sender == dao, "!auth");
        dao = _newDao;
        emit DaoSet(_newDao);
    }

    function setRoot(bytes32 _merkleRoot) external {
        require(msg.sender == dao, "!auth");
        require(merkleRoot == bytes32(0), "already set");
        merkleRoot = _merkleRoot;
        emit RootSet(_merkleRoot);
    }

    function startEarly() external {
        require(msg.sender == dao, "!auth");
        startTime = block.timestamp;
        emit StartedEarly();
    }

    function withdrawExpired() external {
        require(msg.sender == dao, "!auth");
        require(block.timestamp > expiryTime.add(gracePeriod), "!expired");
        uint256 amt = aura.balanceOf(address(this));
        aura.safeTransfer(dao, amt);
        emit ExpiredWithdrawn(amt);
    }

    function setLocker(address _newLocker) external {
        require(msg.sender == dao, "!auth");
        liqLocker = ILiqLocker(_newLocker);
        emit LockerSet(_newLocker);
    }

    function rescueReward() public {
        require(msg.sender == dao, "!auth");
        require(block.timestamp < AuraMath.min(deployTime + 1 weeks, startTime), "too late");

        uint256 amt = aura.balanceOf(address(this));
        aura.safeTransfer(dao, amt);

        emit Rescued();
    }

    /***************************************
                    CLAIM
    ****************************************/

    function claim(
        bytes32[] calldata _proof,
        uint256 _amount,
        bool _lock
    ) public returns (bool) {
        require(merkleRoot != bytes32(0), "!root");
        require(block.timestamp > startTime, "!started");
        require(block.timestamp < expiryTime.add(gracePeriod), "!active");
        require(_amount > 0, "!amount");
        require(hasClaimed[msg.sender] == false, "already claimed");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _amount));
        require(MerkleProof.verify(_proof, merkleRoot, leaf), "invalid proof");

        hasClaimed[msg.sender] = true;

        uint256 adjustedAmount = _applyAdjustment(_amount);

        if (_lock) {
            aura.safeApprove(address(liqLocker), 0);
            aura.safeApprove(address(liqLocker), adjustedAmount);
            liqLocker.lock(msg.sender, adjustedAmount);
        } else {
            aura.safeTransfer(msg.sender, adjustedAmount);
        }

        emit Claimed(msg.sender, adjustedAmount, _lock);
        return true;
    }

    function getBonus() public view returns (uint256) {
        // timeRemaining = expiryTime - now, or 0 if bonus ended
        uint256 timeRemaining = block.timestamp > expiryTime ? 0 : expiryTime.sub(block.timestamp);
        // bonus = maxBonus * timeRemaining / (expiryTime - startTime)
        return MAX_BONUS.mul(timeRemaining).div(expiryTime.sub(startTime));
    }

    function calculateAdjustedAmount(uint256 amount)
        public
        view
        returns (
            uint256 adjustedAmount,
            uint256 bonus,
            uint256 bonusPart
        )
    {
        // If last claims, return full amount + full bonus
        if (claimed + 1 == totalClaims) {
            return (amount.add(bonusSum), 0, 0);
        }
        // adjustedPercentage = amount / initialPoolSize * percentageIndex
        uint256 adjustedPercentage = amount.mul(PERCENTAGE_BASE).div(initialPoolSize).mul(percentageIndex).div(
            PERCENTAGE_BASE
        );
        // bonusPart = adjustedPercentage * bonusSum
        bonusPart = adjustedPercentage.mul(bonusSum).div(PERCENTAGE_BASE);
        // totalToClaim = amount + bonusPart
        uint256 totalToClaim = amount.add(bonusPart);
        // bonus = totalToClaim * getBonus()
        bonus = totalToClaim.mul(getBonus()).div(PERCENTAGE_BASE);
        // adjustedAmount = totalToClaim - bonus
        adjustedAmount = totalToClaim.sub(bonus);
    }

    function _applyAdjustment(uint256 amount) private returns (uint256) {
        (uint256 adjustedAmount, uint256 bonus, uint256 bonusPart) = calculateAdjustedAmount(amount);
        // Increment claim index
        claimed += 1;

        // If last claims, return full amount, don't update anything
        if (claimed == totalClaims) {
            return adjustedAmount;
        }
        // newPoolSize = currentPoolSize - amount
        uint256 newPoolSize = currentPoolSize.sub(amount);
        // percentageIndex = percentageIndex * currentPoolSize / newPoolSize
        percentageIndex = percentageIndex.mul(currentPoolSize.mul(PERCENTAGE_BASE).div(newPoolSize)).div(
            PERCENTAGE_BASE
        );
        // currentPoolSize = newPoolSize
        currentPoolSize = newPoolSize;
        // bonusSum = bonusSum - bonusPart + bonus
        bonusSum = bonusSum.sub(bonusPart).add(bonus);

        return adjustedAmount;
    }
}
