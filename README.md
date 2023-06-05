# Liquis Finance

[![Test Coverage](https://github.com/liquisfi/liquis-contracts/actions/workflows/test-coverage.yaml/badge.svg)](https://github.com/liquisfi/liquis-contracts/actions/workflows/test-coverage.yaml)

## Security

Liquis Finance codebase is based on smart contracts developed and used in production by DeFi champions Convex and Aura. Just like these teams we take security very seriously, [see Security documentation](https://docs.liquis.fi/liquis/security) .

If you have any feedback or concerns, reach out to our security team on [our Discord](https://discord.com).

## Dev

### Install

```sh
$ yarn install
```

### Compile

Compile the smart contracts with Hardhat:

```sh
$ yarn compile
```

### TypeChain

Compile the smart contracts and generate TypeChain artifacts:

```sh
$ yarn typechain
```

### Lint Solidity

Lint the Solidity code:

```sh
$ yarn lint:sol
```

### Lint TypeScript

Lint the TypeScript code:

```sh
$ yarn lint:ts
```

### Test

Run the Mocha tests:

```sh
$ yarn test
```

Run fork tests

```sh
$ yarn test:fork:all
```

### Tasks

Running in fork mode

```sh
$ NODE_URL=<FORK_URL> yarn task:fork <TASK_NAME>
```

Running task normally

```
$ NODE_URL=<NODE_URL> yarn task --network <NETWORK> <TASK_NAME>
```

### Coverage

Generate the code coverage report:

```sh
$ yarn coverage
```

### Clean

Delete the smart contract artifacts, the coverage reports and the Hardhat cache:

```sh
$ yarn clean
```

## Local Fork

This runs a local node on your system, that can be used with Metamask, etc.

Run a local fork:

```
npx hardhat node --fork https://eth-mainnet.alchemyapi.io/v2/<API_KEY> --port <PORT>
```

Once you stake or lock CVX you may want to progress timestamps to check rewards stuff

```
export NODE_URL=<LOCAL_NODE_URL>
yarn task timeTravel --duration 69420 --network forking
```

## Diagrams

[Booster Reward Flow](https://docs.google.com/drawings/d/1RjtogmP2EO4j0AIR_uRnOr9jorUwTBn2iBdk4dnK7d8/edit?usp=sharing)
<img src="https://docs.google.com/drawings/d/e/2PACX-1vTEfuureekx70YBgcDBjOsgGYPGYXFzEcjzm-exmcHhe49F9QskgEl6Qn4O5kSHAOvihToEo-4_n5bj/pub?w=2052&h=1032" />

[Cvx Reward Flow](https://docs.google.com/drawings/d/1csXH2TP74UeIhQie1j8fmJvBsBAvGzHAB_-FkfXJ7k8/edit?usp=sharing)
<img src="https://docs.google.com/drawings/d/e/2PACX-1vTGNgox8tvYi1kRxkBnPB8Rwas6Tb5Ic2pCquqG7oIYqLrBF8I9r3n-2fQKtjKfY7xhQrvFKV0Yn5_j/pub?w=1629&h=960" />

## Deployments

### Ethereum Mainnet

| Contract                        | Address                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| voterProxy                      | [0xaF52695E1bB01A16D33D7194C28C42b10e0Dbec2](https://etherscan.io/address/0xaF52695E1bB01A16D33D7194C28C42b10e0Dbec2) |
| aura                            | [0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF](https://etherscan.io/address/0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF) |
| minter                          | [0x59A5ccD34943CD0AdCf5ce703EE9F06889E13707](https://etherscan.io/address/0x59A5ccD34943CD0AdCf5ce703EE9F06889E13707) |
| booster                         | [0xA57b8d98dAE62B26Ec3bcC4a365338157060B234](https://etherscan.io/address/0xA57b8d98dAE62B26Ec3bcC4a365338157060B234) |
| boosterOwner                    | [0x228a142081b456a9fF803d004504955032989f04](https://etherscan.io/address/0x228a142081b456a9fF803d004504955032989f04) |
| boosterOwnerSecondary           | [0xCe96e48A2893C599fe2601Cc1918882e1D001EaD](https://etherscan.io/address/0xCe96e48A2893C599fe2601Cc1918882e1D001EaD) |
| boosterHelper                   | [0x82bbbC3c7B459913Ae6063858832a6C2c43D0Bd0](https://etherscan.io/address/0x82bbbC3c7B459913Ae6063858832a6C2c43D0Bd0) |
| rewardFactory                   | [0xBC8d9cAf4B6bf34773976c5707ad1F2778332DcA](https://etherscan.io/address/0xBC8d9cAf4B6bf34773976c5707ad1F2778332DcA) |
| tokenFactory                    | [0x3eC040DbF7D953216F4C89A2e665d5073445f5Ba](https://etherscan.io/address/0x3eC040DbF7D953216F4C89A2e665d5073445f5Ba) |
| proxyFactory                    | [0xf5E2cFde016bd55BEF42a5A4bAad7E21cd39720d](https://etherscan.io/address/0xf5E2cFde016bd55BEF42a5A4bAad7E21cd39720d) |
| stashFactory                    | [0x54da426EFBB93fbaB5CF81bef03F9B9F00A3E915](https://etherscan.io/address/0x54da426EFBB93fbaB5CF81bef03F9B9F00A3E915) |
| extraRewardStashV3              | [0x4A53301Fe213ECA70f904cD3766C07DB3A621bF8](https://etherscan.io/address/0x4A53301Fe213ECA70f904cD3766C07DB3A621bF8) |
| arbitratorVault                 | [0x5d208cD54f5132f2BD0c1F1e8d8c864Bb6BEdc40](https://etherscan.io/address/0x5d208cD54f5132f2BD0c1F1e8d8c864Bb6BEdc40) |
| auraBAL                         | [0x616e8BfA43F920657B3497DBf40D6b1A02D4608d](https://etherscan.io/address/0x616e8BfA43F920657B3497DBf40D6b1A02D4608d) |
| auraBALBpt                      | [0x3dd0843a028c86e0b760b1a76929d1c5ef93a2dd](https://etherscan.io/address/0x3dd0843a028c86e0b760b1a76929d1c5ef93a2dd) |
| cvxCrvRewards                   | [0x00A7BA8Ae7bca0B10A32Ea1f8e2a1Da980c6CAd2](https://etherscan.io/address/0x00A7BA8Ae7bca0B10A32Ea1f8e2a1Da980c6CAd2) |
| initialCvxCrvStaking            | [0xC47162863a12227E5c3B0860715F9cF721651C0c](https://etherscan.io/address/0xC47162863a12227E5c3B0860715F9cF721651C0c) |
| crvDepositor                    | [0xeAd792B55340Aa20181A80d6a16db6A0ECd1b827](https://etherscan.io/address/0xeAd792B55340Aa20181A80d6a16db6A0ECd1b827) |
| crvDepositorWrapper             | [0x68655AD9852a99C87C0934c7290BB62CFa5D4123](https://etherscan.io/address/0x68655AD9852a99C87C0934c7290BB62CFa5D4123) |
| crvDepositorWrapperWithFee      | [0x6eb746A3F23D401f80AB033edeb65e1a8bB27586](https://etherscan.io/address/0x6eb746A3F23D401f80AB033edeb65e1a8bB27586) |
| auraLocker (vlAURA)             | [0x3Fa73f1E5d8A792C80F426fc8F84FBF7Ce9bBCAC](https://etherscan.io/address/0x3Fa73f1E5d8A792C80F426fc8F84FBF7Ce9bBCAC) |
| cvxStakingProxy                 | [0xd9e863B7317a66fe0a4d2834910f604Fd6F89C6c](https://etherscan.io/address/0xd9e863B7317a66fe0a4d2834910f604Fd6F89C6c) |
| chef                            | [0x1ab80F7Fb46B25b7e0B2cfAC23Fc88AC37aaf4e9](https://etherscan.io/address/0x1ab80F7Fb46B25b7e0B2cfAC23Fc88AC37aaf4e9) |
| lbpBpt                          | [0x6fc73b9d624b543f8b6b88fc3ce627877ff169ee](https://etherscan.io/address/0x6fc73b9d624b543f8b6b88fc3ce627877ff169ee) |
| balLiquidityProvider            | [0xa7429af4DeB16827dAd0e71D8AEEa9C2bF70e32c](https://etherscan.io/address/0xa7429af4DeB16827dAd0e71D8AEEa9C2bF70e32c) |
| penaltyForwarder                | [0x4043569200F7a7a1D989AbbaBC2De2Bde1C20D1E](https://etherscan.io/address/0x4043569200F7a7a1D989AbbaBC2De2Bde1C20D1E) |
| extraRewardsDistributor         | [0xA3739b206097317c72EF416F0E75BB8f58FbD308](https://etherscan.io/address/0xA3739b206097317c72EF416F0E75BB8f58FbD308) |
| poolManager                     | [0x8Dd8cDb1f3d419CCDCbf4388bC05F4a7C8aEBD64](https://etherscan.io/address/0x8Dd8cDb1f3d419CCDCbf4388bC05F4a7C8aEBD64) |
| poolManagerProxy                | [0x2c809Ec701C088099c911AF9DdfA4A1Db6110F3c](https://etherscan.io/address/0x2c809Ec701C088099c911AF9DdfA4A1Db6110F3c) |
| poolManagerSecondaryProxy       | [0xa72932Aea1392b0Da9eDc34178dA2B29EcE2de54](https://etherscan.io/address/0xa72932Aea1392b0Da9eDc34178dA2B29EcE2de54) |
| vestedEscrows                   | [0x5bd3fCA8D3d8c94a6419d85E0a76ec8Da52d836a](https://etherscan.io/address/0x5bd3fCA8D3d8c94a6419d85E0a76ec8Da52d836a) |
|                                 | [0x24346652e0e2aE0CE05c781501fDF4Fe4553fAc6](https://etherscan.io/address/0x24346652e0e2aE0CE05c781501fDF4Fe4553fAc6) |
|                                 | [0x45025Ebc38647bcf7Edd2b40CfDaF3fbfE1538F5](https://etherscan.io/address/0x45025Ebc38647bcf7Edd2b40CfDaF3fbfE1538F5) |
|                                 | [0x43B17088503F4CE1AED9fB302ED6BB51aD6694Fa](https://etherscan.io/address/0x43B17088503F4CE1AED9fB302ED6BB51aD6694Fa) |
|                                 | [0xFd72170339AC6d7bdda09D1eACA346B21a30D422](https://etherscan.io/address/0xFd72170339AC6d7bdda09D1eACA346B21a30D422) |
| drops                           | [0x45EB1A004373b1D8457134A2C04a42d69D287724](https://etherscan.io/address/0x45EB1A004373b1D8457134A2C04a42d69D287724) |
|                                 | [0x1a661CF8D8cd69dD2A423F3626A461A24280a8fB](https://etherscan.io/address/0x1a661CF8D8cd69dD2A423F3626A461A24280a8fB) |
| auraClaimZap                    | [0x2E307704EfaE244c4aae6B63B601ee8DA69E92A9](https://etherscan.io/address/0x2E307704EfaE244c4aae6B63B601ee8DA69E92A9) |
| claimFeesHelper                 | [0xAf824c80aA77Ae7F379DA3Dc05fea0dC1941c200](https://etherscan.io/address/0xAf824c80aA77Ae7F379DA3Dc05fea0dC1941c200) |
| rewardPoolDepositWrapper        | [0xB188b1CB84Fb0bA13cb9ee1292769F903A9feC59](https://etherscan.io/address/0xB188b1CB84Fb0bA13cb9ee1292769F903A9feC59) |
| ChefForwarder                   | [0x57d23f0f101cBd25A05Fc56Fd07dE32bCBb622e9](https://etherscan.io/address/0x57d23f0f101cBd25A05Fc56Fd07dE32bCBb622e9) |
| ChefForwarderSiphonToken        | [0xc9307D63B3709F537D2158F43199a69682Ff0967](https://etherscan.io/address/0xc9307D63B3709F537D2158F43199a69682Ff0967) |
| masterChefRewardHook            | [TBD](https://etherscan.io/address/TBD)                                                                               |
| masterChefRewardHookSiphonToken | [0xbB7A6Ec509D42177C100273b4cd785816daF8e4f](https://etherscan.io/address/0xbB7A6Ec509D42177C100273b4cd785816daF8e4f) |
| gaugeMigrator                   | [0x7954bcDce86e86BeE7b1dEff48c3a0b9BCCe578B](https://etherscan.io/address/0x7954bcDce86e86BeE7b1dEff48c3a0b9BCCe578B) |
| poolMigrator                    | [0x12addE99768a82871EAaecFbDB065b12C56F0578](https://etherscan.io/address/0x12addE99768a82871EAaecFbDB065b12C56F0578) |
| siphonToken                     | [TBD](https://etherscan.io/address/TBD)                                                                               |
| uniswapMigrator                 | [0x5B6159F43585e8A130b0Bc1d31e38Ce7028145b6](https://etherscan.io/address/0x5B6159F43585e8A130b0Bc1d31e38Ce7028145b6) |
| auraMining                      | [0x744Be650cea753de1e69BF6BAd3c98490A855f52](https://etherscan.io/address/0x744Be650cea753de1e69BF6BAd3c98490A855f52) |
| VirtualRewardsFactory           | [0x64E2dF8E5463f8c14e1c28C9782f7B4B6062b2c3](https://etherscan.io/address/0x64E2dF8E5463f8c14e1c28C9782f7B4B6062b2c3) |
| auraBalVault                    | [0xfAA2eD111B4F580fCb85C48E6DC6782Dc5FCD7a6](https://etherscan.io/address/0xfAA2eD111B4F580fCb85C48E6DC6782Dc5FCD7a6) |
| auraBalVault Strategy           | [0x7372EcE4C18bEABc19981A53b557be90dcBd2b66](https://etherscan.io/address/0x7372EcE4C18bEABc19981A53b557be90dcBd2b66) |
| auraBalVault BBUSDHandler       | [0xC4eF943b7c2f6b387b37689f1e9fa6ecB738845d](https://etherscan.io/address/0xC4eF943b7c2f6b387b37689f1e9fa6ecB738845d) |
| auraBalVault VirtualRewards     | [0xAc16927429c5c7Af63dD75BC9d8a58c63FfD0147](https://etherscan.io/address/0xAc16927429c5c7Af63dD75BC9d8a58c63FfD0147) |
| auraClaimZapV3                  | [0x5b2364fD757E262253423373E4D57C5c011Ad7F4](https://etherscan.io/address/0x5b2364fD757E262253423373E4D57C5c011Ad7F4) |
| auraBalStaker                   | [0xa3fCaFCa8150636C3B736A16Cd73d49cC8A7E10E](https://etherscan.io/address/0xa3fCaFCa8150636C3B736A16Cd73d49cC8A7E10E) |
| feeScheduler                    | [0x1a65276A9B6A0611506763839B1fFAe3E86718b4](https://etherscan.io/address/0x1a65276A9B6A0611506763839B1fFAe3E86718b4) |
| veBalGrant                      | [0x89f67f3054bFD662971854190Dbc18dcaBb416f6](https://etherscan.io/address/0x89f67f3054bFD662971854190Dbc18dcaBb416f6) |
| auraViewHelpers                 | [0x129bBda5087e132983e7c20ae1F761333D40c229](https://etherscan.io/address/0x129bBda5087e132983e7c20ae1F761333D40c229) |
