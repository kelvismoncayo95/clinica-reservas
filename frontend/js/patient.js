// patient.js - Panel del paciente

const state = {
  specialties: [],
  doctors: [],
  selectedSpecialtyId: null,
  selectedDoctorId: null,
  selectedDate: null,
  selectedStartTime: null,
};

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;
  if (!requireRole("patient")) return;
  setupHeader();
  setupNavigation();
  setupReservaForm();
  await Promise.all([loadSpecialties(), loadDoctors()]);
  await loadMyAppointments();
});

function setupHeader() {
  const user = getCurrentUser();
  const displayName = document.getElementById("user-display-name");
  if (user && displayName) displayName.textContent = user.email;
  document.getElementById("logout-btn").addEventListener("click", logout);
}

function setupNavigation() {
  const btnCitas = document.getElementById("nav-mis-citas");
  const btnReservar = document.getElementById("nav-reservar");
  const secCitas = document.getElementById("section-mis-citas");
  const secReservar = document.getElementById("section-reservar");
  btnCitas.addEventListener("click", () => switchSection("citas"));
  btnReservar.addEventListener("click", () => switchSection("reservar"));
  document.getElementById("ir-a-reservar").addEventListener("click", () => switchSection("reservar"));
  function switchSection(which) {
    const isCitas = which === "citas";
    btnCitas.classList.toggle("nav-item-activa", isCitas);
    btnReservar.classList.toggle("nav-item-activa", !isCitas);
    btnCitas.setAttribute("aria-selected", String(isCitas));
    btnReservar.setAttribute("aria-selected", String(!isCitas));
    secCitas.hidden = !isCitas;
    secReservar.hidden = isCitas;
  }
}

async function loadSpecialties() {
  const select = document.getElementById("reserva-especialidad");
  try {
    const list = await fetchSpecialties();
    state.specialties = list;
    select.innerHTML = "";
    if (list.length === 0) {
      select.innerHTML = "<option value=\"\">No hay especialidades</option>";
      return;
    }
    const first = document.createElement("option");
    first.value = "";
    first.textContent = "Elegí una especialidad";
    select.appendChild(first);
    list.forEach((esp) => {
      const opt = document.createElement("option");
      opt.value = esp.id;
      opt.textContent = esp.name;
      select.appendChild(opt);
    });
  } catch (err) {
    select.innerHTML = "<option value=\"\">Error al cargar</option>";
    showToast("No pudimos cargar las especialidades.", "error");
  }
}

async function loadDoctors() {
  try {
    state.doctors = await fetchDoctors();
  } catch (err) {
    showToast("No pudimos cargar los médicos.", "error");
  }
}

function setupReservaForm() {
  document.getElementById("reserva-especialidad").addEventListener("change", onSpecialtyChange);
  document.getElementById("reserva-medico").addEventListener("change", onDoctorChange);
  document.getElementById("reserva-fecha").addEventListener("change", onDateChange);
  document.getElementById("reservar-form").addEventListener("submit", onReservaSubmit);
}

function onSpecialtyChange(e) {
  const specialtyId = e.target.value ? Number(e.target.value) : null;
  state.selectedSpecialtyId = specialtyId;
  state.selectedDoctorId = null;
  state.selectedDate = null;
  state.selectedStartTime = null;
  const selectMed = document.getElementById("reserva-medico");
  const inputFecha = document.getElementById("reserva-fecha");
  document.getElementById("horarios-group").hidden = true;
  document.getElementById("reserva-submit").disabled = true;
  inputFecha.value = "";
  inputFecha.disabled = true;
  if (!specialtyId) {
    selectMed.innerHTML = "<option value=\"\">Primero elegí una especialidad</option>";
    selectMed.disabled = true;
    return;
  }
  const filtered = filterDoctorsBySpecialty(state.doctors, specialtyId);
  selectMed.innerHTML = "";
  if (filtered.length === 0) {
    selectMed.innerHTML = "<option value=\"\">No hay médicos para esa especialidad</option>";
    selectMed.disabled = true;
    return;
  }
  const first = document.createElement("option");
  first.value = "";
  first.textContent = "Elegí un médico";
  selectMed.appendChild(first);
  filtered.forEach((doc) => {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = `${doc.last_name}, ${doc.first_name}`;
    selectMed.appendChild(opt);
  });
  selectMed.disabled = false;
}

function onDoctorChange(e) {
  const doctorId = e.target.value ? Number(e.target.value) : null;
  state.selectedDoctorId = doctorId;
  state.selectedDate = null;
  state.selectedStartTime = null;
  const inputFecha = document.getElementById("reserva-fecha");
  document.getElementById("horarios-group").hidden = true;
  document.getElementById("reserva-submit").disabled = true;
  inputFecha.value = "";
  inputFecha.disabled = !doctorId;
  if (doctorId) {
    const today = new Date().toISOString().split("T")[0];
    inputFecha.min = today;
  }
}

