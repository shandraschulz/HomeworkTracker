"""
Database configuration and session management.
Supports both development (SQLite) and production (PostgreSQL) environments.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Environment detection
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Database URL configuration
if ENVIRONMENT == "production":
    # Production: PostgreSQL
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://homework:homework@db:5432/homework_tracker"
    )
else:
    # Development: SQLite (or PostgreSQL if DATABASE_URL is set)
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://homework:homework@localhost:5432/homework_tracker"
    )

# Create engine with appropriate settings
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(DATABASE_URL)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """
    Dependency that provides a database session.
    Ensures proper cleanup after request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)
