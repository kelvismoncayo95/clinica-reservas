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

  // Arrancar mostrando la sección de Inicio
  switchSection("inicio");
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
  const secciones = ["inicio", "citas", "agenda", "ausencias", "pacientes", "medicos", "especialidades", "horarios", "usuarios"];

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

  // Enlazar el botón de Inicio explícitamente (porque el JS se cargó antes de que existiera)
  const btnInicio = document.getElementById("nav-inicio");
  if (btnInicio) {
    btnInicio.addEventListener("click", () => switchSection("inicio"));
  }

  // Enlazar el resto de las secciones
  secciones.forEach((sec) => {
    if (sec === "inicio") return; // Ya lo hicimos arriba
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
  const secciones = ["inicio", "citas", "agenda", "ausencias", "pacientes", "medicos", "especialidades", "horarios", "usuarios"];
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

  // Cargar inicio cada vez que se entra (para tener datos frescos)
  if (which === "inicio" && typeof cargarInicio === "function") {
    cargarInicio();
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
  document.getElementById("btn-nueva-cita").addEventListener("click", () => abrirModalNuevaCita());
}


// ----- Cargar medicos, pacientes, especialidades -----

async function loadDoctors() {
  try {
    state.doctors = await fetchDoctors();
    const select = document.getElementById("filtro-medico");
    select.innerHTML = '<option value="">Todos los médicos</option>';
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
    select.innerHTML = '<option value="">Todos los pacientes</option>';
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
  card.className = "lista-card";

  const doctor = state.doctors.find((d) => d.id === cita.doctor_id);
  const patient = state.patients.find((p) => p.id === cita.patient_id);
  const doctorName = doctor ? `${doctor.last_name}, ${doctor.first_name}` : `Médico #${cita.doctor_id}`;
  const patientName = patient ? `${patient.last_name}, ${patient.first_name}` : `Paciente #${cita.patient_id}`;

  // 1. Avatar con iniciales del paciente
  const avatar = document.createElement("div");
  avatar.className = "lista-avatar";
  let iniciales = "?";
  if (patient) {
    iniciales = `${(patient.first_name || "?").charAt(0)}${(patient.last_name || "?").charAt(0)}`.toUpperCase();
  }
  avatar.textContent = iniciales;

  // 2. Contenido
  const contenido = document.createElement("div");
  contenido.className = "lista-contenido";

  const hora = document.createElement("div");
  hora.className = "lista-titulo";
  hora.textContent = `${formatTime(cita.start_time)} · ${formatDate(cita.appointment_date)}`;

  const paciente = document.createElement("div");
  paciente.className = "lista-detalle";
  paciente.textContent = patientName;

  const detalle = document.createElement("div");
  detalle.className = "lista-detalle-secundario";
  detalle.textContent = `${doctorName}${cita.specialty_name ? " · " + cita.specialty_name : ""}`;

  contenido.appendChild(hora);
  contenido.appendChild(paciente);
  contenido.appendChild(detalle);

  // 3. Píldora de estado
  const estado = document.createElement("span");
  const statusClass = cita.status === "confirmed" ? "lista-estado-activo"
    : cita.status === "attended" ? "lista-estado-activo"
    : cita.status === "cancelled" ? "lista-estado-inactivo"
    : "lista-estado-inactivo";
  estado.className = `lista-estado ${statusClass}`;
  estado.textContent = getStatusLabel(cita.status);

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

  // Acciones según el estado
  if (cita.status === "confirmed") {
    const btnAtendida = document.createElement("button");
    btnAtendida.type = "button";
    btnAtendida.textContent = "Marcar atendida";
    btnAtendida.addEventListener("click", () => {
      menu.hidden = true;
      cambiarEstado(cita.id, "attended");
    });
    menu.appendChild(btnAtendida);

    const btnNoShow = document.createElement("button");
    btnNoShow.type = "button";
    btnNoShow.textContent = "Marcar no asistió";
    btnNoShow.addEventListener("click", () => {
      menu.hidden = true;
      cambiarEstado(cita.id, "no_show");
    });
    menu.appendChild(btnNoShow);

    const btnCancelar = document.createElement("button");
    btnCancelar.type = "button";
    btnCancelar.className = "peligro";
    btnCancelar.textContent = "Cancelar cita";
    btnCancelar.addEventListener("click", () => {
      menu.hidden = true;
      cancelarCitaAdmin(cita.id);
    });
    menu.appendChild(btnCancelar);
  } else if (cita.status === "attended" || cita.status === "no_show") {
    const btnDeshacer = document.createElement("button");
    btnDeshacer.type = "button";
    btnDeshacer.textContent = "Deshacer cambio";
    btnDeshacer.title = "Volver a estado confirmado (solo dentro de las 2 horas)";
    btnDeshacer.addEventListener("click", () => {
      menu.hidden = true;
      deshacerEstadoAdmin(cita.id);
    });
    menu.appendChild(btnDeshacer);
  } else {
    const info = document.createElement("button");
    info.type = "button";
    info.disabled = true;
    info.textContent = "Sin acciones disponibles";
    info.style.color = "var(--color-texto-suave)";
    menu.appendChild(info);
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


async function deshacerEstadoAdmin(id) {
  try {
    await updateAppointmentStatus(id, "confirmed");
    showToast("Cita vuelta a confirmada.", "success");
    await loadCitas();
  } catch (err) {
    showToast(err.message, "error");
  }
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
  document.getElementById("nc-especialidad").addEventListener("change", onModalSpecialtyChange);
  document.getElementById("nc-fecha").addEventListener("change", onModalDateChange);
  document.getElementById("form-nueva-cita").addEventListener("submit", onModalSubmit);
  document.getElementById("modal-nueva-cita").addEventListener("click", (e) => {
    if (e.target.id === "modal-nueva-cita") cerrarModalNuevaCita();
  });
}


async function abrirModalNuevaCita() {
  resetModalNuevaCita();
  document.getElementById("modal-nueva-cita").showModal();

  // Llenar pacientes con buscador
  const patientItems = state.patients.map((p) => ({
    value: p.id,
    label: `${p.last_name}, ${p.first_name}`,
    detalle: `DNI ${p.dni}`,
  }));
  initSearchableSelect("nc-paciente", patientItems, (item) => {
    state.selectedPatientId = item.value;
  });
  document.getElementById("nc-paciente-id").value = "";
  document.getElementById("nc-paciente").value = "";
  document.getElementById("nc-paciente-dropdown").hidden = true;

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
  const dialog = document.getElementById("modal-nueva-cita");
  if (dialog.open) dialog.close();
}


function resetModalNuevaCita() {
  state.selectedPatientId = null;
  state.selectedSpecialtyId = null;
  state.selectedDoctorId = null;
  state.selectedDate = null;
  state.selectedStartTime = null;

  document.getElementById("nc-paciente").value = "";
  document.getElementById("nc-especialidad").value = "";
  const inputMed = document.getElementById("nc-medico");
  inputMed.value = "";
  inputMed.placeholder = "Primero elegí una especialidad";
  inputMed.disabled = true;
  document.getElementById("nc-medico-id").value = "";
  document.getElementById("nc-medico-dropdown").hidden = true;
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
  limpiarErrorFormulario("nc-error");
  const specialtyId = e.target.value ? Number(e.target.value) : null;
  state.selectedSpecialtyId = specialtyId;
  state.selectedDoctorId = null;
  state.selectedDate = null;
  state.selectedStartTime = null;

  const inputMed = document.getElementById("nc-medico");
  const inputFecha = document.getElementById("nc-fecha");
  document.getElementById("nc-horarios-group").hidden = true;
  document.getElementById("nc-medico-dropdown").hidden = true;
  inputFecha.value = "";
  inputFecha.disabled = true;

  if (!specialtyId) {
    inputMed.value = "";
    inputMed.placeholder = "Primero elegí una especialidad";
    inputMed.disabled = true;
    document.getElementById("nc-medico-id").value = "";
    actualizarSubmitModal();
    return;
  }

  const filtered = filterDoctorsBySpecialty(state.doctors, specialtyId);
  inputMed.value = "";
  inputMed.disabled = false;
  document.getElementById("nc-medico-id").value = "";
  document.getElementById("nc-medico-dropdown").hidden = true;

  if (filtered.length === 0) {
    inputMed.placeholder = "No hay médicos para esa especialidad";
    inputMed.disabled = true;
    actualizarSubmitModal();
    return;
  }
  
  inputMed.placeholder = "Escribí el nombre del médico...";
  const doctorItems = filtered.map((d) => ({
    value: d.id,
    label: `${d.last_name}, ${d.first_name}`,
    detalle: `Matrícula ${d.license_number}`,
  }));
  initSearchableSelect("nc-medico", doctorItems, (item) => {
    state.selectedDoctorId = item.value;
    // Habilitar el campo de fecha cuando se elige un médico
    inputFecha.disabled = false;
    actualizarSubmitModal();
  });
  actualizarSubmitModal();
}


function onModalDoctorChange(e) {
  limpiarErrorFormulario("nc-error");
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
  limpiarErrorFormulario("nc-error");
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
    // Scroll automático al error para que el usuario lo vea sin buscar
    setTimeout(() => {
      errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
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

  if (!a.seen_at && !a.resolved_at) {
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
    await actualizarBadgeAusencias();
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
    await actualizarBadgeAusencias();
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