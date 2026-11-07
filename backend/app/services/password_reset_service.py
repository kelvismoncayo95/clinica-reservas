"""Logica de "Olvidé mi contraseña".

Flujo (como perder la llave de casa):
1. request_password_reset: el usuario da su email y le mandamos una
   llave temporal (token) por correo.
2. reset_password: el usuario usa esa llave para poner una contraseña nueva.

Reglas de seguridad:
- El token es aleatorio y largo (secrets.token_urlsafe), imposible de adivinar.
- En la base guardamos solo su hash SHA-256, nunca el token real.
- Vence a los PASSWORD_RESET_EXPIRE_MINUTES minutos y se usa una sola vez.
- Al pedir uno nuevo, los anteriores del mismo usuario dejan de servir.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User

settings = get_settings()


class PasswordResetError(Exception):
    """El token no sirve (no existe, vencio o ya se uso)."""
    pass


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _invalidate_user_tokens(db: Session, user_id: int, now: datetime) -> None:
    """Marca como usados todos los tokens pendientes del usuario."""
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=now)
    )


def request_password_reset(db: Session, email: str) -> tuple[User, str] | None:
    """Crea un token para el usuario con ese email.

    Devuelve (user, token_en_texto) para mandarlo por correo, o None si
    no hay un usuario activo con ese email. El endpoint responde lo mismo
    en los dos casos, para no revelar que emails estan registrados.
    """
    user = db.scalar(
        select(User).where(User.email == email.strip(), User.activo.is_(True))
    )
    if user is None:
        return None

    now = datetime.now(timezone.utc)
    _invalidate_user_tokens(db, user.id, now)

    token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_token(token),
            expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
        )
    )
    db.commit()
    return user, token


def reset_password(db: Session, token: str, new_password: str) -> User:
    """Cambia la contraseña si el token es valido. Lanza PasswordResetError si no."""
    now = datetime.now(timezone.utc)
    reset = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == _hash_token(token)
        )
    )
    if reset is None or reset.used_at is not None or reset.expires_at <= now:
        raise PasswordResetError("El enlace no es válido o ya venció. Pedí uno nuevo.")

    user = db.get(User, reset.user_id)
    if user is None or not user.activo:
        raise PasswordResetError("El enlace no es válido o ya venció. Pedí uno nuevo.")

    # Todo en la misma transaccion: nueva contraseña + token usado.
    user.password_hash = hash_password(new_password)
    _invalidate_user_tokens(db, user.id, now)
    db.commit()
    return user
