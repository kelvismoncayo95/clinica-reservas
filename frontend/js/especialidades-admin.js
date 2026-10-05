// ============================================================
// especialidades-admin.js - Seccion de especialidades
// ============================================================

const especialidadesState = {
  specialties: [],
  filtered: [],
  editingId: null,
};


document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("section-especialidades")) return;
  setupEspecialidadesSection();
});


function setupEspecialidadesSection() {
  document.getElementById("buscar-especialidad").addEventListener("input", onBuscarEspecialidad);
  document.getElementById("btn-nueva-especialidad").addEventListener("click", () => abrirModalEspecialidad());
  document.getElementById("modal-especialidad-cerrar").addEventListener("click", cerrarModalEspecialidad);
  document.getElementById("esp-cancelar").addEventListener("click", cerrarModalEspecialidad);
  document.getElementById("form-especialidad").addEventListener("submit", onEspecialidadSubmit);
  document.getElementById("modal-especialidad").addEventListener("click", (e) => {
    if (e.target.id === "modal-especialidad") cerrarModalEspecialidad();
  });
  document.getElementById("nav-especialidades").addEventListener("click", cargarEspecialidadesSiEsNecesario);
}


let especialidadesCargadas = false;

async function cargarEspecialidadesSiEsNecesario() {
  if (especialidadesCargadas) return;
  await cargarEspecialidades();
  especialidadesCargadas = true;
}


async function cargarEspecialidades() {
  const loading = document.getElementById("especialidades-loading");
  const empty = document.getElementById("especialidades-empty");
  const list = document.getElementById("especialidades-list");
  loading.hidden = false;
  empty.hidden = true;
  list.hidden = true;
  list.innerHTML = "";
  try {
    especialidadesState.specialties = await fetchSpecialties();
    especialidadesState.filtered = especialidadesState.specialties.slice();
    loading.hidden = true;
    renderEspecialidades();
  } catch (err) {
    loading.hidden = true;
    empty.hidden = false;
    showToast("No pudimos cargar las especialidades.", "error");
  }
}


function onBuscarEspecialidad(e) {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    especialidadesState.filtered = especialidadesState.specialties.slice();
  } else {
    especialidadesState.filtered = especialidadesState.specialties.filter((s) => {
      return s.name.toLowerCase().includes(q);
    });
  }
  renderEspecialidades();
}


function renderEspecialidades() {
  const empty = document.getElementById("especialidades-empty");
  const list = document.getElementById("especialidades-list");
  list.innerHTML = "";
  if (especialidadesState.filtered.length === 0) {
    empty.hidden = false;
    list.hidden = true;
    return;
  }
  empty.hidden = true;
  list.hidden = false;
  especialidadesState.filtered.forEach((s) => list.appendChild(renderEspecialidad(s)));
}


function renderEspecialidad(s) {
  const card = document.createElement("article");
  card.className = "cita-card";
  const desc = s.description ? s.description : "Sin descripción";
  card.innerHTML = `
    <div class="cita-info">
      <p class="cita-fecha">${s.name}</p>
      <p class="cita-estado">${desc}</p>
    </div>
  `;
  const acciones = document.createElement("div");
  acciones.className = "cita-acciones";
  const btnEditar = document.createElement("button");
  btnEditar.type = "button";
  btnEditar.className = "btn btn-sm";
  btnEditar.textContent = "Editar";
  btnEditar.addEventListener("click", () => abrirModalEspecialidad(s));
  acciones.appendChild(btnEditar);
  const btnDesactivar = document.createElement("button");
  btnDesactivar.type = "button";
  btnDesactivar.className = "btn btn-peligro btn-sm";
  btnDesactivar.textContent = "Desactivar";
  btnDesactivar.addEventListener("click", () => desactivarEspecialidad(s));
  acciones.appendChild(btnDesactivar);
  card.appendChild(acciones);
  return card;
}


// ----- Modal de especialidad -----

function abrirModalEspecialidad(esp = null) {
  especialidadesState.editingId = esp ? esp.id : null;
  const titulo = document.getElementById("modal-especialidad-titulo");
  const submit = document.getElementById("esp-submit");

  document.getElementById("form-especialidad").reset();
  document.querySelectorAll("#form-especialidad .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });

  if (esp) {
    titulo.textContent = "Editar especialidad";
    submit.textContent = "Guardar cambios";
    document.getElementById("esp-id").value = esp.id;
    document.getElementById("esp-name").value = esp.name;
    document.getElementById("esp-description").value = esp.description || "";
  } else {
    titulo.textContent = "Nueva especialidad";
    submit.textContent = "Crear especialidad";
  }

  document.getElementById("modal-especialidad").hidden = false;
}


function cerrarModalEspecialidad() {
  document.getElementById("modal-especialidad").hidden = true;
  document.getElementById("esp-id").value = "";
}


async function onEspecialidadSubmit(e) {
  e.preventDefault();
  document.querySelectorAll("#form-especialidad .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });

  const editing = especialidadesState.editingId !== null;
  const data = {
    name: document.getElementById("esp-name").value.trim(),
    description: document.getElementById("esp-description").value.trim() || null,
  };

  if (!data.name) {
    setFieldError("esp-name", "Ingresá el nombre de la especialidad.");
    return;
  }

  const submit = document.getElementById("esp-submit");
  const originalText = submit.textContent;
  submit.disabled = true;
  submit.textContent = editing ? "Guardando..." : "Creando...";

  try {
    if (editing) {
      await apiFetch(`/specialties/${especialidadesState.editingId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      showToast("Especialidad actualizada.", "success");
    } else {
      await apiFetch("/specialties", {
        method: "POST",
        body: JSON.stringify(data),
      });
      showToast("Especialidad creada.", "success");
    }
    cerrarModalEspecialidad();
    await cargarEspecialidades();
  } catch (err) {
    document.getElementById("esp-error").textContent = err.message;
    document.getElementById("esp-error").hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = originalText;
  }
}


async function desactivarEspecialidad(esp) {
  if (!confirm(`¿Desactivar la especialidad "${esp.name}"?`)) return;
  try {
    await apiFetch(`/specialties/${esp.id}`, { method: "DELETE" });
    showToast("Especialidad desactivada.", "success");
    await cargarEspecialidades();
  } catch (err) {
    showToast(err.message, "error");
  }
}
