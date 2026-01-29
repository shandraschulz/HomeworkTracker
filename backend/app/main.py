"""
FastAPI application for Homework Tracker.
"""
import os
import uuid
from datetime import date, datetime, timedelta
from typing import List

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import get_db, init_db, ENVIRONMENT
from .models import Class, Task
from .schemas import (
    ClassCreate, ClassUpdate, ClassResponse, ClassWithTasksResponse,
    TaskCreate, TaskUpdate, TaskResponse,
    BackupPayload, StateBackup, DashboardResponse, DashboardTask
)

# Create FastAPI app
app = FastAPI(
    title="Homework Tracker API",
    description="API for managing homework tasks and classes",
    version="1.0.0",
    docs_url="/api/docs" if ENVIRONMENT == "development" else None,
    redoc_url="/api/redoc" if ENVIRONMENT == "development" else None,
)

# CORS configuration
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8080,http://localhost").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()


def generate_id() -> str:
    """Generate a unique ID matching the original JS format."""
    return uuid.uuid4().hex[:16]


# ============== Health Check ==============

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "environment": ENVIRONMENT}


# ============== Class Endpoints ==============

@app.get("/api/classes", response_model=List[ClassResponse])
async def get_classes(db: Session = Depends(get_db)):
    """Get all classes."""
    classes = db.query(Class).order_by(Class.created_at).all()
    return classes


@app.get("/api/classes/{class_id}", response_model=ClassWithTasksResponse)
async def get_class(class_id: str, db: Session = Depends(get_db)):
    """Get a specific class with its tasks."""
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    return cls


