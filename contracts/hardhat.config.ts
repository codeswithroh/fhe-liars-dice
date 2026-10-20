import "dotenv/config";
import "@nomicfoundation/hardhat-toolbox";
import "@cofhe/hardhat-plugin";
import { HardhatUserConfig } from "hardhat/config";

// `arb-sepolia` and `eth-sepolia` networks are injected by @cofhe/hardhat-plugin (PRIVATE_KEY, ARBITRUM_SEPOLIA_RPC_URL).
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.25",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun", viaIR: true },
  },
  cofhe: { gasSummary: false },
  sourcify: { enabled: true },
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY ?? "" },
};

export default config;
