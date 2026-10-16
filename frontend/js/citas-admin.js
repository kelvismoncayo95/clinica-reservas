// ============================================================
// citas-admin.js - Panel de citas del admin/recepcion
// ============================================================

const state = {
  currentSection: "citas",
  doctors: [],
  patients: [],
  specialties: [],
  citas: [],
  selectedPatientId: null,
  selectedSpecialtyId: null,
  selectedDoctorId: null,
  selectedDate: null,
  selectedStartTime: null,
};


document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;
  const role = getCurrentUser().role;
  if (role !== "admin" && role !== "reception") {
    window.location.href = "index.html";
    return;
  }

  setupHeader();
  setupNavigation(role);
  setupFiltros();
  setupModalNuevaCita();

  // Fecha de hoy por defecto en el filtro
  const hoy = new Date().toISOString().split("T")[0];
  document.getElementById("filtro-fecha").value = hoy;

  // Cargar datos iniciales
  await Promise.all([loadDoctors(), loadPatients(), loadSpecialties()]);
  await loadCitas();
});


// ----- Header -----

function setupHeader() {
  const user = getCurrentUser();
  const displayName = document.getElementById("user-display-name");
  if (user && displayName) displayName.textContent = user.email;
  document.getElementById("logout-btn").addEventListener("click", logout);
}


// ----- Navegacion -----

function setupNavigation(role) {
  const secciones = ["citas", "ausencias", "pacientes", "medicos", "especialidades", "horarios", "usuarios"];

  // Mostrar las que corresponden al rol
  if (role === "admin") {
    secciones.forEach((s) => {
      const btn = document.getElementById(`nav-${s}`);
      if (btn) btn.hidden = false;
    });
  } else if (role === "reception") {
    ["citas", "ausencias", "pacientes", "medicos"].forEach((s) => {
      const btn = document.getElementById(`nav-${s}`);
      if (btn) btn.hidden = false;
    });
  }

  secciones.forEach((sec) => {
    const btn = document.getElementById(`nav-${sec}`);
    if (btn) {
      btn.addEventListener("click", () => switchSection(sec));
    }
  });
}


let ausenciasAdminCargadas = false;

function switchSection(which) {
  // Cerrar cualquier modal abierto antes de cambiar de seccion
  document.querySelectorAll(".modal-backdrop").forEach((m) => {
    m.hidden = true;
  });

  state.currentSection = which;
  const secciones = ["citas", "ausencias", "pacientes", "medicos", "especialidades", "horarios", "usuarios"];
  secciones.forEach((sec) => {
    const btn = document.getElementById(`nav-${sec}`);
    const section = document.getElementById(`section-${sec}`);
    const active = sec === which;
    if (btn) {
      btn.classList.toggle("nav-item-activa", active);
      btn.setAttribute("aria-selected", String(active));
    }
    if (section) section.hidden = !active;
  });

  // Cargar ausencias la primera vez que se entra
  if (which === "ausencias" && !ausenciasAdminCargadas) {
    cargarAusenciasAdmin();
    ausenciasAdminCargadas = true;
  }
}


// ----- Filtros -----

function setupFiltros() {
  ["filtro-fecha", "filtro-medico", "filtro-paciente", "filtro-estado"].forEach((id) => {
    document.getElementById(id).addEventListener("change", loadCitas);
  });
  document.getElementById("filtros-limpiar").addEventListener("click", () => {
    document.getElementById("filtro-fecha").value = "";
    document.getElementById("filtro-medico").value = "";
    document.getElementById("filtro-paciente").value = "";
    document.getElementById("filtro-estado").value = "";
    loadCitas();
  });
  document.getElementById("btn-nueva-cita").addEventListener("click", abrirModalNuevaCita);
}


// ----- Cargar medicos, pacientes, especialidades -----

