// ============================================================
// agenda-admin.js - Agenda Semanal (grilla con bloques)
// ============================================================

let agendaSemanaActual = null; // Fecha del lunes de la semana que se ve

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("section-agenda")) return;

  const btnAgenda = document.getElementById("nav-agenda");
  if (btnAgenda) {
    btnAgenda.addEventListener("click", () => {
      if (!agendaSemanaActual) {
        agendaSemanaActual = obtenerLunesDeEstaSemana();
      }
      cargarAgenda(agendaSemanaActual);
    });
  }

  const btnAnterior = document.getElementById("agenda-semana-anterior");
  const btnSiguiente = document.getElementById("agenda-semana-siguiente");
  const btnNueva = document.getElementById("agenda-nueva-cita");

  if (btnAnterior) {
    btnAnterior.addEventListener("click", () => {
      agendaSemanaActual.setDate(agendaSemanaActual.getDate() - 7);
      cargarAgenda(agendaSemanaActual);
    });
  }
  if (btnSiguiente) {
    btnSiguiente.addEventListener("click", () => {
      agendaSemanaActual.setDate(agendaSemanaActual.getDate() + 7);
      cargarAgenda(agendaSemanaActual);
    });
  }
  if (btnNueva) {
    btnNueva.addEventListener("click", () => {
      // Abre el modal de nueva cita que ya existe
      if (typeof abrirModalNuevaCita === "function") {
        abrirModalNuevaCita();
      }
    });
  }
});

function obtenerLunesDeEstaSemana() {
  const hoy = new Date();
  const dia = hoy.getDay(); // 0 = domingo, 1 = lunes...
  const diff = dia === 0 ? -6 : 1 - dia; // Ajuste para que la semana empiece lunes
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}

