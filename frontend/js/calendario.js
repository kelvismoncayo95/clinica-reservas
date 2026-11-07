// ============================================================
// calendario.js - Calendario de días disponibles de un médico
//
// Reemplaza al calendario del celular (<input type="date">) en los
// lugares donde se reserva o se cambia una cita. Pinta en verde los
// días en los que el médico tiene turnos libres y en gris los demás,
// con el motivo al tocarlos ("No atiende ese día", "Ausencia"...).
//
// Uso:
//   const cal = crearCalendarioDisponible("reserva-fecha");
//   cal.setDoctor(5);     // cuando se elige un médico
//   cal.setDoctor(null);  // para limpiarlo
//
// El <input> original queda oculto y sigue guardando la fecha elegida
// ("2026-11-09"). Al elegir un día se dispara su evento "change", así
// el código que ya escuchaba ese input sigue funcionando igual.
// ============================================================

const MOTIVOS_NO_DISPONIBLE = {
  pasado: "Ese día ya pasó.",
  fuera_de_rango: "Todavía no se puede reservar con tanta anticipación.",
  no_atiende: "El médico no atiende ese día.",
  bloqueado: "La clínica no atiende ese día.",
  ausencia: "El médico avisó que no viene ese día.",
  completo: "No quedan horarios libres ese día.",
};

const NOMBRES_DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];