async function onDateChange(e) {
  const dateStr = e.target.value;
  state.selectedDate = dateStr || null;
  state.selectedStartTime = null;
  document.getElementById("reserva-submit").disabled = true;
  if (!dateStr || !state.selectedDoctorId) {
    document.getElementById("horarios-group").hidden = true;
    return;
  }
  document.getElementById("horarios-group").hidden = false;
  await loadHorarios(state.selectedDoctorId, dateStr);
}

async function loadHorarios(doctorId, dateStr) {
  const loading = document.getElementById("horarios-loading");
  const empty = document.getElementById("horarios-empty");
  const grid = document.getElementById("horarios-grid");
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
        btn.addEventListener("click", () => onHorarioSelect(btn, slot.start_time));
      }
      grid.appendChild(btn);
    });
  } catch (err) {
    loading.hidden = true;
    empty.hidden = false;
    showToast("No pudimos cargar los horarios.", "error");
  }
}

function onHorarioSelect(btn, startTime) {
  document.querySelectorAll(".horario-btn").forEach((b) => b.classList.remove("horario-btn-seleccionado"));
  btn.classList.add("horario-btn-seleccionado");
  state.selectedStartTime = startTime;
  document.getElementById("reserva-submit").disabled = false;
}

async function onReservaSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById("reserva-error");
  errorEl.hidden = true;
  const submit = document.getElementById("reserva-submit");

  if (!state.selectedSpecialtyId || !state.selectedDoctorId || !state.selectedDate || !state.selectedStartTime) {
    errorEl.textContent = "Falta completar algún paso de la reserva.";
    errorEl.hidden = false;
    return;
  }

  const originalText = submit.textContent;
  submit.disabled = true;
  submit.textContent = "Reservando...";

  try {
    await createAppointment({
      doctor_id: state.selectedDoctorId,
      specialty_id: state.selectedSpecialtyId,
      appointment_date: state.selectedDate,
      start_time: state.selectedStartTime,
    });
    showToast("¡Cita reservada con éxito!", "success");
    resetReservaForm();
    await loadMyAppointments();
    document.getElementById("nav-mis-citas").click();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = originalText;
  }
}

function resetReservaForm() {
  state.selectedSpecialtyId = null;
  state.selectedDoctorId = null;
  state.selectedDate = null;
  state.selectedStartTime = null;
  document.getElementById("reserva-especialidad").value = "";
  const selectMed = document.getElementById("reserva-medico");
  selectMed.innerHTML = "<option value=\"\">Primero elegí una especialidad</option>";
  selectMed.disabled = true;
  const inputFecha = document.getElementById("reserva-fecha");
  inputFecha.value = "";
  inputFecha.disabled = true;
  document.getElementById("horarios-group").hidden = true;
}

async function loadMyAppointments() {
  const loading = document.getElementById("citas-loading");
  const empty = document.getElementById("citas-empty");
  const list = document.getElementById("citas-list");
  loading.hidden = false;
  empty.hidden = true;
  list.hidden = true;
  list.innerHTML = "";
  try {
    const citas = await fetchMyAppointments();
    loading.hidden = true;
    if (!citas || citas.length === 0) {
      empty.hidden = false;
      return;
    }
    list.hidden = false;
    citas.forEach((cita) => list.appendChild(renderCita(cita)));
  } catch (err) {
    loading.hidden = true;
    showToast("No pudimos cargar tus citas.", "error");
  }
}

function renderCita(cita) {
  const card = document.createElement("article");
  card.className = `cita-card ${getStatusClass(cita.status)}`;
  const isFuture = isFutureAppointment(cita);
  const canCancel = cita.status === "confirmed" && isFuture;
  card.innerHTML = `
    <div class="cita-info">
      <p class="cita-fecha">${formatDate(cita.appointment_date)} a las ${formatTime(cita.start_time)}</p>
      <p class="cita-estado">${getStatusLabel(cita.status)}</p>
    </div>
  `;
  if (canCancel) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-peligro btn-sm";
    btn.textContent = "Cancelar";
    btn.addEventListener("click", () => cancelarCita(cita.id));
    card.appendChild(btn);
  }
  return card;
}

async function cancelarCita(id) {
  if (!confirm("¿Estás seguro de que querés cancelar esta cita?")) return;
  try {
    await cancelAppointment(id);
    showToast("Cita cancelada.", "success");
    await loadMyAppointments();
  } catch (err) {
    showToast(err.message, "error");
  }
}
