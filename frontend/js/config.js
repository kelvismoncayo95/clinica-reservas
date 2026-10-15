// ============================================================
// config.js - Configuracion base y helpers del frontend
// ============================================================

// URL base de la API. Cambiar si el backend corre en otro host/puerto.
// Desde la PC (localhost): http://localhost:8000/api/v1
// Desde el iPhone (Tailscale): http://100.127.30.91:8000/api/v1
const API_BASE = (() => {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:8000/api/v1";
  }
  return `http://${host}:8000/api/v1`;
})();


// ----- Manejo del token JWT -----

const TOKEN_KEY = "clinica_token";
const USER_KEY = "clinica_user";


function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}


function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}


function getCurrentUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}


function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}


// ----- Fetch con auth automatica -----

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  // 401: token invalido o vencido, cerrar sesion
  if (response.status === 401) {
    clearSession();
    if (!window.location.pathname.endsWith("index.html") && window.location.pathname !== "/") {
      window.location.href = "index.html";
    }
    throw new Error("Sesion vencida. Inicia sesion de nuevo.");
  }

  // Sin contenido (204)
  if (response.status === 204) {
    return null;
  }

  // Parsear JSON
  let data = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  }

  // Error HTTP: lanzar con el mensaje del backend
  if (!response.ok) {
    const message =
      (data && data.detail) ||
      `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return data;
}


// ----- Notificaciones simples -----

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-visible");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}


// ----- Helpers de formato -----

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}


function formatTime(timeStr) {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);  // "10:00:00" -> "10:00"
}


function getDayName(dayOfWeek) {
  const days = [
    "Lunes", "Martes", "Miercoles", "Jueves",
    "Viernes", "Sabado", "Domingo",
  ];
  return days[dayOfWeek] || "Desconocido";
}


// ----- Guardia de sesion -----

function requireAuth() {
  if (!getToken()) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}


function requireRole(...roles) {
  const user = getCurrentUser();
  if (!user || !roles.includes(user.role)) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}


function logout() {
  clearSession();
  window.location.href = "index.html";
}


function formatDateTime(isoStr) {
  // Convierte ISO 8601 (ej: "2026-10-15T19:51:35.603467+00:00") a "15/10/2026 16:51" (local)
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const anio = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dia}/${mes}/${anio} ${hora}:${min}`;
  } catch {
    return isoStr;
  }
}