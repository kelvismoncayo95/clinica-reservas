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
    let message = `Error ${response.status}: ${response.statusText}`;
    if (data && data.detail) {
      if (typeof data.detail === "string") {
        // Caso normal: el backend devuelve un string
        message = data.detail;
      } else if (Array.isArray(data.detail)) {
        // Caso Pydantic: devuelve un array de errores de validación
        const primerError = data.detail[0];
        const campo = primerError.loc && primerError.loc[primerError.loc.length - 1];
        const msgOriginal = primerError.msg || "Error de validación";
        // Traducir mensajes comunes de Pydantic al español
        if (msgOriginal.includes("email")) {
          message = `El correo electrónico no tiene un formato válido.`;
        } else if (msgOriginal.includes("required") || msgOriginal.includes("Field required")) {
          message = `El campo "${campo}" es obligatorio.`;
        } else if (msgOriginal.includes("String should have at least")) {
          message = `El campo "${campo}" es demasiado corto.`;
        } else if (msgOriginal.includes("String should have at most")) {
          message = `El campo "${campo}" es demasiado largo.`;
        } else {
          message = `Error en "${campo}": ${msgOriginal}`;
        }
      } else {
        message = JSON.stringify(data.detail);
      }
    }
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
  // Convierte ISO 8601 (ej: "2026-10-15T19:51:35.603467+00:00" o "...Z")
  // a "15/10/2026 16:51" (local).
  // Safari en iOS no tolera 6 digitos de milisegundos, asi que los
  // normalizamos a 3 antes de parsear.
  if (!isoStr) return "";
  try {
    // Normalizar: reemplazar .NNNNNN por .NNN (3 digitos)
    const normalizado = isoStr.replace(/\.(\d{3})\d+/, ".$1");
    const d = new Date(normalizado);
    if (isNaN(d.getTime())) {
      return isoStr;
    }
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

// ----- Helpers de errores inline (para formularios de admin) -----

function setFieldError(fieldId, message) {
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
}


function clearFieldError(fieldId) {
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }
}


function clearAllErrors() {
  document.querySelectorAll(".form-error").forEach((el) => {
    el.textContent = "";
    el.hidden = true;
  });
}

// ============================================================
// FASE 7: Buscador con autocompletado (searchable select)
// ============================================================

function initSearchableSelect(inputId, items, onSelect) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  // Evitar inicializar dos veces el mismo input (memory leak de listeners)
  if (input.dataset.searchableInitialized === "true") {
    // Solo actualizar los items y el callback
    input._searchableItems = items;
    input._searchableOnSelect = onSelect;
    return;
  }
  input.dataset.searchableInitialized = "true";
  input._searchableItems = items;
  input._searchableOnSelect = onSelect;
  
  const container = input.closest(".searchable-select");
  const dropdown = container.querySelector(".searchable-dropdown");
  
  function renderOptions(filter = "") {
    const filtro = filter.toLowerCase().trim();
    const filtrados = items.filter((item) => {
      if (!filtro) return true;
      const enLabel = item.label.toLowerCase().includes(filtro);
      const enDetalle = item.detalle && item.detalle.toLowerCase().includes(filtro);
      return enLabel || enDetalle;
    });
    
    dropdown.innerHTML = "";
    
    if (filtrados.length === 0) {
      const empty = document.createElement("div");
      empty.className = "searchable-empty";
      empty.textContent = "No se encontraron resultados";
      dropdown.appendChild(empty);
    } else {
      filtrados.slice(0, 50).forEach((item) => {
        const option = document.createElement("div");
        option.className = "searchable-option";
        
        const label = document.createElement("div");
        label.textContent = item.label;
        option.appendChild(label);
        
        if (item.detalle) {
          const detalle = document.createElement("div");
          detalle.className = "option-detalle";
          detalle.textContent = item.detalle;
          option.appendChild(detalle);
        }
        
        option.addEventListener("click", () => {
          input.value = item.label;
          const hiddenId = container.querySelector("input[type=hidden]");
          if (hiddenId) hiddenId.value = item.value;
          dropdown.hidden = true;
          if (onSelect) onSelect(item);
        });
        
        dropdown.appendChild(option);
      });
    }
    
    dropdown.hidden = false;
  }
  
  input.addEventListener("focus", () => renderOptions(input.value));
  input.addEventListener("input", () => renderOptions(input.value));
  
  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      dropdown.hidden = true;
    }
  });
}


// ============================================================
// Modal de confirmación reutilizable
// ============================================================

