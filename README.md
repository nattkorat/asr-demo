# Khmer ASR Demo Web App

A simple FastAPI application that provides both backend APIs and a frontend web interface.

## Project Structure

```text
.
├── backend
│   ├── core
│   │   └── config.py
│   ├── main.py
│   ├── routers
│   │   ├── http.py
│   │   └── websocket.py
│   └── services
│       └── asr.py
├── frontend
│   └── index.html
├── README.md
├── requirements.txt
└── run.py
```

## Features

* FastAPI backend
* HTTP API endpoints
* WebSocket support
* Frontend web interface
* Modular service architecture
* Configuration management

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/nattkorat/asr-demo
cd asr-demo
```

### 2. Create a virtual environment

```bash
python -m venv .venv
```

Activate the environment:

**Linux/macOS**

```bash
source .venv/bin/activate
```

**Windows**

```bash
.venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

## Running the Application

Start the application with:

```bash
python run.py
```

Alternatively, run FastAPI directly:

```bash
uvicorn backend.main:app --reload
```

## Access the Application

After starting the server:

* Frontend: http://localhost:8000
* API Documentation (Swagger UI): http://localhost:8000/docs
* ReDoc Documentation: http://localhost:8000/redoc

## Backend Components

### `backend/main.py`

Application entry point and FastAPI initialization.

### `backend/routers/http.py`

Contains HTTP API routes.

### `backend/routers/websocket.py`

Contains WebSocket endpoints for real-time communication.

### `backend/services/asr.py`

Business logic and ASR-related services.

### `backend/core/config.py`

Application configuration and settings.

## Frontend

The frontend is located in:

```text
frontend/index.html
```

It communicates with the FastAPI backend through HTTP requests and/or WebSocket connections.

## Requirements

Install all dependencies from:

```bash
requirements.txt
```

## License

Specify your license here.
