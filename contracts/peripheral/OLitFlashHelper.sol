// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts-0.8/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.8/utils/Address.sol";
import "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";

import { IBooster } from "../interfaces/IBooster.sol";
import { IBaseRewardPool } from "../interfaces/IBaseRewardPool.sol";
import { ICrvDepositorWrapper } from "../interfaces/ICrvDepositorWrapper.sol";
import { IBalancerVault, IAsset, IBalancerTwapOracle } from "../interfaces/balancer/BalancerV2.sol";

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

// Note oLIT 0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa
interface IOLit {
    /**
     * @notice Exercises options tokens to purchase the underlying tokens.
     * @dev The options tokens are not burnt but sent to address(0) to avoid messing up the
     * inflation schedule.
     * The oracle may revert if it cannot give a secure result.
     * @param amount The amount of options tokens to exercise
     * @param maxPaymentAmount The maximum acceptable amount to pay. Used for slippage protection.
     * @param recipient The recipient of the purchased underlying tokens
     * @param deadline The Unix timestamp (in seconds) after which the call will revert
     * @return paymentAmount The amount paid to the treasury to purchase the underlying tokens
     */
    function exercise(
        uint256 amount,
        uint256 maxPaymentAmount,
        address recipient,
        uint256 deadline
    ) external returns (uint256 paymentAmount);
}

interface IFlashLoanSimpleReceiver {
    /**
     * @notice Executes an operation after receiving the flash-borrowed asset
     * @dev Ensure that the contract can return the debt + premium, e.g., has
     *      enough funds to repay and has approved the Pool to pull the total amount
     * @param asset The address of the flash-borrowed asset
     * @param amount The amount of the flash-borrowed asset
     * @param premium The fee of the flash-borrowed asset
     * @param initiator The address of the flashloan initiator
     * @param params The byte-encoded params passed when initiating the flashloan
     * @return True if the execution of the operation succeeds, false otherwise
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

/**
 * @title IPool
 * @author Aave
 * @notice Defines the basic interface for an Aave Pool.
 */
interface IPool {
    /**
     * @notice Allows smart contracts to access the liquidity of the pool within one transaction,
     * as long as the amount taken plus a fee is returned.
     * @dev IMPORTANT There are security concerns for developers of flashloan receiver contracts that must be kept
     * into consideration. For further details please visit https://developers.aave.com
     * @param receiverAddress The address of the contract receiving the funds, implementing IFlashLoanSimpleReceiver interface
     * @param asset The address of the asset being flash-borrowed
     * @param amount The amount of the asset being flash-borrowed
     * @param params Variadic packed params to pass to the receiver as extra information
     * @param referralCode The code used to register the integrator originating the operation, for potential rewards.
     * 0 if the action is executed directly by the user, without any middle-man
     */
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;

