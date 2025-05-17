// // hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");
// require('dotenv').config();
// Replace this with your own private key
require('dotenv').config({ path: '../.env' });
console.log(process.env.ADMIN_PRIVATE_KEY)
const PRIVATE_KEY = String(process.env.ADMIN_PRIVATE_KEY)

module.exports = {
  networks: {
    zkEVM: {
      url: `https://rpc.cardona.zkevm-rpc.com`,
      accounts: [PRIVATE_KEY],
      chainId: 2442
    },
  },
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};

