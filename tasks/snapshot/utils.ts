import * as fs from "fs";
import * as path from "path";
import { networkLabels, priorityGaugesAddresses, symbolOverrides, validNetworks } from "./constants";

export interface Gauge {
    pool: {
        tokens: {
            symbol: string;
            address: string;
        }[];
    };
    network: number;
    address: string;
    label: string;
}

export interface GaugeChoice {
    label: string;
    address: string;
}

export const compareAddresses = (a: string, b: string): boolean => {
    return a.toLowerCase() === b.toLowerCase();
};

export function getGaugeSnapshot() {
    // https://raw.githubusercontent.com/balancer/frontend-v2/develop/src/data/voting-gauges.json
    const savePath = path.resolve(__dirname, "./gauge_snapshot_bunni.json");
    return JSON.parse(fs.readFileSync(savePath, "utf-8"));
}

export function getGaugeChoices(): Array<GaugeChoice> {
    // https://raw.githubusercontent.com/balancer/frontend-v2/develop/src/data/voting-gauges.json
    const savePath = path.resolve(__dirname, "./gauge_choices.json");
    return JSON.parse(fs.readFileSync(savePath, "utf-8"));
}

export function saveGaugeChoices(gauges: GaugeChoice[]) {
    fs.writeFileSync(path.resolve(__dirname, "./gauge_choices.json"), JSON.stringify(gauges));
}

export function saveGaugeSnapshot(gauges: Gauge[]) {
    fs.writeFileSync(path.resolve(__dirname, "./gauge_snapshot_bunni.json"), JSON.stringify(gauges));
}

export const parseLabel = (gauge: Gauge) => {
    if (gauge.address === "0xE867AD0a48e8f815DC0cda2CDb275e0F163A480b") return "veBAL";

    const networkStr = networkLabels[gauge.network] ? `${networkLabels[gauge.network]}-` : "";

    const tokenStr = gauge.pool.tokens
        .map(token => symbolOverrides[token.address.toLowerCase()] || token.symbol)
        .join("/");

    return [networkStr, " ", tokenStr].join("");
};

export const sortGaugeList = (gaugeList: Gauge[]) => {
    const gauges = gaugeList.map(gauge => {
        if (gauge.address === "0x0312AA8D0BA4a1969Fddb382235870bF55f7f242") {
            // auraBAL gauge
            return { ...gauge, pool: { ...gauge.pool, tokens: [gauge.pool.tokens[1], gauge.pool.tokens[0]] } };
        }

        // Deal with child gauges
        if (gauge.pool.tokens[0].symbol === "N/A") {
            return gauge;
        }

        // Deal with WETH pools
        const hasWeth = gauge.pool.tokens.some(token => token.symbol === "WETH");
        if (hasWeth) {
            const tokens = gauge.pool.tokens.sort(a => (a.symbol === "WETH" ? 1 : -1));
            return { ...gauge, pool: { ...gauge.pool, tokens } };
        }
    });

    const chainOrder = [1, 42161, 137, 10, 100];

    if (chainOrder.length !== validNetworks.length) {
        throw Error("Chain order wrong length");
    }

    const networkOrder = chainOrder.reduce((acc, chainId) => {
        return [...acc, ...gauges.filter(g => g.network === chainId)];
    }, []);

    const priorityGauges = priorityGaugesAddresses.map(addr =>
        gauges.find(g => g.address.toLowerCase() === addr.toLowerCase()),
    );
    return [...priorityGauges, ...networkOrder.filter(x => !priorityGaugesAddresses.includes(x.address.toLowerCase()))];
};

export const ordinalSuffix = (i: number) => {
    const j = i % 10;
    const k = i % 100;
    if (j == 1 && k != 11) {
        return i + "st";
    }
    if (j == 2 && k != 12) {
        return i + "nd";
    }
    if (j == 3 && k != 13) {
        return i + "rd";
    }
    return i + "th";
};
