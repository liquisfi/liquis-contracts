### Test

Run all the folder tests:

```sh
yarn hardhat --config hardhat-fork.config.ts test ./test-liquis/*
```

Run a particular test

```sh
yarn hardhat --config hardhat-fork.config.ts test ./test-liquis/<Desired test name>
```

e.g

```sh
yarn hardhat --config hardhat-fork.config.ts test ./test-liquis/LitDepositorWrapper.spec.ts
```
