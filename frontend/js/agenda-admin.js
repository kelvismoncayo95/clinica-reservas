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
    
    const filtroMedico = document.getElementById("agenda-filtro-medico-id").value;
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

      // Mostramos solo las primeras 2 citas y un botón "+N más"
        const MAX_VISIBLES = 2;
        citasDelBloque.slice(0, MAX_VISIBLES).forEach((c) => {
          celda.appendChild(crearBloque(c));
        });
        if (citasDelBloque.length > MAX_VISIBLES) {
          const mas = document.createElement("button");
          mas.type = "button";
          mas.className = "agenda-mas";
          mas.textContent = `+${citasDelBloque.length - MAX_VISIBLES} más`;
          mas.addEventListener("click", () => {
            mas.remove();
            citasDelBloque.slice(MAX_VISIBLES).forEach((c) => celda.appendChild(crearBloque(c)));
          });
          celda.appendChild(mas);
        }

      grilla.appendChild(celda);
    }
  }
}


// ============================================================
// Filtros de la agenda
// ============================================================

let agendaMedicosCache = [];
let agendaEspecialidadesCache = [];

async function inicializarFiltrosAgenda() {
  try {
    agendaMedicosCache = await fetchDoctors();
    agendaEspecialidadesCache = await fetchSpecialties();
  } catch (err) {
    console.error("Error al cargar filtros:", err);
    return;
  }
  
  llenarSelectMedicos(agendaMedicosCache);
  llenarSelectEspecialidades(agendaEspecialidadesCache);
  
  // Al cambiar especialidad -> filtrar médicos
  document.getElementById("agenda-filtro-especialidad").addEventListener("change", () => {
    const espId = document.getElementById("agenda-filtro-especialidad").value;
    if (espId) {
      const medicosFiltrados = agendaMedicosCache.filter((m) =>
        (m.specialty_ids || []).includes(parseInt(espId))
      );
      llenarSelectMedicos(medicosFiltrados);
    } else {
      llenarSelectMedicos(agendaMedicosCache);
    }
    if (agendaSemanaActual) cargarAgenda(agendaSemanaActual);
  });
  

  
  // Limpiar
  document.getElementById("agenda-filtros-limpiar").addEventListener("click", () => {
    document.getElementById("agenda-filtro-medico").value = "";
    document.getElementById("agenda-filtro-medico-id").value = "";
    document.getElementById("agenda-filtro-especialidad").value = "";
    llenarSelectMedicos(agendaMedicosCache);
    llenarSelectEspecialidades(agendaEspecialidadesCache);
    if (agendaSemanaActual) cargarAgenda(agendaSemanaActual);
  });
}

function llenarSelectMedicos(medicos) {
  const medicoItems = medicos.map((m) => ({
    value: m.id,
    label: `${m.last_name}, ${m.first_name}`,
    detalle: m.specialty_ids?.length
      ? m.specialty_ids.map((id) => {
          const esp = agendaEspecialidadesCache.find((e) => e.id === id);
          return esp ? esp.name : null;
        }).filter(Boolean).join(", ")
      : "",
  }));
  initSearchableSelect("agenda-filtro-medico", medicoItems, (item) => {
    document.getElementById("agenda-filtro-medico-id").value = item ? item.value : "";
    if (item && item.value) {
      const medico = agendaMedicosCache.find((m) => m.id === item.value);
      if (medico && medico.specialty_ids && medico.specialty_ids.length > 0) {
        const especialidadesDelMedico = agendaEspecialidadesCache.filter((e) =>
          medico.specialty_ids.includes(e.id)
        );
        llenarSelectEspecialidades(especialidadesDelMedico);
      } else {
        llenarSelectEspecialidades(agendaEspecialidadesCache);
      }
    } else {
      llenarSelectEspecialidades(agendaEspecialidadesCache);
    }
    if (agendaSemanaActual) cargarAgenda(agendaSemanaActual);
  });
}

function llenarSelectEspecialidades(especialidades) {
  const select = document.getElementById("agenda-filtro-especialidad");
  const valorActual = select.value;
  select.innerHTML = '<option value="">Todas las especialidades</option>';
  especialidades.forEach((e) => {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = e.name;
    if (String(e.id) === valorActual) opt.selected = true;
    select.appendChild(opt);
  });
}

// Llamar a inicializarFiltrosAgenda cuando se carga la agenda por primera vez
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("section-agenda")) {
    inicializarFiltrosAgenda();
  }
});


// ============================================================
// Render de la Agenda en formato Lista (para ver todas las citas)
// ============================================================
function renderAgendaLista() {
  const tbody = document.getElementById("agenda-lista-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  // Usamos el state de citas que ya se cargó en la agenda
  const citas = state.citas || [];

  if (citas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No hay citas en esta semana.</td></tr>';
    return;
  }

  // Ordenamos por fecha y hora
  const citasOrdenadas = [...citas].sort((a, b) => {
    if (a.appointment_date !== b.appointment_date) return a.appointment_date.localeCompare(b.appointment_date);
    return a.start_time.localeCompare(b.start_time);
  });

  citasOrdenadas.forEach((c) => {
    const tr = document.createElement("tr");
    const statusClass = c.status === 'confirmed' ? 'lista-estado-activo'
      : c.status === 'attended' ? 'lista-estado-activo'
      : 'lista-estado-inactivo';
    tr.innerHTML = `
      <td>${escapeHTML(formatDate(c.appointment_date))}</td>
      <td>${escapeHTML(c.start_time.substring(0, 5))}</td>
      <td><strong>${escapeHTML(c.patient_name || "Paciente")}</strong></td>
      <td>${escapeHTML(c.doctor_name || "")}</td>
      <td>${escapeHTML(c.specialty_name || "")}</td>
      <td><span class="lista-estado ${statusClass}">${escapeHTML(getStatusLabel(c.status))}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function crearBloque(cita) {
  const b = document.createElement("div");
  b.className = `agenda-bloque agenda-bloque-${cita.status}`;
  const l1 = document.createElement("strong");
  l1.textContent = `${cita.start_time.slice(0, 5)} ${cita.patient_name || "Paciente"}`;
  const l2 = document.createElement("div");
  l2.textContent = [cita.doctor_name, cita.specialty_name].filter(Boolean).join(" · ");
  b.append(l1, l2);
  return b;
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-vista]");
  if (!btn) return;
  const grilla = document.getElementById("agenda-grilla");
  const lista = document.getElementById("agenda-lista");
  if (!grilla || !lista) return;
  grilla.hidden = btn.dataset.vista !== "calendario";
  lista.hidden = btn.dataset.vista !== "lista";
});
