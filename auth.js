const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

function showApp() {
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  if (typeof loadSongs === 'function') loadSongs();
}

function showLogin() {
  appView.classList.add('hidden');
  loginView.classList.remove('hidden');
}

// On page load, check whether there's already a valid session
// (so refreshing the page doesn't log you out)
async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    showApp();
  } else {
    showLogin();
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    loginError.textContent = 'Login failed. Check your email and password.';
    return;
  }

  showApp();
});

logoutBtn.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  showLogin();
});

checkSession();
