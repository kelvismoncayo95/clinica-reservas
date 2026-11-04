// ============================================================
// app.js - Logica de la pantalla de login y registro
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  // Si ya hay sesión, saltar al panel correspondiente
  redirectIfLoggedIn();

  setupTabs();
  setupLoginForm();
  setupRegisterForm();
});


// ----- Manejo de pestañas -----

function setupTabs() {
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const formLogin = document.getElementById("form-login");
  const formRegister = document.getElementById("form-register");

  tabLogin.addEventListener("click", () => switchTab("login"));
  tabRegister.addEventListener("click", () => switchTab("register"));

  function switchTab(which) {
    const isLogin = which === "login";
    tabLogin.classList.toggle("tab-activa", isLogin);
    tabRegister.classList.toggle("tab-activa", !isLogin);
    tabLogin.setAttribute("aria-selected", String(isLogin));
    tabRegister.setAttribute("aria-selected", String(!isLogin));
    formLogin.hidden = !isLogin;
    formRegister.hidden = isLogin;
    clearAllErrors();
  }
}


// ----- Helpers de errores inline -----

function setFieldError(fieldId, message) {
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
}


function clearFieldError(fieldId) {
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }
}


function clearAllErrors() {
  document.querySelectorAll(".form-error").forEach((el) => {
    el.textContent = "";
    el.hidden = true;
  });
}


function setGlobalError(id, message) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = message;
    el.hidden = false;
  }
}


function setButtonLoading(button, isLoading, originalText) {
  if (isLoading) {
    button.disabled = true;
    button.textContent = "Enviando...";
  } else {
    button.disabled = false;
    button.textContent = originalText;
  }
}


// ----- Formulario de login -----

function setupLoginForm() {
  const form = document.getElementById("login-form");
  const submit = document.getElementById("login-submit");

  // Filtrar la cédula: solo dígitos, máximo 8
  const inputCedula = document.getElementById("reg-dni");
  if (inputCedula) {
    inputCedula.addEventListener("input", () => {
      inputCedula.value = inputCedula.value.replace(/\D/g, "").slice(0, 8);
    });
  }

  // Mostrar/ocultar contraseña
  const togglePassword = null; // Oculto en el registro
  if (togglePassword) {
    togglePassword.addEventListener("click", () => {
      const input = document.getElementById("reg-password");
      input.type = input.type === "password" ? "text" : "password";
    });
  }

  // Filtrar el teléfono: solo dígitos, espacios, guiones y +, máximo 15
  const inputPhone = document.getElementById("reg-phone");
  if (inputPhone) {
    inputPhone.addEventListener("input", () => {
      inputPhone.value = inputPhone.value.replace(/[^0-9\s\-+]/g, "").slice(0, 15);
    });
  }

  // Calcular max/min de fecha de nacimiento (18 a 120 años)
  const inputFecha = document.getElementById("reg-birth-date");
  if (inputFecha) {
    const hoy = new Date();
    const max = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());
    const min = new Date(hoy.getFullYear() - 120, hoy.getMonth(), hoy.getDate());
    const formato = (d) => {
      const anio = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, "0");
      const dia = String(d.getDate()).padStart(2, "0");
      return `${anio}-${mes}-${dia}`;
    };
    inputFecha.max = formato(max);
    inputFecha.min = formato(min);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    // Validacion en el navegador
    let hasError = false;
    if (!email) {
      setFieldError("login-email", "Ingresá tu correo electrónico.");
      hasError = true;
    }
    if (!password) {
      setFieldError("login-password", "Ingresá tu contraseña.");
      hasError = true;
    }
    if (hasError) return;

    setButtonLoading(submit, true);
    try {
      const token = await login(email, password);
      saveSession(token, { email, role: null });  // se completa abajo

      // Obtener los datos completos del usuario
      const user = await fetchCurrentUser();
      saveSession(token, user);

      showToast(`¡Bienvenido/a, ${user.email}!`, "success");
      setTimeout(() => redirectByRole(user.role), 500);
    } catch (err) {
      setGlobalError("login-error", err.message);
    } finally {
      setButtonLoading(submit, false, "Iniciar sesión");
    }
  });
}


// ----- Formulario de registro -----

function setupRegisterForm() {
  const form = document.getElementById("register-form");
  const submit = document.getElementById("register-submit");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors();

    const data = {
      first_name: document.getElementById("reg-first-name").value.trim(),
      last_name: document.getElementById("reg-last-name").value.trim(),
      dni: document.getElementById("reg-dni").value.trim(),
      birth_date: document.getElementById("reg-birth-date").value,
      phone: document.getElementById("reg-phone").value.trim(),
      email: document.getElementById("reg-email").value.trim(),
      
      obra_social: document.getElementById("reg-obra-social").value.trim() || null,
    };

    // Validacion en el navegador
    let hasError = false;
    if (!data.first_name) {
      setFieldError("reg-first-name", "Ingresá tu nombre.");
      hasError = true;
    }
    if (!data.last_name) {
      setFieldError("reg-last-name", "Ingresá tu apellido.");
      hasError = true;
    }
    if (!data.dni) {
      setFieldError("reg-dni", "Ingresá tu DNI.");
      hasError = true;
    }
    if (!data.birth_date) {
      setFieldError("reg-birth-date", "Ingresá tu fecha de nacimiento.");
      hasError = true;
    }
    if (!data.phone) {
      setFieldError("reg-phone", "Ingresá tu teléfono.");
      hasError = true;
    }
    if (!data.email) {
      setFieldError("reg-email", "Ingresá tu correo electrónico.");
      hasError = true;
    }
    if (!data.password || data.password.length < 8) {
      setFieldError("reg-password", "La contraseña debe tener al menos 8 caracteres.");
      hasError = true;
    }
    const passwordConfirm = document.getElementById("reg-password-confirm").value;
    if (data.password !== passwordConfirm) {
      setFieldError("reg-password-confirm", "Las contraseñas no coinciden.");
      hasError = true;
    }
    if (hasError) return;

    setButtonLoading(submit, true);
    try {
      await register(data);
      showToast("¡Cuenta creada! Ahora iniciá sesión.", "success");

      // Volver a la pestaña de login con el correo ya cargado
      document.getElementById("login-email").value = data.email;
      setTimeout(() => {
        document.getElementById("tab-login").click();
      }, 800);
    } catch (err) {
      // Parsear el error: si es un array de Pydantic, mostrar el primer mensaje
      let mensaje = err.message;
      if (typeof mensaje === "string" && mensaje.startsWith("[")) {
        try {
          const parsed = JSON.parse(mensaje);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const err0 = parsed[0];
            const campo = err0.loc && err0.loc[err0.loc.length - 1];
            const msgOriginal = err0.msg || "Error de validación";
            if (msgOriginal.includes("email")) {
              mensaje = "El correo electrónico no tiene un formato válido.";
            } else if (msgOriginal.includes("DNI") || msgOriginal.includes("dni")) {
              mensaje = "El DNI no tiene un formato válido (7 u 8 dígitos).";
            } else if (msgOriginal.includes("birth_date") || msgOriginal.includes("fecha")) {
              mensaje = "La fecha de nacimiento no es válida.";
            } else {
              mensaje = `Error en "${campo}": ${msgOriginal}`;
            }
          }
        } catch (_) {
          // Si no es JSON, dejar el mensaje como estaba
        }
      }
      setGlobalError("register-error", mensaje);
    } finally {
      setButtonLoading(submit, false, "Crear mi cuenta");
    }
  });
}
