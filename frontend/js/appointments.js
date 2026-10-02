// ============================================================
// appointments.js - Funciones para hablar con la API de citas
// ============================================================

// ----- Especialidades -----

async function fetchSpecialties() {
  return apiFetch("/specialties");
}


// ----- Medicos -----

async function fetchDoctors() {
  return apiFetch("/doctors");
}


function filterDoctorsBySpecialty(doctors, specialtyId) {
  return doctors.filter((d) => (d.specialty_ids || []).includes(specialtyId));
}


// ----- Disponibilidad -----

async function fetchAvailability(doctorId, dateStr) {
  return apiFetch(`/availability?doctor_id=${doctorId}&date=${dateStr}`);
}


// ----- Citas -----

async function createAppointment(data) {
  return apiFetch("/appointments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}


async function fetchMyAppointments() {
  return apiFetch("/appointments/me");
}


async function fetchAppointments(params = {}) {
  const query = new URLSearchParams();
  if (params.date) query.append("date", params.date);
  if (params.doctor_id) query.append("doctor_id", params.doctor_id);
  if (params.patient_id) query.append("patient_id", params.patient_id);
  if (params.status) query.append("status", params.status);
  const qs = query.toString();
  return apiFetch(`/appointments${qs ? "?" + qs : ""}`);
}


async function cancelAppointment(id) {
  return apiFetch(`/appointments/${id}/cancel`, { method: "PATCH" });
}


async function rescheduleAppointment(id, data) {
  return apiFetch(`/appointments/${id}/reschedule`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}


async function updateAppointmentStatus(id, status) {
  return apiFetch(`/appointments/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}


// ----- Helpers de traduccion de estado -----

function getStatusLabel(status) {
  const labels = {
    confirmed: "Confirmada",
    cancelled: "Cancelada",
    attended: "Atendida",
    no_show: "No asistió",
  };
  return labels[status] || status;
}


function getStatusClass(status) {
  const classes = {
    confirmed: "cita-confirmada",
    cancelled: "cita-cancelada",
    attended: "cita-atendida",
    no_show: "cita-no-show",
  };
  return classes[status] || "";
}


function isFutureAppointment(appointment) {
  const [y, m, d] = appointment.appointment_date.split("-").map(Number);
  const [h, min] = appointment.start_time.split(":").map(Number);
  const target = new Date(y, m - 1, d, h, min);
  return target > new Date();
}
