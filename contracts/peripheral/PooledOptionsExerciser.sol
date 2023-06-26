// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts-0.8/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.8/utils/Address.sol";
import "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";

import { IBooster } from "../interfaces/IBooster.sol";
import { ILiqLocker } from "../interfaces/ILiqLocker.sol";
import { IBaseRewardPool } from "../interfaces/IBaseRewardPool.sol";
import { ICrvDepositorWrapper } from "../interfaces/ICrvDepositorWrapper.sol";
import { IBalancerTwapOracle } from "../interfaces/balancer/BalancerV2.sol";

// Note Oracle 0x9d43ccb1aD7E0081cC8A8F1fd54D16E54A637E30
interface IOracle {
    /**
     * @notice Computes the current strike price of the option
     * @return price The strike price in terms of the payment token, scaled by 18 decimals.
     * For example, if the payment token is $2 and the strike price is $4, the return value
     * would be 2e18.
     */
    function getPrice() external view returns (uint256 price);
}

/**
 * @dev     Addresses from Bunni
 *          Gauge Controller 0x901c8aA6A61f74aC95E7f397E22A0Ac7c1242218
 *          Voting Escrow 0xf17d23136B4FeAd139f54fB766c8795faae09660
 *          Minter 0xF087521Ffca0Fa8A43F5C445773aB37C5f574DA0
 *          BAL-20WETH-80LIT 0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C
 *          LIT 0xfd0205066521550D7d7AB19DA8F72bb004b4C341
 *          Options LIT 0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa
 *          Liquidity Gauge USDC/WETH 0xd4d8E88bf09efCf3F5bf27135Ef12c1276d9063C
 *          Bunni USDC/WETH LP (BUNNI-LP) 0x680026A1C99a1eC9878431F730706810bFac9f31
 */

/**
 * @title   PooledOptionsExerciser
 * @author  LiquisFinance
 * @notice  Allows for claiming oLIT from RewardPools, exercise it and lock LIT received.
 * @dev     Implements a pooled exercise model where anyone is allowed to exchange a pool of oLIT for LIT.
 */
