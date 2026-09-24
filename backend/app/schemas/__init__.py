from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.schemas.patient import (
    PatientCreate,
    PatientSelfRegister,
    PatientUpdate,
    PatientResponse,
)
from app.schemas.doctor import DoctorCreate, DoctorUpdate, DoctorResponse
from app.schemas.specialty import (
    SpecialtyCreate,
    SpecialtyUpdate,
    SpecialtyResponse,
)
from app.schemas.schedule import (
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
)
from app.schemas.block import BlockCreate, BlockResponse
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentReschedule,
    AppointmentStatusUpdate,
    AppointmentResponse,
    AppointmentStatus,
)
from app.schemas.availability import AvailabilitySlot, AvailabilityResponse
