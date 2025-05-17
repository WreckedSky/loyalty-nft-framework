const express = require('express');
const jwt = require('jsonwebtoken');
const Request = require('../models/Request');
const User = require('../models/User');
const { contract, web3, adminAccount } = require('../utils/web3');
require('dotenv').config({ path: '../../.env' });

const router = express.Router();

// Middleware to auth admin
const authAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const { id, role } = jwt.verify(token, process.env.JWT_SECRET);
    if (role !== 'admin') throw Error();
    req.adminId = id;
    next();
  } catch {
    res.status(403).json({ error: 'Forbidden' });
  }
};

// Fetch pending requests
router.get('/requests/:type', authAdmin, async (req, res) => {
  const { type } = req.params;
  const list = await Request.find({ type, status: 'pending' }).populate('user', 'email wallet');
  res.json(list);
});

// Approve
router.post('/approve', authAdmin, async (req, res) => {
  try {
    const { requestId } = req.body;
    const reqDoc = await Request.findById(requestId).populate('user');
    
    if (!reqDoc) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (reqDoc.type === 'mint') {
      console.log('Processing mint request for user:', reqDoc.user.email);
      
      // Option 1: Direct mint to user (preferred method)
      const tx = contract.methods.mintNFT(reqDoc.user.wallet);
      const gas = await tx.estimateGas({ from: adminAccount.address });
      const gasPrice = await web3.eth.getGasPrice();
      const data = tx.encodeABI();
      console.log('Minting NFT directly to user:', reqDoc.user.wallet);

      // Fix BigInt calculations - convert to Number first or handle properly
      const estimatedGas = Number(gas);
      const bufferGas = Math.round(estimatedGas * 1.2); // 20% buffer

      const signedMint = await web3.eth.accounts.signTransaction({
        from: adminAccount.address,
        to: contract.options.address,
        data,
        gas: bufferGas,
        gasPrice: gasPrice.toString()
      }, adminAccount.privateKey);

      const mintReceipt = await web3.eth.sendSignedTransaction(signedMint.rawTransaction);
      console.log('Minted NFT tx:', mintReceipt.transactionHash);
      
      // The mapping is automatically updated in the mint function
      console.log('NFT minted and mapping updated for user wallet:', reqDoc.user.wallet);
    }
    else if (reqDoc.type === 'payment') {
      console.log('Processing payment request for user:', reqDoc.user.email);
      
      try {
        // First try to get the token ID from the mapping
        const tokenId = await contract.methods.walletToToken(reqDoc.user.wallet).call();
        console.log('Token ID from mapping:', tokenId);
        
        if (!tokenId || Number(tokenId) === 0) {
          // If mapping fails, we need to find the token a different way
          console.log('No token mapping found, attempting to fix...');
          
          // Use a loop to find the token by ownership
          const maxTokenId = await contract.methods.tokenCounter().call();
          let userTokenId = null;
          
          for (let i = Number(maxTokenId) - 1; i > 0; i--) {
            try {
              const owner = await contract.methods.ownerOf(i).call();
              if (owner.toLowerCase() === reqDoc.user.wallet.toLowerCase()) {
                userTokenId = i;
                console.log(`Found token ${i} owned by user`);
                break;
              }
            } catch (err) {
              // Token might not exist, continue searching
            }
          }
          
          if (userTokenId) {
            // Fix the mapping using our helper function
            console.log('Fixing token mapping for wallet...');
            const fixTx = contract.methods.fixWalletToTokenMapping(reqDoc.user.wallet, userTokenId);
            const fixGas = await fixTx.estimateGas({ from: adminAccount.address });
            const fixData = fixTx.encodeABI();
            const fixGasPrice = await web3.eth.getGasPrice();
            
            const signedFix = await web3.eth.accounts.signTransaction({
              from: adminAccount.address,
              to: contract.options.address,
              data: fixData,
              gas: Math.round(Number(fixGas) * 1.2), // Convert to Number before multiplication
              gasPrice: fixGasPrice.toString() // Convert BigInt to string
            }, adminAccount.privateKey);
            
            const fixReceipt = await web3.eth.sendSignedTransaction(signedFix.rawTransaction);
            console.log('Fixed wallet mapping tx:', fixReceipt.transactionHash);
            
            // Now we can use this token ID
            console.log(`Adding ${reqDoc.amount} points to token ${userTokenId}`);
            const pointsTx = contract.methods.addPointsToNFT(userTokenId, reqDoc.amount);
            const pointsGas = await pointsTx.estimateGas({ from: adminAccount.address });
            const pointsData = pointsTx.encodeABI();
            const pointsGasPrice = await web3.eth.getGasPrice();
            
            const signedPoints = await web3.eth.accounts.signTransaction({
              from: adminAccount.address,
              to: contract.options.address,
              data: pointsData,
              gas: Math.round(Number(pointsGas) * 1.2), // Convert to Number
              gasPrice: pointsGasPrice.toString() // Convert to string
            }, adminAccount.privateKey);
            
            const pointsReceipt = await web3.eth.sendSignedTransaction(signedPoints.rawTransaction);
            console.log('Added points tx:', pointsReceipt.transactionHash);
          } else {
            throw new Error('Could not find a token owned by this user');
          }
        } else {
          // If we have a valid token ID, add points directly
          console.log(`Adding ${reqDoc.amount} points to token ${tokenId}`);
          const tx = contract.methods.addPointsToNFT(Number(tokenId), reqDoc.amount);
          const gas = await tx.estimateGas({ from: adminAccount.address });
          const gasPrice = await web3.eth.getGasPrice();
          const data = tx.encodeABI();

          const signed = await web3.eth.accounts.signTransaction({ 
            from: adminAccount.address,
            to: contract.options.address, 
            data, 
            gas: Math.round(Number(gas) * 1.2), // Convert to Number
            gasPrice: gasPrice.toString() // Convert to string
          }, adminAccount.privateKey);

          const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
          console.log('Added points tx:', receipt.transactionHash);
        }
      } catch (error) {
        console.error('Error processing payment request:', error);
        return res.status(500).json({ error: `Failed to process payment: ${error.message}` });
      }
    }

    reqDoc.status = 'approved';
    await reqDoc.save();
    res.json({ message: 'Approved' });
  } catch (error) {
    console.error('Error in approval process:', error);
    res.status(500).json({ error: `Approval failed: ${error.message}` });
  }
});

// Reject
router.post('/reject', authAdmin, async (req, res) => {
  await Request.findByIdAndUpdate(req.body.requestId, { status: 'rejected' });
  res.json({ message: 'Rejected' });
});

module.exports = router;