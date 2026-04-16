"""
Authentication module for VibeCode.
Handles JWT tokens, password hashing, and auth middleware.
"""

import os
from datetime import datetime, timedelta
from typing import Optional, Dict
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Password hashing context (bcrypt with cost=12)
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12
)


class TokenData(BaseModel):
    """JWT payload data."""
    user_id: str
    email: str
    exp: datetime
    type: str  # "access" or "refresh"


class TokenResponse(BaseModel):
    """Token response model."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenPayload(BaseModel):
    """Token payload for response."""
    access_token: str
    token_type: str = "bearer"


# ===== PASSWORD HASHING =====

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Args:
        password: Plain text password
        
    Returns:
        Bcrypt hash (will never be the same twice due to salt)
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Bcrypt hash to verify against
        
    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


# ===== JWT TOKEN MANAGEMENT =====

def create_access_token(user_id: str, email: str) -> str:
    """
    Create a short-lived access token (15 minutes).
    
    Args:
        user_id: User's unique ID
        email: User's email
        
    Returns:
        JWT access token
    """
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    payload = {
        "user_id": str(user_id),
        "email": email,
        "exp": expire,
        "type": "access"
    }
    
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    logger.debug(f"Created access token for {email}")
    return token


def create_refresh_token(user_id: str, email: str) -> str:
    """
    Create a long-lived refresh token (7 days).
    
    Args:
        user_id: User's unique ID
        email: User's email
        
    Returns:
        JWT refresh token
    """
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    payload = {
        "user_id": str(user_id),
        "email": email,
        "exp": expire,
        "type": "refresh"
    }
    
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    logger.debug(f"Created refresh token for {email}")
    return token


def create_token_pair(user_id: str, email: str) -> TokenResponse:
    """
    Create both access and refresh tokens.
    
    Args:
        user_id: User's unique ID
        email: User's email
        
    Returns:
        TokenResponse with both tokens
    """
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id, email)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60  # seconds
    )


# ===== TOKEN VALIDATION =====

def verify_token(token: str, expected_type: str = "access") -> Optional[Dict]:
    """
    Verify and decode a JWT token.
    
    Args:
        token: JWT token to verify
        expected_type: Expected token type ("access" or "refresh")
        
    Returns:
        Token payload dict if valid, None otherwise
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Check token type
        if payload.get("type") != expected_type:
            logger.warning(f"Token type mismatch: expected {expected_type}, got {payload.get('type')}")
            return None
        
        user_id = payload.get("user_id")
        email = payload.get("email")
        
        if not user_id or not email:
            logger.warning("Token missing user_id or email")
            return None
        
        return payload
        
    except JWTError as e:
        logger.warning(f"Token verification failed: {e}")
        return None


def decode_access_token(token: str) -> Optional[Dict]:
    """Decode and validate an access token."""
    return verify_token(token, expected_type="access")


def decode_refresh_token(token: str) -> Optional[Dict]:
    """Decode and validate a refresh token."""
    return verify_token(token, expected_type="refresh")


# ===== PASSWORD VALIDATION =====

def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password strength.
    
    Requirements:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    
    Args:
        password: Password to validate
        
    Returns:
        Tuple of (is_valid, message)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"
    
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"
    
    return True, "Password is valid"


# ===== TOKEN HASH (for secure storage in DB) =====

def hash_token(token: str) -> str:
    """
    Hash a token for secure storage in database.
    Used for refresh token revocation.
    """
    return pwd_context.hash(token)


def verify_token_hash(token: str, token_hash: str) -> bool:
    """
    Verify a token against its hash.
    """
    return pwd_context.verify(token, token_hash)