async function loadDoctors() {
  try {
    state.doctors = await fetchDoctors();
    const select = document.getElementById("filtro-medico");
    state.doctors.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${d.last_name}, ${d.first_name}`;
      select.appendChild(opt);
    });
  } catch (err) {
    showToast("No pudimos cargar los médicos.", "error");
  }
}


async function loadPatients() {
  try {
    state.patients = await apiFetch("/patients");
    const select = document.getElementById("filtro-paciente");
    state.patients.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.last_name}, ${p.first_name} (DNI ${p.dni})`;
      select.appendChild(opt);
    });
  } catch (err) {
    showToast("No pudimos cargar los pacientes.", "error");
  }
}


async function loadSpecialties() {
  try {
    state.specialties = await fetchSpecialties();
  } catch (err) {
    showToast("No pudimos cargar las especialidades.", "error");
  }
}


// ----- Cargar citas con filtros -----

async function loadCitas() {
  const loading = document.getElementById("citas-admin-loading");
  const empty = document.getElementById("citas-admin-empty");
  const list = document.getElementById("citas-admin-list");
  loading.hidden = false;
  empty.hidden = true;
  list.hidden = true;
  list.innerHTML = "";

  const params = {};
  const fecha = document.getElementById("filtro-fecha").value;
  const medico = document.getElementById("filtro-medico").value;
  const paciente = document.getElementById("filtro-paciente").value;
  const estado = document.getElementById("filtro-estado").value;
  if (fecha) params.date = fecha;
  if (medico) params.doctor_id = medico;
  if (paciente) params.patient_id = paciente;
  if (estado) params.status = estado;

  try {
    const citas = await fetchAppointments(params);
    state.citas = citas;
    loading.hidden = true;
    if (!citas || citas.length === 0) {
      empty.hidden = false;
      return;
    }
    list.hidden = false;
    citas.forEach((cita) => list.appendChild(renderCitaAdmin(cita)));
  } catch (err) {
    loading.hidden = true;
    empty.hidden = false;
    showToast("No pudimos cargar las citas.", "error");
  }
}


// ----- Render de cada cita -----

function renderCitaAdmin(cita) {
  const card = document.createElement("article");
  card.className = `cita-card ${getStatusClass(cita.status)}`;

  const doctor = state.doctors.find((d) => d.id === cita.doctor_id);
  const patient = state.patients.find((p) => p.id === cita.patient_id);
  const doctorName = doctor ? `${doctor.last_name}, ${doctor.first_name}` : `Médico #${cita.doctor_id}`;
  const patientName = patient ? `${patient.last_name}, ${patient.first_name}` : `Paciente #${cita.patient_id}`;

  card.innerHTML = `
    <div class="cita-info">
      <p class="cita-fecha">${formatDate(cita.appointment_date)} a las ${formatTime(cita.start_time)}</p>
      <p class="cita-detalle">${patientName} con ${doctorName}</p>
      <p class="cita-estado">${getStatusLabel(cita.status)}</p>
    </div>
  `;

  const acciones = document.createElement("div");
  acciones.className = "cita-acciones";

  if (cita.status === "confirmed") {
    const btnAtendida = document.createElement("button");
    btnAtendida.type = "button";
    btnAtendida.className = "btn btn-sm";
    btnAtendida.textContent = "Atendida";
    btnAtendida.addEventListener("click", () => cambiarEstado(cita.id, "attended"));
    acciones.appendChild(btnAtendida);

    const btnNoShow = document.createElement("button");
    btnNoShow.type = "button";
    btnNoShow.className = "btn btn-sm";
    btnNoShow.textContent = "No asistió";
    btnNoShow.addEventListener("click", () => cambiarEstado(cita.id, "no_show"));
    acciones.appendChild(btnNoShow);

    const btnCancelar = document.createElement("button");
    btnCancelar.type = "button";
    btnCancelar.className = "btn btn-peligro btn-sm";
    btnCancelar.textContent = "Cancelar";
    btnCancelar.addEventListener("click", () => cancelarCitaAdmin(cita.id));
    acciones.appendChild(btnCancelar);
  }

  card.appendChild(acciones);
  return card;
}


