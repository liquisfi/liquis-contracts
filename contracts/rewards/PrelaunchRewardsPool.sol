// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICrvDepositor } from "../interfaces/ICrvDepositor.sol";
import { ILitConvertor } from "../interfaces/ILitConvertor.sol";

import { Math } from "../utils/Math.sol";

/**
 * @title   PrelaunchRewardsPool
 * @author  LiquisFinance
 * @notice  Staking rewards contract for the prelaunch of Liquis Protocol.
 */
contract PrelaunchRewardsPool {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public immutable rewardToken;
    IERC20 public immutable stakingToken;
    IERC20 public immutable lit;
    uint256 public constant duration = 7 days;

    address public owner;
    address public rewardDistributor;
    address public crvDepositor;
    address public litConvertor;

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public currentRewards = 0;
    uint256 public historicalRewards = 0;

    uint256 private _totalSupply;

    uint256 public immutable START_WITHDRAWALS;
    uint256 public immutable START_VESTING_DATE;
    uint256 public immutable END_VESTING_DATE;

    uint256 public totalRenounced;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) private _balances;
    mapping(address => uint256) public claimed;
    mapping(address => bool) public isVestingUser;

    event RewardAdded(uint256 reward);
    event OwnerUpdated(address newOwner);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event Recovered(address token, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event CrvDepositorSet(address indexed crvDepositor);
    event RewardsDistributorUpdated(address indexed newRewardDistributor);

    /**
     * @dev Initializes variables, approves lit and sets target dates.
     * @param stakingToken_  BPT token BAL 20-80 WETH/LIT
     * @param rewardToken_   LIQ
     * @param litConvertor_  Contract that converts LIT into BPT
     * @param lit_           LIT
     */
    constructor(
        address stakingToken_,
        address rewardToken_,
        address litConvertor_,
        address lit_
    ) {
        owner = msg.sender;

        stakingToken = IERC20(stakingToken_);
        rewardToken = IERC20(rewardToken_);

        litConvertor = litConvertor_;

        lit = IERC20(lit_);
        lit.safeApprove(litConvertor, type(uint256).max);

        START_VESTING_DATE = block.timestamp + 28 days;
        END_VESTING_DATE = START_VESTING_DATE + 180 days;

        START_WITHDRAWALS = START_VESTING_DATE + 14 days;
    }

    // ----- View Methods ----- //

    function totalSupply() public view virtual returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view virtual returns (uint256) {
        return _balances[account];
    }

    // ----- Reward Functions ----- //

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored +
            (((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) / totalSupply());
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    /**
     * @dev Returns how many rewards a given account has earned
     * @param account    Address for which the request is made
     */
    function earned(address account) public view returns (uint256) {
        return (balanceOf(account) * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18 + rewards[account];
    }

    // ----- Stake Functions ----- //

    function stake(uint256 _amount) public returns (bool) {
        // pull tokens from msg.sender
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        _processStake(_amount, msg.sender);
        return true;
    }

    function stakeAll() external returns (bool) {
        uint256 balance = stakingToken.balanceOf(msg.sender);

        stake(balance);
        return true;
    }

    function stakeFor(address _for, uint256 _amount) external returns (bool) {
        // pull tokens from msg.sender
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        _processStake(_amount, _for);
        return true;
    }

    /**
     * @dev Converts user LIT into BPT and stakes it, reward is updated in low level func _processStake
     */
    function stakeInLit(uint256 amount, uint256 minOut) external {
        lit.safeTransferFrom(msg.sender, address(this), amount); // Note check if we can save a transfer

        uint256 bptReceived = ILitConvertor(litConvertor).convertLitToBpt(amount, minOut);

        _processStake(bptReceived, msg.sender);
    }

    /**
     * @dev Generic internal staking function that updates rewards based on previous balances, then update balances
     * @param _amount    Units to add to the users balance
     * @param _receiver  Address of user who will receive the stake
     */
    function _processStake(uint256 _amount, address _receiver) internal updateReward(_receiver) {
        require(_amount > 0, "Cannot stake 0");

        // update storage variables
        _totalSupply = _totalSupply + _amount;
        _balances[_receiver] = _balances[_receiver] + _amount;

        emit Transfer(address(0), _receiver, _amount);

        emit Staked(_receiver, _amount);
    }

    /**
     * @dev Called by a staker to convert all their staked BPT balance to liqLIT (if target address set)
     * Note crvDepositor address should be populated after rewards have ended
     */
    function convertStakeToLiqLit() external updateReward(msg.sender) onlyIfAddressExists(crvDepositor) {
        uint256 userStake = balanceOf(msg.sender);

        // update state variables
        _totalSupply = _totalSupply - userStake;
        _balances[msg.sender] = 0;

        // deposit to crvDepositor for the user, liqLit is sent directly to the user
        ICrvDepositor(crvDepositor).depositFor(msg.sender, userStake, true, address(0));

        // register the user as vesting user
        isVestingUser[msg.sender] = true;
    }

    // ----- Withdraw Functions ----- //

    /**
     * @dev Called by a staker to withdraw all their BPT stake
     * Note Rewards accumulated are renounced, users that withdraw are not eligible for rewards vesting
     * Note Check if it is better to send directly the rewardToken to the treasury
     */
    function withdraw() external {
        _withdraw(_balances[msg.sender]);
    }

    function _withdraw(uint256 amount) internal updateReward(msg.sender) onlyAfterDate(START_WITHDRAWALS) {
        require(crvDepositor == address(0), "Target address is set");
        require(amount > 0, "Cannot withdraw 0");

        _totalSupply = _totalSupply - amount;
        _balances[msg.sender] = _balances[msg.sender] - amount;

        // track renounced reward balances from users that withdraw
        uint256 rewardAccrued = rewards[msg.sender];
        totalRenounced += rewardAccrued;
        rewards[msg.sender] = 0;

        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);

        emit Transfer(msg.sender, address(0), amount);
    }

    // ----- Vesting Functions ----- //

    /**
     * @dev Called by a staker to get their vested LIQ rewards
     * Note In convertStakeToLiqLit() we make sure that rewards[msg.sender] mapping reflects all rewards
     */
    function claimLiqVesting() external onlyAfterDate(START_VESTING_DATE) onlyVestingUser {
        _sendLiqVesting(msg.sender);
    }

    function _sendLiqVesting(address _account) private {
        uint256 unclaimedAmount = getClaimableLiqVesting(_account);
        if (unclaimedAmount == 0) return;

        // update rewards claimed mapping
        claimed[_account] += unclaimedAmount;

        rewardToken.safeTransfer(_account, unclaimedAmount);

        emit RewardPaid(_account, unclaimedAmount);
    }

    function getClaimableLiqVesting(address _account) public view returns (uint256 claimable) {
        if (block.timestamp < START_VESTING_DATE) return 0;

        if (block.timestamp >= END_VESTING_DATE) {
            claimable = rewards[_account] - claimed[_account];
        } else {
            claimable =
                ((rewards[_account] * (block.timestamp - START_VESTING_DATE)) /
                    (END_VESTING_DATE - START_VESTING_DATE)) -
                claimed[_account];
        }
    }

    // ----- Protected Functions ----- //

    /**
     * @dev Called by authorized addresses to allocate new LIQ rewards to this pool
     *      Rewards need to be first sent and subsequently call notifyRewardAmount
     *      There is no pull method in the function
     */
    function notifyRewardAmount(uint256 reward) external onlyAuthorized updateReward(address(0)) {
        historicalRewards = historicalRewards + reward;

        if (block.timestamp >= periodFinish) {
            rewardRate = reward / duration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            reward = reward + leftover;
            rewardRate = reward / duration;
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint256 balance = rewardToken.balanceOf(address(this));
        require(rewardRate <= balance.div(duration), "Provided reward too high");

        currentRewards = reward;
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + duration;

        emit RewardAdded(reward);
    }

    function recoverERC20(address tokenAddress, uint256 tokenAmount) external {
        require(msg.sender == owner, "!auth");
        require(tokenAddress != address(stakingToken) && tokenAddress != address(rewardToken), "Not valid token");
        IERC20(tokenAddress).safeTransfer(owner, tokenAmount);

        emit Recovered(tokenAddress, tokenAmount);
    }

    function setNewRewardsDistributor(address _rewardDistributor) external {
        require(msg.sender == owner, "!auth");
        rewardDistributor = _rewardDistributor;

        emit RewardsDistributorUpdated(_rewardDistributor);
    }

    function setOwner(address _owner) external {
        require(msg.sender == owner, "!auth");
        owner = _owner;

        emit OwnerUpdated(_owner);
    }

    function setCrvDepositor(address _crvDepositor) external {
        require(msg.sender == owner, "!auth");
        crvDepositor = _crvDepositor;

        // approve crvDepositor to convert contract BPT to liqLIT
        IERC20(stakingToken).safeApprove(crvDepositor, type(uint256).max);

        emit CrvDepositorSet(_crvDepositor);
    }

    /**
     * @dev Allows the owner to pull the renounced balances from people that withdrew
     */
    function recoverRenouncedLiq() external {
        require(msg.sender == owner, "!auth");
        uint256 _totalRenounced = totalRenounced;

        totalRenounced = 0;
        rewardToken.safeTransfer(msg.sender, _totalRenounced);

        emit Recovered(address(rewardToken), _totalRenounced);
    }

    // ----- Modifiers ----- //

    modifier onlyAuthorized() {
        require(msg.sender == owner || msg.sender == rewardDistributor, "!auth");
        _;
    }

    modifier onlyAfterDate(uint256 limitDate) {
        require(block.timestamp > limitDate, "Currently not possible");
        _;
    }

    modifier onlyVestingUser() {
        require(isVestingUser[msg.sender], "Not vesting User");
        _;
    }

    modifier onlyIfAddressExists(address targetAddress) {
        require(targetAddress != address(0), "Target address not set");
        _;
    }
}
