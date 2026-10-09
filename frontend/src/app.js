// Frontend Application Logic for FoodApp Auth

// --- 1. Tab Navigation & State ---
function switchTab(tabName) {
  // Hide all tabs
  document.getElementById('registerTab').style.display = 'none';
  document.getElementById('loginTab').style.display = 'none';
  document.getElementById('workflowTab').style.display = 'none';

  // Remove active class from buttons
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  // Clear global alerts
  hideAlert();

  // Show selected tab
  if (tabName === 'register') {
    document.getElementById('registerTab').style.display = 'block';
    buttons[0].classList.add('active');
  } else if (tabName === 'login') {
    document.getElementById('loginTab').style.display = 'block';
    buttons[1].classList.add('active');
  } else if (tabName === 'workflow') {
    document.getElementById('workflowTab').style.display = 'block';
    buttons[2].classList.add('active');
    refreshSystemStatus(); // Auto fetch current Redis & DB state
  }
}

// --- 2. Alert Notifications ---
function showAlert(type, message) {
  const alertEl = document.getElementById('globalAlert');
  alertEl.className = `alert alert-${type}`;
  alertEl.innerHTML = message;
  alertEl.style.display = 'block';
  alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAlert() {
  const alertEl = document.getElementById('globalAlert');
  alertEl.style.display = 'none';
  alertEl.innerHTML = '';
}

// --- 3. Handle Registration ---
async function handleRegister(e) {
  e.preventDefault();
  hideAlert();

  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const submitBtn = document.getElementById('regSubmitBtn');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>⏳ Storing in Redis & Generating Link...</span>';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Registration failed.');
    }

    // Success: details temporarily cached in Redis
    showAlert('success', `🎉 <strong>Registration Successful!</strong> Verification link created and details saved temporarily in <strong>Redis (TTL: 15 mins)</strong>.`);

    // Display simulation verification card
    const resultBox = document.getElementById('regResultBox');
    const simLink = document.getElementById('simulatedVerifyLink');
    const directBtn = document.getElementById('directVerifyBtn');

    simLink.href = data.verificationUrl;
    simLink.textContent = data.verificationUrl;
    directBtn.href = data.verificationUrl;
    resultBox.style.display = 'block';

    // Clear password input for security
    document.getElementById('regPassword').value = '';
  } catch (err) {
    showAlert('error', `❌ ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Create Account & Send Verification Link</span>';
  }
}

// --- 4. Handle Login ---
async function handleLogin(e) {
  e.preventDefault();
  hideAlert();

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const submitBtn = document.getElementById('loginSubmitBtn');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>⏳ Checking PostgreSQL credentials...</span>';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.pendingVerification) {
        showAlert('warning', `⚠️ <strong>Verification Required:</strong> ${data.error}`);
      } else {
        showAlert('error', `❌ ${data.error || 'Login failed.'}`);
      }
      return;
    }

    // Store token in browser storage
    localStorage.setItem('auth_token', data.token);

    // Show Dashboard
    showDashboard(data.user);
    showAlert('success', `👋 Welcome back, <strong>${data.user.name}</strong>! You logged in successfully.`);
  } catch (err) {
    showAlert('error', `❌ Network error: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Log In</span>';
  }
}

// --- 5. Dashboard State & Session Management ---
function showDashboard(user) {
  document.getElementById('loginFormContainer').style.display = 'none';
  document.getElementById('dashboardContainer').style.display = 'block';

  document.getElementById('dashGreeting').textContent = `Hello, ${user.name}! 👋`;
  document.getElementById('dashUserId').textContent = user.id;
  document.getElementById('dashName').textContent = user.name;
  document.getElementById('dashEmail').textContent = user.email;
  document.getElementById('dashDate').textContent = user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Just now';
}

function handleLogout() {
  localStorage.removeItem('auth_token');
  document.getElementById('dashboardContainer').style.display = 'none';
  document.getElementById('loginFormContainer').style.display = 'block';
  document.getElementById('loginPassword').value = '';
  showAlert('info', 'ℹ️ You have logged out successfully.');
}

async function checkSession() {
  const token = localStorage.getItem('auth_token');
  if (!token) return;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      showDashboard(data.user);
    } else {
      localStorage.removeItem('auth_token');
    }
  } catch (e) {
    // Session check failed, stay in login form
  }
}

// --- 6. Live Architecture & Redis Inspector ---
async function refreshSystemStatus() {
  const display = document.getElementById('inspectorDisplay');
  display.textContent = 'Fetching current Redis and PostgreSQL status...';

  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    display.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    display.textContent = `Error inspecting status: ${err.message}`;
  }
}

// Check session on page load
window.addEventListener('DOMContentLoaded', () => {
  checkSession();
});
