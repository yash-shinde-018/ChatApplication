# Real-Time Chat Application

A modern real-time multi-room chat application built using **React, Node.js, Express, Socket.io, and MongoDB**.

The application allows users to register and log in securely, create and join public or private chat rooms, communicate in real time using Socket.io, and share room invitation links.

---

## Features

### Authentication

- User registration with username, email, and password
- Secure password hashing using bcrypt
- JWT-based authentication
- Protected API routes
- Persistent authentication
- Login and logout functionality
- Authenticated Socket.io connections

### Dashboard

- View available chat rooms
- Search rooms by name or description
- View room type and capacity
- Create new chat rooms
- Join existing rooms
- Modern glassmorphism-inspired interface

### Real-Time Chat

- Real-time messaging using Socket.io
- Messages delivered instantly without page refresh
- Room-specific messaging
- Message timestamps
- Different UI for sent and received messages
- Automatic scrolling to latest messages
- Messages persisted in MongoDB
- Chat history restored after refresh

### Chat Rooms

- Create public rooms
- Create private rooms
- Password-protected private rooms
- Maximum user capacity
- Join and leave rooms
- Room-specific message history
- Room membership validation
- Room isolation

### Room Sharing

- Generate shareable room links
- Copy room invitation links
- Public rooms can be joined directly
- Private rooms require a password
- Room passwords are never included in URLs

### UI/UX

- Modern glassmorphism-inspired design
- Responsive layout
- Desktop and mobile friendly
- Connection status indicator
- Loading states
- Error handling
- Empty states
- Password visibility controls
- Responsive chat interface

---

# Tech Stack

### Frontend

- React
- Vite
- JavaScript
- Socket.io Client
- CSS
- Oxlint

### Backend

- Node.js
- Express.js
- Socket.io
- Mongoose
- JWT
- bcrypt
- dotenv
- CORS
- nodemon

### Database

- MongoDB Atlas

---

## Installation

1. Clone the Repository
      git clone <YOUR_GITHUB_REPOSITORY_URL>
      cd real-time-chat
   
3. Backend Setup
      - Open a terminal: cd backend
      - Install dependencies: npm install
      - Create the backend/.env file using the environment variables described above.
      - Start the backend: npm run dev
      - The backend will normally run at: http://localhost:5000
      -  Health check: http://localhost:5000/api/health
       
3. Frontend Setup
      - Open another terminal: cd frontend
      - Install dependencies: npm install
      - Create the frontend/.env file using the environment variables described above.
      - Start the frontend: npm run dev

The application will normally be available at: http://localhost:5173

