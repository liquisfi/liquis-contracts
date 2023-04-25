import { Signer } from "ethers";
import { SidechainDeployed } from "scripts/deploySidechain";

export interface SidechainAddresses {
    lzEndpoint: string;
    token: string;
    daoMultisig: string;
    minter: string;
    create2Factory: string;
}

export interface SidechainNaming {
    auraOftName: string;
    auraOftSymbol: string;
    auraBalOftName: string;
    auraBalOftSymbol: string;
    tokenFactoryNamePostfix: string;
}

export interface ExtSidechainConfig {
    canonicalChainId: number;
}

export interface SidechainConfig {
    chainId: number;
    addresses: SidechainAddresses;
    naming: SidechainNaming;
    extConfig: ExtSidechainConfig;
    getSidechain?: (s: Signer) => SidechainDeployed;
}
