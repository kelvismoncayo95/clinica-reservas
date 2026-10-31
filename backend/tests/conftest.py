import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import dotenv_values

# Lee la URL original del .env y la cambia por la base de pruebas
env_actual = dotenv_values(BACKEND_DIR / ".env")
url_real = env_actual.get("DATABASE_URL", "")
if not url_real:
    raise RuntimeError("No se encontró DATABASE_URL en el .env")

# Reemplaza el nombre de la base por clinica_test
url_test = url_real.rsplit("/", 1)[0] + "/clinica_test"

assert url_test.endswith("clinica_test"), "La URL de test debe terminar en clinica_test"
os.environ["DATABASE_URL"] = url_test  # ANTES de importar app

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text

import app.models  # noqa: F401  (registra todas las tablas)
from app.database import Base, engine


@pytest.fixture(scope="session", autouse=True)
def migrar():
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")


@pytest.fixture(autouse=True)
def vaciar():
    yield
    tablas = ", ".join(t.name for t in Base.metadata.sorted_tables)
    with engine.begin() as c:
        c.execute(text(f"TRUNCATE {tablas} RESTART IDENTITY CASCADE"))