function crearCalendarioDisponible(inputId) {
  const input = document.getElementById(inputId);
  input.type = "hidden";

  const contenedor = document.createElement("div");
  contenedor.className = "calendario";
  input.insertAdjacentElement("afterend", contenedor);

  const hoy = new Date();
  const estado = {
    doctorId: null,
    anio: hoy.getFullYear(),
    mes: hoy.getMonth(),          // 0 = enero
    dias: {},                     // "2026-11-09" -> { available, reason }
    cargando: false,
    pedidoActual: 0,              // para ignorar respuestas viejas
    mensaje: "",
  };

  function iso(anio, mes, dia) {
    return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }

  async function cargarMes() {
    if (!estado.doctorId) return;
    const pedido = ++estado.pedidoActual;
    estado.cargando = true;
    render();
    const ultimoDia = new Date(estado.anio, estado.mes + 1, 0).getDate();
    const desde = iso(estado.anio, estado.mes, 1);
    const hasta = iso(estado.anio, estado.mes, ultimoDia);
    try {
      const dias = await apiFetch(
        `/doctors/${estado.doctorId}/available-dates?from=${desde}&to=${hasta}`
      );
      // Si mientras esperábamos se cambió de médico o de mes, ignoramos
      // esta respuesta vieja (evita la "condición de carrera").
      if (pedido !== estado.pedidoActual) return;
      estado.dias = {};
      dias.forEach((d) => { estado.dias[d.date] = d; });
    } catch (err) {
      if (pedido !== estado.pedidoActual) return;
      estado.dias = {};
      estado.mensaje = "No pudimos cargar los días disponibles. Probá de nuevo.";
    }
    estado.cargando = false;
    render();
  }

  function cambiarMes(delta) {
    estado.mes += delta;
    if (estado.mes < 0) { estado.mes = 11; estado.anio -= 1; }
    if (estado.mes > 11) { estado.mes = 0; estado.anio += 1; }
    estado.mensaje = "";
    cargarMes();
  }

  function elegirDia(fechaIso) {
    const info = estado.dias[fechaIso];
    if (!info || !info.available) {
      estado.mensaje = info ? MOTIVOS_NO_DISPONIBLE[info.reason] || "Ese día no está disponible." : "";
      render();
      return;
    }
    estado.mensaje = "";
    input.value = fechaIso;
    render();
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function render() {
    contenedor.innerHTML = "";

    if (!estado.doctorId) {
      const vacio = document.createElement("p");
      vacio.className = "calendario-vacio";
      vacio.textContent = "Primero elegí un médico para ver sus días disponibles.";
      contenedor.appendChild(vacio);
      return;
    }

    // Encabezado: ◀  noviembre 2026  ▶
    const header = document.createElement("div");
    header.className = "calendario-header";
    const hoyMes = new Date().getFullYear() * 12 + new Date().getMonth();
    const esteMes = estado.anio * 12 + estado.mes;

    const btnAnterior = document.createElement("button");
    btnAnterior.type = "button";
    btnAnterior.className = "calendario-nav";
    btnAnterior.setAttribute("aria-label", "Mes anterior");
    btnAnterior.textContent = "‹";
    btnAnterior.disabled = esteMes <= hoyMes;
    btnAnterior.addEventListener("click", () => cambiarMes(-1));

    const titulo = document.createElement("span");
    titulo.className = "calendario-titulo";
    titulo.textContent = `${capitalizar(FECHA_MESES[estado.mes])} ${estado.anio}`;

    const btnSiguiente = document.createElement("button");
    btnSiguiente.type = "button";
    btnSiguiente.className = "calendario-nav";
    btnSiguiente.setAttribute("aria-label", "Mes siguiente");
    btnSiguiente.textContent = "›";
    btnSiguiente.disabled = esteMes >= hoyMes + 2; // 60 días ≈ 2 meses
    btnSiguiente.addEventListener("click", () => cambiarMes(1));

    header.append(btnAnterior, titulo, btnSiguiente);
    contenedor.appendChild(header);

    // Grilla: nombres de los días + los días del mes
    const grilla = document.createElement("div");
    grilla.className = "calendario-grilla";
    NOMBRES_DIAS_CORTOS.forEach((n) => {
      const celda = document.createElement("span");
      celda.className = "calendario-dia-nombre";
      celda.textContent = n;
      grilla.appendChild(celda);
    });

    // Huecos antes del día 1 (la semana empieza el lunes)
    const primerDiaSemana = (new Date(estado.anio, estado.mes, 1).getDay() + 6) % 7;
    for (let i = 0; i < primerDiaSemana; i++) {
      grilla.appendChild(document.createElement("span"));
    }

    const ultimoDia = new Date(estado.anio, estado.mes + 1, 0).getDate();
    const hoyIso = getHoyLocal();
    for (let dia = 1; dia <= ultimoDia; dia++) {
      const fechaIso = iso(estado.anio, estado.mes, dia);
      const info = estado.dias[fechaIso];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = dia;
      btn.className = "calendario-dia";
      if (estado.cargando) btn.classList.add("calendario-dia-cargando");
      else if (info && info.available) btn.classList.add("calendario-dia-disponible");
      else btn.classList.add("calendario-dia-no-disponible");
      if (fechaIso === hoyIso) btn.classList.add("calendario-dia-hoy");
      if (fechaIso === input.value) btn.classList.add("calendario-dia-seleccionado");
      btn.setAttribute(
        "aria-label",
        `${formatFechaLegible(fechaIso)}: ${info && info.available ? "disponible" : "no disponible"}`
      );
      btn.addEventListener("click", () => elegirDia(fechaIso));
      grilla.appendChild(btn);
    }
    contenedor.appendChild(grilla);

    // Leyenda + mensaje
    const pie = document.createElement("div");
    pie.className = "calendario-pie";
    pie.innerHTML = `
      <span><span class="calendario-muestra calendario-dia-disponible"></span> Disponible</span>
      <span><span class="calendario-muestra calendario-dia-no-disponible"></span> No disponible</span>`;
    contenedor.appendChild(pie);

    if (estado.cargando) {
      const cargando = document.createElement("p");
      cargando.className = "calendario-mensaje";
      cargando.textContent = "Buscando días disponibles...";
      contenedor.appendChild(cargando);
    } else if (estado.mensaje) {
      const msg = document.createElement("p");
      msg.className = "calendario-mensaje calendario-mensaje-aviso";
      msg.setAttribute("role", "status");
      msg.textContent = estado.mensaje;
      contenedor.appendChild(msg);
    } else if (!Object.values(estado.dias).some((d) => d.available)) {
      const msg = document.createElement("p");
      msg.className = "calendario-mensaje";
      msg.textContent = "No hay días disponibles este mes. Probá con el mes siguiente.";
      contenedor.appendChild(msg);
    }
  }

  render();

  return {
    setDoctor(doctorId) {
      estado.doctorId = doctorId || null;
      estado.dias = {};
      estado.mensaje = "";
      input.value = "";
      const ahora = new Date();
      estado.anio = ahora.getFullYear();
      estado.mes = ahora.getMonth();
      estado.pedidoActual++;
      if (estado.doctorId) cargarMes();
      else render();
    },
  };
}
