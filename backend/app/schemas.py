"""
Pydantic schemas for request/response validation.
"""
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# ============== Task Schemas ==============

class TaskBase(BaseModel):
    """Base task schema with common fields."""
    title: str = Field(..., min_length=1, max_length=500)
    due_date: date = Field(..., alias="dueDate")
    
    class Config:
        populate_by_name = True


class TaskCreate(TaskBase):
    """Schema for creating a new task."""
    pass


class TaskUpdate(BaseModel):
    """Schema for updating a task (all fields optional)."""
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    due_date: Optional[date] = Field(None, alias="dueDate")
    done: Optional[bool] = None
    hidden: Optional[bool] = None
    
    class Config:
        populate_by_name = True


class TaskResponse(BaseModel):
    """Schema for task response."""
    id: str
    title: str
    due_date: date = Field(..., alias="dueDate")
    done: bool
    hidden: bool
    created_at: datetime = Field(..., alias="createdAt")
    class_id: str = Field(..., alias="classId")
    
    class Config:
        from_attributes = True
        populate_by_name = True


# ============== Class Schemas ==============

class ClassBase(BaseModel):
    """Base class schema."""
    name: str = Field(..., min_length=1, max_length=200)


class ClassCreate(ClassBase):
    """Schema for creating a new class."""
    pass


class ClassUpdate(BaseModel):
    """Schema for updating a class."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)


class ClassResponse(BaseModel):
    """Schema for class response (without tasks)."""
    id: str
    name: str
    created_at: datetime = Field(..., alias="createdAt")
    
    class Config:
        from_attributes = True
        populate_by_name = True


class ClassWithTasksResponse(ClassResponse):
    """Schema for class response including tasks."""
    tasks: List[TaskResponse] = []


# ============== State Schemas (for backup/restore) ==============

class TaskBackup(BaseModel):
    """Task format for backup/restore."""
    id: str
    title: str
    dueDate: str  # ISO date string
    done: bool
    hidden: Optional[bool] = False
    createdAt: int  # Unix timestamp in ms


class StateBackup(BaseModel):
    """Full state backup matching the original localStorage format."""
    activeClassId: Optional[str] = None
    viewMode: str = "week"
    classes: List[dict]  # List of {id, name}
    tasksByClass: dict  # Dict of classId -> List[TaskBackup]
    expandedWeeksByClass: Optional[dict] = {}


class BackupPayload(BaseModel):
    """Wrapper for backup import/export."""
    version: int = 1
    exportedAt: str
    storageKey: str = "hw_tracker_semester_v2"
    state: StateBackup


# ============== Dashboard Response ==============

class DashboardTask(BaseModel):
    """Task with class info for dashboard views."""
    task: TaskResponse
    class_id: str = Field(..., alias="classId")
    class_name: str = Field(..., alias="className")
    
    class Config:
        populate_by_name = True


class DashboardResponse(BaseModel):
    """Response for dashboard endpoint."""
    overdue: List[DashboardTask]
    due_today: List[DashboardTask] = Field(..., alias="dueToday")
    due_this_week: List[DashboardTask] = Field(..., alias="dueThisWeek")
    due_next_week: List[DashboardTask] = Field(..., alias="dueNextWeek")
    
    class Config:
        populate_by_name = True
