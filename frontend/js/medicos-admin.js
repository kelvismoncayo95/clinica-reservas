// ============================================================
// medicos-admin.js - Seccion de medicos del admin
// ============================================================

const medicosState = {
  doctors: [],
  specialties: [],
  filtered: [],
  editingId: null,
};


document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("section-medicos")) return;
  setupMedicosSection();
});


function setupMedicosSection() {
  document.getElementById("buscar-medico").addEventListener("input", onBuscarMedico);
  document.getElementById("btn-nuevo-medico").addEventListener("click", () => abrirModalMedico());
  document.getElementById("modal-medico-cerrar").addEventListener("click", cerrarModalMedico);
  document.getElementById("med-cancelar").addEventListener("click", cerrarModalMedico);
  document.getElementById("form-medico").addEventListener("submit", onMedicoSubmit);
  document.getElementById("modal-medico").addEventListener("click", (e) => {
    if (e.target.id === "modal-medico") cerrarModalMedico();
  });
  document.getElementById("nav-medicos").addEventListener("click", cargarMedicosSiEsNecesario);
}


let medicosCargados = false;

async function cargarMedicosSiEsNecesario() {
  if (medicosCargados) return;
  await cargarMedicos();
  medicosCargados = true;
}


async function cargarMedicos() {
  const loading = document.getElementById("medicos-loading");
  const empty = document.getElementById("medicos-empty");
  const list = document.getElementById("medicos-list");
  loading.hidden = false;
  empty.hidden = true;
  list.hidden = true;
  list.innerHTML = "";
  try {
    const [docs, specs] = await Promise.all([fetchDoctors(), fetchSpecialties()]);
    medicosState.doctors = docs;
    medicosState.specialties = specs;
    medicosState.filtered = docs.slice();
    loading.hidden = true;
    renderMedicos();
  } catch (err) {
    loading.hidden = true;
    empty.hidden = false;
    showToast("No pudimos cargar los médicos.", "error");
  }
}


function onBuscarMedico(e) {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    medicosState.filtered = medicosState.doctors.slice();
  } else {
    medicosState.filtered = medicosState.doctors.filter((d) => {
      return (
        d.first_name.toLowerCase().includes(q) ||
        d.last_name.toLowerCase().includes(q) ||
        d.license_number.toLowerCase().includes(q)
      );
    });
  }
  renderMedicos();
}


function renderMedicos() {
  const empty = document.getElementById("medicos-empty");
  const list = document.getElementById("medicos-list");
  list.innerHTML = "";
  if (medicosState.filtered.length === 0) {
    empty.hidden = false;
    list.hidden = true;
    return;
  }
  empty.hidden = true;
  list.hidden = false;
  medicosState.filtered.forEach((d) => list.appendChild(renderMedico(d)));
}


function renderMedico(d) {
  const card = document.createElement("article");
  card.className = "lista-card";

  // 1. Avatar con iniciales
  const avatar = document.createElement("div");
  avatar.className = "lista-avatar";
  const iniciales = `${(d.first_name || "?").charAt(0)}${(d.last_name || "?").charAt(0)}`.toUpperCase();
  avatar.textContent = iniciales;

  // 2. Contenido (nombre, matrícula, especialidades)
  const contenido = document.createElement("div");
  contenido.className = "lista-contenido";

  const titulo = document.createElement("div");
  titulo.className = "lista-titulo";
  titulo.textContent = `${d.last_name}, ${d.first_name}`;

  const detalle = document.createElement("div");
  detalle.className = "lista-detalle";
  detalle.textContent = `Matrícula ${d.license_number}`;

  const especialidades = (d.specialty_ids || [])
    .map((id) => {
      const esp = medicosState.specialties.find((s) => s.id === id);
      return esp ? esp.name : null;
    })
    .filter(Boolean);
  const espText = especialidades.length > 0
    ? especialidades.join(", ")
    : "Sin especialidades asignadas";

  const secundario = document.createElement("div");
  secundario.className = "lista-detalle-secundario";
  secundario.textContent = espText;

  contenido.appendChild(titulo);
  contenido.appendChild(detalle);
  contenido.appendChild(secundario);

  // 3. Píldora de estado
  const estado = document.createElement("span");
  estado.className = `lista-estado ${d.activo ? "lista-estado-activo" : "lista-estado-inactivo"}`;
  estado.textContent = d.activo ? "Activo" : "Inactivo";

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
    abrirModalMedico(d);
  });

  menu.appendChild(btnEditar);
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

  // 5. Armar la tarjeta completa
  card.appendChild(avatar);
  card.appendChild(contenido);
  card.appendChild(estado);
  card.appendChild(acciones);

  return card;
}


