console.log('User.js script loaded');

const USER_API = 'http://localhost:4000/api/user';

// Function to check if user has an NFT
async function checkNFTStatus() {
  console.log('Checking NFT status...');
  try {
    const token = sessionStorage.getItem('token');
    console.log('Token:', token?.substring(0, 10) + '...');
    
    if (!token) {
      document.getElementById('nft-message').textContent = 'Please log in to view NFT status';
      return;
    }

    console.log('Making fetch request to:', `${USER_API}/nft-status`);
    const response = await fetch(`${USER_API}/nft-status`, {
      headers: { 
        'Authorization': `Bearer ${token}` 
      }
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Server error response:', error);
      throw new Error(error.error || 'Failed to check NFT status');
    }
    
    console.log('Response OK, parsing JSON');
    const data = await response.json();
    console.log('NFT status data:', data);
    
    updateNFTStatus(data);
  } catch (error) {
    console.error('NFT status check failed:', error);
    document.getElementById('nft-message').textContent = `Error checking NFT status: ${error.message}`;
  }
}

// Helper function to update UI based on NFT status
function updateNFTStatus(data) {
  console.log('Updating UI with NFT status:', data);
  
  const nftMessage = document.getElementById('nft-message');
  const nftDetails = document.getElementById('nft-details');
  const nftError = document.getElementById('nft-error');
  const errorMessage = document.getElementById('error-message');
  
  if (!nftMessage || !nftDetails) {
    console.error('Required DOM elements not found');
    return;
  }
  
  // Reset displays
  nftError.style.display = 'none';
  nftDetails.style.display = 'none';
  
  if (data.hasNFT) {
    console.log('User has NFT');
    nftMessage.textContent = 'You own a Loyalty NFT';
    
    if (data.tokenId) {
      // We have full details
      document.getElementById('token-id').textContent = data.tokenId;
      document.getElementById('token-points').textContent = data.points || '0';
      nftDetails.style.display = 'block';
    } else {
      // We only know they have NFT(s) but not details
      nftMessage.textContent = `You own ${data.balance} Loyalty NFT(s)`;
      
      // Add note about details if there's a message
      if (data.message) {
        nftError.style.display = 'block';
        errorMessage.textContent = data.message;
      }
    }
    
    // Hide mint button if user already has NFT
    document.getElementById('mint-btn').style.display = 'none';
  } else {
    console.log('User does not have NFT');
    nftMessage.textContent = 'You don\'t have a Loyalty NFT yet. Request one to start earning points!';
    nftDetails.style.display = 'none';
    // Show mint button
    document.getElementById('mint-btn').style.display = 'block';
  }
}

async function requestMint() {
  try {
    const token = sessionStorage.getItem('token');
    if (!token) {
      alert('You need to log in first');
      return;
    }

    const response = await fetch(`${USER_API}/request-mint`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({}),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to request mint');
    }
    
    const data = await response.json();
    console.log('Mint request successful:', data);
    alert('Mint requested successfully');
  } catch (error) {
    console.error('Mint request failed:', error);
    alert(`Error: ${error.message}`);
  }
}

async function makePayment() {
  try {
    const token = sessionStorage.getItem('token');
    if (!token) {
      alert('You need to log in first');
      return;
    }
    
    const amount = prompt('Enter amount in USD');
    if (!amount || isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    const response = await fetch(`${USER_API}/create-checkout`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ amount: Number(amount) }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create checkout');
    }
    
    const { url } = await response.json();
    window.location = url;
    console.log('Redirecting to payment URL:', url);
    console.log('Payment initiated successfully');
  } catch (error) {
    console.error('Payment failed:', error);
    alert(`Error: ${error.message}`);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM content loaded');
  
  // Check for payment status from session storage (set by success/cancel pages)
  const paymentStatus = sessionStorage.getItem('paymentStatus');
  if (paymentStatus) {
    if (paymentStatus === 'success') {
      alert('Payment successful! Your loyalty points will be added soon.');
      console.log('Payment successful');
    } else if (paymentStatus === 'canceled') {
      alert('Payment was canceled. No charges were made.');
    }
    console.log('Payment status:', paymentStatus);
    // Clear the status after showing the message
    sessionStorage.removeItem('paymentStatus');
  }
  
  // Remove the mock data and use the actual API
  checkNFTStatus();
  
  document.getElementById('mint-btn')?.addEventListener('click', requestMint);
  document.getElementById('pay-btn')?.addEventListener('click', makePayment);

  // For testing only - simulate successful payment
  document.getElementById('test-payment-btn')?.addEventListener('click', async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        alert('You need to log in first');
        return;
      }
      
      const amount = prompt('Enter simulated payment amount in USD');
      if (!amount || isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount');
        return;
      }
      
      const response = await fetch(`${USER_API}/simulate-payment`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      
      const data = await response.json();
      alert(`Payment simulation successful! Request ID: ${data.requestId}`);
      console.log('Payment simulation result:', data);
    } catch (error) {
      console.error('Simulation failed:', error);
      alert(`Error: ${error.message}`);
    }
  });
  
  // Add event listener for refresh button
  document.getElementById('refresh-btn')?.addEventListener('click', checkNFTStatus);
});