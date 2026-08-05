from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.config import settings
from app.routes.analytics import router as analytics_router
from app.routes.auth import router as auth_router
from app.routes.dashboard import router as dashboard_router
from app.routes.events import router as events_router
from app.routes.operating_rooms import router as operating_rooms_router
from app.routes.patients import router as patients_router
from app.routes.room_commands import router as room_commands_router
from app.routes.scanner import router as scanner_router
from app.routes.surgeries import router as surgeries_router

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_origin_regex=r"^https?://(localhost(:[0-9]+)?|simplesurgery\.com\.br|www\.simplesurgery\.com\.br)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(surgeries_router, prefix="/api/v1")
app.include_router(events_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(patients_router, prefix="/api/v1")
app.include_router(operating_rooms_router, prefix="/api/v1")
app.include_router(room_commands_router, prefix="/api/v1")
app.include_router(scanner_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@app.get("/api/health")
def api_health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}