    /**
     * @notice Returns the total fee on flash loans
     * @return The total fee on flashloans
     */
    function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128);
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
 * @title   OptionsExerciser
 * @author  LiquisFinance
 * @notice  Main helper contract; allows for claiming oLIT from RewardPools and later exercise it.
 * @dev     Implements AaveFlashloan in order to facilitate the conversion in one step.
 */
contract OptionsExerciser is IFlashLoanSimpleReceiver {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public owner;
    address public immutable operator;
    address public immutable liqLit;
    address public immutable crvDepositorWrapper;
    address public immutable lockerRewards;

    address public immutable balVault = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    address public immutable lit = 0xfd0205066521550D7d7AB19DA8F72bb004b4C341;
    address public immutable olit = 0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa;
    address public immutable olitOracle = 0x9d43ccb1aD7E0081cC8A8F1fd54D16E54A637E30;
    address public immutable balOracle = 0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C;
    address public immutable weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public immutable aavePool = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    uint256 public secs;
    uint256 public ago;
    uint256 public maxSlippage;
    uint16 internal referralCode; // Aave referral code

    uint256 public constant basisOne = 10000;
    bytes32 internal constant balancerPoolId = 0x9232a548dd9e81bac65500b5e0d918f8ba93675c000200000000000000000423;

    struct LocalVariablesFlashLoan {
        uint256 olitAmount;
        uint256 amountToRepay;
        uint256 price;
        uint256 amountIn;
        uint256 maxAmountIn;
        uint256 amountNeeded;
        uint256 wethBal;
    }

    event OwnerUpdated(address newOwner);
    event SetParams(uint256 secs, uint256 ago);
    event SetOperationalParams(uint256 maxSlippage, uint16 referralCode);

    /**
     * @param _liqLit ERC20 token minted when locking LIT to veLIT in VoterProxy through crvDepositor.
     * @param _operator Booster main deposit contract; keeps track of pool info & user deposits; distributes rewards.
     * @param _crvDepositorWrapper Converts LIT -> balBPT and then wraps to liqLIT via the crvDepositor.
     * @param _lockerRewards BaseRewardPool where staking token is liqLIT
     */
    constructor(
        address _liqLit,
        address _operator,
        address _crvDepositorWrapper,
        address _lockerRewards
    ) {
        liqLit = _liqLit;
        operator = _operator;
        crvDepositorWrapper = _crvDepositorWrapper;
        lockerRewards = _lockerRewards;

        owner = msg.sender;

        secs = 1800;
        ago = 0;
        maxSlippage = 300;

        IERC20(weth).safeApprove(olit, type(uint256).max);
        IERC20(lit).safeApprove(balVault, type(uint256).max);

        IERC20(lit).safeApprove(crvDepositorWrapper, type(uint256).max);

        emit OwnerUpdated(msg.sender);
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
     * @notice User converts their olit into liqLit, sends it back to the user or stakes it in liqLit staking
     * @param _outputBps Multiplier where 100% == 10000, 99.5% == 9950 and 98% == 9800
     * @param _stake Stake liqLit into the liqLit staking rewards pool
     */
    function exerciseAndLock(
        uint256 _amount,
        uint256 _outputBps,
        bool _stake
    ) external {
        IERC20(olit).safeTransferFrom(msg.sender, address(this), _amount);

        _exerciseOptions(_amount);

        // convert lit to liqLit, send it to sender or stake it in liqLit staking
        _convertLitToLiqLit(_outputBps, _stake);
    }

    /**
     * @notice User claims their olit from liqLit staking, converts into lit and sends it back to the user
     */
    function claimAndExerciseLocker() external {
        // claim all the rewards, only olit is sent here, the rest directly to sender
        uint256 olitAmount = IBaseRewardPool(lockerRewards).getRewardFor(msg.sender, true);

        _exerciseOptions(olitAmount);

        // send lit to sender
        _transferLitToSender();
    }

    /**
     * @notice User claims their olit from different pools, converts into lit and sends it back to the user
     * @param _pids Booster pools ids array to claim rewards from
     * @param _locker Boolean that indicates if the user is staking in lockerRewards
     */
    function claimAndExerciseMultiple(uint256[] memory _pids, bool _locker) external {
        uint256 olitAmount = 0;
        for (uint256 i = 0; i < _pids.length; i++) {
            IBooster.PoolInfo memory pool = IBooster(operator).poolInfo(_pids[i]);
            // claim all the rewards, only olit is sent here, the rest directly to sender
            olitAmount += IBaseRewardPool(pool.crvRewards).getRewardFor(msg.sender, true);
        }

        if (_locker) {
            olitAmount += IBaseRewardPool(lockerRewards).getRewardFor(msg.sender, true);
        }

        _exerciseOptions(olitAmount);

        // send lit to sender
        _transferLitToSender();
    }

    function _transferLitToSender() internal {
        uint256 litBal = IERC20(lit).balanceOf(address(this));
        if (litBal > 0) {
            IERC20(lit).safeTransfer(msg.sender, litBal);
        }
    }

    /**
     * @notice User claims their olit from liqLit staking, converts into liqLit and sends it back to the user
     * @param _outputBps Multiplier for slippage where 100% == 10000, 99.5% == 9950 and 98% == 9800
     * @param _stake Stake liqLit into the liqLit staking rewards pool
     */
    function claimAndLockLocker(uint256 _outputBps, bool _stake) external {
        uint256 olitAmount = IBaseRewardPool(lockerRewards).getRewardFor(msg.sender, true);

        _exerciseOptions(olitAmount);

        // convert lit to liqLit, send it to sender or stake it in liqLit staking
        _convertLitToLiqLit(_outputBps, _stake);
    }

    /**
     * @notice User claims their olit from pool, converts into liqLit and sends it back to the user
     * @param _pids Booster pools ids array to claim rewards from
     * @param _locker Boolean that indicates if the user is staking in lockerRewards
     * @param _outputBps Multiplier for slippage where 100% == 10000, 99.5% == 9950 and 98% == 9800
     * @param _stake Stake liqLit into the liqLit staking rewards pool
     */
    function claimAndLockMultiple(
        uint256[] memory _pids,
        bool _locker,
        uint256 _outputBps,
        bool _stake
    ) external {
        uint256 olitAmount = 0;
        for (uint256 i = 0; i < _pids.length; i++) {
            IBooster.PoolInfo memory pool = IBooster(operator).poolInfo(_pids[i]);
            olitAmount += IBaseRewardPool(pool.crvRewards).getRewardFor(msg.sender, true);
        }

        if (_locker) {
            olitAmount += IBaseRewardPool(lockerRewards).getRewardFor(msg.sender, true);
        }

        _exerciseOptions(olitAmount);

        // convert lit to liqLit, send it to sender or stake it in liqLit staking
        _convertLitToLiqLit(_outputBps, _stake);
    }

    function _convertLitToLiqLit(uint256 _outputBps, bool _stake) internal {
        uint256 litBal = IERC20(lit).balanceOf(address(this));
        if (litBal > 0) {
            uint256 minOut = ICrvDepositorWrapper(crvDepositorWrapper).getMinOut(litBal, _outputBps);
            _stake == true
                ? ICrvDepositorWrapper(crvDepositorWrapper).depositFor(msg.sender, litBal, minOut, true, lockerRewards)
                : ICrvDepositorWrapper(crvDepositorWrapper).depositFor(msg.sender, litBal, minOut, true, address(0));
        }
    }

    function _balancerSwap(
        uint256 _amountOutDesired,
        uint256 _maxAmountIn,
        IAsset _assetIn,
        IAsset _assetOut
    ) internal returns (uint256 tokensIn) {
        IBalancerVault.SingleSwap memory singleSwap = IBalancerVault.SingleSwap(
            balancerPoolId,
            IBalancerVault.SwapKind.GIVEN_OUT,
            _assetIn,
            _assetOut,
            _amountOutDesired, // amount of assetOut desired from the trade
            abi.encode(0)
        );

        tokensIn = IBalancerVault(balVault).swap(
            singleSwap,
            IBalancerVault.FundManagement(address(this), false, payable(address(this)), false),
            _maxAmountIn, // limit amountIn we are willing to swap
            block.timestamp
        );
    }

    function _exerciseOptions(uint256 _olitAmount) internal {
        if (_olitAmount == 0) return;

        // amount of weth needed to process the olit, rounded up
        uint256 amount = (_olitAmount * IOracle(olitOracle).getPrice()) / 1e18 + 1;

        // encode _olitAmount to avoid an extra balanceOf call in next function
        bytes memory userData = abi.encode(_olitAmount);

        IPool(aavePool).flashLoanSimple(address(this), weth, amount, userData, referralCode);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == aavePool, "untrusted lender");
        require(initiator == address(this), "untrusted initiator");

        LocalVariablesFlashLoan memory vars;

        vars.olitAmount = abi.decode(params, (uint256));

        // exercise the olit into lit
        IOLit(olit).exercise(vars.olitAmount, amount, address(this), block.timestamp);

        // currently flashloan fee = 5, but that could vary
        vars.amountToRepay = amount.add(premium);

        IBalancerTwapOracle.OracleAverageQuery[] memory queries = new IBalancerTwapOracle.OracleAverageQuery[](1);
        queries[0] = IBalancerTwapOracle.OracleAverageQuery({
            variable: IBalancerTwapOracle.Variable.PAIR_PRICE,
            secs: secs,
            ago: ago
        });

        // calculate the price weth/lit in 1e18 e.g price = 1e14
        vars.price = IBalancerTwapOracle(balOracle).getTimeWeightedAverage(queries)[0];

        vars.amountIn = vars.amountToRepay.mul(1e18).div(vars.price);
        // apply our accepted slippage to amountIn
        vars.maxAmountIn = vars.amountIn.mul(basisOne.add(maxSlippage)).div(basisOne);

        vars.wethBal = IERC20(weth).balanceOf(address(this));
        if (vars.wethBal < vars.amountToRepay) {
            vars.amountNeeded = vars.amountToRepay.sub(vars.wethBal);
        } // else -> amountNeeded = 0;

        // swap the necessary lit into weth, swap must start with a non-zero amount in
        if (vars.amountNeeded > 0) {
            _balancerSwap(vars.amountNeeded, vars.maxAmountIn, IAsset(lit), IAsset(weth));
        }

        // repay the flashloan, aavePool will pull the tokens from the contract
        IERC20(asset).safeIncreaseAllowance(aavePool, vars.amountToRepay);

        return true;
    }

    /**
     * @param _secs The size of the window to take the TWAP value over in seconds.
     * @param _ago The number of seconds in the past to take the TWAP from.
     * The window would be (block.timestamp - secs - ago, block.timestamp - ago]
     */
    function setOracleParams(uint256 _secs, uint256 _ago) external {
        require(msg.sender == owner, "!auth");
        secs = _secs;
        ago = _ago;
        emit SetParams(_secs, _ago);
    }

    /**
     * @param _maxSlippage Max slippage allowed in Balancer swap.
     * @param _referralCode The referral code for Aave Protocol.
     */
    function setOperationalParams(uint256 _maxSlippage, uint16 _referralCode) external {
        require(msg.sender == owner, "!auth");
        maxSlippage = _maxSlippage;
        referralCode = _referralCode;
        emit SetOperationalParams(_maxSlippage, _referralCode);
    }
}
