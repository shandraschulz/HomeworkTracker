# Homework Tracker

A dockerized homework tracking application with a FastAPI backend, PostgreSQL database, and a responsive frontend.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Tunnel                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Traefik                               │
│                   (Reverse Proxy + SSL)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Frontend  │───▶│   Backend   │───▶│  PostgreSQL │     │
│  │   (Nginx)   │    │  (FastAPI)  │    │     (DB)    │     │
│  │   :80       │    │   :8000     │    │   :5432     │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Local Development

1. **Clone and navigate to the project:**
   ```bash
   cd HomeworkTracker
   ```

2. **Copy development environment file:**
   ```bash
   cp .env.development .env
   ```

3. **Start the development stack:**
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

4. **Access the application:**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:8000/api
   - API Docs: http://localhost:8000/api/docs

### Production Deployment (Portainer + Traefik)

1. **Prerequisites:**
   - Traefik running with Cloudflare DNS challenge configured
   - External Docker network named `traefik-proxy`
   - Cloudflare tunnel pointing to your Traefik instance

2. **Create the Traefik network (if not exists):**
   ```bash
   docker network create traefik-proxy
   ```

3. **Configure environment:**
   ```bash
   cp .env.production .env
   # Edit .env with your production values
   ```

4. **Update `.env` with your settings:**
   ```env
   POSTGRES_PASSWORD=your_strong_password_here
   DOMAIN=homework.yourdomain.com
   ALLOWED_ORIGINS=https://homework.yourdomain.com
   ```

5. **Deploy via Portainer:**
   - Add as a new Stack
   - Use `docker-compose.prod.yml`
   - Add environment variables from `.env`

6. **Or deploy via command line:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/classes` | List all classes |
| POST | `/api/classes` | Create a new class |
| GET | `/api/classes/{id}` | Get class with tasks |
| PUT | `/api/classes/{id}` | Update class |
| DELETE | `/api/classes/{id}` | Delete class |
| GET | `/api/classes/{id}/tasks` | List tasks for class |
| POST | `/api/classes/{id}/tasks` | Create task |
| PUT | `/api/tasks/{id}` | Update task |
| DELETE | `/api/tasks/{id}` | Delete task |
| POST | `/api/classes/{id}/tasks/clear-completed` | Hide completed tasks |
| POST | `/api/tasks/restore` | Restore hidden tasks |
| GET | `/api/backup` | Export data backup |
| POST | `/api/backup` | Import data backup |
| GET | `/api/state` | Get full state |
| GET | `/api/dashboard` | Get dashboard data |

## Project Structure

```
HomeworkTracker/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI application
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── schemas.py       # Pydantic schemas
│   │   └── database.py      # Database configuration
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── tracker.html         # Main HTML file
│   ├── tracker.css          # Styles
│   ├── tracker.js           # Frontend JavaScript
│   ├── nginx.conf           # Nginx configuration
│   └── Dockerfile
├── docker-compose.dev.yml   # Development compose
├── docker-compose.prod.yml  # Production compose
├── .env.development         # Dev environment template
├── .env.production          # Prod environment template
└── README.md
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | `development` or `production` | `development` |
| `POSTGRES_USER` | Database username | `homework` |
| `POSTGRES_PASSWORD` | Database password | Required |
| `POSTGRES_DB` | Database name | `homework_tracker` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:8080` |
| `DOMAIN` | Production domain | Required for production |

## Traefik Integration

The production compose file includes Traefik labels for:

- Automatic HTTPS with Cloudflare certificates
- HTTP to HTTPS redirect
- Security headers (HSTS, XSS protection, etc.)
- Load balancing ready

### Required Traefik Configuration

Ensure your Traefik has:
```yaml
entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"

certificatesResolvers:
  cloudflare:
    acme:
      email: your@email.com
      storage: /letsencrypt/acme.json
      dnsChallenge:
        provider: cloudflare
```

## Backup & Restore

The application supports JSON backup/restore compatible with the original localStorage format:

- **Download Backup:** Click "Download backup" in the UI
- **Upload Backup:** Click "Upload backup" and select a JSON file
- **API:** Use `GET /api/backup` and `POST /api/backup`

## Development

### Running Backend Locally (without Docker)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Hot Reload

In development mode, both frontend and backend support hot reload:
- Backend: Code changes auto-reload via uvicorn
- Frontend: Changes require browser refresh (static files)

## License

MIT
