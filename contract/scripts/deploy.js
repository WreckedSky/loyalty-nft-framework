async function main() {
    const [deployer] = await ethers.getSigners();
    const NFT = await ethers.getContractFactory("LoyaltyNFT");
    const nft = await NFT.deploy();
    await nft.waitForDeployment();
    const address = await nft.getAddress();
    
    console.log("Contract deployed to:", address);
  }
  main();