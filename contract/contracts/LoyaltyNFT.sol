// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LoyaltyNFT is ERC721, Ownable {
    uint256 public tokenCounter;
    mapping(uint256 => uint256) public points;
    mapping(address => uint256) public walletToToken;
    
    // Add event for token transfers for off-chain tracking
    event TokenTransferred(address indexed from, address indexed to, uint256 indexed tokenId);

    constructor() ERC721("LoyaltyNFT", "LNFT") {
        tokenCounter = 1;
    }

    function mintNFT(address to) public onlyOwner returns (uint256) {
        uint256 tokenId = tokenCounter;
        _mint(to, tokenId);
        walletToToken[to] = tokenId;
        tokenCounter++;
        return tokenId;
    }

    function addPointsToNFT(uint256 tokenId, uint256 _points) public onlyOwner {
        require(_exists(tokenId), "Token doesn't exist");
        points[tokenId] += _points;
    }

    function _exists(uint256 tokenId) internal view override returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function getPoints(uint256 tokenId) public view returns (uint256) {
        require(_exists(tokenId), "Token doesn't exist");
        return points[tokenId];
    }

    function getUserToken(address wallet) public view returns (uint256) {
        uint256 tokenId = walletToToken[wallet];
        require(tokenId > 0, "No token associated with this wallet");
        return tokenId;
    }

    // Instead of overriding _transfer, use a new function to update mappings
    function safeTransferWithMapping(
        address from,
        address to,
        uint256 tokenId
    ) public {
        // First perform the transfer
        safeTransferFrom(from, to, tokenId);
        
        // Then update our mappings
        updateTokenMapping(from, to, tokenId);
    }

    function transferWithMapping(
        address from,
        address to,
        uint256 tokenId
    ) public {
        // First perform the transfer
        transferFrom(from, to, tokenId);
        
        // Then update our mappings
        updateTokenMapping(from, to, tokenId);
    }
    
    // Helper function to update mappings
    function updateTokenMapping(address from, address to, uint256 tokenId) internal {
        if (from != address(0)) {
            walletToToken[from] = 0; // Clear previous owner's mapping
        }
        walletToToken[to] = tokenId; // Set new owner's mapping
        
        emit TokenTransferred(from, to, tokenId);
    }
    
    // Add a function to manually fix wallet mappings when needed
    function fixWalletToTokenMapping(address wallet, uint256 tokenId) public onlyOwner {
        require(_exists(tokenId), "Token doesn't exist");
        require(_ownerOf(tokenId) == wallet, "Wallet is not the owner of token");
        walletToToken[wallet] = tokenId;
    }
    
    // Hook into ERC721 _beforeTokenTransfer (which is virtual)
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
        
        // Update our mapping when tokens transfer
        // Skip during minting (from == address(0)) as mintNFT already handles this
        if (from != address(0)) {
            walletToToken[from] = 0; // Clear previous owner's mapping
        }
        
        // Always update the recipient's mapping
        if (to != address(0)) { // Skip during burning
            walletToToken[to] = firstTokenId;
        }
    }
}