from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.config import settings
from app.routes.analytics import router as analytics_router
from app.routes.auth import router as auth_router
from app.routes.dashboard import router as dashboard_router
from app.routes.events import router as events_router
from app.routes.operating_rooms import router as operating_rooms_router
from app.routes.patients import router as patients_router
from app.routes.surgeries import router as surgeries_router

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
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


@app.get("/health")
def health_check():
    return {"status": "ok", "service": settings.app_name}
