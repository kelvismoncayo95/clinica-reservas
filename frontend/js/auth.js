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
    throw new Error(error.detail || "No pudimos iniciar sesión. Intentá de nuevo en unos segundos.");
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
    throw new Error(error.detail || "No pudimos crear tu cuenta. Revisá los datos e intentá de nuevo.");
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
  if (user && getToken()) {
    redirectByRole(user.role);
  }
}
