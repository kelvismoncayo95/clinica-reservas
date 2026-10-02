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
      password: document.getElementById("reg-password").value,
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
    if (!data.password || data.password.length < 6) {
      setFieldError("reg-password", "La contraseña debe tener al menos 6 caracteres.");
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
      setGlobalError("register-error", err.message);
    } finally {
      setButtonLoading(submit, false, "Crear mi cuenta");
    }
  });
}
