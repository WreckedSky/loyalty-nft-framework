const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../../.env' });

const web3 = new Web3(process.env.PROVIDER_URL);
const abi = JSON.parse(
  fs.readFileSync(path.join(__dirname,'..','contract','abi.json'), 'utf8')
);
const contract = new web3.eth.Contract(abi, process.env.CONTRACT_ADDRESS);
const adminAccount = web3.eth.accounts.privateKeyToAccount(process.env.ADMIN_PRIVATE_KEY);
web3.eth.accounts.wallet.add(adminAccount);

module.exports = { web3, contract, adminAccount };