from datetime import datetime, timedelta, timezone
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database.config import settings
from app.database.session import get_db
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=True)

DEFAULT_LOGIN_PASSWORD = "simplesurgery"

DEFAULT_OPERATIONAL_LOGINS = {
    "centrocirurgico@simplesurgery.com.br": {
        "name": "Centro Cirurgico",
        "role": "operator",
    },
    "cme@simplesurgery.com.br": {
        "name": "Central de Material e Esterilizacao",
        "role": "cme",
    },
    "farmacia@simplesurgery.com.br": {
        "name": "Farmacia Hospitalar",
        "role": "farmacia",
    },
}


def _operational_user_id(email: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"simple-surgery:{email}")


def _operational_user_from_email(email: str) -> User | None:
    profile = DEFAULT_OPERATIONAL_LOGINS.get(email)
    if not profile:
        return None
    return User(
        id=_operational_user_id(email),
        email=email,
        full_name=profile["name"],
        password_hash="default-login-managed",
        role=profile["role"],
        is_active=True,
    )


def _operational_user_from_id(user_id: str) -> User | None:
    for email in DEFAULT_OPERATIONAL_LOGINS:
        if str(_operational_user_id(email)) == user_id:
            return _operational_user_from_email(email)
    return None


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    normalized_email = email.strip().lower()
    if normalized_email in DEFAULT_OPERATIONAL_LOGINS and password == DEFAULT_LOGIN_PASSWORD:
        profile = DEFAULT_OPERATIONAL_LOGINS[normalized_email]
        try:
            user = db.execute(
                select(User).where(User.email == normalized_email, User.is_active.is_(True))
            ).scalar_one_or_none()
            if not user:
                user = User(
                    email=normalized_email,
                    full_name=profile["name"],
                    password_hash="default-login-managed",
                    role=profile["role"],
                    is_active=True,
                )
                db.add(user)
            else:
                user.full_name = profile["name"]
                user.role = profile["role"]
                user.is_active = True
            db.commit()
            db.refresh(user)
            return user
        except SQLAlchemyError:
            db.rollback()
            return _operational_user_from_email(normalized_email)

    user = db.execute(
        select(User).where(User.email == normalized_email, User.is_active.is_(True))
    ).scalar_one_or_none()

    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def create_access_token(subject: str) -> str:
    expire_at = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire_at}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
    return subject


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    user_id = decode_access_token(credentials.credentials)
    user = None
    try:
        user = db.get(User, user_id)
    except SQLAlchemyError:
        user = _operational_user_from_id(user_id)

    if not user:
        user = _operational_user_from_id(user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not authorized")
    return user
