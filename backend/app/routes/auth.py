from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.auth import AuthUserResponse, LoginRequest, LoginResponse
from app.services.auth_service import authenticate_user, create_access_token, get_current_user

router = APIRouter(tags=["auth"])


@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user.id))
    return LoginResponse(
        access_token=token,
        user=AuthUserResponse(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            role=user.role,
        ),
    )


@router.get("/auth/me", response_model=AuthUserResponse)
def me(current_user: User = Depends(get_current_user)):
    return AuthUserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
    )
