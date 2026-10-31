import os
from slowapi import Limiter
from slowapi.util import get_remote_address

# En tests, desactivamos el rate limit para no interferir con los múltiples logins
enabled = os.getenv("TESTING", "false").lower() != "true"

limiter = Limiter(key_func=get_remote_address, enabled=enabled)
