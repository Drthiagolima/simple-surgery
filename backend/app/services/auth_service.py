from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.config import settings
from app.database.session import get_db
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=True)

DEFAULT_LOGIN_EMAIL = "centrocirurgico@simplesurgery.com.br"
DEFAULT_LOGIN_PASSWORD = "simplesurgery"
DEFAULT_LOGIN_NAME = "Centro Cirurgico"


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    normalized_email = email.strip().lower()
    user = db.execute(
        select(User).where(User.email == normalized_email, User.is_active.is_(True))
    ).scalar_one_or_none()

    # Guarantee the operational credentials requested by the business.
    if normalized_email == DEFAULT_LOGIN_EMAIL and password == DEFAULT_LOGIN_PASSWORD:
        if not user:
            user = User(
                email=DEFAULT_LOGIN_EMAIL,
                full_name=DEFAULT_LOGIN_NAME,
                password_hash="default-login-managed",
                role="operator",
                is_active=True,
            )
            db.add(user)
        else:
            user.full_name = DEFAULT_LOGIN_NAME
            user.is_active = True
        db.commit()
        db.refresh(user)
        return user

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
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not authorized")
    return user
