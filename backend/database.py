"""
Database connection and session management for VibeCode.
Uses SQLAlchemy with PostgreSQL connection pooling.
"""

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)

# Get database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://user:password@localhost:5432/vibeCode"
)

# Create engine with connection pooling
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,  # Number of connections to keep pooled
    max_overflow=20,  # Maximum number of connections to create
    pool_recycle=3600,  # Recycle connections after 1 hour
    pool_pre_ping=True,  # Verify connection before using (detects dead connections)
    echo=False,  # Set to True for SQL logging during development
    connect_args={
        "connect_timeout": 10,
        "application_name": "vibeCode"
    }
)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False
)


def get_db() -> Session:
    """
    Dependency injection for FastAPI routes.
    Usage:
        @app.get("/example")
        async def example(db: Session = Depends(get_db)):
            users = db.query(User).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context():
    """
    Context manager for database sessions (non-FastAPI use).
    Usage:
        with get_db_context() as db:
            users = db.query(User).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database (create all tables).
    Should be called once during app startup or after migrations.
    """
    from models import Base
    
    logger.info("Initializing database...")
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database initialized")


def drop_db():
    """
    Drop all tables (DANGEROUS - for testing only).
    """
    from models import Base
    
    logger.warning("⚠️ Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    logger.warning("⚠️ All tables dropped")


@event.listens_for(engine, "connect")
def receive_connect(dbapi_conn, connection_record):
    """Enable UUID support in PostgreSQL."""
    cursor = dbapi_conn.cursor()
    cursor.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
    cursor.close()


# Health check function
def check_db_health() -> bool:
    """
    Check if database connection is healthy.
    Returns: True if healthy, False otherwise
    """
    try:
        with get_db_context() as db:
            db.execute("SELECT 1")
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False


if __name__ == "__main__":
    # Quick database test
    print("Testing database connection...")
    if check_db_health():
        print("✅ Database connection OK")
    else:
        print("❌ Database connection failed")
