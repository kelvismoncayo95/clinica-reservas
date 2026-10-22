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
  card.className = "lista-card";

  // 1. Avatar con iniciales (del email, porque no hay nombre)
  const avatar = document.createElement("div");
  avatar.className = "lista-avatar";
  const iniciales = (u.email || "?").charAt(0).toUpperCase();
  avatar.textContent = iniciales;

  // 2. Contenido (email + rol)
  const contenido = document.createElement("div");
  contenido.className = "lista-contenido";

  const titulo = document.createElement("div");
  titulo.className = "lista-titulo";
  titulo.textContent = u.email;

  const detalle = document.createElement("div");
  detalle.className = "lista-detalle-secundario";
  const rol = ROLES_LABEL[u.role] || u.role;
  detalle.textContent = rol;

  contenido.appendChild(titulo);
  contenido.appendChild(detalle);

  // 3. Píldora de estado
  const estado = document.createElement("span");
  estado.className = `lista-estado ${u.activo ? "lista-estado-activo" : "lista-estado-inactivo"}`;
  estado.textContent = u.activo ? "Activo" : "Inactivo";

  // 4. Menú de acciones (⋯)
  const acciones = document.createElement("div");
  acciones.className = "lista-acciones";

  const btnMenu = document.createElement("button");
  btnMenu.type = "button";
  btnMenu.className = "lista-menu-btn";
  btnMenu.setAttribute("aria-label", "Acciones");
  btnMenu.textContent = "⋯";

  const menu = document.createElement("div");
  menu.className = "lista-menu";
  menu.hidden = true;

  const btnEditar = document.createElement("button");
  btnEditar.type = "button";
  btnEditar.textContent = "Editar";
  btnEditar.addEventListener("click", () => {
    menu.hidden = true;
    abrirModalUsuario(u);
  });
  menu.appendChild(btnEditar);

  if (u.activo) {
    const btnDesactivar = document.createElement("button");
    btnDesactivar.type = "button";
    btnDesactivar.className = "peligro";
    btnDesactivar.textContent = "Desactivar";
    btnDesactivar.addEventListener("click", () => {
      menu.hidden = true;
      desactivarUsuario(u);
    });
    menu.appendChild(btnDesactivar);
  }

  acciones.appendChild(btnMenu);
  acciones.appendChild(menu);

  btnMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".lista-menu").forEach((m) => {
      if (m !== menu) m.hidden = true;
    });
    menu.hidden = !menu.hidden;
  });

  document.addEventListener("click", () => {
    menu.hidden = true;
  });

  // 5. Armar la tarjeta
  card.appendChild(avatar);
  card.appendChild(contenido);
  card.appendChild(estado);
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
