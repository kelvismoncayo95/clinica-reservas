// ============================================================
// doctor.js - Panel del medico
// ============================================================

const state = {
  doctorId: null,
  citas: [],
};


document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;
  if (!requireRole("doctor")) return;

  setupHeader();
  setupFiltros();
  setupModalAusencia();

  // Fecha de hoy por defecto
  const hoy = new Date().toISOString().split("T")[0];
  document.getElementById("filtro-fecha").value = hoy;

  // Resolver el doctor_id del usuario logueado
  await resolverDoctorId();
  if (!state.doctorId) return;

  await cargarCitas();
  await cargarAusencias();
});


function setupHeader() {
  const user = getCurrentUser();
  const displayName = document.getElementById("user-display-name");
  if (user && displayName) displayName.textContent = user.email;
  document.getElementById("logout-btn").addEventListener("click", logout);
}


async function resolverDoctorId() {
  try {
    const doctors = await fetchDoctors();
    const user = getCurrentUser();
    const myDoctor = doctors.find((d) => d.email === user.email);
    if (!myDoctor) {
      showToast("No pudimos identificar tu ficha de médico.", "error");
      return;
    }
    state.doctorId = myDoctor.id;
  } catch (err) {
    showToast("No pudimos cargar tu información.", "error");
  }
}


function setupFiltros() {
  document.getElementById("filtro-fecha").addEventListener("change", cargarCitas);
  document.getElementById("filtro-estado").addEventListener("change", cargarCitas);
  document.getElementById("filtros-limpiar").addEventListener("click", () => {
    document.getElementById("filtro-fecha").value = "";
    document.getElementById("filtro-estado").value = "";
    cargarCitas();
  });
}


async function cargarCitas() {
  const loading = document.getElementById("citas-loading");
  const empty = document.getElementById("citas-empty");
  const list = document.getElementById("citas-list");
  loading.hidden = false;
  empty.hidden = true;
  list.hidden = true;
  list.innerHTML = "";

  if (!state.doctorId) {
    loading.hidden = true;
    return;
  }

  const params = new URLSearchParams();
  const fecha = document.getElementById("filtro-fecha").value;
  const estado = document.getElementById("filtro-estado").value;
  if (fecha) params.append("date", fecha);
  if (estado) params.append("status", estado);
  const qs = params.toString();

  try {
    // Filtrar por doctor_id directo (el backend lo controla)
    const url = `/doctors/${state.doctorId}/appointments` + (qs ? "?" + qs : "");
    const citas = await apiFetch(url);
    state.citas = citas;
    loading.hidden = true;
    if (!citas || citas.length === 0) {
      empty.hidden = false;
      return;
    }
    list.hidden = false;
    renderCitasAgrupadas(citas);
  } catch (err) {
    loading.hidden = true;
    empty.hidden = false;
    showToast("No pudimos cargar tus citas.", "error");
  }
}


function renderCitasAgrupadas(citas) {
  const container = document.getElementById("citas-list");
  container.innerHTML = "";

  // Agrupar por fecha
  const grupos = {};
  citas.forEach((c) => {
    if (!grupos[c.appointment_date]) grupos[c.appointment_date] = [];
    grupos[c.appointment_date].push(c);
  });

  // Ordenar fechas
  const fechas = Object.keys(grupos).sort();
  fechas.forEach((fecha) => {
    const grupoDiv = document.createElement("div");
    grupoDiv.className = "grupo-dia";

    const titulo = document.createElement("h3");
    titulo.className = "grupo-dia-titulo";
    titulo.textContent = formatearTituloDia(fecha);
    grupoDiv.appendChild(titulo);

    const citasDiv = document.createElement("div");
    citasDiv.className = "citas-admin-list";
    grupos[fecha].forEach((c) => citasDiv.appendChild(renderCita(c)));
    grupoDiv.appendChild(citasDiv);
    container.appendChild(grupoDiv);
  });
}


function formatearTituloDia(fechaStr) {
  const [y, m, d] = fechaStr.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                 "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${dias[fecha.getDay()]} ${d} de ${meses[m - 1]}`;
}


function renderCita(c) {
  const card = document.createElement("article");
  card.className = `cita-card ${getStatusClass(c.status)}`;

  const patientName = c.patient_name || `Paciente #${c.patient_id}`;
  const specialtyName = c.specialty_name || "";

  card.innerHTML = `
    <div class="cita-info">
      <p class="cita-fecha">${formatTime(c.start_time)} — ${formatTime(c.end_time)}</p>
      <p class="cita-detalle">${patientName}</p>
      ${specialtyName ? `<p class="cita-detalle">${specialtyName}</p>` : ""}
      <p class="cita-estado">${getStatusLabel(c.status)}</p>
    </div>
  `;

  const acciones = document.createElement("div");
  acciones.className = "cita-acciones";

  if (c.status === "confirmed") {
    const btnAtendida = document.createElement("button");
    btnAtendida.type = "button";
    btnAtendida.className = "btn btn-sm";
    btnAtendida.textContent = "Atendida";
    btnAtendida.addEventListener("click", () => cambiarEstado(c.id, "attended"));
    acciones.appendChild(btnAtendida);

    const btnNoShow = document.createElement("button");
    btnNoShow.type = "button";
    btnNoShow.className = "btn btn-sm";
    btnNoShow.textContent = "No asistió";
    btnNoShow.addEventListener("click", () => cambiarEstado(c.id, "no_show"));
    acciones.appendChild(btnNoShow);

  } else if (c.status === "attended" || c.status === "no_show") {
    const btnDeshacer = document.createElement("button");
    btnDeshacer.type = "button";
    btnDeshacer.className = "btn btn-secondary btn-sm";
    btnDeshacer.textContent = "Deshacer";
    btnDeshacer.title = "Volver a estado confirmado (solo dentro de las 2 horas)";
    btnDeshacer.addEventListener("click", () => deshacerEstado(c.id));
    acciones.appendChild(btnDeshacer);
  }

  if (acciones.children.length > 0) {
    card.appendChild(acciones);
  }
  return card;
}


