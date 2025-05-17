const fs = require("fs");
const path = require("path");

const abiPath = path.join(__dirname, "../artifacts/contracts/LoyaltyNFT.sol/LoyaltyNFT.json");
const outputPath = path.join(__dirname, "../frontend/abi/LoyaltyNFT.json");

const artifact = JSON.parse(fs.readFileSync(abiPath));
fs.writeFileSync(outputPath, JSON.stringify(artifact.abi, null, 2));

console.log("ABI exported to frontend!");
