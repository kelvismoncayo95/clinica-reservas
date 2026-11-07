def get_email_reserva(patient_name: str, doctor_name: str, specialty: str, date: str, time: str) -> tuple[str, str]:
    """Devuelve (asunto, html) para el correo de confirmación de reserva."""
    asunto = f"Confirmación de cita - {specialty}"
    html = f"""
    <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>¡Hola {patient_name}!</h2>
        <p>Tu cita ha sido confirmada exitosamente.</p>
        <ul>
            <li><strong>Médico:</strong> {doctor_name}</li>
            <li><strong>Especialidad:</strong> {specialty}</li>
            <li><strong>Fecha:</strong> {date}</li>
            <li><strong>Hora:</strong> {time}</li>
        </ul>
        <p>Por favor, llegá 10 minutos antes.</p>
        <p>Clínica Médica del Sur</p>
    </div>"""
    return asunto, html

def get_email_cancelacion(patient_name: str, date: str, time: str) -> tuple[str, str]:
    """Devuelve (asunto, html) para el correo de cancelación."""
    asunto = "Cancelación de cita"
    html = f"""
    <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Hola {patient_name}</h2>
        <p>Tu cita del <strong>{date} a las {time}</strong> ha sido cancelada.</p>
        <p>Si fue un error, podés volver a reservar en el sistema.</p>
        <p>Clínica Médica del Sur</p>
    </div>"""
    return asunto, html

def get_email_reprogramacion(patient_name: str, old_date: str, old_time: str, new_date: str, new_time: str) -> tuple[str, str]:
    """Devuelve (asunto, html) para el correo de reprogramación."""
    asunto = "Cambio de turno"
    html = f"""
    <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Hola {patient_name}</h2>
        <p>Tu cita ha sido reprogramada.</p>
        <p><strong>Antes:</strong> {old_date} a las {old_time}</p>
        <p><strong>Ahora:</strong> {new_date} a las {new_time}</p>
        <p>Clínica Médica del Sur</p>
    </div>"""
    return asunto, html

def get_email_reserva_medico(doctor_name: str, patient_name: str, date: str, time: str) -> tuple[str, str]:
    """Devuelve (asunto, html) para el correo de reserva que recibe el medico."""
    asunto = f"Nueva cita agendada - {date}"
    html = f"""
    <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Dr/a. {doctor_name}</h2>
        <p>Tenés una nueva cita agendada en tu agenda.</p>
        <ul>
            <li><strong>Paciente:</strong> {patient_name}</li>
            <li><strong>Fecha:</strong> {date}</li>
            <li><strong>Hora:</strong> {time}</li>
        </ul>
        <p>Clínica Médica del Sur</p>
    </div>"""
    return asunto, html


def get_email_recuperar_password(link: str, minutos: int) -> tuple[str, str]:
    """Devuelve (asunto, html) para el correo de "Olvidé mi contraseña"."""
    asunto = "Recuperá tu contraseña"
    html = f"""
    <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Recuperación de contraseña</h2>
        <p>Recibimos un pedido para cambiar la contraseña de tu cuenta.</p>
        <p>
            <a href="{link}" style="background:#2563eb;color:#fff;padding:10px 16px;
               border-radius:6px;text-decoration:none;">Crear nueva contraseña</a>
        </p>
        <p>El enlace vence en {minutos} minutos y solo se puede usar una vez.</p>
        <p>Si no fuiste vos, ignorá este correo: tu contraseña no cambia.</p>
        <p>Clínica Médica del Sur</p>
    </div>"""
    return asunto, html
