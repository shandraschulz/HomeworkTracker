"""
SQLAlchemy models for the Homework Tracker application.
"""
from sqlalchemy import Column, String, Boolean, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from .database import Base


class Class(Base):
    """Represents a class/course in the tracker."""
    __tablename__ = "classes"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationship to tasks
    tasks = relationship("Task", back_populates="class_", cascade="all, delete-orphan")


class Task(Base):
    """Represents a homework task."""
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    due_date = Column(Date, nullable=False)
    done = Column(Boolean, default=False)
    hidden = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Foreign key to class
    class_id = Column(String, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    
    # Relationship back to class
    class_ = relationship("Class", back_populates="tasks")