async function cambiarEstado(id, nuevoEstado) {
  try {
    await updateAppointmentStatus(id, nuevoEstado);
    showToast(`Cita marcada como ${getStatusLabel(nuevoEstado).toLowerCase()}.`, "success");
    await loadCitas();
  } catch (err) {
    showToast(err.message, "error");
  }
}


async function cancelarCitaAdmin(id) {
  if (!confirm("¿Cancelar esta cita?")) return;
  try {
    await cancelAppointment(id);
    showToast("Cita cancelada.", "success");
    await loadCitas();
  } catch (err) {
    showToast(err.message, "error");
  }
}


// ============================================================
// Modal de nueva cita
// ============================================================

function setupModalNuevaCita() {
  document.getElementById("modal-cerrar").addEventListener("click", cerrarModalNuevaCita);
  document.getElementById("nc-cancelar").addEventListener("click", cerrarModalNuevaCita);
  document.getElementById("nc-paciente").addEventListener("change", onModalPatientChange);
  document.getElementById("nc-especialidad").addEventListener("change", onModalSpecialtyChange);
  document.getElementById("nc-medico").addEventListener("change", onModalDoctorChange);
  document.getElementById("nc-fecha").addEventListener("change", onModalDateChange);
  document.getElementById("form-nueva-cita").addEventListener("submit", onModalSubmit);
  document.getElementById("modal-nueva-cita").addEventListener("click", (e) => {
    if (e.target.id === "modal-nueva-cita") cerrarModalNuevaCita();
  });
}


