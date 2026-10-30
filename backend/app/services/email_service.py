import httpx
from app.core.config import get_settings

settings = get_settings()

def enviar_email(to_email: str, subject: str, html_content: str) -> bool:
    """Envía un correo usando la API de Resend."""
    if not getattr(settings, "RESEND_API_KEY", ""):
        print("DEBUG: No hay RESEND_API_KEY configurada. Se omite el envío.")
        return False

    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "from": settings.EMAIL_FROM,
        "to": [to_email],
        "subject": subject,
        "html": html_content,
    }
    try:
        with httpx.Client() as client:
            response = client.post(url, json=payload, headers=headers, timeout=10.0)
            response.raise_for_status()
            print(f"DEBUG: Correo enviado a {to_email}")
            return True
    except Exception as e:
        print(f"ERROR al enviar correo a {to_email}: {e}")
        return False
