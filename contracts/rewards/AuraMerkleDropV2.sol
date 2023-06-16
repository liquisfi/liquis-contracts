// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import { MerkleProof } from "@openzeppelin/contracts-0.8/utils/cryptography/MerkleProof.sol";
import { ILiqLocker } from "../interfaces/ILiqLocker.sol";
import { AuraMath } from "../utils/AuraMath.sol";
import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts-0.8/security/ReentrancyGuard.sol";

/**
 * @title   AuraMerkleDropV2
 * @dev     Forked from contracts/rewards/AuraMerkleDrop.sol. Changes:
 *          - Removed rewards penalty
 *          - Added Initialized event
 */
contract AuraMerkleDropV2 {
    using SafeERC20 for IERC20;

    address public dao;
    bytes32 public merkleRoot;

    IERC20 public immutable aura;
    ILiqLocker public liqLocker;

    uint256 public immutable deployTime;
    uint256 public startTime;
    uint256 public immutable expiryTime;

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
     * @param _dao              The Aura Dao
     * @param _merkleRoot       Merkle root
     * @param _aura             Aura token
     * @param _liqLocker       Aura locker contract
     * @param _startDelay       Delay until claim is live
     * @param _expiresAfter     Timestamp claim expires
     */
    constructor(
        address _dao,
        bytes32 _merkleRoot,
        address _aura,
        address _liqLocker,
        uint256 _startDelay,
        uint256 _expiresAfter
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
        require(block.timestamp > expiryTime, "!expired");
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
        require(block.timestamp < expiryTime, "!active");
        require(_amount > 0, "!amount");
        require(hasClaimed[msg.sender] == false, "already claimed");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _amount));
        require(MerkleProof.verify(_proof, merkleRoot, leaf), "invalid proof");

        hasClaimed[msg.sender] = true;

        if (_lock) {
            aura.safeApprove(address(liqLocker), 0);
            aura.safeApprove(address(liqLocker), _amount);
            liqLocker.lock(msg.sender, _amount);
        } else {
            aura.safeTransfer(msg.sender, _amount);
        }

        emit Claimed(msg.sender, _amount, _lock);
        return true;
    }
}
