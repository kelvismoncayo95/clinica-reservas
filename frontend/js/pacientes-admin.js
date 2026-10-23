// ============================================================
// pacientes-admin.js - Seccion de pacientes del admin
// ============================================================

const pacientesState = {
  patients: [],
  filtered: [],
  editingId: null,
};


document.addEventListener("DOMContentLoaded", () => {
  // Solo arranca si estamos en admin.html
  if (!document.getElementById("section-pacientes")) return;

  setupPacientesSection();
});


function setupPacientesSection() {
  document.getElementById("buscar-paciente").addEventListener("input", onBuscarPaciente);
  document.getElementById("btn-nuevo-paciente").addEventListener("click", () => abrirModalPaciente());
  document.getElementById("modal-paciente-cerrar").addEventListener("click", cerrarModalPaciente);
  document.getElementById("pac-cancelar").addEventListener("click", cerrarModalPaciente);
  document.getElementById("form-paciente").addEventListener("submit", onPacienteSubmit);
  document.getElementById("modal-paciente").addEventListener("click", (e) => {
    if (e.target.id === "modal-paciente") cerrarModalPaciente();
  });

  // Se cargan cuando el usuario entra a la seccion por primera vez
  document.getElementById("nav-pacientes").addEventListener("click", cargarPacientesSiEsNecesario);
}


let pacientesCargados = false;

async function cargarPacientesSiEsNecesario() {
  if (pacientesCargados) return;
  await cargarPacientes();
  pacientesCargados = true;
}


async function cargarPacientes() {
  const loading = document.getElementById("pacientes-loading");
  const empty = document.getElementById("pacientes-empty");
  const list = document.getElementById("pacientes-list");
  loading.hidden = false;
  empty.hidden = true;
  list.hidden = true;
  list.innerHTML = "";
  try {
    pacientesState.patients = await apiFetch("/patients");
    pacientesState.filtered = pacientesState.patients.slice();
    loading.hidden = true;
    renderPacientes();
  } catch (err) {
    loading.hidden = true;
    empty.hidden = false;
    showToast("No pudimos cargar los pacientes.", "error");
  }
}


function onBuscarPaciente(e) {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    pacientesState.filtered = pacientesState.patients.slice();
  } else {
    pacientesState.filtered = pacientesState.patients.filter((p) => {
      return (
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.dni.toLowerCase().includes(q)
      );
    });
  }
  renderPacientes();
}


function renderPacientes() {
  const empty = document.getElementById("pacientes-empty");
  const list = document.getElementById("pacientes-list");
  list.innerHTML = "";
  if (pacientesState.filtered.length === 0) {
    empty.hidden = false;
    list.hidden = true;
    return;
  }
  empty.hidden = true;
  list.hidden = false;
  pacientesState.filtered.forEach((p) => list.appendChild(renderPaciente(p)));
}


function renderPaciente(p) {
  const card = document.createElement("article");
  card.className = "lista-card";

  // 1. Avatar con iniciales
  const avatar = document.createElement("div");
  avatar.className = "lista-avatar";
  const iniciales = `${(p.first_name || "?").charAt(0)}${(p.last_name || "?").charAt(0)}`.toUpperCase();
  avatar.textContent = iniciales;

  // 2. Contenido (nombre, DNI, teléfono, obra social)
  const contenido = document.createElement("div");
  contenido.className = "lista-contenido";

  const titulo = document.createElement("div");
  titulo.className = "lista-titulo";
  titulo.textContent = `${p.last_name}, ${p.first_name}`;

  const detalle = document.createElement("div");
  detalle.className = "lista-detalle";
  detalle.textContent = `DNI ${p.dni} · Tel ${p.phone || "-"}`;

  const secundario = document.createElement("div");
  secundario.className = "lista-detalle-secundario";
  secundario.textContent = p.obra_social || "Sin obra social";

  contenido.appendChild(titulo);
  contenido.appendChild(detalle);
  contenido.appendChild(secundario);

  // 3. Píldora de estado
  const estado = document.createElement("span");
  estado.className = `lista-estado ${p.activo ? "lista-estado-activo" : "lista-estado-inactivo"}`;
  estado.textContent = p.activo ? "Activo" : "Inactivo";

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
    abrirModalPaciente(p);
  });

  menu.appendChild(btnEditar);
  acciones.appendChild(btnMenu);
  acciones.appendChild(menu);

  btnMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    // Cerrar otros menús abiertos
    document.querySelectorAll(".lista-menu").forEach((m) => {
      if (m !== menu) m.hidden = true;
    });
    menu.hidden = !menu.hidden;
  });

  // Cerrar el menú al tocar afuera
  document.addEventListener("click", () => {
    menu.hidden = true;
  });

  // 5. Armar la tarjeta completa
  card.appendChild(avatar);
  card.appendChild(contenido);
  card.appendChild(estado);
  card.appendChild(acciones);

  return card;
}


// ----- Modal de paciente -----

