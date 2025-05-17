require('dotenv').config(); 

const express = require('express');
const jwt = require('jsonwebtoken');
const Request = require('../models/Request');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');

const router = express.Router();

// Middleware to auth user
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const { id, role } = jwt.verify(token, process.env.JWT_SECRET);
    if (role !== 'user') throw Error();
    req.userId = id;
    next();
  } catch {
    res.status(403).json({ error: 'Forbidden' });
  }
};

// Mint request
router.post('/request-mint', auth, async (req, res) => {
  const { amount } = req.body; // amount unused for mint
  const reqDoc = await Request.create({ type: 'mint', user: req.userId });
  res.json({ message: 'Mint request sent' });
});

// Create Stripe Checkout Session
router.post('/create-checkout', auth, async (req, res) => {
  const { amount } = req.body;
  
  // Use environment variables but with session_id parameter for tracking
  const success_url = `${process.env.SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`;
  const cancel_url = process.env.CANCEL_URL;
  
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ 
        price_data: { 
          currency: 'usd', 
          product_data: { name: 'Loyalty Points' }, 
          unit_amount: amount * 100 
        }, 
        quantity: 1 
      }],
      mode: 'payment',
      success_url: success_url,
      cancel_url: cancel_url,
      client_reference_id: req.userId, // Add this to identify the user in webhooks
      metadata: {
        userId: req.userId
      }
    });
    console.log('Stripe session created:', session.id);
    console.log('Stripe session URL:', session.url);
    console.log('Stripe session success URL:', success_url);
    console.log('Stripe session cancel URL:', cancel_url);  
    console.log('Stripe session metadata:', session.metadata);
    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook to capture successful payment
router.post('/webhook', 
  // Use raw body parser for Stripe webhooks
  express.raw({type: 'application/json'}),
  async (req, res) => {
    console.log('Webhook triggered');
    const sig = req.headers['stripe-signature'];
    
    let event;
    
    try {
      // Get the raw body as a buffer
      const payload = req.body;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      // Verify webhook signature if secret is available
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
        console.log('Webhook signature verified');
      } else {
        // Development mode - parse the body without verification
        event = JSON.parse(payload.toString());
        console.log('Webhook received without verification (dev mode)');
      }
      
      console.log('Webhook event type:', event.type);
      
      // Handle the checkout.session.completed event
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log('Payment completed session:', session);
        
        try {
          // Get user ID from metadata or client reference
          const userId = session.client_reference_id || session.metadata?.userId;
          
          if (!userId) {
            console.error('No user ID found in webhook payload');
            return res.status(400).json({ error: 'No user ID in session' });
          }
          
          // Convert amount from cents to dollars
          const amountUsd = session.amount_total / 100;
          
          console.log(`Creating payment request for user ${userId} with amount $${amountUsd}`);
          
          const reqDoc = await Request.create({
            type: 'payment',
            user: userId,
            amount: amountUsd,
            status: 'pending'
          });
          
          console.log('Payment request created successfully:', reqDoc._id);
        } catch (error) {
          console.error('Failed to create payment request:', error);
          // Still return 200 to Stripe so they don't retry
        }
      }
      
      // Return success
      res.status(200).json({ received: true });
    } catch (err) { 
      console.error('Webhook error:', err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// New endpoint to check if user has NFT and get NFT details
router.get('/nft-status', auth, async (req, res) => {
  console.log('NFT status check requested for user:', req.userId);
  try {
    const { web3, contract } = require('../utils/web3');
    console.log('Web3 initialized, contract address:', process.env.CONTRACT_ADDRESS);
    const User = require('../models/User');
    
    // Get user from DB to get wallet address
    const user = await User.findById(req.userId);
    console.log('Found user in DB:', user ? 'yes' : 'no');
    
    if (!user || !user.wallet) {
      console.log('No wallet found for user');
      return res.status(400).json({ error: 'No wallet associated with this account' });
    }
    
    console.log('User wallet:', user.wallet);
    
    // First check if the user owns any NFT using balanceOf
    const balance = await contract.methods.balanceOf(user.wallet).call();
    console.log('User NFT balance:', balance);
    
    if (balance && Number(balance) > 0) {
      // User has at least one NFT
      
      try {
        // Use advanced approach: find token by ownership
        console.log('Finding token owned by the user...');
        
        // Get the owner's token using ownerOf by checking tokenIds
        // Start from the most recent tokens (assuming tokenCounter starts from 1)
        const maxTokenId = await contract.methods.tokenCounter().call();
        console.log('Maximum token ID (tokenCounter):', maxTokenId);
        
        let userTokenId = null;
        let tokenPoints = 0;
        
        // Search from newer tokens to older tokens (more likely to find quickly)
        for (let i = Number(maxTokenId) - 1; i > 0; i--) {
          try {
            console.log(`Checking token ID ${i}...`);
            const ownerAddress = await contract.methods.ownerOf(i).call();
            
            if (ownerAddress.toLowerCase() === user.wallet.toLowerCase()) {
              userTokenId = i;
              // Get points for this token
              tokenPoints = await contract.methods.getPoints(userTokenId).call();
              console.log(`Found user's token: ${userTokenId} with ${tokenPoints} points`);
              break;
            }
          } catch (err) {
            // Token may not exist, continue searching
            console.log(`Token ${i} not found or error:`, err.message);
          }
        }
        
        if (userTokenId) {
          return res.json({
            hasNFT: true,
            tokenId: String(userTokenId),
            points: String(tokenPoints)
          });
        } else {
          // Fallback to returning basic information
          console.log('Could not find specific token ID despite positive balance');
          return res.json({
            hasNFT: true,
            balance: String(balance),
            message: "User has NFT(s) but specific token details could not be retrieved"
          });
        }
      } catch (error) {
        console.error('Error while searching for user token:', error);
        return res.json({
          hasNFT: true,
          balance: String(balance),
          message: "User has NFT(s) but specific token details could not be retrieved"
        });
      }
    } else {
      // User doesn't have NFT
      return res.json({ hasNFT: false });
    }
  } catch (error) {
    console.error('Error checking NFT status:', error);
    return res.status(500).json({ error: 'Failed to check NFT status: ' + error.message });
  }
});

// TEMPORARY - For testing only
router.post('/simulate-payment', auth, async (req, res) => {
  const { amount } = req.body;
  
  try {
    console.log(`Creating simulated payment request for user ${req.userId} with amount ${amount}`);
    
    const reqDoc = await Request.create({
      type: 'payment',
      user: req.userId,
      amount: Number(amount),
      status: 'pending'
    });
    
    console.log('Payment request created successfully:', reqDoc._id);
    res.json({ success: true, message: 'Payment request created', requestId: reqDoc._id });
  } catch (error) {
    console.error('Failed to create payment request:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;