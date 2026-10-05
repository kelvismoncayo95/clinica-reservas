// ============================================================
// usuarios-admin.js - Seccion de usuarios
// ============================================================

const usuariosState = {
  users: [],
  filtered: [],
  editingId: null,
};

const ROLES_LABEL = {
  admin: "Administrador",
  reception: "Recepción",
  doctor: "Médico",
  patient: "Paciente",
};


document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("section-usuarios")) return;
  setupUsuariosSection();
});


function setupUsuariosSection() {
  document.getElementById("buscar-usuario").addEventListener("input", onBuscarUsuario);
  document.getElementById("btn-nuevo-usuario").addEventListener("click", () => abrirModalUsuario());
  document.getElementById("modal-usuario-cerrar").addEventListener("click", cerrarModalUsuario);
  document.getElementById("usu-cancelar").addEventListener("click", cerrarModalUsuario);
  document.getElementById("form-usuario").addEventListener("submit", onUsuarioSubmit);
  document.getElementById("modal-usuario").addEventListener("click", (e) => {
    if (e.target.id === "modal-usuario") cerrarModalUsuario();
  });
  document.getElementById("nav-usuarios").addEventListener("click", cargarUsuariosSiEsNecesario);
}


let usuariosCargados = false;

async function cargarUsuariosSiEsNecesario() {
  if (usuariosCargados) return;
  await cargarUsuarios();
  usuariosCargados = true;
}


async function cargarUsuarios() {
  const loading = document.getElementById("usuarios-loading");
  const empty = document.getElementById("usuarios-empty");
  const list = document.getElementById("usuarios-list");
  loading.hidden = false;
  empty.hidden = true;
  list.hidden = true;
  list.innerHTML = "";
  try {
    usuariosState.users = await apiFetch("/users");
    usuariosState.filtered = usuariosState.users.slice();
    loading.hidden = true;
    renderUsuarios();
  } catch (err) {
    loading.hidden = true;
    empty.hidden = false;
    showToast("No pudimos cargar los usuarios.", "error");
  }
}


function onBuscarUsuario(e) {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    usuariosState.filtered = usuariosState.users.slice();
  } else {
    usuariosState.filtered = usuariosState.users.filter((u) => {
      return u.email.toLowerCase().includes(q);
    });
  }
  renderUsuarios();
}


function renderUsuarios() {
  const empty = document.getElementById("usuarios-empty");
  const list = document.getElementById("usuarios-list");
  list.innerHTML = "";
  if (usuariosState.filtered.length === 0) {
    empty.hidden = false;
    list.hidden = true;
    return;
  }
  empty.hidden = true;
  list.hidden = false;
  usuariosState.filtered.forEach((u) => list.appendChild(renderUsuario(u)));
}


function renderUsuario(u) {
  const card = document.createElement("article");
  card.className = "cita-card";
  const rol = ROLES_LABEL[u.role] || u.role;
  const estado = u.activo ? "Activo" : "Inactivo";
  card.innerHTML = `
    <div class="cita-info">
      <p class="cita-fecha">${u.email}</p>
      <p class="cita-detalle">${rol}</p>
      <p class="cita-estado">${estado}</p>
    </div>
  `;
  const acciones = document.createElement("div");
  acciones.className = "cita-acciones";
  const btnEditar = document.createElement("button");
  btnEditar.type = "button";
  btnEditar.className = "btn btn-sm";
  btnEditar.textContent = "Editar";
  btnEditar.addEventListener("click", () => abrirModalUsuario(u));
  acciones.appendChild(btnEditar);
  if (u.activo) {
    const btnDesactivar = document.createElement("button");
    btnDesactivar.type = "button";
    btnDesactivar.className = "btn btn-peligro btn-sm";
    btnDesactivar.textContent = "Desactivar";
    btnDesactivar.addEventListener("click", () => desactivarUsuario(u));
    acciones.appendChild(btnDesactivar);
  }
  card.appendChild(acciones);
  return card;
}


// ----- Modal de usuario -----

function abrirModalUsuario(user = null) {
  usuariosState.editingId = user ? user.id : null;
  const titulo = document.getElementById("modal-usuario-titulo");
  const submit = document.getElementById("usu-submit");
  const roleGroup = document.getElementById("usu-role-group");
  const passwordGroup = document.getElementById("usu-password-group");
  const passwordHelp = document.getElementById("usu-password-help");

  document.getElementById("form-usuario").reset();
  document.querySelectorAll("#form-usuario .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });

  if (user) {
    titulo.textContent = "Editar usuario";
    submit.textContent = "Guardar cambios";
    roleGroup.hidden = true;  // No se puede cambiar el rol
    passwordGroup.hidden = false;
    passwordHelp.textContent = "Dejá la contraseña vacía si no querés cambiarla.";
    document.getElementById("usu-id").value = user.id;
    document.getElementById("usu-email").value = user.email;
  } else {
    titulo.textContent = "Nuevo usuario";
    submit.textContent = "Crear usuario";
    roleGroup.hidden = false;
    passwordGroup.hidden = false;
    passwordHelp.textContent = "Mínimo 6 caracteres. El usuario la va a usar para entrar al sistema.";
  }

  document.getElementById("modal-usuario").hidden = false;
}


function cerrarModalUsuario() {
  document.getElementById("modal-usuario").hidden = true;
  document.getElementById("usu-id").value = "";
}


async function onUsuarioSubmit(e) {
  e.preventDefault();
  document.querySelectorAll("#form-usuario .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });

  const editing = usuariosState.editingId !== null;
  const email = document.getElementById("usu-email").value.trim();
  const role = document.getElementById("usu-role").value;
  const password = document.getElementById("usu-password").value;
  const passwordConfirm = document.getElementById("usu-password-confirm").value;

  let hasError = false;
  if (!email) { setFieldError("usu-email", "Ingresá el email."); hasError = true; }

  if (!editing) {
    if (!role) { setFieldError("usu-role", "Elegí un rol."); hasError = true; }
    if (!password || password.length < 6) {
      setFieldError("usu-password", "La contraseña debe tener al menos 6 caracteres.");
      hasError = true;
    } else if (password !== passwordConfirm) {
      setFieldError("usu-password-confirm", "Las contraseñas no coinciden.");
      hasError = true;
    }
  } else if (password) {
    if (password.length < 6) {
      setFieldError("usu-password", "La contraseña debe tener al menos 6 caracteres.");
      hasError = true;
    } else if (password !== passwordConfirm) {
      setFieldError("usu-password-confirm", "Las contraseñas no coinciden.");
      hasError = true;
    }
  }
  if (hasError) return;

  const data = { email };
  if (!editing) data.role = role;
  if (password) data.password = password;

  const submit = document.getElementById("usu-submit");
  const originalText = submit.textContent;
  submit.disabled = true;
  submit.textContent = editing ? "Guardando..." : "Creando...";

  try {
    if (editing) {
      await apiFetch(`/users/${usuariosState.editingId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      showToast("Usuario actualizado.", "success");
    } else {
      await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify(data),
      });
      showToast("Usuario creado.", "success");
    }
    cerrarModalUsuario();
    await cargarUsuarios();
  } catch (err) {
    document.getElementById("usu-error").textContent = err.message;
    document.getElementById("usu-error").hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = originalText;
  }
}


async function desactivarUsuario(user) {
  if (!confirm(`¿Desactivar al usuario "${user.email}"?`)) return;
  try {
    await apiFetch(`/users/${user.id}`, { method: "DELETE" });
    showToast("Usuario desactivado.", "success");
    await cargarUsuarios();
  } catch (err) {
    showToast(err.message, "error");
  }
}
