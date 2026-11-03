// ============================================================
// auth.js - Login y registro
// ============================================================

// ----- Login -----

async function login(email, password) {
  // El endpoint usa form-data (OAuth2), no JSON
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 401) {
      throw new Error("El correo o la contraseña no son correctos. Revisalos e intentá de nuevo.");
    }
    throw new Error(mensajeDeError(error, response.status) || "No pudimos iniciar sesión. Intentá de nuevo en unos segundos.");
  }

  const data = await response.json();
  return data.access_token;
}


// ----- Registro de paciente -----

async function register(data) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(mensajeDeError(error, response.status) || "No pudimos crear tu cuenta. Revisá los datos e intentá de nuevo.");
  }

  return response.json();
}


// ----- Obtener datos del usuario logueado -----

async function fetchCurrentUser() {
  return apiFetch("/auth/me");
}


// ----- Redirigir según el rol -----

function redirectByRole(role) {
  const destinos = {
    admin: "admin.html",
    reception: "admin.html",
    doctor: "doctor.html",
    patient: "patient.html",
  };
  window.location.href = destinos[role] || "index.html";
}


// ----- Si ya hay sesión activa, redirigir al panel -----

function redirectIfLoggedIn() {
  const user = getCurrentUser();
  const token = getToken();
  
  if (!user || !token) {
    clearSession();
    return;
  }
  
  // Validamos el token contra el backend antes de redirigir
  apiFetch('/auth/me')
    .then(() => {
      if (user.role === 'admin' || user.role === 'reception') {
        window.location.href = 'admin.html';
      } else if (user.role === 'doctor') {
        window.location.href = 'doctor.html';
      } else if (user.role === 'patient') {
        window.location.href = 'patient.html';
      }
    })
    .catch(() => {
      clearSession();
      console.log('Sesion expirada o invalida. Por favor, inicia sesion de nuevo.');
    });
}
