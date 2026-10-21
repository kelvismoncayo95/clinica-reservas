// ============================================================
// inicio-admin.js - Pantalla de Inicio (Dashboard)
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("section-inicio")) return;
  
  // Escuchar clicks en el botón "Inicio"
  const btnInicio = document.getElementById("nav-inicio");
  if (btnInicio) {
    btnInicio.addEventListener("click", () => {
      cargarInicio();
    });
  }
});

async function cargarInicio() {
  const hoy = new Date().toISOString().split("T")[0];
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const fechaTexto = `${dias[new Date().getDay()]} ${new Date().getDate()} de ${meses[new Date().getMonth()]} · Lo que pasa hoy en la clínica`;
  document.getElementById("inicio-fecha-hoy").textContent = fechaTexto;

  // Mostrar loading
  document.getElementById("inicio-agenda-loading").hidden = false;
  document.getElementById("inicio-agenda-empty").hidden = true;
  document.getElementById("inicio-agenda-list").hidden = true;
  document.getElementById("inicio-agenda-list").innerHTML = "";

  try {
    // 1. Citas de hoy
    const citas = await apiFetch(`/appointments?date=${hoy}`);
    // 2. Ausencias pendientes
    const ausencias = await apiFetch("/absences?status_filter=pending");
    // 3. Médicos activos
    const medicos = await apiFetch("/doctors");

    // Tarjetas de resumen
    document.getElementById("inicio-total-citas").textContent = citas.length;
    const confirmadas = citas.filter(c => c.status === "confirmed").length;
    document.getElementById("inicio-detalle-citas").textContent = `${confirmadas} confirmadas · ${citas.length - confirmadas} de otros estados`;

    document.getElementById("inicio-total-ausencias").textContent = ausencias.length;
    document.getElementById("inicio-total-medicos").textContent = medicos.length;

    // Agenda del día
    if (citas.length === 0) {
      document.getElementById("inicio-agenda-loading").hidden = true;
      document.getElementById("inicio-agenda-empty").hidden = false;
    } else {
      document.getElementById("inicio-agenda-loading").hidden = true;
      document.getElementById("inicio-agenda-list").hidden = false;
      
      citas.forEach((c) => {
        const item = document.createElement("div");
        item.className = "inicio-agenda-item";
        
        const hora = document.createElement("span");
        hora.className = "inicio-agenda-hora";
        hora.textContent = c.start_time.substring(0, 5);
        
        const info = document.createElement("div");
        info.className = "inicio-agenda-info";
        
        const paciente = document.createElement("div");
        paciente.className = "inicio-agenda-paciente";
        paciente.textContent = c.patient_name || "Paciente";
        
        const detalle = document.createElement("div");
        detalle.className = "inicio-agenda-detalle";
        detalle.textContent = `${c.doctor_name || "Médico"} · ${c.specialty_name || "Especialidad"}`;
        
        info.appendChild(paciente);
        info.appendChild(detalle);
        
        const estado = document.createElement("span");
        estado.className = `estado-badge estado-${c.status}`;
        const estadosTexto = { confirmed: "Confirmada", attended: "Asistió", pending: "Pendiente", cancelled: "Cancelada", no_show: "No asistió" };
        estado.textContent = estadosTexto[c.status] || c.status;
        
        item.appendChild(hora);
        item.appendChild(info);
        item.appendChild(estado);
        document.getElementById("inicio-agenda-list").appendChild(item);
      });
    }
  } catch (err) {
    console.error(err);
    document.getElementById("inicio-agenda-loading").hidden = true;
    document.getElementById("inicio-agenda-empty").hidden = false;
  }
}
