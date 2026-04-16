"""
Integration tests for Phase 3 authentication endpoints.
Run: pytest test_auth_integration.py -v
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from main import app, get_db
from models import Base, User
from database import get_db_context

# Use in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


class TestAuthSignup:
    """Test user registration."""
    
    def test_signup_valid(self):
        """Valid signup should succeed."""
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "test@example.com",
                "username": "testuser",
                "password": "SecurePass123"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["user"]["email"] == "test@example.com"
        assert "access_token" in data["tokens"]
        assert "refresh_token" in data["tokens"]
        assert data["tokens"]["token_type"] == "bearer"
        assert data["tokens"]["expires_in"] > 0
    
    def test_signup_duplicate_email(self):
        """Duplicate email should fail."""
        client.post(
            "/api/auth/signup",
            json={
                "email": "test@example.com",
                "username": "user1",
                "password": "SecurePass123"
            }
        )
        
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "test@example.com",
                "username": "user2",
                "password": "SecurePass123"
            }
        )
        
        assert response.status_code == 409
        assert "already registered" in response.json()["detail"]
    
    def test_signup_duplicate_username(self):
        """Duplicate username should fail."""
        client.post(
            "/api/auth/signup",
            json={
                "email": "test1@example.com",
                "username": "sameuser",
                "password": "SecurePass123"
            }
        )
        
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "test2@example.com",
                "username": "sameuser",
                "password": "SecurePass123"
            }
        )
        
        assert response.status_code == 409
        assert "already taken" in response.json()["detail"]
    
    def test_signup_weak_password(self):
        """Weak password should fail."""
        test_cases = [
            ("short", "must be at least 8 characters"),
            ("lowercaseonly123", "must contain at least one uppercase"),
            ("UPPERCASEONLY123", "must contain at least one lowercase"),
            ("NoDigitsHere", "must contain at least one digit"),
        ]
        
        for password, expected_msg in test_cases:
            response = client.post(
                "/api/auth/signup",
                json={
                    "email": f"test_{password}@example.com",
                    "username": f"user_{password}",
                    "password": password
                }
            )
            
            assert response.status_code == 400
            assert expected_msg in response.json()["detail"]
    
    def test_signup_invalid_email(self):
        """Invalid email should fail."""
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "not-an-email",
                "username": "testuser",
                "password": "SecurePass123"
            }
        )
        
        assert response.status_code == 422  # Validation error


class TestAuthLogin:
    """Test user login."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test user."""
        client.post(
            "/api/auth/signup",
            json={
                "email": "login@example.com",
                "username": "loginuser",
                "password": "LoginPass123"
            }
        )
    
    def test_login_valid(self):
        """Valid login should succeed."""
        response = client.post(
            "/api/auth/login",
            json={
                "email": "login@example.com",
                "password": "LoginPass123"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["user"]["email"] == "login@example.com"
        assert "access_token" in data["tokens"]
        assert "refresh_token" in data["tokens"]
    
    def test_login_wrong_password(self):
        """Wrong password should fail."""
        response = client.post(
            "/api/auth/login",
            json={
                "email": "login@example.com",
                "password": "WrongPassword123"
            }
        )
        
        assert response.status_code == 401
        assert "Invalid email or password" in response.json()["detail"]
    
    def test_login_nonexistent_email(self):
        """Login with nonexistent email should fail."""
        response = client.post(
            "/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "SomePass123"
            }
        )
        
        assert response.status_code == 401


class TestTokenRefresh:
    """Test JWT token refresh."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test user and get tokens. Falls back to login if user exists."""
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "refresh@example.com",
                "username": "refreshuser",
                "password": "RefreshPass123"
            }
        )
        if response.status_code not in (200, 201):
            # User already exists from a prior test run — log in instead
            response = client.post(
                "/api/auth/login",
                json={
                    "email": "refresh@example.com",
                    "password": "RefreshPass123"
                }
            )
        self.refresh_token = response.json()["tokens"]["refresh_token"]
        self.access_token = response.json()["tokens"]["access_token"]
    
    def test_refresh_valid(self):
        """Valid refresh should return new access token."""
        response = client.post(
            "/api/auth/refresh",
            json={"refresh_token": self.refresh_token}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "access_token" in data["tokens"]
        assert data["tokens"]["token_type"] == "bearer"
    
    def test_refresh_invalid(self):
        """Invalid refresh token should fail."""
        response = client.post(
            "/api/auth/refresh",
            json={"refresh_token": "invalid.token.here"}
        )
        
        assert response.status_code == 401


class TestProtectedRoutes:
    """Test that protected routes require authentication."""
    
    def test_get_lessons_no_auth(self):
        """GET /api/lessons without auth should fail."""
        response = client.get("/api/lessons")
        assert response.status_code == 401  # Unauthorized (no credentials)
    
    def test_get_me_no_auth(self):
        """GET /api/me without auth should fail."""
        response = client.get("/api/me")
        assert response.status_code == 401
    
    def test_get_me_with_auth(self):
        """GET /api/me with valid auth should succeed."""
        # Signup first
        signup_response = client.post(
            "/api/auth/signup",
            json={
                "email": "me@example.com",
                "username": "meuser",
                "password": "MePass123"
            }
        )
        access_token = signup_response.json()["tokens"]["access_token"]
        
        # Test protected route
        response = client.get(
            "/api/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "me@example.com"
        assert data["username"] == "meuser"


class TestMigration:
    """Test that database schema is correct."""
    
    def test_users_table_exists(self):
        """Users table should exist with all columns."""
        db = TestingSessionLocal()
        # Try to query - would fail if table doesn't exist
        users = db.query(User).all()
        assert users is not None
        db.close()
    
    def test_unique_constraints(self):
        """Email and username should be unique."""
        db = TestingSessionLocal()
        
        # Create first user
        user1 = User(
            email="unique@example.com",
            username="uniqueuser",
            password_hash="hash",
            is_active=True
        )
        db.add(user1)
        db.commit()
        
        # Try to create with same email
        user2 = User(
            email="unique@example.com",
            username="different",
            password_hash="hash",
            is_active=True
        )
        db.add(user2)
        
        with pytest.raises(Exception):  # Should raise IntegrityError
            db.commit()
        
        db.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
