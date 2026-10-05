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
  card.className = "cita-card";
  const especialidades = (d.specialty_ids || [])
    .map((id) => {
      const esp = medicosState.specialties.find((s) => s.id === id);
      return esp ? esp.name : null;
    })
    .filter(Boolean);
  const espText = especialidades.length > 0
    ? especialidades.join(", ")
    : "Sin especialidades asignadas";
  card.innerHTML = `
    <div class="cita-info">
      <p class="cita-fecha">${d.last_name}, ${d.first_name}</p>
      <p class="cita-detalle">Matrícula ${d.license_number}</p>
      <p class="cita-estado">${espText}</p>
    </div>
  `;
  const acciones = document.createElement("div");
  acciones.className = "cita-acciones";
  const btnEditar = document.createElement("button");
  btnEditar.type = "button";
  btnEditar.className = "btn btn-sm";
  btnEditar.textContent = "Editar";
  btnEditar.addEventListener("click", () => abrirModalMedico(d));
  acciones.appendChild(btnEditar);
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
  document.querySelectorAll("#form-medico .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });

  const editing = medicosState.editingId !== null;

  // Especialidades seleccionadas
  const specialtyIds = [];
  document.querySelectorAll("#med-especialidades-list input:checked").forEach((cb) => {
    specialtyIds.push(Number(cb.value));
  });

  const data = {
    first_name: document.getElementById("med-first-name").value.trim(),
    last_name: document.getElementById("med-last-name").value.trim(),
    phone: document.getElementById("med-phone").value.trim() || null,
    email: document.getElementById("med-email").value.trim() || null,
    specialty_ids: specialtyIds,
  };

  let hasError = false;
  if (!data.first_name) { setFieldError("med-first-name", "Ingresá el nombre."); hasError = true; }
  if (!data.last_name) { setFieldError("med-last-name", "Ingresá el apellido."); hasError = true; }
  if (specialtyIds.length === 0) {
    setFieldError("med-especialidades", "Marcá al menos una especialidad.");
    hasError = true;
  }

  if (!editing) {
    data.license_number = document.getElementById("med-license").value.trim();
    data.user_email = document.getElementById("med-user-email").value.trim();
    data.password = document.getElementById("med-password").value;
    if (!data.license_number) { setFieldError("med-license", "Ingresá la matrícula."); hasError = true; }
    if (!data.user_email) { setFieldError("med-user-email", "Ingresá el email de inicio de sesión."); hasError = true; }
    const pass = data.password || "";
    const passConfirm = document.getElementById("med-password-confirm").value;
    if (pass.length < 6) {
      setFieldError("med-password", "La contraseña debe tener al menos 6 caracteres.");
      hasError = true;
    } else if (pass !== passConfirm) {
      setFieldError("med-password-confirm", "Las contraseñas no coinciden.");
      hasError = true;
    }
  }
  if (hasError) return;

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
    document.getElementById("med-error").textContent = err.message;
    document.getElementById("med-error").hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = originalText;
  }
}
