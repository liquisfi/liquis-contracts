### Deploying to a local tenderly fork

First create a fork on Tenderly, you will get a RPC url.

After that, fill the different fields of `.env` file, there is an example file `.env.example`

`TENDERLY_FORK_URL`
`TENDERLY_PRIVATE_KEY`
`TENDERLY_FORK_CHAINID`
`TENDERLY_PROJECT`
`TENDERLY_USERNAME`

In order to run a particular script:

```sh
yarn hardhat run scripts/tenderly/<script_file_name> --network tenderly
```

e.g

```sh
yarn hardhat run scripts/tenderly/deploy-prelaunch.ts --network tenderly
```

For doing tx and manipulating the fork there are tasks in the deploy section

Just need to fill the `contracts.tenderly.json` file with the deployment addresses

In order to run a particular script:

```sh
yarn hardhat deploy --network tenderly --no-compile --reset --tags <tag_name>
```

e.g

```sh
yarn hardhat deploy --network tenderly --no-compile --reset --tags notifyRewardAmount
```