function abrirModalPaciente(paciente = null) {
  pacientesState.editingId = paciente ? paciente.id : null;
  const titulo = document.getElementById("modal-paciente-titulo");
  const submit = document.getElementById("pac-submit");
  const passwordGroup = document.getElementById("pac-password-group");
  const dniHint = document.getElementById("pac-dni-hint");

  // Reset form
  document.getElementById("form-paciente").reset();
  document.querySelectorAll("#form-paciente .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });

  if (paciente) {
    titulo.textContent = "Editar paciente";
    submit.textContent = "Guardar cambios";
    passwordGroup.hidden = true;  // En edicion no se cambia password
    dniHint.textContent = "El DNI no se puede modificar.";
    document.getElementById("pac-id").value = paciente.id;
    document.getElementById("pac-first-name").value = paciente.first_name;
    document.getElementById("pac-last-name").value = paciente.last_name;
    document.getElementById("pac-dni").value = paciente.dni;
    document.getElementById("pac-dni").disabled = true;
    document.getElementById("pac-birth-date").value = paciente.birth_date;
    document.getElementById("pac-phone").value = paciente.phone;
    document.getElementById("pac-email").value = paciente.email;
    document.getElementById("pac-obra-social").value = paciente.obra_social || "";
  } else {
    titulo.textContent = "Nuevo paciente";
    submit.textContent = "Crear paciente";
    passwordGroup.hidden = false;
    document.getElementById("pac-dni").disabled = false;
    dniHint.textContent = "";
  }

  // Actualizar la fecha máxima a HOY (dinámico)
  const hoyMax = new Date();
  const anioMax = hoyMax.getFullYear();
  const mesMax = String(hoyMax.getMonth() + 1).padStart(2, "0");
  const diaMax = String(hoyMax.getDate()).padStart(2, "0");
  document.getElementById("pac-birth-date").max = `${anioMax}-${mesMax}-${diaMax}`;

  document.getElementById("modal-paciente").showModal();
}


function cerrarModalPaciente() {
  const dialog = document.getElementById("modal-paciente");
  if (dialog.open) dialog.close();
  document.getElementById("pac-id").value = "";
}


async function onPacienteSubmit(e) {
  // Validación nativa del navegador: si falla, mostrar el tooltip y salir.
  if (!e.target.checkValidity()) {
    e.target.reportValidity();
    return;
  }
  e.preventDefault();
  document.querySelectorAll("#form-paciente .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });

  const editing = pacientesState.editingId !== null;
  const data = {
    first_name: document.getElementById("pac-first-name").value.trim(),
    last_name: document.getElementById("pac-last-name").value.trim(),
    birth_date: document.getElementById("pac-birth-date").value,
    phone: document.getElementById("pac-phone").value.trim(),
    email: document.getElementById("pac-email").value.trim(),
    obra_social: document.getElementById("pac-obra-social").value.trim() || null,
  };

  if (!editing) {
    data.dni = document.getElementById("pac-dni").value.trim();
    data.password = document.getElementById("pac-password").value;
  }

  let hasError = false;

  // Validación manual de la fecha (por si el HTML5 falla)
  if (data.birth_date) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Ignorar la hora para comparar solo fechas
    const fechaNac = new Date(data.birth_date + "T00:00:00");
    if (fechaNac > hoy) {
      setFieldError("pac-birth-date", "La fecha de nacimiento no puede ser futura.");
      hasError = true;
    }
  }

  if (!data.first_name) { setFieldError("pac-first-name", "Ingresá el nombre."); hasError = true; }
  if (!data.last_name) { setFieldError("pac-last-name", "Ingresá el apellido."); hasError = true; }
  if (!editing && !data.dni) { setFieldError("pac-dni", "Ingresá el DNI."); hasError = true; }
  if (!data.birth_date) { setFieldError("pac-birth-date", "Ingresá la fecha de nacimiento."); hasError = true; }
  if (!data.phone) { setFieldError("pac-phone", "Ingresá el teléfono."); hasError = true; }
  if (!data.email) { setFieldError("pac-email", "Ingresá el correo electrónico."); hasError = true; }
  if (!editing) {
    const pass = data.password || "";
    const passConfirm = document.getElementById("pac-password-confirm").value;
    if (pass.length < 6) {
      setFieldError("pac-password", "La contraseña debe tener al menos 6 caracteres.");
      hasError = true;
    } else if (pass !== passConfirm) {
      setFieldError("pac-password-confirm", "Las contraseñas no coinciden.");
      hasError = true;
    }
  }
  if (hasError) return;

  const submit = document.getElementById("pac-submit");
  const originalText = submit.textContent;
  submit.disabled = true;
  submit.textContent = editing ? "Guardando..." : "Creando...";

  try {
    if (editing) {
      await apiFetch(`/patients/${pacientesState.editingId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      showToast("Paciente actualizado.", "success");
    } else {
      await apiFetch("/patients", {
        method: "POST",
        body: JSON.stringify(data),
      });
      showToast("Paciente creado.", "success");
    }
    cerrarModalPaciente();
    await cargarPacientes();
  } catch (err) {
    document.getElementById("pac-error").textContent = err.message;
    document.getElementById("pac-error").hidden = false;
    // Scroll automático al error
    setTimeout(() => {
      const errorEl = document.getElementById("pac-error");
      if (errorEl) errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  } finally {
    submit.disabled = false;
    submit.textContent = originalText;
  }
}
