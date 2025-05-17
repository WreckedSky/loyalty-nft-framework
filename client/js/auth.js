const API_BASE = 'http://localhost:4000';

async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const wallet = document.getElementById('wallet')?.value;

  // Check if this is a login or signup page
  const isLogin = !document.getElementById('wallet');
  
  const endpoint = isLogin 
    ? '/api/auth/login' 
    : '/api/auth/signup';

  const res = await fetch(API_BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, wallet }),
  });
  
  const data = await res.json();
  
  if (res.ok) {
    // Store token for login responses
    if (data.token) {
      sessionStorage.setItem('token', data.token);
    }
    
    // Redirect based on page type and user role
    if (isLogin) {
      // For login, check role
      if (data.role === 'admin') {
        window.location = 'admin-dashboard.html';
      } else {
        window.location = 'dashboard.html';
      }
    } else {
      // For signup, always go to user dashboard
      window.location = 'dashboard.html';
    }
  } else {
    alert(data.error || 'An error occurred');
  }
}

// Fixed event listener to include admin-login-form
const form = document.getElementById('signup-form') || 
             document.getElementById('login-form') || 
             document.getElementById('admin-login-form');
form?.addEventListener('submit', handleAuth);