async function abrirModalNuevaCita() {
  resetModalNuevaCita();
  document.getElementById("modal-nueva-cita").hidden = false;

  // Llenar pacientes
  const selectPac = document.getElementById("nc-paciente");
  selectPac.innerHTML = "<option value=\"\">Elegí un paciente</option>";
  state.patients.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.last_name}, ${p.first_name} (DNI ${p.dni})`;
    selectPac.appendChild(opt);
  });

  // Llenar especialidades
  const selectEsp = document.getElementById("nc-especialidad");
  selectEsp.innerHTML = "<option value=\"\">Elegí una especialidad</option>";
  state.specialties.forEach((e) => {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = e.name;
    selectEsp.appendChild(opt);
  });
}


function cerrarModalNuevaCita() {
  document.getElementById("modal-nueva-cita").hidden = true;
}


function resetModalNuevaCita() {
  state.selectedPatientId = null;
  state.selectedSpecialtyId = null;
  state.selectedDoctorId = null;
  state.selectedDate = null;
  state.selectedStartTime = null;

  document.getElementById("nc-paciente").value = "";
  document.getElementById("nc-especialidad").value = "";
  const selMed = document.getElementById("nc-medico");
  selMed.innerHTML = "<option value=\"\">Primero elegí una especialidad</option>";
  selMed.disabled = true;
  const inputFecha = document.getElementById("nc-fecha");
  inputFecha.value = "";
  inputFecha.disabled = true;
  document.getElementById("nc-horarios-group").hidden = true;
  document.getElementById("nc-submit").disabled = true;
  document.getElementById("nc-error").hidden = true;
}


function onModalPatientChange(e) {
  state.selectedPatientId = e.target.value ? Number(e.target.value) : null;
  actualizarSubmitModal();
}


function onModalSpecialtyChange(e) {
  const specialtyId = e.target.value ? Number(e.target.value) : null;
  state.selectedSpecialtyId = specialtyId;
  state.selectedDoctorId = null;
  state.selectedDate = null;
  state.selectedStartTime = null;

  const selMed = document.getElementById("nc-medico");
  const inputFecha = document.getElementById("nc-fecha");
  document.getElementById("nc-horarios-group").hidden = true;
  inputFecha.value = "";
  inputFecha.disabled = true;

  if (!specialtyId) {
    selMed.innerHTML = "<option value=\"\">Primero elegí una especialidad</option>";
    selMed.disabled = true;
    actualizarSubmitModal();
    return;
  }

  const filtered = filterDoctorsBySpecialty(state.doctors, specialtyId);
  selMed.innerHTML = "";
  if (filtered.length === 0) {
    selMed.innerHTML = "<option value=\"\">No hay médicos para esa especialidad</option>";
    selMed.disabled = true;
    actualizarSubmitModal();
    return;
  }
  const first = document.createElement("option");
  first.value = "";
  first.textContent = "Elegí un médico";
  selMed.appendChild(first);
  filtered.forEach((doc) => {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = `${doc.last_name}, ${doc.first_name}`;
    selMed.appendChild(opt);
  });
  selMed.disabled = false;
  actualizarSubmitModal();
}


function onModalDoctorChange(e) {
  const doctorId = e.target.value ? Number(e.target.value) : null;
  state.selectedDoctorId = doctorId;
  state.selectedDate = null;
  state.selectedStartTime = null;

  const inputFecha = document.getElementById("nc-fecha");
  document.getElementById("nc-horarios-group").hidden = true;
  inputFecha.value = "";
  inputFecha.disabled = !doctorId;

  if (doctorId) {
    const today = new Date().toISOString().split("T")[0];
    inputFecha.min = today;
  }
  actualizarSubmitModal();
}


async function onModalDateChange(e) {
  const dateStr = e.target.value;
  state.selectedDate = dateStr || null;
  state.selectedStartTime = null;

  const horariosGroup = document.getElementById("nc-horarios-group");
  if (!dateStr || !state.selectedDoctorId) {
    horariosGroup.hidden = true;
    actualizarSubmitModal();
    return;
  }
  horariosGroup.hidden = false;
  await loadHorariosModal(state.selectedDoctorId, dateStr);
}


async function loadHorariosModal(doctorId, dateStr) {
  const loading = document.getElementById("nc-horarios-loading");
  const empty = document.getElementById("nc-horarios-empty");
  const grid = document.getElementById("nc-horarios-grid");

  loading.hidden = false;
  empty.hidden = true;
  grid.hidden = true;
  grid.innerHTML = "";

  try {
    const data = await fetchAvailability(doctorId, dateStr);
    loading.hidden = true;
    if (!data.slots || data.slots.length === 0) {
      empty.hidden = false;
      return;
    }
    grid.hidden = false;
    data.slots.forEach((slot) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = slot.available ? "horario-btn" : "horario-btn horario-btn-ocupado";
      btn.textContent = formatTime(slot.start_time);
      btn.disabled = !slot.available;
      if (slot.available) {
        btn.addEventListener("click", () => onModalHorarioSelect(btn, slot.start_time));
      }
      grid.appendChild(btn);
    });
  } catch (err) {
    loading.hidden = true;
    empty.hidden = false;
    showToast("No pudimos cargar los horarios.", "error");
  }
}


function onModalHorarioSelect(btn, startTime) {
  document.querySelectorAll("#nc-horarios-grid .horario-btn").forEach((b) => {
    b.classList.remove("horario-btn-seleccionado");
  });
  btn.classList.add("horario-btn-seleccionado");
  state.selectedStartTime = startTime;
  actualizarSubmitModal();
}


function actualizarSubmitModal() {
  const completo =
    state.selectedPatientId &&
    state.selectedSpecialtyId &&
    state.selectedDoctorId &&
    state.selectedDate &&
    state.selectedStartTime;
  document.getElementById("nc-submit").disabled = !completo;
}


async function onModalSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById("nc-error");
  errorEl.hidden = true;

  if (!state.selectedPatientId || !state.selectedSpecialtyId ||
      !state.selectedDoctorId || !state.selectedDate ||
      !state.selectedStartTime) {
    errorEl.textContent = "Falta completar algún paso.";
    errorEl.hidden = false;
    return;
  }

  const submit = document.getElementById("nc-submit");
  const originalText = submit.textContent;
  submit.disabled = true;
  submit.textContent = "Creando...";

  try {
    await createAppointment({
      patient_id: state.selectedPatientId,
      doctor_id: state.selectedDoctorId,
      specialty_id: state.selectedSpecialtyId,
      appointment_date: state.selectedDate,
      start_time: state.selectedStartTime,
    });
    showToast("¡Cita creada con éxito!", "success");
    cerrarModalNuevaCita();
    await loadCitas();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = originalText;
  }
}



// ----- Seccion de ausencias del admin -----

async function cargarAusenciasAdmin() {
  const loading = document.getElementById("ausencias-admin-loading");
  const empty = document.getElementById("ausencias-admin-empty");
  const list = document.getElementById("ausencias-admin-list");
  loading.hidden = false;
  empty.hidden = true;
  list.hidden = true;
  list.innerHTML = "";

  const estado = document.getElementById("filtro-ausencia-estado").value;
  let url = "/absences";
  if (estado) {
    url += `?status_filter=${estado}`;
  }

  try {
    const data = await apiFetch(url);
    loading.hidden = true;
    if (!data || data.length === 0) {
      empty.hidden = false;
      return;
    }
    list.hidden = false;
    data.forEach((a) => list.appendChild(renderAusenciaAdmin(a)));
  } catch (err) {
    loading.hidden = true;
    empty.hidden = false;
    showToast("No pudimos cargar las ausencias: " + err.message, "error");
  }
}

function renderAusenciaAdmin(a) {
  const card = document.createElement("article");
  let claseEstado = "cita-no-show";
  if (a.resolved_at) {
    claseEstado = "cita-atendida";
  } else if (a.seen_at) {
    claseEstado = "cita-confirmada";
  }
  card.className = `cita-card ${claseEstado}`;

  const doctorName = a.doctor_name || `Médico #${a.doctor_id}`;
  const motivo = a.reason ? a.reason : "Sin motivo especificado";
  let estadoTexto = "Pendiente de gestión";
  if (a.resolved_at) estadoTexto = "Resuelta";
  else if (a.seen_at) estadoTexto = "Vista, sin resolver";

  card.innerHTML = `
    <div class="cita-info">
      <p class="cita-fecha">${formatDate(a.absence_date)} — ${doctorName}</p>
      <p class="cita-detalle">${motivo}</p>
      <p class="cita-estado">${estadoTexto}</p>
    </div>
  `;

  const acciones = document.createElement("div");
  acciones.className = "cita-acciones";

  if (!a.seen_at) {
    const btnVista = document.createElement("button");
    btnVista.type = "button";
    btnVista.className = "btn btn-sm";
    btnVista.textContent = "Marcar vista";
    btnVista.addEventListener("click", () => marcarAusenciaVista(a.id));
    acciones.appendChild(btnVista);
  }

  if (!a.resolved_at) {
    const btnResolver = document.createElement("button");
    btnResolver.type = "button";
    btnResolver.className = "btn btn-sm";
    btnResolver.textContent = "Marcar resuelta";
    btnResolver.addEventListener("click", () => resolverAusencia(a.id));
    acciones.appendChild(btnResolver);
  }

  if (acciones.children.length > 0) {
    card.appendChild(acciones);
  }
  return card;
}

async function marcarAusenciaVista(id) {
  try {
    await apiFetch(`/absences/${id}/mark-seen`, { method: "PATCH" });
    showToast("Ausencia marcada como vista.", "success");
    await cargarAusenciasAdmin();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function resolverAusencia(id) {
  if (!confirm("¿Marcar esta ausencia como resuelta? Solo si ya gestionaste todas las citas afectadas.")) return;
  try {
    await apiFetch(`/absences/${id}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    showToast("Ausencia marcada como resuelta.", "success");
    await cargarAusenciasAdmin();
  } catch (err) {
    showToast(err.message, "error");
  }
}


// Listener del filtro de estado
document.addEventListener("DOMContentLoaded", () => {
  const filtro = document.getElementById("filtro-ausencia-estado");
  if (filtro) {
    filtro.addEventListener("change", cargarAusenciasAdmin);
  }
  const btnLimpiar = document.getElementById("ausencias-limpiar");
  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      document.getElementById("filtro-ausencia-estado").value = "";
      cargarAusenciasAdmin();
    });
  }
});