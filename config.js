// Arc Payroll network configuration
// IMPORTANT: Never put a private key or seed phrase here.

const ARC_CONFIG = {
  testnet: {
    key: "testnet",
    name: "Arc Testnet",
    chainId: 5042002,
    chainHex: "0x4CEF52",
    rpc: "https://rpc.testnet.arc.io",
    explorer: "https://testnet.arcscan.app",
    usdc: "0x3600000000000000000000000000000000000000",
    faucet: "https://faucet.circle.com"
  },

  mainnet: {
    key: "mainnet",
    name: "Arc Mainnet",
    chainId: 5042,
    chainHex: "0x13B2",
    rpc: "https://rpc.mainnet.arc.io",
    explorer: "https://explorer.arc.io",
    usdc: "0x3600000000000000000000000000000000000000"
  }
};

// USDC ERC-20 interface
const USDC_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];