async function cambiarEstado(id, nuevoEstado) {
  try {
    await updateAppointmentStatus(id, nuevoEstado);
    showToast(`Cita marcada como ${getStatusLabel(nuevoEstado).toLowerCase()}.`, "success");
    await cargarCitas();
  } catch (err) {
    showToast(err.message, "error");
  }
}


async function deshacerEstado(id) {
  if (!confirm("¿Volver esta cita al estado confirmado?")) return;
  try {
    await updateAppointmentStatus(id, "confirmed");
    showToast("Cita vuelta a confirmada.", "success");
    await cargarCitas();
  } catch (err) {
    showToast(err.message, "error");
  }
}



// ----- Modal de notificar ausencia -----

function setupModalAusencia() {
  document.getElementById("btn-no-asistir").addEventListener("click", abrirModalAusencia);
  document.getElementById("modal-ausencia-cerrar").addEventListener("click", cerrarModalAusencia);
  document.getElementById("aus-cancelar").addEventListener("click", cerrarModalAusencia);
  document.getElementById("form-ausencia").addEventListener("submit", onAusenciaSubmit);
  document.getElementById("modal-ausencia").addEventListener("click", (e) => {
    if (e.target.id === "modal-ausencia") cerrarModalAusencia();
  });
}

function abrirModalAusencia() {
  document.getElementById("form-ausencia").reset();
  document.querySelectorAll("#form-ausencia .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });

  const hoy = new Date().toISOString().split("T")[0];
  document.getElementById("aus-fecha").min = hoy;

  document.getElementById("modal-ausencia").hidden = false;
}

function cerrarModalAusencia() {
  document.getElementById("modal-ausencia").hidden = true;
  const submit = document.getElementById("aus-submit");
  submit.disabled = false;
  submit.textContent = "Notificar ausencia";
}

async function onAusenciaSubmit(e) {
  e.preventDefault();
  document.querySelectorAll("#form-ausencia .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });

  const fecha = document.getElementById("aus-fecha").value;
  const motivo = document.getElementById("aus-motivo").value.trim() || null;

  if (!fecha) {
    setFieldError("aus-fecha", "Elegí una fecha.");
    return;
  }

  const submit = document.getElementById("aus-submit");
  const originalText = submit.textContent;
  submit.disabled = true;
  submit.textContent = "Enviando...";

  try {
    await apiFetch("/doctors/me/notify-absence", {
      method: "POST",
      body: JSON.stringify({ absence_date: fecha, reason: motivo }),
    });
    showToast("Ausencia notificada. Recepción va a gestionar las citas.", "success");
    cerrarModalAusencia();
  } catch (err) {
    const errorEl = document.getElementById("aus-error");
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    submit.disabled = false;
    submit.textContent = originalText;
  }
}


// ----- Mis ausencias notificadas -----

async function cargarAusencias() {
  const loading = document.getElementById("ausencias-loading");
  const empty = document.getElementById("ausencias-empty");
  const list = document.getElementById("ausencias-list");
  loading.hidden = false;
  empty.hidden = true;
  list.hidden = true;
  list.innerHTML = "";

  try {
    const data = await apiFetch("/doctors/me/absences");
    loading.hidden = true;
    if (!data || data.length === 0) {
      empty.hidden = false;
      return;
    }
    list.hidden = false;
    data.forEach((a) => list.appendChild(renderAusencia(a)));
  } catch (err) {
    loading.hidden = true;
    empty.hidden = false;
    showToast("No pudimos cargar tus ausencias.", "error");
  }
}

function renderAusencia(a) {
  const card = document.createElement("article");
  card.className = "cita-card";

  let estado = "Pendiente de gestión";
  let claseEstado = "cita-no-show";
  if (a.resolved_at) {
    estado = "Resuelta por recepción";
    claseEstado = "cita-atendida";
  } else if (a.seen_at) {
    estado = "Vista por recepción";
    claseEstado = "cita-confirmada";
  }
  card.className = `cita-card ${claseEstado}`;

  const motivo = a.reason ? a.reason : "Sin motivo especificado";
  card.innerHTML = `
    <div class="cita-info">
      <p class="cita-fecha">${formatDate(a.absence_date)}</p>
      <p class="cita-detalle">${motivo}</p>
      <p class="cita-estado">${estado}</p>
    </div>
  `;
  return card;
}