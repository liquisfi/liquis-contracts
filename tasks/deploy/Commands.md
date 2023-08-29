### Scripts

Run a particular task

```sh
yarn hardhat --config tasks-fork.config.ts <Desired_task_name>
```

e.g

```sh
yarn hardhat --config tasks-fork.config.ts deploy:mainnet:1
```

```sh
yarn hardhat --config tasks-fork.config.ts deploy:mainnet:1 --network localhost
```

For mainnet deploy

```sh
yarn hardhat --config tasks.config.ts deploy:mainnet:fullSystem --network mainnet
```
