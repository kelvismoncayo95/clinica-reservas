// ============================================================
// horarios-admin.js - Seccion de horarios y bloqueos
// ============================================================

const horariosState = {
  doctors: [],
  currentDoctorId: null,
  schedules: [],
  blocks: [],
};


const DIAS_SEMANA = [
  "Lunes", "Martes", "Miércoles", "Jueves",
  "Viernes", "Sábado", "Domingo",
];


document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("section-horarios")) return;
  setupHorariosSection();
});


function setupHorariosSection() {
  document.getElementById("horarios-medico-select").addEventListener("change", onMedicoChange);
  document.getElementById("btn-nuevo-horario").addEventListener("click", abrirModalHorario);
  document.getElementById("btn-nuevo-bloqueo").addEventListener("click", abrirModalBloqueo);
  document.getElementById("modal-horario-cerrar").addEventListener("click", cerrarModalHorario);
  document.getElementById("hor-cancelar").addEventListener("click", cerrarModalHorario);
  document.getElementById("modal-bloqueo-cerrar").addEventListener("click", cerrarModalBloqueo);
  document.getElementById("bloq-cancelar").addEventListener("click", cerrarModalBloqueo);
  document.getElementById("form-horario").addEventListener("submit", onHorarioSubmit);
  document.getElementById("form-bloqueo").addEventListener("submit", onBloqueoSubmit);
  document.getElementById("modal-horario").addEventListener("click", (e) => {
    if (e.target.id === "modal-horario") cerrarModalHorario();
  });
  document.getElementById("modal-bloqueo").addEventListener("click", (e) => {
    if (e.target.id === "modal-bloqueo") cerrarModalBloqueo();
  });
  document.getElementById("nav-horarios").addEventListener("click", cargarMedicosHorariosSiEsNecesario);
}


let horariosMedicosCargados = false;

