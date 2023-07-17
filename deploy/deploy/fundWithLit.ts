import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { getConfig } from "../config";
import axios from "axios";

import { MockERC20__factory } from "../../types/generated";

import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();

const config = getConfig();

const { TENDERLY_USERNAME, TENDERLY_PROJECT, TENDERLY_ACCESS_KEY, TENDERLY_FORK_ID } = process.env;

// yarn hardhat deploy --network tenderly --no-compile --reset --tags fundWithLit

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const deployer = (await ethers.getSigners())[0];

    const provider = new ethers.providers.JsonRpcProvider(process.env.TENDERLY_FORK_URL);

    console.log(`Funding account with Lit in network ${hre.network.name}`);

    const litAmount = BigNumber.from(1000000); // 1M LIT

    const LIT_WHALE = "0x63F2695207f1d625a9B0B8178D95cD517bC5E82C";

    const lit = MockERC20__factory.connect(config.External.lit, provider);
    const whaleBal = await lit.balanceOf(LIT_WHALE);
    console.log("Whale LIT balance: ", +whaleBal);

    const SIMULATE_API = `https://api.tenderly.co/api/v1/account/${TENDERLY_USERNAME}/project/${TENDERLY_PROJECT}/fork/${TENDERLY_FORK_ID}/simulate`;

    const LIT_ADDRESS = config.External.lit;

    const TX_DATA = await lit.populateTransaction.transfer(deployer.address, litAmount);

    const tx = {
        network_id: "1",
        block_number: null,
        transaction_index: null,
        from: LIT_WHALE,
        input: TX_DATA.data,
        to: LIT_ADDRESS,
        gas: 8000000,
        gas_price: "0",
        value: "0",
        access_list: [],
        generate_access_list: true,
        save: true,
        source: "dashboard",
        block_header: null,
        root: "",
        skip_fork_head_update: false,
        alias: "",
        description: "",
    };

    const opts = {
        headers: {
            "content-type": "application/JSON",
            "X-Access-Key": TENDERLY_ACCESS_KEY || "",
        },
    };

    try {
        const resp = await axios.post(SIMULATE_API, tx, opts);
        console.log(resp);
    } catch (err: any) {
        console.log(err);
        console.log(err.response.data.error);
    }

    console.log(`Transfer of ${litAmount} LIT is done`);
};

export default func;
func.tags = ["fundWithLit"];