function confirmDialog(titulo, mensaje, textoAceptar = "Confirmar") {
  return new Promise((resolve) => {
    const dialog = document.getElementById("modal-confirm");
    if (!dialog) {
      // Si no existe, usar confirm() nativo como fallback
      resolve(window.confirm(mensaje));
      return;
    }

    document.getElementById("modal-confirm-titulo").textContent = titulo;
    document.getElementById("modal-confirm-mensaje").textContent = mensaje;
    document.getElementById("modal-confirm-aceptar").textContent = textoAceptar;

    const cerrar = (resultado) => {
      dialog.close();
      resolve(resultado);
    };

    // Remover listeners viejos clonando los botones
    const btnAceptar = document.getElementById("modal-confirm-aceptar");
    const btnCancelar = document.getElementById("modal-confirm-cancelar");
    const btnCerrar = document.getElementById("modal-confirm-cerrar");
    const nuevoAceptar = btnAceptar.cloneNode(true);
    const nuevoCancelar = btnCancelar.cloneNode(true);
    const nuevoCerrar = btnCerrar.cloneNode(true);
    btnAceptar.replaceWith(nuevoAceptar);
    btnCancelar.replaceWith(nuevoCancelar);
    btnCerrar.replaceWith(nuevoCerrar);

    nuevoAceptar.addEventListener("click", () => cerrar(true));
    nuevoCancelar.addEventListener("click", () => cerrar(false));
    nuevoCerrar.addEventListener("click", () => cerrar(false));

    dialog.showModal();
  });
}


// ============================================================
// FASE 10: Limpiar mensajes de error al cambiar opciones
// ============================================================

function limpiarErrorFormulario(errorId) {
  const errorEl = document.getElementById(errorId);
  if (errorEl) errorEl.hidden = true;
}


// ============================================================
// FASE 10: Mensajes de error legibles (Pydantic y genéricos)
// ============================================================

function mensajeDeError(data, status) {
  const d = data && data.detail;
  
  // Caso 1: string directo
  if (typeof d === "string") return d;
  
  // Caso 2: array de errores de Pydantic
  if (Array.isArray(d)) {
    const mensajes = d.map((e) => {
      const campo = e.loc && e.loc[e.loc.length - 1];
      const msg = e.msg || "Dato inválido";
      
      // Traducir mensajes comunes
      if (msg.includes("Field required")) return `Falta completar: ${campo}`;
      if (msg.includes("email")) return "El correo no tiene un formato válido";
      if (msg.includes("String should have at most")) {
        const max = msg.match(/\d+/)?.[0] || "?";
        return `El campo ${campo} es demasiado largo (máximo ${max} caracteres)`;
      }
      if (msg.includes("String should have at least")) {
        const min = msg.match(/\d+/)?.[0] || "?";
        return `El campo ${campo} es demasiado corto (mínimo ${min} caracteres)`;
      }
      if (msg.includes("al menos 18 años")) {
        return "Tenés que tener al menos 18 años para registrarte";
      }
      if (msg.includes("dominio del correo")) {
        return "El correo no tiene un formato válido (ej: nombre@dominio.com)";
      }
      if (msg.includes("La cédula solo puede tener números")) {
        return "La cédula solo puede tener números (7 u 8 dígitos)";
      }
      if (msg.includes("El nombre solo puede tener letras")) {
        return "El nombre solo puede tener letras y espacios";
      }
      if (msg.includes("El teléfono solo puede tener")) {
        return "El teléfono solo puede tener números, espacios, guiones o +";
      }
      if (msg.includes("value is not a valid email")) return "El correo no tiene un formato válido";
      if (msg.includes("value is not a valid date")) return `La fecha de ${campo} no es válida`;
      if (msg.includes("value is not a valid integer")) return `El campo ${campo} debe ser un número`;
      
      return msg;
    });
    return mensajes.join(". ");
  }
  
  // Caso 3: objeto con mensaje
  if (d && typeof d === "object" && d.msg) return d.msg;
  
  // Caso 4: fallback
  return `Error ${status || ""}`.trim();
}


// ============================================================
// FASE 10: Iconos del menu lateral (SVG inline)
// ============================================================

const ICONOS = {
  inicio: '<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-6h6v6"/>',
  citas: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  ausencias: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0"/>',
  pacientes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/>',
  medicos: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  especialidades: '<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 13 9 5 9-5"/>',
  horarios: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  usuarios: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  "mis-citas": '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  "notificar-ausencia": '<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0"/>',
  reservar: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
};

function aplicarIconosMenu() {
  document.querySelectorAll(".nav-item").forEach((boton) => {
    if (boton.querySelector(".icono")) return;  // ya tiene icono
    const clave = boton.id.replace("nav-", "");
    const trazo = ICONOS[clave];
    if (trazo) {
      boton.insertAdjacentHTML(
        "afterbegin",
        `<svg class="icono" viewBox="0 0 24 24" aria-hidden="true">${trazo}</svg>`
      );
    }
  });
}

document.addEventListener("DOMContentLoaded", aplicarIconosMenu);


// ============================================================
// FASE 10: Badge de ausencias pendientes en el menu
// ============================================================

async function actualizarBadgeAusencias() {
  const badge = document.getElementById("nav-ausencias-badge");
  if (!badge) return;

  try {
    const ausencias = await apiFetch("/absences?status_filter=pending");
    const total = Array.isArray(ausencias) ? ausencias.length : 0;
    if (total > 0) {
      badge.textContent = total;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  } catch (err) {
    // Silencioso: si falla la consulta, no mostramos badge
    badge.hidden = true;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("nav-ausencias")) {
    actualizarBadgeAusencias();
  }
});
