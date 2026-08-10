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

## REST API

 Authentication
- Register:
  POST /api/auth/register
- Example request:
      {
        "username": "Yash",
        "email": "yash@example.com",
        "password": "Password123"
      }
- Login
  POST /api/auth/login
- Example request:
      {
        "email": "yash@example.com",
        "password": "Password123"
      }
- Get Current User
  GET /api/auth/me
- Requires:
  Authorization: Bearer <JWT>
  
# Rooms
- Create Room
  - POST /api/rooms
- Get Available Rooms
  - GET /api/rooms
- Get Room Details
  - GET /api/rooms/:roomId
- Join Room
  - POST /api/rooms/:roomId/join
- Leave Room
  - POST /api/rooms/:roomId/leave
  
# Messages
- Get Room Messages
  - GET /api/rooms/: roomId/messages
- Send Message
  - POST /api/rooms/: roomId/messages

Protected endpoints require a valid JWT.

## Socket.io Events
Socket.io is used for real-time communication.
- Client → Server
      room:join
      room:leave
      message:send

- Server → Client
      room:joined
      room:left
      message:receive
      socket:error
  
- Real-Time Message Flow
      User sends message
             ↓
      Socket.io Server
             ↓
      Verify authentication
             ↓
      Verify room membership
             ↓
      Save message to MongoDB
             ↓
      Broadcast to Socket.io room
             ↓
      Room members receive message instantly

Messages are broadcast only to users belonging to the corresponding room.

## Design Decisions
-React + Vite
React provides a component-based architecture for building a responsive and maintainable frontend. Vite provides a fast development environment.

- Node.js + Express
Node.js and Express provide a lightweight backend for REST APIs and integrate naturally with Socket.io and MongoDB.

- Socket.io
Socket.io was selected because real-time communication is a mandatory requirement. It allows messages to be delivered instantly without polling or page refreshes.

- MongoDB
MongoDB was selected because users, rooms, and chat messages can be represented naturally as documents and it integrates well with Node.js through Mongoose.

- JWT
JWT provides authentication for REST APIs and Socket.io connections.

- bcrypt
bcrypt is used to securely hash user passwords and private room passwords.

- Socket.io Rooms
Socket.io rooms ensure that messages are delivered only to members of the relevant chat room.

- Glassmorphism
A glassmorphism-inspired design provides a modern interface while maintaining clear and readable chat content.

## Assumptions
- This project is intended for educational and demonstration purposes.
- Email verification is not implemented.
- Password reset is not implemented.
- OAuth/social login is not implemented.
- Users authenticate using email and password.
- Room creators are automatically added as room members.
- Private rooms require a password to join.
- Room capacity is enforced on the backend.
- Room invitation URLs contain the room ID but never the room password.
- MongoDB Atlas is used as the database.
- JWT is stored on the client for this project. A production application could use secure HttpOnly    cookies.
- Client-side room search is sufficient for the current project scale.