// ----- Modal de medico -----

function abrirModalMedico(doctor = null) {
  medicosState.editingId = doctor ? doctor.id : null;
  const titulo = document.getElementById("modal-medico-titulo");
  const submit = document.getElementById("med-submit");
  const userEmailGroup = document.getElementById("med-user-email-group");
  const passwordGroup = document.getElementById("med-password-group");
  const licenseHint = document.getElementById("med-license-hint");

  document.getElementById("form-medico").reset();
  document.querySelectorAll("#form-medico .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });

  renderEspecialidadesCheckboxes(doctor ? doctor.specialty_ids || [] : []);

  if (doctor) {
    titulo.textContent = "Editar médico";
    submit.textContent = "Guardar cambios";
    userEmailGroup.hidden = true;
    passwordGroup.hidden = true;
    licenseHint.textContent = "La matrícula no se puede modificar.";
    document.getElementById("med-id").value = doctor.id;
    document.getElementById("med-first-name").value = doctor.first_name;
    document.getElementById("med-last-name").value = doctor.last_name;
    document.getElementById("med-license").value = doctor.license_number;
    document.getElementById("med-license").disabled = true;
    document.getElementById("med-phone").value = doctor.phone || "";
    document.getElementById("med-email").value = doctor.email || "";
  } else {
    titulo.textContent = "Nuevo médico";
    submit.textContent = "Crear médico";
    userEmailGroup.hidden = false;
    passwordGroup.hidden = false;
    document.getElementById("med-license").disabled = false;
    licenseHint.textContent = "";
  }

  document.getElementById("modal-medico").hidden = false;
}


function cerrarModalMedico() {
  document.getElementById("modal-medico").hidden = true;
  document.getElementById("med-id").value = "";
}


function renderEspecialidadesCheckboxes(selectedIds) {
  const container = document.getElementById("med-especialidades-list");
  container.innerHTML = "";
  if (medicosState.specialties.length === 0) {
  container.innerHTML = '<p class="form-help">No hay especialidades cargadas.</p>';
    return;
  }
  medicosState.specialties.forEach((esp) => {
    const label = document.createElement("label");
    label.className = "checkbox-item";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = esp.id;
    input.checked = selectedIds.includes(esp.id);
    const span = document.createElement("span");
    span.textContent = esp.name;
    label.appendChild(input);
    label.appendChild(span);
    container.appendChild(label);
  });
}


async function onMedicoSubmit(e) {
  e.preventDefault();
  
  // Limpiar errores previos
  document.querySelectorAll("#form-medico .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });

  // Leer los valores del formulario
  const data = {
    first_name: document.getElementById("med-first-name").value.trim(),
    last_name: document.getElementById("med-last-name").value.trim(),
    license_number: document.getElementById("med-license").value.trim(),
    phone: document.getElementById("med-phone").value.trim() || null,
    email: document.getElementById("med-email").value.trim() || null,
    user_email: document.getElementById("med-user-email").value.trim(),
  };

  const editing = medState.editingId !== null;
  const password = document.getElementById("med-password").value;
  const passwordConfirm = document.getElementById("med-password-confirm").value;
  
  // Leer especialidades
  const checkboxes = document.querySelectorAll("#med-especialidades-list input[type=checkbox]:checked");
  const specialty_ids = Array.from(checkboxes).map(cb => parseInt(cb.value));

  let hasError = false;

  // Validar Nombre
  if (!data.first_name) {
    setFieldError("med-first-name", "El nombre es obligatorio.");
    hasError = true;
  } else if (data.first_name.length < 2) {
    setFieldError("med-first-name", "El nombre debe tener al menos 2 letras.");
    hasError = true;
  }

  // Validar Apellido
  if (!data.last_name) {
    setFieldError("med-last-name", "El apellido es obligatorio.");
    hasError = true;
  } else if (data.last_name.length < 2) {
    setFieldError("med-last-name", "El apellido debe tener al menos 2 letras.");
    hasError = true;
  }

  // Validar Matrícula (solo en modo creación, en edición no se modifica)
  if (!editing) {
    if (!data.license_number) {
      setFieldError("med-license", "La matrícula es obligatoria.");
      hasError = true;
    } else if (data.license_number.length < 3) {
      setFieldError("med-license", "La matrícula debe tener al menos 3 caracteres.");
      hasError = true;
    }
  }

  // Validar Email de login
  if (!data.user_email) {
    setFieldError("med-user-email", "El email de inicio de sesión es obligatorio.");
    hasError = true;
  } else if (!data.user_email.includes("@") || !data.user_email.includes(".")) {
    setFieldError("med-user-email", "El email no tiene un formato válido (ejemplo: nombre@dominio.com).");
    hasError = true;
  }

  // Validar Contraseña (solo en modo creación)
  if (!editing) {
    if (!password || password.length < 6) {
      setFieldError("med-password", "La contraseña debe tener al menos 6 caracteres.");
      hasError = true;
    } else if (password !== passwordConfirm) {
      setFieldError("med-password-confirm", "Las contraseñas no coinciden.");
      hasError = true;
    }
  }

  // Validar Especialidades (mínimo una)
  if (specialty_ids.length === 0) {
    setFieldError("med-especialidades", "Marcá al menos una especialidad.");
    hasError = true;
  }

  // Si hay errores, frenamos acá. Los mensajes rojos ya están pintados.
  if (hasError) {
    // Hacer scroll al primer error para que el usuario lo vea
    const primerError = document.querySelector("#form-medico .form-error:not([hidden])");
    if (primerError) {
      primerError.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }

  // --- A partir de acá, todo está válido. Enviar al backend ---

  const submit = document.getElementById("med-submit");
  const originalText = submit.textContent;
  submit.disabled = true;
  submit.textContent = editing ? "Guardando..." : "Creando...";

  try {
    if (editing) {
      await apiFetch(`/doctors/${medicosState.editingId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      showToast("Médico actualizado.", "success");
    } else {
      await apiFetch("/doctors", {
        method: "POST",
        body: JSON.stringify(data),
      });
      showToast("Médico creado.", "success");
    }
    cerrarModalMedico();
    await cargarMedicos();
  } catch (err) {
    // Parsear el mensaje de error: si es un array (validación de Pydantic), tomar el primero
    let mensaje = err.message;
    if (typeof mensaje === "string" && mensaje.startsWith("[")) {
      try {
        const parsed = JSON.parse(mensaje);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].msg) {
          // Extraer el nombre del campo del error
          const campo = parsed[0].loc && parsed[0].loc[parsed[0].loc.length - 1];
          const msgOriginal = parsed[0].msg;
          // Traducir mensajes comunes de Pydantic
          if (msgOriginal.includes("email")) {
            mensaje = `El correo electrónico no tiene un formato válido.`;
          } else if (msgOriginal.includes("required")) {
            mensaje = `Falta el campo: ${campo}.`;
          } else {
            mensaje = `Error en ${campo}: ${msgOriginal}`;
          }
        }
      } catch (_) {
        // Si no es JSON, dejar el mensaje como estaba
      }
    }
    document.getElementById("med-error").textContent = mensaje;
    document.getElementById("med-error").hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = originalText;
  }
}