@app.post("/api/classes", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
async def create_class(class_data: ClassCreate, db: Session = Depends(get_db)):
    """Create a new class."""
    new_class = Class(
        id=generate_id(),
        name=class_data.name
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    return new_class


@app.put("/api/classes/{class_id}", response_model=ClassResponse)
async def update_class(class_id: str, class_data: ClassUpdate, db: Session = Depends(get_db)):
    """Update a class."""
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    
    if class_data.name is not None:
        cls.name = class_data.name
    
    db.commit()
    db.refresh(cls)
    return cls


@app.delete("/api/classes/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class(class_id: str, db: Session = Depends(get_db)):
    """Delete a class and all its tasks."""
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    
    db.delete(cls)
    db.commit()
    return None


# ============== Task Endpoints ==============

@app.get("/api/classes/{class_id}/tasks", response_model=List[TaskResponse])
async def get_tasks(class_id: str, db: Session = Depends(get_db)):
    """Get all tasks for a class."""
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    
    tasks = db.query(Task).filter(Task.class_id == class_id).order_by(Task.due_date, Task.created_at).all()
    return tasks


@app.post("/api/classes/{class_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(class_id: str, task_data: TaskCreate, db: Session = Depends(get_db)):
    """Create a new task for a class."""
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    
    new_task = Task(
        id=generate_id(),
        title=task_data.title,
        due_date=task_data.due_date,
        class_id=class_id,
        done=False,
        hidden=False
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task


@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_data: TaskUpdate, db: Session = Depends(get_db)):
    """Update a task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task_data.title is not None:
        task.title = task_data.title
    if task_data.due_date is not None:
        task.due_date = task_data.due_date
    if task_data.done is not None:
        task.done = task_data.done
    if task_data.hidden is not None:
        task.hidden = task_data.hidden
    
    db.commit()
    db.refresh(task)
    return task


@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: str, db: Session = Depends(get_db)):
    """Delete a task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(task)
    db.commit()
    return None


# ============== Batch Operations ==============

@app.post("/api/classes/{class_id}/tasks/clear-completed", response_model=List[str])
async def clear_completed_tasks(class_id: str, db: Session = Depends(get_db)):
    """Mark all completed tasks as hidden for a class. Returns list of hidden task IDs."""
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    
    tasks = db.query(Task).filter(
        Task.class_id == class_id,
        Task.done == True,
        Task.hidden == False
    ).all()
    
    hidden_ids = []
    for task in tasks:
        task.hidden = True
        hidden_ids.append(task.id)
    
    db.commit()
    return hidden_ids


@app.post("/api/tasks/restore", response_model=List[TaskResponse])
async def restore_tasks(task_ids: List[str], db: Session = Depends(get_db)):
    """Restore hidden tasks (undo clear completed)."""
    tasks = db.query(Task).filter(Task.id.in_(task_ids)).all()
    
    for task in tasks:
        task.hidden = False
    
    db.commit()
    return tasks


# ============== Dashboard Endpoint ==============

def get_week_boundaries(today: date):
    """Get Monday start and Sunday end of current week."""
    day = today.weekday()  # Monday = 0
    start = today - timedelta(days=day)
    end = start + timedelta(days=6)
    return start, end


@app.get("/api/dashboard", response_model=DashboardResponse)
async def get_dashboard(db: Session = Depends(get_db)):
    """Get dashboard data with overdue, today, this week, and next week tasks."""
    today = date.today()
    week_start, week_end = get_week_boundaries(today)
    next_week_start = week_start + timedelta(days=7)
    next_week_end = week_end + timedelta(days=7)
    
    classes = db.query(Class).all()
    class_map = {c.id: c.name for c in classes}
    
    all_tasks = db.query(Task).filter(Task.hidden == False).all()
    
    overdue = []
    due_today = []
    due_this_week = []
    due_next_week = []
    
    for task in all_tasks:
        task_response = TaskResponse(
            id=task.id,
            title=task.title,
            dueDate=task.due_date,
            done=task.done,
            hidden=task.hidden,
            createdAt=task.created_at,
            classId=task.class_id
        )
        
        dashboard_task = DashboardTask(
            task=task_response,
            classId=task.class_id,
            className=class_map.get(task.class_id, "Unknown")
        )
        
        if not task.done and task.due_date < today:
            overdue.append(dashboard_task)
        elif task.due_date == today:
            due_today.append(dashboard_task)
        elif not task.done and week_start <= task.due_date <= week_end:
            due_this_week.append(dashboard_task)
        elif not task.done and next_week_start <= task.due_date <= next_week_end:
            due_next_week.append(dashboard_task)
    
    # Sort by due date
    overdue.sort(key=lambda x: x.task.due_date)
    due_today.sort(key=lambda x: x.task.due_date)
    due_this_week.sort(key=lambda x: x.task.due_date)
    due_next_week.sort(key=lambda x: x.task.due_date)
    
    return DashboardResponse(
        overdue=overdue,
        dueToday=due_today,
        dueThisWeek=due_this_week,
        dueNextWeek=due_next_week
    )


# ============== Backup/Restore Endpoints ==============

@app.get("/api/backup", response_model=BackupPayload)
async def get_backup(db: Session = Depends(get_db)):
    """Export current state as backup (compatible with original format)."""
    classes = db.query(Class).order_by(Class.created_at).all()
    
    classes_list = [{"id": c.id, "name": c.name} for c in classes]
    
    tasks_by_class = {}
    for cls in classes:
        tasks = db.query(Task).filter(Task.class_id == cls.id).order_by(Task.due_date, Task.created_at).all()
        tasks_by_class[cls.id] = [
            {
                "id": t.id,
                "title": t.title,
                "dueDate": t.due_date.isoformat(),
                "done": t.done,
                "hidden": t.hidden,
                "createdAt": int(t.created_at.timestamp() * 1000)
            }
            for t in tasks
        ]
    
    state = StateBackup(
        activeClassId=classes[0].id if classes else None,
        viewMode="week",
        classes=classes_list,
        tasksByClass=tasks_by_class,
        expandedWeeksByClass={}
    )
    
    return BackupPayload(
        version=1,
        exportedAt=datetime.now().isoformat(),
        storageKey="hw_tracker_semester_v2",
        state=state
    )


@app.post("/api/backup", status_code=status.HTTP_201_CREATED)
async def restore_backup(backup: BackupPayload, db: Session = Depends(get_db)):
    """Restore state from backup. WARNING: This replaces all existing data."""
    # Clear existing data
    db.query(Task).delete()
    db.query(Class).delete()
    db.commit()
    
    # Restore classes
    for cls_data in backup.state.classes:
        new_class = Class(
            id=cls_data["id"],
            name=cls_data["name"]
        )
        db.add(new_class)
    
    db.commit()
    
    # Restore tasks
    for class_id, tasks in backup.state.tasksByClass.items():
        for task_data in tasks:
            new_task = Task(
                id=task_data["id"],
                title=task_data["title"],
                due_date=date.fromisoformat(task_data["dueDate"]),
                done=task_data.get("done", False),
                hidden=task_data.get("hidden", False),
                class_id=class_id
            )
            db.add(new_task)
    
    db.commit()
    
    return {"message": "Backup restored successfully"}


# ============== Full State Endpoint (for frontend sync) ==============

@app.get("/api/state")
async def get_state(db: Session = Depends(get_db)):
    """Get full state matching the original localStorage format."""
    classes = db.query(Class).order_by(Class.created_at).all()
    
    classes_list = [{"id": c.id, "name": c.name} for c in classes]
    
    tasks_by_class = {}
    for cls in classes:
        tasks = db.query(Task).filter(Task.class_id == cls.id).order_by(Task.due_date, Task.created_at).all()
        tasks_by_class[cls.id] = [
            {
                "id": t.id,
                "title": t.title,
                "dueDate": t.due_date.isoformat(),
                "done": t.done,
                "hidden": t.hidden,
                "createdAt": int(t.created_at.timestamp() * 1000)
            }
            for t in tasks
        ]
    
    return {
        "classes": classes_list,
        "tasksByClass": tasks_by_class
    }
