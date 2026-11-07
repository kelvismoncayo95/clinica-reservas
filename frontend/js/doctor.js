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
  const hoy = getHoyLocal();
  document.getElementById("filtro-fecha-desde").value = hoy;
  document.getElementById("filtro-fecha-hasta").value = hoy;

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
  document.getElementById("filtro-fecha-desde").addEventListener("change", () => {
    actualizarRestriccionesFecha();
    onFechaChange();
  });
  document.getElementById("filtro-fecha-hasta").addEventListener("change", () => {
    actualizarRestriccionesFecha();
    onFechaChange();
  });
  document.getElementById("filtro-estado").addEventListener("change", cargarCitas);
  
  // Botones de acceso rápido
  document.getElementById("filtro-hoy").addEventListener("click", () => {
    const hoy = getHoyLocal();
    document.getElementById("filtro-fecha-desde").value = hoy;
    document.getElementById("filtro-fecha-hasta").value = hoy;
    cargarCitas();
  });
  
  document.getElementById("filtro-semana").addEventListener("click", () => {
    const hoy = new Date();
    const lunes = new Date(hoy);
    const dia = hoy.getDay();
    const diff = dia === 0 ? -6 : 1 - dia;
    lunes.setDate(hoy.getDate() + diff);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    document.getElementById("filtro-fecha-desde").value = lunes.toISOString().split("T")[0];
    document.getElementById("filtro-fecha-hasta").value = domingo.toISOString().split("T")[0];
    cargarCitas();
  });
  
  document.getElementById("filtro-mes").addEventListener("click", () => {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    document.getElementById("filtro-fecha-desde").value = primerDia.toISOString().split("T")[0];
    document.getElementById("filtro-fecha-hasta").value = ultimoDia.toISOString().split("T")[0];
    cargarCitas();
  });
  
  document.getElementById("filtros-limpiar").addEventListener("click", () => {
    document.getElementById("filtro-fecha-desde").value = "";
    document.getElementById("filtro-fecha-hasta").value = "";
    document.getElementById("filtro-estado").value = "";
    cargarCitas();
  });
}


function validarRangoFechas() {
  const desde = document.getElementById("filtro-fecha-desde").value;
  const hasta = document.getElementById("filtro-fecha-hasta").value;
  
  if (desde && hasta && desde > hasta) {
    showToast("La fecha 'Desde' no puede ser posterior a 'Hasta'.", "error");
    return false;
  }
  return true;
}

function actualizarRestriccionesFecha() {
  const desde = document.getElementById("filtro-fecha-desde").value;
  const hasta = document.getElementById("filtro-fecha-hasta").value;
  
  // Si hay "Desde", el "Hasta" no puede ser menor
  document.getElementById("filtro-fecha-hasta").min = desde || "";
  
  // Si hay "Hasta", el "Desde" no puede ser mayor
  document.getElementById("filtro-fecha-desde").max = hasta || "";
}

function onFechaChange() {
  if (!validarRangoFechas()) {
    // Si el rango es inválido, vaciar la lista y mostrar el estado vacío
    document.getElementById("citas-list").innerHTML = "";
    document.getElementById("citas-list").hidden = true;
    document.getElementById("citas-empty").hidden = false;
    return;
  }
  cargarCitas();
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
  const fechaDesde = document.getElementById("filtro-fecha-desde").value;
  const fechaHasta = document.getElementById("filtro-fecha-hasta").value;
  const estado = document.getElementById("filtro-estado").value;
  if (fechaDesde) params.append("date_from", fechaDesde);
  if (fechaHasta) params.append("date_to", fechaHasta);
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
  return formatFechaLegible(fechaStr);
}


function renderCita(c) {
  const card = document.createElement("article");
  card.className = "lista-card";

  const avatar = document.createElement("div");
  avatar.className = "lista-avatar";
  let iniciales = "?";
  if (c.patient_name) {
    const partes = c.patient_name.split(",");
    if (partes.length === 2) {
      iniciales = (partes[0].trim().charAt(0) + partes[1].trim().charAt(0)).toUpperCase();
    }
  }
  avatar.textContent = iniciales;

  const contenido = document.createElement("div");
  contenido.className = "lista-contenido";

  const titulo = document.createElement("div");
  titulo.className = "lista-titulo";
  titulo.textContent = `${formatTime(c.start_time)} — ${formatTime(c.end_time)}`;

  const detalle = document.createElement("div");
  detalle.className = "lista-detalle";
  detalle.textContent = c.patient_name || `Paciente #${c.patient_id}`;

  const secundario = document.createElement("div");
  secundario.className = "lista-detalle-secundario";
  secundario.textContent = c.specialty_name || "Consulta médica";

  contenido.appendChild(titulo);
  contenido.appendChild(detalle);
  contenido.appendChild(secundario);

  const estado = document.createElement("span");
  const statusClass = c.status === "confirmed" ? "lista-estado-activo"
    : c.status === "attended" ? "lista-estado-activo"
    : "lista-estado-inactivo";
  estado.className = `lista-estado ${statusClass}`;
  estado.textContent = getStatusLabel(c.status);

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

  card.appendChild(avatar);
  card.appendChild(contenido);
  card.appendChild(estado);
  
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
  const btnNavAusencia = document.getElementById("nav-notificar-ausencia");
  if (btnNavAusencia) {
    btnNavAusencia.addEventListener("click", () => abrirModalAusencia());
  }
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

  const hoy = getHoyLocal();
  document.getElementById("aus-fecha").min = hoy;

  document.getElementById("modal-ausencia").showModal();
}

function cerrarModalAusencia() {
  const dialog = document.getElementById("modal-ausencia");
  if (dialog.open) dialog.close();
  const submit = document.getElementById("aus-submit");
  submit.disabled = false;
  submit.textContent = "Notificar ausencia";
}

async function onAusenciaSubmit(e) {
  e.preventDefault();
  limpiarErrorFormulario("aus-error");
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
      <p class="cita-fecha">${escapeHTML(formatFechaLegible(a.absence_date))}</p>
      <p class="cita-detalle">${escapeHTML(motivo)}</p>
      <p class="cita-estado">${escapeHTML(estado)}</p>
    </div>
  `;
  return card;
}