function formatearFechaISO(date) {
  const anio = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

async function cargarAgenda(lunes) {
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const fechaInicio = formatearFechaISO(lunes);
  const fechaFin = formatearFechaISO(domingo);

  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  document.getElementById("agenda-rango-semana").textContent =
    `${lunes.getDate()} de ${meses[lunes.getMonth()]} al ${domingo.getDate()} de ${meses[domingo.getMonth()]}`;

  document.getElementById("agenda-loading").hidden = false;
  document.getElementById("agenda-empty").hidden = true;
  document.getElementById("agenda-grilla-container").hidden = true;

  try {
    // Construir la URL con los filtros
    const params = new URLSearchParams();
    params.append("date_from", fechaInicio);
    params.append("date_to", fechaFin);
    
    const filtroMedico = document.getElementById("agenda-filtro-medico").value;
    const filtroEsp = document.getElementById("agenda-filtro-especialidad").value;
    if (filtroMedico) params.append("doctor_id", filtroMedico);
    
    let citas = await apiFetch(`/appointments?${params.toString()}`);
    
    // Si hay filtro de especialidad, filtrar en el cliente
    if (filtroEsp) {
      citas = citas.filter((c) => c.specialty_id === parseInt(filtroEsp));
    }

    if (citas.length === 0) {
      document.getElementById("agenda-loading").hidden = true;
      document.getElementById("agenda-empty").hidden = false;
      return;
    }

    document.getElementById("agenda-loading").hidden = true;
    document.getElementById("agenda-grilla-container").hidden = false;
    dibujarGrilla(lunes, citas);
  } catch (err) {
    console.error(err);
    document.getElementById("agenda-loading").hidden = true;
    document.getElementById("agenda-empty").hidden = false;
  }
}

function dibujarGrilla(lunes, citas) {
  const grilla = document.getElementById("agenda-grilla");
  grilla.innerHTML = "";

  const diasNombres = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // 1. Header de la grilla (columna vacía + 7 días)
  const header = document.createElement("div");
  header.className = "agenda-grilla-header";
  
  const celdaVacia = document.createElement("div");
  celdaVacia.className = "agenda-grilla-celda-header";
  header.appendChild(celdaVacia);

  for (let i = 0; i < 7; i++) {
    const dia = new Date(lunes);
    dia.setDate(lunes.getDate() + i);
    
    const celda = document.createElement("div");
    celda.className = "agenda-grilla-celda-header";
    if (dia.getTime() === hoy.getTime()) celda.classList.add("hoy");
    celda.textContent = `${diasNombres[i]} ${dia.getDate()}`;
    header.appendChild(celda);
  }
  grilla.appendChild(header);

  // 2. Filas de horas (de 8 a 20)
  for (let hora = 8; hora <= 20; hora++) {
    // Columna de hora
    const celdaHora = document.createElement("div");
    celdaHora.className = "agenda-grilla-hora";
    celdaHora.textContent = `${String(hora).padStart(2, "0")}:00`;
    grilla.appendChild(celdaHora);

    // 7 celdas (una por día) para esa hora
    for (let i = 0; i < 7; i++) {
      const dia = new Date(lunes);
      dia.setDate(lunes.getDate() + i);
      const fechaDia = formatearFechaISO(dia);

      const celda = document.createElement("div");
      celda.className = "agenda-grilla-celda";

      // Buscar citas de ese día y hora
      const citasDelBloque = citas.filter((c) => {
        return c.appointment_date === fechaDia && parseInt(c.start_time.split(":")[0]) === hora;
      });

      citasDelBloque.forEach((cita) => {
        const bloque = document.createElement("div");
        bloque.className = `agenda-bloque agenda-bloque-${cita.status}`;
        bloque.title = `${cita.patient_name} - ${cita.doctor_name}`;
        bloque.innerHTML = `
          <div class="agenda-bloque-hora">${cita.start_time.substring(0, 5)}</div>
          <div class="agenda-bloque-paciente">${cita.patient_name || "Paciente"}</div>
          <div class="agenda-bloque-medico">${cita.doctor_name || ""}</div>
        `;
        bloque.addEventListener("click", () => {
          if (typeof abrirModalDetalleCita === "function") {
            abrirModalDetalleCita(cita);
          }
        });
        celda.appendChild(bloque);
      });

      grilla.appendChild(celda);
    }
  }
}


// ============================================================
// Filtros de la agenda
// ============================================================

async function inicializarFiltrosAgenda() {
  // Cargar médicos
  try {
    const medicos = await fetchDoctors();
    const selectMed = document.getElementById("agenda-filtro-medico");
    selectMed.innerHTML = '<option value="">Todos los médicos</option>';
    medicos.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.last_name}, ${m.first_name}`;
      selectMed.appendChild(opt);
    });
  } catch (err) {
    console.error("Error al cargar médicos:", err);
  }
  
  // Cargar especialidades
  try {
    const especialidades = await fetchSpecialties();
    const selectEsp = document.getElementById("agenda-filtro-especialidad");
    selectEsp.innerHTML = '<option value="">Todas las especialidades</option>';
    especialidades.forEach((e) => {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = e.name;
      selectEsp.appendChild(opt);
    });
  } catch (err) {
    console.error("Error al cargar especialidades:", err);
  }
  
  // Event listeners
  document.getElementById("agenda-filtro-medico").addEventListener("change", () => {
    if (agendaSemanaActual) cargarAgenda(agendaSemanaActual);
  });
  document.getElementById("agenda-filtro-especialidad").addEventListener("change", () => {
    if (agendaSemanaActual) cargarAgenda(agendaSemanaActual);
  });
  document.getElementById("agenda-filtros-limpiar").addEventListener("click", () => {
    document.getElementById("agenda-filtro-medico").value = "";
    document.getElementById("agenda-filtro-especialidad").value = "";
    if (agendaSemanaActual) cargarAgenda(agendaSemanaActual);
  });
}

// Llamar a inicializarFiltrosAgenda cuando se carga la agenda por primera vez
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("section-agenda")) {
    inicializarFiltrosAgenda();
  }
});
