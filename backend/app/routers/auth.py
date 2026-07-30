"""User signup API endpoints."""

import sqlite3

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.database.db import authenticate_user, create_user
from app.database.mongo_store import sync_user

router = APIRouter(prefix="/auth", tags=["Auth"])


class SignupRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    company: str = Field(default="", max_length=100)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or "." not in normalized.rsplit("@", 1)[-1]:
            raise ValueError("Enter a valid email address.")
        return normalized


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    company: str
    role: str
    created_at: str


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest) -> dict:
    """Create a real persisted user account."""
    try:
        user = create_user(
            full_name=payload.full_name,
            email=str(payload.email),
            password=payload.password,
            company=payload.company,
        )
        sync_user(user)
        return user
    except sqlite3.IntegrityError as exc:
        if "users.email" in str(exc) or "UNIQUE constraint failed" in str(exc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            ) from exc
        raise


@router.post("/login", response_model=UserResponse)
def login(payload: LoginRequest) -> dict:
    """Authenticate an existing user account."""
    user = authenticate_user(email=payload.email, password=payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    sync_user(user)
    return user