contract PooledOptionsExerciser {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public owner;
    address public immutable operator;
    address public immutable liqLit;
    address public immutable crvDepositorWrapper;
    address public immutable lockerRewards;
    address public immutable liqLocker;

    address public immutable lit = 0xfd0205066521550D7d7AB19DA8F72bb004b4C341;
    address public immutable olit = 0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa;
    address public immutable olitOracle = 0x9d43ccb1aD7E0081cC8A8F1fd54D16E54A637E30;
    address public immutable balOracle = 0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C;

    uint256 public secs;
    uint256 public ago;

    bytes32 internal constant balancerPoolId = 0x9232a548dd9e81bac65500b5e0d918f8ba93675c000200000000000000000423;

    // Option execution queue
    mapping(address => mapping(uint256 => uint256)) public queued; // owner => epoch => balance
    mapping(uint256 => uint256) public totalQueued; // owner => supply
    mapping(address => mapping(uint256 => uint256)) public withdrawn; // owner => epoch => balance
    mapping(uint256 => uint256) public totalWithdrawable; // epoch => total supply

    uint256 public epoch; // execution queue epoch
    uint256 public fee; // fee paid to option executor in 1e18 scale

    event OwnerUpdated(address newOwner);
    event SetParams(uint256 secs, uint256 ago, uint256 fee);
    event Queued(address owner, uint256 epoch, uint256 amount);
    event Unqueued(address owner, uint256 epoch, uint256 amount);
    event Exercised(uint256 epoch, uint256 amountIn, uint256 amountOut);
    event Withdrawn(address owner, uint256 epoch, uint256 amount);

    /**
     * @param _liqLit ERC20 token minted when locking LIT to veLIT in VoterProxy through crvDepositor.
     * @param _operator Booster main deposit contract; keeps track of pool info & user deposits; distributes rewards.
     * @param _crvDepositorWrapper Converts LIT -> balBPT and then wraps to liqLIT via the crvDepositor.
     * @param _lockerRewards BaseRewardPool where staking token is liqLIT.
     */
    constructor(
        address _liqLit,
        address _operator,
        address _crvDepositorWrapper,
        address _lockerRewards,
        address _liqLocker
    ) {
        liqLit = _liqLit;
        operator = _operator;
        crvDepositorWrapper = _crvDepositorWrapper;
        lockerRewards = _lockerRewards;
        liqLocker = _liqLocker;

        owner = msg.sender;

        secs = 1800;
        ago = 0;

        epoch = 0;
        fee = 1.01e18; // 1%

        IERC20(lit).safeApprove(crvDepositorWrapper, type(uint256).max);

        emit OwnerUpdated(msg.sender);
        emit SetParams(1800, 0, 1.01e18);
    }

    /**
     * @notice Queue oLIT for execution
     * @param amount The amount of oLIT to be queued
     * @dev Adds queued oLIT to current epoch
     * @dev Reverts if insufficient balance
     */
    function queue(uint256 amount) external {
        IERC20(olit).safeTransferFrom(msg.sender, address(this), amount);

        queued[msg.sender][epoch] += amount;
        totalQueued[epoch] += amount;

        emit Queued(msg.sender, epoch, amount);
    }

    /**
     * @notice Claim oLIT rewards from pool and queue for execution
     * @param _pid Id of the pool to claim rewards from
     * @return amount The amount of oLIT claimed and queued
     */
    function claimAndQueue(uint256 _pid) external returns (uint256 amount) {
        // claim oLIT rewards from _pid pool for user
        IBooster.PoolInfo memory pool = IBooster(operator).poolInfo(_pid);
        amount = IBaseRewardPool(pool.crvRewards).getRewardFor(msg.sender, true);

        // queue claimed oLIT rewards
        queued[msg.sender][epoch] += amount;
        totalQueued[epoch] += amount;

        emit Queued(msg.sender, epoch, amount);
    }

    /**
     * @notice Claim oLIT rewards from liqLit staking and liqLocker
     * @param _option Option == 1 claim from liqLit staking, 2 claim from liqLocker, anything else claim from both
     */
    function claimAndQueueExtra(uint8 _option) external returns (uint256 amount) {
        if (_option == 1) {
            amount = IBaseRewardPool(lockerRewards).getRewardFor(msg.sender, true);
        } else if (_option == 2) {
            amount = ILiqLocker(liqLocker).getRewardFor(msg.sender);
        } else {
            amount = IBaseRewardPool(lockerRewards).getRewardFor(msg.sender, true);
            amount += ILiqLocker(liqLocker).getRewardFor(msg.sender);
        }

        // queue claimed oLIT rewards
        queued[msg.sender][epoch] += amount;
        totalQueued[epoch] += amount;

        emit Queued(msg.sender, epoch, amount);
    }

    /**
     * @notice Claim oLIT rewards from liqLit staking and liqLocker
     * @param _pids Booster pools ids array to claim rewards from
     * @param _locker Boolean that indicates if the user is staking in lockerRewards (BaseRewardPool)
     * @param _liqLocker Boolean that indicates if the user is locking Liq in LiqLocker
     */
    function claimAndQueueMultiple(
        uint256[] memory _pids,
        bool _locker,
        bool _liqLocker
    ) external returns (uint256 amount) {
        for (uint256 i = 0; i < _pids.length; i++) {
            IBooster.PoolInfo memory pool = IBooster(operator).poolInfo(_pids[i]);
            // claim all the rewards, only oLIT is sent here, the rest directly to sender
            amount += IBaseRewardPool(pool.crvRewards).getRewardFor(msg.sender, true);
        }

        if (_locker) {
            amount += IBaseRewardPool(lockerRewards).getRewardFor(msg.sender, true);
        }

        if (_liqLocker) {
            amount += ILiqLocker(liqLocker).getRewardFor(msg.sender);
        }

        // queue claimed oLIT rewards
        queued[msg.sender][epoch] += amount;
        totalQueued[epoch] += amount;

        emit Queued(msg.sender, epoch, amount);
    }

    /**
     * @notice Unqueue oLIT from execution
     * @param amount The amount of oLIT to unqueue from execution
     * @dev Reverts if amount exceeds queued balance
     */
    function unqueue(uint256 amount) external {
        // queued balance
        uint256 _queued = queued[msg.sender][epoch];

        // revert if queued balance insufficient
        require(amount <= _queued, "insufficient balance");

        // unqueue
        queued[msg.sender][epoch] -= amount;
        totalQueued[epoch] -= amount;
        IERC20(olit).safeTransfer(msg.sender, amount);

        emit Unqueued(msg.sender, epoch, amount);
    }

    // compute oLIT amountIn and LIT amountOut for exercising the oLIT queued for execution in current epoch
    function _exerciseAmounts() internal returns (uint256 amountIn, uint256 amountOut) {
        // oLIT amount available for exercise
        amountIn = totalQueued[epoch];

        if (amountIn == 0) return (0, 0);

        // oLIT option exercise price in WETH incl exercise fee for caller
        // note, normalize to 1e18 precision when computing exercise price in LIT (below)
        uint256 executionPriceWETH = IOracle(olitOracle).getPrice().mul(fee);

        // WETH/LIT price
        IBalancerTwapOracle.OracleAverageQuery[] memory queries = new IBalancerTwapOracle.OracleAverageQuery[](1);
        queries[0] = IBalancerTwapOracle.OracleAverageQuery({
            variable: IBalancerTwapOracle.Variable.PAIR_PRICE,
            secs: secs,
            ago: ago
        });
        uint256 priceLIT = IBalancerTwapOracle(balOracle).getTimeWeightedAverage(queries)[0];

        // oLIT option exercise price in LIT
        // note, executionPriceWETH is in 1e36 precision
        uint256 executionPriceLIT = executionPriceWETH.div(priceLIT);

        // amount of LIT available for claiming is exercised LIT minus execution price
        amountOut = amountIn.sub(amountIn.mul(executionPriceLIT).div(1e18));
    }

    /**
     * @notice Compute oLIT in and LIT out for option exercise
     * @return amountIn The amount of oLIT options exercised
     * @return amountOut The amount of LIT received
     */
    function exerciseAmounts() external virtual returns (uint256 amountIn, uint256 amountOut) {
        return _exerciseAmounts();
    }

    /**
     * @notice Exercise queued oLIT options
     * @dev Increments epoch
     * TODO: support partial execution in order to prevent
     */
    function exercise() external {
        // compute oLIT exercise amounts
        (uint256 amountIn, uint256 amountOut) = _exerciseAmounts();

        // Update withdrawable amount for epoch
        // note, can only exercise once for every epoch
        totalWithdrawable[epoch] += amountOut;
        epoch += 1;

        // Transfer oLIT to caller and LIT to exerciser contract
        IERC20(lit).safeTransferFrom(msg.sender, address(this), amountOut);
        IERC20(olit).safeTransfer(msg.sender, amountIn);

        emit Exercised(epoch - 1, amountIn, amountOut);
    }

    /**
     * @notice Withdraw LIT
     * @param _epoch The epoch for which to withdraw LIT
     * @return withdrawn_ The LIT withdrawn
     * @dev Returns zero if nothing withdrawable
     */
    function withdraw(uint256 _epoch) external returns (uint256 withdrawn_) {
        // only withdraw past epochs
        require(_epoch < epoch, "epoch not withdrawable");

        // update withdrawn balance
        // note, totalQueued > 0 for all past epochs
        uint256 share = queued[msg.sender][_epoch].mul(1e18).div(totalQueued[_epoch]);
        withdrawn_ = share.mul(totalWithdrawable[_epoch]).div(1e18).sub(withdrawn[msg.sender][_epoch]);

        // return if nothing claimable
        if (withdrawn_ == 0) return 0;

        // update withdrawn amount for user and epoch
        withdrawn[msg.sender][_epoch] += withdrawn_;

        // transfer withdrawable LIT
        IERC20(lit).safeTransfer(msg.sender, withdrawn_);

        emit Withdrawn(msg.sender, _epoch, withdrawn_);
    }

    /**
     * @notice User claims their olit from pool, converts into liqLit and sends it back to the user
     * @param _epoch Epoch for which to withdraw and lock LIT
     * @param _outputBps Multiplier for slippage where 100% == 10000, 99.5% == 9950 and 98% == 9800
     * @param _stake Stake liqLit into the liqLit staking rewards pool
     */
    function withdrawAndLock(
        uint256 _epoch,
        uint256 _outputBps,
        bool _stake
    ) external returns (uint256 withdrawn_) {
        // only withdraw past epochs
        require(_epoch < epoch, "epoch not withdrawable");

        // update withdrawn balance
        // note, totalQueued > 0 for all past epochs
        uint256 share = queued[msg.sender][_epoch].mul(1e18).div(totalQueued[_epoch]);
        withdrawn_ = share.mul(totalWithdrawable[_epoch]).div(1e18).sub(withdrawn[msg.sender][_epoch]);

        // return if nothing claimable
        if (withdrawn_ == 0) return 0;

        // update withdrawn amount for user and epoch
        withdrawn[msg.sender][_epoch] += withdrawn_;

        // convert lit to liqLit, send it to sender or stake it in liqLit staking
        _convertLitToLiqLit(withdrawn_, _outputBps, _stake);

        emit Withdrawn(msg.sender, _epoch, withdrawn_);
    }

    function _convertLitToLiqLit(
        uint256 amount,
        uint256 _outputBps,
        bool _stake
    ) internal {
        uint256 minOut = ICrvDepositorWrapper(crvDepositorWrapper).getMinOut(amount, _outputBps);
        _stake == true
            ? ICrvDepositorWrapper(crvDepositorWrapper).depositFor(msg.sender, amount, minOut, true, lockerRewards)
            : ICrvDepositorWrapper(crvDepositorWrapper).depositFor(msg.sender, amount, minOut, true, address(0));
    }

    /**
     * @notice Owner is responsible for setting initial config and updating operational params
     */
    function setOwner(address _owner) external {
        require(msg.sender == owner, "!auth");
        owner = _owner;

        emit OwnerUpdated(_owner);
    }

    /**
     * @param _secs The size of the window to take the TWAP value over in seconds.
     * @param _ago The number of seconds in the past to take the TWAP from.
     * The window would be (block.timestamp - secs - ago, block.timestamp - ago]
     * @param _fee The fee in basis points for compensating the caller
     */
    function setOracleParams(
        uint256 _secs,
        uint256 _ago,
        uint256 _fee
    ) external {
        require(msg.sender == owner, "!auth");
        secs = _secs;
        ago = _ago;
        fee = _fee;
        emit SetParams(_secs, _ago, _fee);
    }
}
