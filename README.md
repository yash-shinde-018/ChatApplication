# Real-Time Chat Application

A real-time chat application built with React + Vite (frontend) and Node.js + Express (backend), using Socket.io for real-time communication and MongoDB for data persistence.

## Tech Stack

- **Frontend**: React + Vite, JavaScript
- **Backend**: Node.js + Express, JavaScript
- **Real-time Communication**: Socket.io
- **Database**: MongoDB with Mongoose

## Project Structure

```
realtime-chat/
├── frontend/          # React + Vite application
├── backend/           # Node.js + Express server
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB (for later phases)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

The backend will be available at `http://localhost:5000`

## API Endpoints

### Health Check

- **GET** `/api/health` - Server health status

Response:
```json
{
  "success": true,
  "message": "Chat server is running"
}
```

## Development

Both frontend and backend support hot-reload during development:

- **Frontend**: Changes to React components automatically refresh the browser
- **Backend**: Changes to server files automatically restart the server via nodemon

## Phases

- **Phase 1**: Project setup (current)
  - Root project structure
  - Frontend initialization (React + Vite)
  - Backend initialization (Express server)
  - Environment configuration
  - Health check endpoint

- **Phase 2+**: Chat functionality (coming soon)
