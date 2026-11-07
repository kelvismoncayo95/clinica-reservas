// ============================================================
// reset-password.js - "Olvidé mi contraseña"
//
// La misma página tiene dos pasos:
//  - Sin ?token en la URL: el usuario pide el enlace por correo.
//  - Con ?token=... (viene del correo): elige la contraseña nueva.
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const token = new URLSearchParams(window.location.search).get("token");
  if (token) {
    document.getElementById("seccion-cambiar").hidden = false;
    document.getElementById("form-cambiar").addEventListener("submit", (e) => onCambiar(e, token));
  } else {
    document.getElementById("seccion-pedir").hidden = false;
    document.getElementById("form-pedir").addEventListener("submit", onPedir);
  }
});


async function postJSON(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Hiciste muchos intentos seguidos. Esperá un minuto y probá de nuevo.");
    }
    const detail = typeof data.detail === "string" ? data.detail : null;
    throw new Error(detail || "Algo salió mal. Intentá de nuevo en unos segundos.");
  }
  return data;
}


function mostrarMensaje(texto) {
  document.getElementById("seccion-pedir").hidden = true;
  document.getElementById("seccion-cambiar").hidden = true;
  document.getElementById("mensaje-texto").textContent = texto;
  document.getElementById("seccion-mensaje").hidden = false;
}


function mostrarError(id, texto) {
  const el = document.getElementById(id);
  el.textContent = texto;
  el.hidden = !texto;
}


async function onPedir(e) {
  e.preventDefault();
  mostrarError("forgot-email-error", "");
  mostrarError("forgot-error", "");

  const email = document.getElementById("forgot-email").value.trim();
  if (!email.includes("@") || !email.includes(".")) {
    mostrarError("forgot-email-error", "Escribí un correo válido (ejemplo: nombre@dominio.com).");
    return;
  }

  const boton = document.getElementById("forgot-submit");
  boton.disabled = true;
  boton.textContent = "Enviando...";
  try {
    const data = await postJSON("/auth/forgot-password", { email });
    mostrarMensaje(`${data.message} Revisá tu bandeja de entrada (y la carpeta de spam).`);
  } catch (err) {
    mostrarError("forgot-error", err.message);
  } finally {
    boton.disabled = false;
    boton.textContent = "Enviarme el enlace";
  }
}


async function onCambiar(e, token) {
  e.preventDefault();
  mostrarError("reset-password-error", "");
  mostrarError("reset-password-confirm-error", "");
  mostrarError("reset-error", "");

  const password = document.getElementById("reset-password").value;
  const confirmacion = document.getElementById("reset-password-confirm").value;
  if (password.length < 8) {
    mostrarError("reset-password-error", "La contraseña debe tener al menos 8 caracteres.");
    return;
  }
  if (password !== confirmacion) {
    mostrarError("reset-password-confirm-error", "Las contraseñas no coinciden.");
    return;
  }

  const boton = document.getElementById("reset-submit");
  boton.disabled = true;
  boton.textContent = "Guardando...";
  try {
    const data = await postJSON("/auth/reset-password", { token, new_password: password });
    // Sacamos el token de la URL para que no quede en el historial
    window.history.replaceState({}, "", "reset-password.html");
    mostrarMensaje(data.message);
  } catch (err) {
    mostrarError("reset-error", err.message);
  } finally {
    boton.disabled = false;
    boton.textContent = "Guardar contraseña nueva";
  }
}
