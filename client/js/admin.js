const ADMIN_API = 'http://localhost:4000/api/admin';
const token = sessionStorage.getItem('token');

// Check if token exists
if (!token) {
  alert('You must be logged in as admin');
  window.location.href = 'login.html';
}

async function loadRequests(type) {
  try {
    const res = await fetch(`${ADMIN_API}/requests/${type}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to load requests');
    }
    
    return res.json();
  } catch (error) {
    console.error(`Error loading ${type} requests:`, error);
    showError(`Failed to load ${type} requests: ${error.message}`);
    return [];
  }
}

function renderTable(data, tableId) {
  const tbody = document.getElementById(tableId).querySelector('tbody');
  tbody.innerHTML = '';
  
  if (!data || data.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" style="text-align: center; font-style: italic;">No pending requests</td>`;
    tbody.appendChild(tr);
    return;
  }
  
  data.forEach(req => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${req.user.email}</td>
      <td>${req.user.wallet}</td>
      ${req.amount ? `<td>$${req.amount}</td>` : '<td>N/A</td>'}
      <td>
        <button class="approve-btn" onclick="handleApprove('${req._id}', this)">Approve</button>
        <button class="reject-btn" onclick="handleReject('${req._id}', this)">Reject</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function handleApprove(id, buttonEl) {
  try {
    // Disable buttons and show loading state
    if (buttonEl) {
      const buttons = buttonEl.parentElement.querySelectorAll('button');
      buttons.forEach(btn => btn.disabled = true);
      buttonEl.textContent = 'Processing...';
    }
    
    console.log('Approving request:', id);
    const response = await fetch(`${ADMIN_API}/approve`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ requestId: id }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to approve request');
    }
    
    showMessage('Request approved successfully');
    await init(); // Refresh data
  } catch (error) {
    console.error('Error approving request:', error);
    showError(error.message);
    
    // Reset button state
    if (buttonEl) {
      const buttons = buttonEl.parentElement.querySelectorAll('button');
      buttons.forEach(btn => btn.disabled = false);
      buttonEl.textContent = 'Approve';
    }
  }
}

async function handleReject(id, buttonEl) {
  try {
    // Disable buttons and show loading state
    if (buttonEl) {
      const buttons = buttonEl.parentElement.querySelectorAll('button');
      buttons.forEach(btn => btn.disabled = true);
      buttonEl.textContent = 'Processing...';
    }
    
    const response = await fetch(`${ADMIN_API}/reject`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ requestId: id }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to reject request');
    }
    
    showMessage('Request rejected');
    await init(); // Refresh data
  } catch (error) {
    console.error('Error rejecting request:', error);
    showError(error.message);
    
    // Reset button state
    if (buttonEl) {
      const buttons = buttonEl.parentElement.querySelectorAll('button');
      buttons.forEach(btn => btn.disabled = false);
      buttonEl.textContent = 'Reject';
    }
  }
}

// Add utility functions for user feedback
function showMessage(message) {
  // Create or use existing message container
  let msgContainer = document.getElementById('message-container');
  if (!msgContainer) {
    msgContainer = document.createElement('div');
    msgContainer.id = 'message-container';
    msgContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 10px 20px; background-color: #4CAF50; color: white; border-radius: 5px; z-index: 1000;';
    document.body.appendChild(msgContainer);
  }
  
  msgContainer.textContent = message;
  msgContainer.style.display = 'block';
  
  // Hide after 3 seconds
  setTimeout(() => {
    msgContainer.style.display = 'none';
  }, 3000);
}

function showError(message) {
  // Create or use existing error container
  let errorContainer = document.getElementById('error-container');
  if (!errorContainer) {
    errorContainer = document.createElement('div');
    errorContainer.id = 'error-container';
    errorContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 10px 20px; background-color: #F44336; color: white; border-radius: 5px; z-index: 1000;';
    document.body.appendChild(errorContainer);
  }
  
  errorContainer.textContent = message;
  errorContainer.style.display = 'block';
  
  // Hide after 5 seconds
  setTimeout(() => {
    errorContainer.style.display = 'none';
  }, 5000);
}

// Add refresh button functionality
function addRefreshButton() {
  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = 'Refresh Data';
  refreshBtn.style.cssText = 'margin: 20px 0; padding: 10px 15px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;';
  refreshBtn.addEventListener('click', init);
  
  // Insert at the top of the body
  document.body.insertBefore(refreshBtn, document.body.firstChild);
}

async function init() {
  try {
    showMessage('Loading requests...');
    
    // Check if mint-table exists
    if (document.getElementById('mint-table')) {
      const mintRequests = await loadRequests('mint');
      renderTable(mintRequests, 'mint-table');
    }
    
    // Check if payment-table exists
    if (document.getElementById('payment-table')) {
      const paymentRequests = await loadRequests('payment');
      renderTable(paymentRequests, 'payment-table');
    }
  } catch (error) {
    console.error('Error initializing admin dashboard:', error);
    showError('Failed to load dashboard data');
  }
}

// When DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  addRefreshButton();
  init();
});