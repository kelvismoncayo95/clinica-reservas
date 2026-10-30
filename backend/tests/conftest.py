import sys
from pathlib import Path

# Agrega backend/ al sys.path para que los tests puedan hacer "from app..."
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