async function cargarMedicosHorariosSiEsNecesario() {
  if (horariosMedicosCargados) return;
  try {
    horariosState.doctors = await fetchDoctors();
    const select = document.getElementById("horarios-medico-select");
    horariosState.doctors.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${d.last_name}, ${d.first_name}`;
      select.appendChild(opt);
    });
    horariosMedicosCargados = true;
  } catch (err) {
    showToast("No pudimos cargar los médicos.", "error");
  }
}


function onMedicoChange(e) {
  const doctorId = e.target.value ? Number(e.target.value) : null;
  horariosState.currentDoctorId = doctorId;
  const sinMedico = document.getElementById("horarios-sin-medico");
  const contenido = document.getElementById("horarios-contenido");
  if (!doctorId) {
    sinMedico.hidden = false;
    contenido.hidden = true;
    return;
  }
  sinMedico.hidden = true;
  contenido.hidden = false;
  cargarSchedules(doctorId);
  cargarBlocks(doctorId);
}


async function cargarSchedules(doctorId) {
  const loading = document.getElementById("schedules-loading");
  const empty = document.getElementById("schedules-empty");
  const list = document.getElementById("schedules-list");
  loading.hidden = false;
  empty.hidden = true;
  list.hidden = true;
  list.innerHTML = "";
  try {
    const data = await apiFetch(`/doctors/${doctorId}/schedules`);
    console.log("cargarSchedules: data =", data);
    horariosState.schedules = data;
    loading.hidden = true;
    if (!data || data.length === 0) {
      empty.hidden = false;
      return;
    }
    list.hidden = false;
    list.appendChild(renderTablaSchedules(data));
  } catch (err) {
    loading.hidden = true;
    empty.hidden = false;
    console.error("Error en cargarSchedules:", err);
    showToast("Error al cargar horarios: " + (err.message || "desconocido"), "error");
  }
}


function renderTablaSchedules(schedules) {
  const tabla = document.createElement("table");
  tabla.className = "horarios-tabla";
  tabla.innerHTML = `
    <thead>
      <tr>
        <th>Día</th>
        <th>Desde</th>
        <th>Hasta</th>
        <th>Duración</th>
        <th>Vigencia</th>
        <th></th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");
  schedules.forEach((s) => {
    const tr = document.createElement("tr");
    let vigencia;
    if (!s.valid_until) {
      vigencia = "Sin corte";
    } else {
      vigencia = `Hasta ${formatDate(s.valid_until)}`;
      if (s.closed_at) {
        const fechaCierre = formatDateTime(s.closed_at);
        const admin = s.closed_by_email || `Admin #${s.closed_by}`;
        vigencia += ` (cerrado por ${admin} el ${fechaCierre})`;
      }
    }
    tr.innerHTML = `
      <td>${DIAS_SEMANA[s.day_of_week]}</td>
      <td>${formatTime(s.start_time)}</td>
      <td>${formatTime(s.end_time)}</td>
      <td>${s.slot_duration_minutes} min</td>
      <td>${vigencia}</td>
    `;
    const tdAcc = document.createElement("td");
    tdAcc.className = "acciones-horario";

    // Boton principal: cerrar horario con fecha de corte
    const btnCerrar = document.createElement("button");
    btnCerrar.type = "button";
    btnCerrar.className = "btn btn-sm";
    btnCerrar.textContent = "Cerrar";
    btnCerrar.title = "Cerrar este horario a partir de una fecha";
    btnCerrar.addEventListener("click", () => abrirModalCerrarHorario(s));
    tdAcc.appendChild(btnCerrar);

    // Separador visual
    const separador = document.createElement("div");
    separador.className = "acciones-separador";
    tdAcc.appendChild(separador);

    // Boton secundario: desactivar sin fecha (por si fue un error)
    const btnDesactivar = document.createElement("button");
    btnDesactivar.type = "button";
    btnDesactivar.className = "btn btn-peligro btn-sm";
    btnDesactivar.textContent = "Desactivar";
    btnDesactivar.title = "Solo usar si el horario se cargó por error. No se puede desactivar si hay citas futuras.";
    btnDesactivar.addEventListener("click", () => desactivarSchedule(s.id));
    tdAcc.appendChild(btnDesactivar);

    // Nota aclaratoria
    const nota = document.createElement("p");
    nota.className = "acciones-nota";
    nota.textContent = "Solo si fue un error";
    tdAcc.appendChild(nota);

    tr.appendChild(tdAcc);
    tbody.appendChild(tr);
  });
  tabla.appendChild(tbody);
  return tabla;
}


// ----- Bloques -----

async function cargarBlocks(doctorId) {
  const loading = document.getElementById("blocks-loading");
  const empty = document.getElementById("blocks-empty");
  const list = document.getElementById("blocks-list");
  loading.hidden = false;
  empty.hidden = true;
  list.hidden = true;
  list.innerHTML = "";
  try {
    const data = await apiFetch(`/doctors/${doctorId}/blocks`);
    horariosState.blocks = data;
    loading.hidden = true;
    if (!data || data.length === 0) {
      empty.hidden = false;
      return;
    }
    list.hidden = false;
    data.forEach((b) => list.appendChild(renderBlock(b)));
  } catch (err) {
    loading.hidden = true;
    empty.hidden = false;
    showToast("No pudimos cargar los bloqueos.", "error");
  }
}


function renderBlock(b) {
  const card = document.createElement("article");
  card.className = "cita-card";
  const motivo = b.reason ? b.reason : "Sin motivo especificado";
  card.innerHTML = `
    <div class="cita-info">
      <p class="cita-fecha">Del ${formatDate(b.start_date)} al ${formatDate(b.end_date)}</p>
      <p class="cita-estado">${motivo}</p>
    </div>
  `;
  const acciones = document.createElement("div");
  acciones.className = "cita-acciones";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-peligro btn-sm";
  btn.textContent = "Eliminar";
  btn.addEventListener("click", () => eliminarBlock(b.id));
  acciones.appendChild(btn);
  card.appendChild(acciones);
  return card;
}


// ----- Modal de horario -----

function abrirModalHorario() {
  document.getElementById("form-horario").reset();
  document.querySelectorAll("#form-horario .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });
  document.getElementById("modal-horario").hidden = false;
}


function cerrarModalHorario() {
  document.getElementById("modal-horario").hidden = true;
}


async function onHorarioSubmit(e) {
  e.preventDefault();
  document.querySelectorAll("#form-horario .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });
  const data = {
    day_of_week: Number(document.getElementById("hor-dia").value),
    start_time: document.getElementById("hor-inicio").value + ":00",
    end_time: document.getElementById("hor-fin").value + ":00",
    slot_duration_minutes: Number(document.getElementById("hor-duracion").value),
  };

  if (!document.getElementById("hor-inicio").value) {
    setFieldError("hor-inicio", "Ingresá la hora de inicio.");
    return;
  }
  if (!document.getElementById("hor-fin").value) {
    setFieldError("hor-fin", "Ingresá la hora de fin.");
    return;
  }

  const submit = document.getElementById("hor-submit");
  const originalText = submit.textContent;
  submit.disabled = true;
  submit.textContent = "Agregando...";

  try {
    await apiFetch(`/doctors/${horariosState.currentDoctorId}/schedules`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    showToast("Horario agregado.", "success");
    cerrarModalHorario();
    await cargarSchedules(horariosState.currentDoctorId);
  } catch (err) {
    document.getElementById("hor-error").textContent = err.message;
    document.getElementById("hor-error").hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = originalText;
  }
}


async function desactivarSchedule(id) {
  if (!confirm("¿Desactivar este horario?")) return;
  try {
    await apiFetch(`/schedules/${id}`, { method: "DELETE" });
    showToast("Horario desactivado.", "success");
    await cargarSchedules(horariosState.currentDoctorId);
  } catch (err) {
    showToast(err.message, "error");
  }
}


// ----- Modal de bloqueo -----

function abrirModalBloqueo() {
  document.getElementById("form-bloqueo").reset();
  document.querySelectorAll("#form-bloqueo .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });
  document.getElementById("modal-bloqueo").hidden = false;
}


function cerrarModalBloqueo() {
  document.getElementById("modal-bloqueo").hidden = true;
}


async function onBloqueoSubmit(e) {
  e.preventDefault();
  document.querySelectorAll("#form-bloqueo .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });
  const desde = document.getElementById("bloq-desde").value;
  const hasta = document.getElementById("bloq-hasta").value;
  const motivo = document.getElementById("bloq-motivo").value.trim() || null;

  if (!desde) { setFieldError("bloq-desde", "Ingresá la fecha de inicio."); return; }
  if (!hasta) { setFieldError("bloq-hasta", "Ingresá la fecha de fin."); return; }

  const data = { start_date: desde, end_date: hasta, reason: motivo };

  const submit = document.getElementById("bloq-submit");
  const originalText = submit.textContent;
  submit.disabled = true;
  submit.textContent = "Agregando...";

  try {
    await apiFetch(`/doctors/${horariosState.currentDoctorId}/blocks`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    showToast("Bloqueo agregado.", "success");
    cerrarModalBloqueo();
    await cargarBlocks(horariosState.currentDoctorId);
  } catch (err) {
    document.getElementById("bloq-error").textContent = err.message;
    document.getElementById("bloq-error").hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = originalText;
  }
}


async function eliminarBlock(id) {
  if (!confirm("¿Eliminar este bloqueo?")) return;
  try {
    await apiFetch(`/blocks/${id}`, { method: "DELETE" });
    showToast("Bloqueo eliminado.", "success");
    await cargarBlocks(horariosState.currentDoctorId);
  } catch (err) {
    showToast(err.message, "error");
  }
}



// ----- Modal de cierre de horario -----

let horarioActual = null;

function abrirModalCerrarHorario(schedule) {
  horarioActual = schedule;

  // Reset del boton submit (por si quedo trabado de una operacion anterior)
  const submit = document.getElementById("cerrar-submit");
  submit.disabled = false;
  submit.textContent = "Cerrar horario";
  submit.onclick = null;

  document.getElementById("form-cerrar-horario").reset();
  document.querySelectorAll("#form-cerrar-horario .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });
  document.getElementById("cerrar-afectadas").hidden = true;
  document.getElementById("cerrar-afectadas-list").innerHTML = "";

  // Fecha minima: manana
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];
  document.getElementById("cerrar-valid-until").min = minDate;

  document.getElementById("modal-cerrar-horario").hidden = false;
}

function cerrarModalCerrarHorario() {
  document.getElementById("modal-cerrar-horario").hidden = true;
  horarioActual = null;
  const submit = document.getElementById("cerrar-submit");
  submit.disabled = false;
  submit.textContent = "Cerrar horario";
  submit.onclick = null;
}

async function onCerrarHorarioSubmit(e) {
  e.preventDefault();
  document.querySelectorAll("#form-cerrar-horario .form-error").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });

  const validUntil = document.getElementById("cerrar-valid-until").value;
  if (!validUntil) {
    setFieldError("cerrar-valid-until", "Elegí una fecha.");
    return;
  }

  // Validar que la fecha sea al menos manana
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const mananaStr = manana.toISOString().split("T")[0];
  if (validUntil < mananaStr) {
    setFieldError("cerrar-valid-until", "La fecha tiene que ser al menos manana.");
    return;
  }

  if (!horarioActual) {
    setGlobalError("cerrar-error", "No hay horario seleccionado.");
    return;
  }

  const submit = document.getElementById("cerrar-submit");
  const originalText = submit.textContent;
  submit.disabled = true;
  submit.textContent = "Cerrando...";

  try {
    const result = await apiFetch(
      `/schedules/${horarioActual.id}/close`,
      {
        method: "PATCH",
        body: JSON.stringify({ valid_until: validUntil }),
      }
    );

    if (result.affected_appointments && result.affected_appointments.length > 0) {
      const list = document.getElementById("cerrar-afectadas-list");
      list.innerHTML = "";
      result.affected_appointments.forEach((c) => {
        const div = document.createElement("p");
        div.className = "cita-detalle";
        div.textContent = `- ${formatDate(c.appointment_date)} a las ${formatTime(c.start_time)} - ${c.patient_name || "Paciente #" + c.patient_id}`;
        list.appendChild(div);
      });
      document.getElementById("cerrar-afectadas").hidden = false;
      showToast(`Horario cerrado. Hay ${result.affected_appointments.length} cita(s) que gestionar.`, "info");
      submit.disabled = false;
      submit.textContent = "Entendido";
      submit.onclick = (e) => {
        e.preventDefault();
        cerrarModalCerrarHorario();
        cargarSchedules(horariosState.currentDoctorId);
      };
    } else {
      showToast("Horario cerrado sin citas afectadas.", "success");
      cerrarModalCerrarHorario();
      await cargarSchedules(horariosState.currentDoctorId);
    }
  } catch (err) {
    setGlobalError("cerrar-error", err.message);
    submit.disabled = false;
    submit.textContent = originalText;
    submit.onclick = null;
  }
}


document.addEventListener("DOMContentLoaded", () => {
  const btnCerrar = document.getElementById("modal-cerrar-horario-cerrar");
  if (btnCerrar) btnCerrar.addEventListener("click", cerrarModalCerrarHorario);
  const btnCancelar = document.getElementById("cerrar-cancelar");
  if (btnCancelar) btnCancelar.addEventListener("click", cerrarModalCerrarHorario);
  const formCerrar = document.getElementById("form-cerrar-horario");
  if (formCerrar) formCerrar.addEventListener("submit", onCerrarHorarioSubmit);
});