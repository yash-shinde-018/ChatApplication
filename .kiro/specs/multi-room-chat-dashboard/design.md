# Design Document: Multi-Room Chat Dashboard

## Overview

The Multi-Room Chat Dashboard transforms the single-room chat application into a scalable multi-room communication system. Users can create and discover public/private rooms, manage room membership, send room-scoped messages, and navigate between rooms via a unified dashboard interface.

**Key Design Principles:**
- Room-scoped message isolation (critical security requirement)
- Real-time Socket.io communication per-room
- Server-side access control enforcement
- Backward compatibility with Phase 4 authentication
- Glassmorphism UI consistency
- Atomic capacity enforcement

---

## Architecture

### System Architecture Overview

#### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Frontend                              │
├──────────────────┬──────────────────┬──────────────────┬────────────┤
│  AuthContext     │  DashboardView   │  ChatView        │ SocketIO   │
│  (Phase 4)       │  (New)           │  (Updated)       │ Client     │
└────────┬─────────┴──────────┬───────┴────────┬─────────┴────────┬──┘
         │                    │                │                 │
         └────────────────────┴────────────────┴─────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │  CORS-enabled      │
                    │  HTTP + WebSocket  │
                    └─────────┬──────────┘
                              │
         ┌────────────────────┴──────────────────┐
         │                                       │
    ┌────▼────────────────┐       ┌────────────▼──────┐
    │  Express.js API     │       │  Socket.io Server │
    │  (HTTP REST)        │       │  (Real-time)      │
    ├─────────────────────┤       ├───────────────────┤
    │ /api/auth/*         │       │ room:join         │
    │ /api/rooms/*        │       │ room:leave        │
    │ /api/messages       │       │ message:send      │
    │                     │       │ message:receive   │
    └────────┬────────────┘       └────────┬──────────┘
             │                            │
             └────────────┬───────────────┘
                          │
              ┌───────────▼──────────┐
              │    MongoDB Atlas     │
              ├──────────────────────┤
              │ Users Collection     │
              │ Rooms Collection     │
              │ Messages Collection  │
              └──────────────────────┘
```

### Data Flow for Room Message

```
Client (Socket) 
    → message:send {roomId, message}
        ↓ (Socket.io Server validates membership)
    Room.findById(roomId) + verify userId in members
        ↓ (Create and persist)
    Message.create({roomId, senderId, message, timestamp})
        ↓ (Broadcast scoped to room)
    io.to(roomId).emit('message:receive', {...})
        ↓ (Only connected sockets in that room receive)
    Other Room Members (receive real-time message)
```

### Authentication Flow

```
User Login (Phase 4 unchanged)
    ↓ (JWT issued)
Client stores JWT in localStorage
    ↓ (On Dashboard mount)
GET /api/auth/me (validate token + get user)
    ↓ (If valid: show Dashboard; if 401: logout)
User Joins Room (REST API)
    ↓ (JWT validated by auth middleware)
POST /api/rooms/:roomId/join (with password if private)
    ↓ (Server adds userId to Room.members)
Socket connection established
    ↓ (JWT passed in socket.handshake.auth.token)
Socket.io validates token at connection time
    ↓ (If valid: authenticated socket; if invalid: reject)
socket.join(roomId) on client request
    ↓ (Server verifies membership + adds to Socket.io room)
Now receiving room-scoped messages via Socket.io
```

---

## Data Models

### Database Schema

### Users Collection (Phase 4 - unchanged)

```javascript
{
  _id: ObjectId,
  username: String (required, unique, 3-20 chars),
  email: String (required, unique),
  passwordHash: String (required, bcrypt-hashed),
  createdAt: Date,
  updatedAt: Date
}

Indexes:
  - username: 1 (unique)
  - email: 1 (unique)
```

### Rooms Collection (NEW)

```javascript
{
  _id: ObjectId (auto-generated),
  name: String (required, 3-50 chars, trimmed),
  description: String (optional, max 500 chars, trimmed),
  type: String (enum: 'public' | 'private', required),
  passwordHash: String (optional, only for private rooms, bcrypt-hashed, NEVER exposed),
  maxUsers: Number (required, 2-500, validated),
  createdBy: ObjectId (reference to Users, required),
  members: [ObjectId] (array of User references, default: [createdBy]),
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}

Indexes:
  - name: 1
  - createdBy: 1
  - type: 1
  - createdAt: -1
  - members: 1 (for efficient membership queries)

Invariants:
  - members array ALWAYS includes createdBy
  - members.length <= maxUsers
  - passwordHash only present when type === 'private'
  - passwordHash NEVER exposed in API responses or toJSON()
```

### Messages Collection (Updated from Phase 4)

```javascript
{
  _id: ObjectId (auto-generated),
  roomId: ObjectId (reference to Rooms, required for new messages, optional for backward compat),
  senderId: ObjectId (reference to Users, required for new messages, optional for backward compat),
  username: String (required, denormalized from User for display),
  message: String (required, max 500 chars, trimmed, non-empty),
  timestamp: Date (auto-generated, defaults to now),
  _v: Number (version field, auto-managed by Mongoose)
}

Indexes:
  - roomId: 1, timestamp: -1 (composite index for room message queries)
  - senderId: 1 (for user message history if needed)

Backward Compatibility:
  - Messages created before Phase 5 may lack roomId/senderId
  - Queries with roomId filter implicitly exclude old messages (they belong to no room)
  - Old messages never appear in room-specific API responses
```

---

## API Design

### Authentication Endpoints (Phase 4 - Unchanged)

#### POST /api/auth/register

Request:
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

Response (201 Created):
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "userId123",
      "username": "john_doe",
      "email": "john@example.com"
    }
  }
}
```

#### POST /api/auth/login

Request:
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

Response (200 OK):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "userId123",
      "username": "john_doe",
      "email": "john@example.com"
    }
  }
}
```

#### GET /api/auth/me

Headers: `Authorization: Bearer <JWT_TOKEN>`

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "userId123",
      "username": "john_doe",
      "email": "john@example.com"
    }
  }
}
```

Error Response (401 Unauthorized):
```json
{
  "success": false,
  "message": "Token expired or invalid"
}
```

### Room Management Endpoints (NEW)

#### POST /api/rooms - Create Room (Public or Private)

Headers: `Authorization: Bearer <JWT_TOKEN>`

Request:
```json
{
  "name": "Web Developers",
  "description": "Discussion about web development trends",
  "type": "public",
  "maxUsers": 50,
  "password": null
}
```

For Private Room:
```json
{
  "name": "Team Project",
  "description": "Private team workspace",
  "type": "private",
  "maxUsers": 10,
  "password": "SecurePass123"
}
```

Response (201 Created):
```json
{
  "success": true,
  "message": "Room created successfully",
  "data": {
    "room": {
      "_id": "roomId123",
      "name": "Web Developers",
      "description": "Discussion about web development trends",
      "type": "public",
      "maxUsers": 50,
      "createdBy": "userId123",
      "members": ["userId123"],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

Error Response (400 Bad Request):
```json
{
  "success": false,
  "message": "name must be 3-50 characters"
}
```

Error Response (400 Bad Request - Private Room):
```json
{
  "success": false,
  "message": "password is required for private rooms"
}
```

#### GET /api/rooms - List Available Rooms

Headers: `Authorization: Bearer <JWT_TOKEN>`

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "_id": "roomId123",
        "name": "Web Developers",
        "description": "Discussion about web development",
        "type": "public",
        "maxUsers": 50,
        "memberCount": 12,
        "createdAt": "2024-01-15T10:30:00Z",
        "members": ["userId1", "userId2", ...]
      },
      {
        "_id": "roomId456",
        "name": "Private Team",
        "description": "Internal team space",
        "type": "private",
        "maxUsers": 10,
        "memberCount": 5,
        "createdAt": "2024-01-14T14:20:00Z",
        "members": ["userId123", "userId789", ...]
      }
    ]
  }
}
```

Filtering Logic:
- Returns ALL public rooms (type === 'public')
- Returns private rooms (type === 'private') where authenticated user is in members array
- Ordered by createdAt descending (newest first)

#### GET /api/rooms/:roomId - Get Room Details

Headers: `Authorization: Bearer <JWT_TOKEN>`

Response (200 OK - Public Room):
```json
{
  "success": true,
  "data": {
    "_id": "roomId123",
    "name": "Web Developers",
    "description": "Discussion about web development",
    "type": "public",
    "maxUsers": 50,
    "memberCount": 12,
    "members": [
      { "_id": "userId1", "username": "alice" },
      { "_id": "userId2", "username": "bob" }
    ],
    "createdBy": { "_id": "userId123", "username": "john_doe" },
    "isUserMember": true,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

Error Response (403 Forbidden - Private Room, Not Member):
```json
{
  "success": false,
  "message": "Forbidden"
}
```

Error Response (404 Not Found):
```json
{
  "success": false,
  "message": "Room not found"
}
```

#### POST /api/rooms/:roomId/join - Join Public Room

Headers: `Authorization: Bearer <JWT_TOKEN>`

Request Body: (empty for public rooms)
```json
{}
```

Response (200 OK):
```json
{
  "success": true,
  "message": "Joined room successfully",
  "data": {
    "room": {
      "_id": "roomId123",
      "name": "Web Developers",
      "description": "Discussion about web development",
      "type": "public",
      "maxUsers": 50,
      "members": ["userId123", "userId456", ...],
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

Error Response (409 Conflict - Room Full):
```json
{
  "success": false,
  "message": "Room is full"
}
```

Error Response (409 Conflict - Already Member):
```json
{
  "success": false,
  "message": "Already a member of this room"
}
```

Error Response (403 Forbidden - Private Room):
```json
{
  "success": false,
  "message": "Use public join endpoint for public rooms"
}
```

#### POST /api/rooms/:roomId/join - Join Private Room

Headers: `Authorization: Bearer <JWT_TOKEN>`

Request:
```json
{
  "password": "SecurePass123"
}
```

Response (200 OK):
```json
{
  "success": true,
  "message": "Joined room successfully",
  "data": {
    "room": {
      "_id": "roomId456",
      "name": "Team Project",
      "type": "private",
      "maxUsers": 10,
      "members": ["userId123", "userId789", ...],
      "createdAt": "2024-01-14T14:20:00Z"
    }
  }
}
```

Error Response (400 Bad Request - Missing Password):
```json
{
  "success": false,
  "message": "Password is required"
}
```

Error Response (401 Unauthorized - Wrong Password):
```json
{
  "success": false,
  "message": "Invalid password"
}
```

Note: Server returns generic error message regardless of whether room/password exists (security).

#### POST /api/rooms/:roomId/leave - Leave Room

Headers: `Authorization: Bearer <JWT_TOKEN>`

Request Body: (empty)
```json
{}
```

Response (200 OK):
```json
{
  "success": true,
  "message": "Left room successfully"
}
```

Error Response (409 Conflict - Not Member):
```json
{
  "success": false,
  "message": "Not a member of this room"
}
```

Error Response (404 Not Found):
```json
{
  "success": false,
  "message": "Room not found"
}
```

### Message Endpoints

#### GET /api/rooms/:roomId/messages - Get Room Message History

Headers: `Authorization: Bearer <JWT_TOKEN>`

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "_id": "msgId1",
        "senderId": {
          "_id": "userId1",
          "username": "alice"
        },
        "roomId": "roomId123",
        "message": "Hello everyone!",
        "timestamp": "2024-01-15T10:35:00Z"
      },
      {
        "_id": "msgId2",
        "senderId": {
          "_id": "userId2",
          "username": "bob"
        },
        "roomId": "roomId123",
        "message": "Hi there!",
        "timestamp": "2024-01-15T10:36:00Z"
      }
    ]
  }
}
```

Ordering: Messages ordered by timestamp ascending (oldest first).

Error Response (403 Forbidden - Not Member):
```json
{
  "success": false,
  "message": "Forbidden"
}
```

Error Response (404 Not Found):
```json
{
  "success": false,
  "message": "Room not found"
}
```

#### POST /api/messages - Send Message to Room

Headers: `Authorization: Bearer <JWT_TOKEN>`

Request:
```json
{
  "roomId": "roomId123",
  "message": "This is my message"
}
```

Response (201 Created):
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "_id": "msgId123",
    "senderId": { "_id": "userId123", "username": "john_doe" },
    "roomId": "roomId123",
    "message": "This is my message",
    "timestamp": "2024-01-15T10:40:00Z"
  }
}
```

Behavior:
- Message is saved to MongoDB
- Broadcast via Socket.io to ONLY members of specified roomId (message:receive event)
- Users not in room do NOT receive this message

Error Response (400 Bad Request - Missing Message):
```json
{
  "success": false,
  "message": "Message is required"
}
```

Error Response (400 Bad Request - Invalid RoomId):
```json
{
  "success": false,
  "message": "RoomId is required and must be valid"
}
```

Error Response (403 Forbidden - Not Member):
```json
{
  "success": false,
  "message": "Not a member of this room"
}
```

---

## Socket.io Real-Time Events

### Connection Flow

```javascript
Client:
const socket = io('http://localhost:5000', {
  auth: {
    token: localStorage.getItem('JWT_TOKEN')
  }
});

socket.on('connect', () => {
  console.log('Connected to server');
});
```

Server validates token in Socket.io auth middleware before allowing connection.

### Client-to-Server Events

#### room:join

Sent by client when User joins a Room (after successful REST API call).

```javascript
socket.emit('room:join', { roomId: 'roomId123' });
```

Server validates:
- JWT token is present and valid
- roomId exists
- userId is in Room.members array

If validation passes:
- `socket.join(roomId)` - adds socket to Socket.io room
- Broadcasts `room:joined` event to all members

If validation fails:
- Emits `socket:error` event to client

#### room:leave

Sent by client when User leaves a Room.

```javascript
socket.emit('room:leave', { roomId: 'roomId123' });
```

Server:
- `socket.leave(roomId)` - removes socket from Socket.io room
- Broadcasts `room:left` event to remaining members

#### message:send

Sent by client when User sends a message.

```javascript
socket.emit('message:send', {
  roomId: 'roomId123',
  message: 'Hello everyone!'
});
```

Server validates:
- message is non-empty string
- roomId is valid ObjectId
- Room exists
- userId is in Room.members array

If validation passes:
- Create Message document: { senderId, roomId, message, username, timestamp }
- Save to MongoDB
- Broadcast `message:receive` event ONLY to users in that roomId

If validation fails:
- Emits `socket:error` event with error message

### Server-to-Client Events

#### room:joined

Broadcast to all members of a Room when User joins.

```javascript
{
  userId: 'userId123',
  roomId: 'roomId123'
}
```

Clients should:
- Update room member list
- Show "User joined" notification (optional)

#### room:left

Broadcast to remaining members when User leaves.

```javascript
{
  userId: 'userId123',
  roomId: 'roomId123'
}
```

Clients should:
- Update room member list
- Show "User left" notification (optional)

#### message:receive

Broadcast to all members when new message arrives.

```javascript
{
  _id: 'msgId123',
  senderId: { _id: 'userId123', username: 'john_doe' },
  roomId: 'roomId123',
  message: 'Hello everyone!',
  timestamp: '2024-01-15T10:40:00Z'
}
```

Clients should:
- Add message to current Room's message list
- Prevent duplicates (use _id)
- Only display if current activeRoomId === message.roomId

#### socket:error

Emitted when validation fails on server.

```javascript
{
  message: 'Not a member of this room'
}
```

Clients should:
- Display error notification
- Log error for debugging

### Critical Security: Room-Scoped Broadcasting

```javascript
// CORRECT: Broadcast only to roomId participants
io.to(roomId).emit('message:receive', messageData);

// WRONG: Would broadcast to all users
io.emit('message:receive', messageData);

// WRONG: Would leak to other rooms
socket.broadcast.emit('message:receive', messageData);
```

The design enforces room-scoped messaging by:
1. Server validates userId is in Room.members array BEFORE saving message
2. Broadcast uses `io.to(roomId)` - only sockets joined to that room receive event
3. Client filters received messages by roomId === currentActiveRoomId

---

## Components and Interfaces

### Frontend Components Overview

### Component Hierarchy

```
App
├── AuthContext Provider
├── AuthGateway (Phase 4 - unchanged)
│   ├── Login
│   └── Register
├── Dashboard (NEW)
│   ├── RoomList
│   │   └── RoomCard (map over rooms)
│   │       ├── JoinButton (calls API + navigates)
│   │       └── PasswordModal (for private rooms)
│   ├── CreateRoomModal (NEW)
│   ├── SearchBar (frontend filter)
│   └── RefreshButton
└── Chat (Updated)
    ├── ChatHeader
    │   ├── RoomTitle
    │   ├── MemberCount
    │   └── LeaveRoomButton
    ├── MessageList (Updated)
    │   └── MessageBubble (map over messages for current room)
    ├── MessageInput
    └── LoadingState / ErrorBanner
```

### Dashboard Component (NEW)

```jsx
// src/components/dashboard/Dashboard.jsx

props:
  (receives nothing, uses AuthContext for userId)

state:
  - rooms: Array of Room objects
  - filteredRooms: Array (filtered by search)
  - searchQuery: String
  - loading: Boolean
  - error: String | null
  - activeRoomForJoin: String | null (roomId)

lifecycle:
  - useEffect on mount: 
    1. Fetch user from GET /api/auth/me
    2. Fetch rooms from GET /api/rooms
    3. Set loading to false
    4. On 401 error: logout + navigate to login

  - useEffect on search: filter rooms by name

functions:
  - handleCreateRoom(roomData) -> POST /api/rooms
  - handleJoinRoom(roomId) -> POST /api/rooms/:roomId/join
  - handleRefresh() -> re-fetch rooms
  - handleSearch(query) -> filter local state

rendering:
  - Header: "Available Rooms" + Refresh button
  - CreateRoomButton (opens modal)
  - SearchInput
  - RoomList (sorted by createdAt desc)
  - For each room: RoomCard with join/view button
  - "My Rooms" section (filtered to members-only)
  - ErrorBanner if error
```

### RoomCard Component (NEW)

```jsx
// src/components/dashboard/RoomCard.jsx

props:
  - room: Room object
  - onJoin: Function(roomId)
  - onView: Function(roomId)
  - isMember: Boolean

renders:
  - Room name, description
  - Type badge (Public / Private)
  - Member count / max capacity (e.g., "3/10")
  - Created date (formatted)
  - Hover effect (glassmorphism card lift)
  - Join button (if not member)
  - View/Enter button (if member)
  - Password icon (if private)

styling:
  - Glassmorphism card: rgba background, backdrop-filter blur
  - Rounded corners (16px), subtle shadow
  - Smooth transitions on hover
  - Responsive: full width on mobile
```

### CreateRoomModal Component (NEW)

```jsx
// src/components/dashboard/CreateRoomModal.jsx

props:
  - isOpen: Boolean
  - onClose: Function
  - onCreated: Function (callback after successful create)

state:
  - formData: { name, description, type, maxUsers, password }
  - errors: Object (field-level errors)
  - loading: Boolean
  - serverError: String | null

form fields:
  - name: text input (3-50 chars)
  - description: textarea (optional, max 500 chars)
  - type: radio buttons (Public / Private)
  - maxUsers: number input (2-500)
  - password: password input (visible only if type === 'private', min 6 chars)

functions:
  - handleSubmit() -> validate form, POST /api/rooms, close modal, refresh dashboard
  - handleTypeChange() -> show/hide password field
  - handleInputChange() -> update form state

validation:
  - name: required, 3-50 chars
  - description: optional, max 500 chars
  - type: required
  - maxUsers: required, 2-500
  - password: required if type === 'private', min 6 chars

styling:
  - Glassmorphism overlay
  - Dark semi-transparent background
  - Glass card with rounded corners
  - Smooth fade-in animation

error handling:
  - Display inline field errors below each input
  - Display server error banner
  - Keep modal open if error (allow retry)
```

### PasswordModal Component (NEW)

```jsx
// src/components/dashboard/PasswordModal.jsx

props:
  - isOpen: Boolean
  - roomName: String
  - onJoin: Function(password) -> Promise
  - onCancel: Function

state:
  - password: String
  - error: String | null
  - loading: Boolean

functions:
  - handleJoin() -> call onJoin(password), handle success/error
  - handleCancel() -> close modal

rendering:
  - Room name as title
  - Password input (hidden type)
  - Join button (disabled while loading)
  - Cancel button
  - Error message if validation fails

styling:
  - Glassmorphism modal
  - Centered on screen
  - Smooth transitions
```

### Chat Component (Updated from Phase 4)

```jsx
// src/components/Chat.jsx

props:
  - roomId: String (from URL params)

state:
  - messages: Array of Message objects (filtered by roomId)
  - room: Room object (name, description, memberCount, maxUsers)
  - loading: Boolean
  - error: String | null
  - disconnected: Boolean

lifecycle:
  - useEffect on mount or roomId change:
    1. GET /api/rooms/:roomId (fetch room details)
    2. GET /api/rooms/:roomId/messages (fetch history)
    3. Socket: emit room:join event
    4. Socket: listen for message:receive events
    5. Filter and display only messages where roomId === current

  - useEffect on unmount or roomId change:
    1. Socket: emit room:leave event
    2. Socket: unsubscribe from message:receive

  - Socket listener for message:receive:
    1. Verify message.roomId === current roomId
    2. Check for duplicates (by _id)
    3. Add to messages array
    4. Auto-scroll to bottom

functions:
  - handleSendMessage(messageText) -> emit message:send via Socket.io
  - handleLeaveRoom() -> POST /api/rooms/:roomId/leave, navigate to dashboard
  - handleDisconnect() -> show "Disconnected" status, attempt auto-reconnect

rendering:
  - Header: room name, member count, leave button
  - MessageList (messages for current room only)
  - MessageInput
  - LoadingState
  - ErrorBanner (for 401: logout + navigate)
  - DisconnectedStatus
```

### ChatHeader Component (Updated)

```jsx
// src/components/ChatHeader.jsx

props:
  - room: Room object

renders:
  - Room name (as title)
  - Room description (subtitle, if exists)
  - Member count display: "X/Y members"
  - Leave Room button
  - Glassmorphism header background

actions:
  - Leave button: emit room:leave, clear local state, navigate to dashboard
```

### MessageList Component (Updated)

```jsx
// src/components/chat/MessageList.jsx

props:
  - messages: Array of Message objects
  - currentRoomId: String
  - loading: Boolean

rendering:
  - For each message in messages (filtered by roomId):
    - MessageBubble component
  - Auto-scroll to bottom on new message
  - Show loading spinner if loading

note:
  - ONLY display messages where message.roomId === currentRoomId
  - Prevents cross-room message display
```

### MessageInput Component (Updated)

```jsx
// src/components/chat/MessageInput.jsx

props:
  - roomId: String
  - onSend: Function(message)
  - disabled: Boolean (if disconnected)

state:
  - messageText: String

functions:
  - handleSubmit() -> validate, emit message:send via Socket.io
  - handleKeyPress(Enter) -> submit

rendering:
  - Textarea input
  - Send button (disabled if disconnected)
  - Character count (optional)
```

---

## Authentication Flow Integration with Phase 4

### JWT Token Structure (Unchanged)

```javascript
{
  userId: 'user123',
  email: 'user@example.com',
  iat: 1704067200,
  exp: 1704153600 // 24 hours
}
```

### Phase 4 → Phase 5 Transition

```javascript
// Phase 4 behavior: User logs in → JWT issued → single global chat
POST /api/auth/login
  ↓ (JWT issued)
  localStorage.setItem('JWT_TOKEN', token)
  ↓
  Navigate to Chat component (single room)

// Phase 5 behavior: User logs in → JWT issued → Dashboard
POST /api/auth/login
  ↓ (JWT issued)
  localStorage.setItem('JWT_TOKEN', token)
  ↓
  Navigate to Dashboard component (room list)
  ↓
  User selects room → join via API
  ↓
  Navigate to Chat component (room-scoped)
```

### Token Validation Points

1. **REST API Requests** (middleware)
   ```javascript
   // authMiddleware.js
   const authMiddleware = (req, res, next) => {
     const token = req.headers.authorization?.split(' ')[1];
     if (!token) return res.status(401).json({ success: false, message: 'No token' });
     
     jwt.verify(token, JWT_SECRET, (err, decoded) => {
       if (err) return res.status(401).json({ success: false, message: 'Invalid token' });
       req.user = decoded;
       next();
     });
   };
   ```

2. **Socket.io Connections** (auth middleware)
   ```javascript
   // server.js
   io.use((socket, next) => {
     const token = socket.handshake.auth.token;
     jwt.verify(token, JWT_SECRET, (err, decoded) => {
       if (err) return next(new Error('Auth failed'));
       socket.userId = decoded.userId;
       next();
     });
   });
   ```

3. **Dashboard Mount** (client-side)
   ```javascript
   // Dashboard.jsx
   useEffect(() => {
     GET /api/auth/me
       .then(user => setCurrentUser(user))
       .catch(err => {
         if (err.status === 401) logout(); // token expired
       });
   }, []);
   ```

4. **Room Access Check** (server-side before membership verification)
   ```javascript
   // roomController.js
   exports.joinPublicRoom = async (req, res) => {
     // Token already validated by authMiddleware
     const userId = req.user.userId; // from JWT
     // ... verify room membership
   };
   ```

### Logout Mechanism (Unchanged)

```javascript
// AuthContext.jsx
logout() {
  localStorage.removeItem('JWT_TOKEN');
  navigate('/auth/login');
}
```

Token revocation is NOT implemented (stateless JWT).
Once token expires (24 hours), user must re-login.

---

## Error Handling

### Standardized Error Response Format

```json
{
  "success": false,
  "message": "User-facing error message",
  "error": "Error details (development only)",
  "statusCode": 400
}
```

### HTTP Status Codes

| Status | Use Case | Example |
|--------|----------|---------|
| 200 | Successful GET/POST | List rooms, join room success |
| 201 | Resource created | Room/message created |
| 400 | Validation failed | Invalid input, missing field |
| 401 | Token invalid/expired | Invalid JWT, token expired |
| 403 | Access denied | User not room member, wrong password for private room |
| 404 | Resource not found | Room doesn't exist, room not found |
| 409 | Conflict/constraint violation | Room full, already member, capacity exceeded |
| 500 | Server error | Database error, unexpected exception |

### Field-Level Validation Errors

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "name": "name must be 3-50 characters",
    "maxUsers": "maxUsers must be between 2 and 500",
    "password": "password must be at least 6 characters"
  },
  "statusCode": 400
}
```

### Common Error Scenarios

**1. Room Full (Capacity Exceeded)**
```json
{
  "success": false,
  "message": "Room is full",
  "statusCode": 409
}
```
Handler: Client displays modal "Room has reached max capacity. Try another room."

**2. Wrong Private Room Password**
```json
{
  "success": false,
  "message": "Invalid password",
  "statusCode": 401
}
```
Note: Server intentionally doesn't reveal if room exists (security).
Handler: Keep password modal open, show error, allow retry.

**3. Not a Room Member (Accessing Private Room Details)**
```json
{
  "success": false,
  "message": "Forbidden",
  "statusCode": 403
}
```
Handler: Client redirects to dashboard, shows error.

**4. Token Expired**
```json
{
  "success": false,
  "message": "Token expired or invalid",
  "statusCode": 401
}
```
Handler: Client clears JWT from localStorage, redirects to login.

**5. Room Not Found**
```json
{
  "success": false,
  "message": "Room not found",
  "statusCode": 404
}
```
Handler: Client refreshes dashboard list, shows error notification.

### Socket.io Error Events

```javascript
socket.on('socket:error', (errorData) => {
  console.error('Socket error:', errorData.message);
  // Update UI: show error banner
});

socket.on('error', (error) => {
  console.error('Connection error:', error);
  // Update UI: show "Disconnected" status
});

socket.on('connect_error', (error) => {
  console.error('Connect error:', error);
  // Attempt reconnection
});
```

### Frontend Error Handling Strategy

1. **API Errors (REST)**
   - Catch on every request
   - 401: Logout + redirect to login
   - 403: Show "Access denied" notification
   - 404: Show "Not found" notification, refresh list
   - 400: Show validation errors
   - 500: Show generic error, retry option

2. **Socket.io Errors**
   - Connection lost: Show "Disconnected" status, attempt auto-reconnect
   - Message send failed: Show error, keep message in input, allow retry
   - room:join failed: Show error, stay on dashboard

3. **Async Operation Errors**
   - Show loading spinner during operation
   - On error: disable spinner, show error banner
   - On success: update local state, close modal

---

## Performance Considerations

### Database Indexing

```javascript
// Rooms Collection - Optimized Queries
db.rooms.createIndex({ name: 1 });
db.rooms.createIndex({ createdBy: 1 });
db.rooms.createIndex({ type: 1 });
db.rooms.createIndex({ createdAt: -1 });
db.rooms.createIndex({ members: 1 }); // For membership checks

// Messages Collection - Room-Scoped Queries
db.messages.createIndex({ roomId: 1, timestamp: -1 }); // Composite
db.messages.createIndex({ senderId: 1 });

// Users Collection (Phase 4)
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
```

### Query Optimization

**1. List Rooms Query**
```javascript
// BEFORE (inefficient):
const rooms = await Room.find().populate('members').populate('createdBy');
// Returns ALL member and creator objects

// AFTER (optimized):
const rooms = await Room.find({
  $or: [
    { type: 'public' },
    { type: 'private', members: userId }
  ]
})
.select('-passwordHash')
.lean() // Returns plain objects, not Mongoose docs
.sort({ createdAt: -1 });
// Only fetch necessary fields
```

**2. Get Room Messages Query**
```javascript
// BEFORE (inefficient):
const messages = await Message.find({ roomId }).populate('senderId');

// AFTER (optimized):
const messages = await Message.find({ roomId })
  .select('senderId username message timestamp roomId')
  .populate('senderId', 'username')
  .sort({ timestamp: 1 })
  .lean();
// Composite index on roomId + timestamp
// Only select needed fields
```

**3. Room Membership Check (Hot Path)**
```javascript
// BEFORE (loads entire room):
const room = await Room.findById(roomId);
const isMember = room.members.includes(userId);

// AFTER (optimized - just check membership):
const room = await Room.findOne(
  { _id: roomId, members: userId },
  { _id: 1 } // Only fetch _id
);
const isMember = room !== null;
// Uses existing members index
```

### Pagination (Future Phase)

For large room lists, implement cursor-based pagination:

```javascript
// GET /api/rooms?cursor=lastRoomId&limit=20
const rooms = await Room.find({
  _id: { $lt: cursor }, // cursor must be ObjectId
  $or: [{ type: 'public' }, { type: 'private', members: userId }]
})
.limit(20)
.sort({ _id: -1 });
```

### Caching Strategy

**What to Cache:**
- User's joined rooms list (5-10 minute TTL)
- Public rooms list (10 minute TTL)
- Current user profile (5 minute TTL)

**How to Cache:**
- Client-side: React state + localStorage
- Server-side: Redis (if available)

**Cache Invalidation:**
- After room creation
- After join/leave room
- On logout

Example:
```javascript
// Dashboard.jsx
const [roomsCache, setRoomsCache] = useState(null);
const [cacheTime, setCacheTime] = useState(null);

const fetchRooms = async () => {
  const now = Date.now();
  if (roomsCache && (now - cacheTime) < 300000) { // 5 min
    setRooms(roomsCache);
    return;
  }
  const data = await GET /api/rooms;
  setRoomsCache(data);
  setCacheTime(now);
};
```

### Connection Pooling

MongoDB connection pooling (handled by Mongoose):
```javascript
// mongoose.connect(..., {
//   maxPoolSize: 10,        // Max connections in pool
//   minPoolSize: 5,         // Min connections
//   maxConnecting: 2        // Max connecting threads
// })
```

### Message History Limits

For large message histories, limit initial load:

```javascript
// GET /api/rooms/:roomId/messages?limit=50&skip=0
const messages = await Message.find({ roomId })
  .limit(50)
  .skip(skip)
  .sort({ timestamp: -1 });
```

---

## Security Measures

### 1. Authentication & Authorization

**JWT Security:**
- Token issued on successful login
- Stored in localStorage (consider httpOnly cookie for future phase)
- Validated on every protected REST endpoint
- Validated on Socket.io connection
- Token includes: userId, email, iat, exp

**Password Security:**
- User passwords: bcrypt (Phase 4)
- Room passwords (private rooms): bcrypt with salt rounds: 10

```javascript
// Hashing room password
const salt = await bcrypt.genSalt(10);
const hash = await bcrypt.hash(plainPassword, salt);
```

### 2. Access Control Enforcement

**Room Member Verification (Server-Side Only)**

Never trust client-supplied userId. Always extract from JWT:

```javascript
exports.getRoomMessages = async (req, res) => {
  const userId = req.user.userId; // From JWT, not from client
  const { roomId } = req.params;
  
  // Verify user is member BEFORE returning messages
  const room = await Room.findOne({
    _id: roomId,
    members: userId
  });
  
  if (!room) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  
  const messages = await Message.find({ roomId });
  res.json({ success: true, data: { messages } });
};
```

**Socket.io Room-Scoped Verification**

```javascript
socket.on('message:send', async (data) => {
  const userId = socket.userId; // From JWT auth
  const { roomId, message } = data;
  
  // CRITICAL: Verify membership server-side
  const room = await Room.findOne({
    _id: roomId,
    members: userId
  });
  
  if (!room) {
    socket.emit('socket:error', { message: 'Not a member' });
    return;
  }
  
  // Save and broadcast ONLY to this room
  await Message.create({ roomId, senderId: userId, message });
  io.to(roomId).emit('message:receive', {...});
});
```

**Private Room Password Handling**

```javascript
// CORRECT: Generic error message (no room/password discrimination)
exports.joinPrivateRoom = async (req, res) => {
  const { password } = req.body;
  const room = await Room.findById(req.params.roomId);
  
  if (!room || room.type !== 'private') {
    // Intentionally vague: could mean room doesn't exist OR wrong room type
    return res.status(401).json({ success: false, message: 'Invalid password' });
  }
  
  const isValid = await bcrypt.compare(password, room.passwordHash);
  if (!isValid) {
    return res.status(401).json({ success: false, message: 'Invalid password' });
  }
  
  // ... proceed with join
};
```

### 3. Input Validation

**Room Name Validation:**
```javascript
const validateRoomName = (name) => {
  if (!name || typeof name !== 'string') return 'name is required';
  if (name.trim().length < 3) return 'name must be at least 3 characters';
  if (name.trim().length > 50) return 'name must not exceed 50 characters';
  return null;
};
```

**Message Content Validation:**
```javascript
const validateMessage = (message) => {
  if (!message || typeof message !== 'string') return 'message is required';
  if (message.trim().length === 0) return 'message cannot be empty';
  if (message.length > 500) return 'message must not exceed 500 characters';
  return null;
};
```

**RoomId ObjectId Validation:**
```javascript
const mongoose = require('mongoose');

const validateObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) ? null : 'Invalid object ID';
};
```

### 4. Output Sanitization

**Never Expose Sensitive Data:**
```javascript
// CORRECT: Exclude passwordHash from response
room.toJSON = function() {
  const obj = this.toObject();
  delete obj.passwordHash; // Never expose
  return obj;
};

// In API response
res.json({
  success: true,
  data: { room: room.toJSON() } // passwordHash excluded
});
```

### 5. Rate Limiting (Recommended Future Enhancement)

```javascript
// NOT in scope for Phase 5, but recommended:
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: 'Too many requests'
});

app.use('/api/', limiter);
```

### 6. CORS Configuration

```javascript
// server.js
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 7. Socket.io CORS Security

```javascript
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

### 8. Room Capacity Enforcement (Atomic)

```javascript
// Use MongoDB atomic operations to prevent race conditions
exports.joinPublicRoom = async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.userId;
  
  // Atomic operation: Check capacity AND add member in one operation
  const updatedRoom = await Room.findOneAndUpdate(
    {
      _id: roomId,
      $expr: { $lt: [{ $size: '$members' }, '$maxUsers'] }, // Capacity check
      members: { $ne: userId } // Not already member
    },
    { $push: { members: userId } }, // Add to members
    { new: true, runValidators: true }
  );
  
  if (!updatedRoom) {
    return res.status(409).json({ success: false, message: 'Room is full or already member' });
  }
  
  res.json({ success: true, data: { room: updatedRoom } });
};
```

### 9. Message Scoping (Critical)

Messages MUST be scoped to rooms:
- Every message has roomId
- Queries filter by roomId
- Socket broadcasts only to room members
- Never broadcast messages outside their room

---

## Integration Points with Phase 4 Authentication

### Shared Components

**AuthContext (Phase 4 - Unchanged)**
```javascript
// frontend/src/context/AuthContext.jsx
- login(email, password) -> sets JWT + currentUser
- logout() -> clears JWT + navigates to login
- currentUser -> { id, username, email }
- token -> JWT string
- isAuthenticated -> boolean
```

**Preserved Endpoints (Phase 4 - Unchanged)**
```
POST /api/auth/register
POST /api/auth/login
GET /api/auth/me
```

### Middleware & Interceptors

**HTTP Interceptor (Updated)**
```javascript
// frontend/src/services/api.js
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' }
});

// Add JWT to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('JWT_TOKEN');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Logout user
      localStorage.removeItem('JWT_TOKEN');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

**Auth Middleware (Backend - Unchanged Pattern)**
```javascript
// backend/src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

module.exports = authMiddleware;
```

### JWT Payload Consistency

Phase 4 JWT structure carries forward to Phase 5:

```javascript
// At login (Phase 4 - Unchanged)
const token = jwt.sign(
  { userId: user._id, email: user.email },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);
```

All Phase 5 endpoints rely on `req.user.userId` from the same JWT:

```javascript
// Phase 5 room endpoint
exports.createRoom = async (req, res) => {
  const userId = req.user.userId; // Same field as Phase 4
  // ...
};
```

### Socket.io Authentication (Phase 4 Pattern Extended)

**Phase 4 Established:**
```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Auth failed'));
    socket.userId = decoded.userId;
    next();
  });
});
```

**Phase 5 Continues:**
No changes to Socket.io auth middleware. Token validation remains identical.
Difference: Phase 5 ADDS room-scoped membership verification in event handlers.

### Backward Compatibility Guarantees

1. **Existing Users Can Login**
   - POST /api/auth/login unchanged
   - JWT structure unchanged
   - Token validation unchanged

2. **Existing Messages Remain Queryable**
   - Old messages (without roomId) are not deleted
   - New messages MUST have roomId
   - Queries with `roomId` filter implicitly exclude old messages

3. **Phase 4 Users See Dashboard First**
   - Instead of direct chat, they see Dashboard
   - They can create/join rooms or view existing rooms
   - First room join takes them to Chat view

4. **Token Expiration Handling**
   - 24-hour expiration unchanged
   - Dashboard validates token on mount (GET /api/auth/me)
   - If 401: logout + redirect to login (unchanged behavior)

### Migration Path (Future Consideration)

If a future phase needs to migrate old messages to a default room:

```javascript
// NOT in Phase 5 scope, but example:
const defaultRoom = await Room.findOne({ name: 'General' });

const oldMessages = await Message.find({ roomId: null });
for (const msg of oldMessages) {
  msg.roomId = defaultRoom._id;
  await msg.save();
}
```

---

## UI/UX Design Specifications

### Glassmorphism Styling (Consistent with Phase 4)

**Color Palette:**
- Primary Background: `#0f0f1e` (very dark blue-black)
- Glass Card: `rgba(255, 255, 255, 0.05)` (2-5% opacity)
- Glass Border: `rgba(255, 255, 255, 0.1)` (10% opacity)
- Text Primary: `#ffffff` (white)
- Text Secondary: `rgba(255, 255, 255, 0.7)` (70% opacity)
- Accent: `#00d4ff` (cyan) for buttons/highlights
- Success: `#00ff6b` (green)
- Error: `#ff0000` (red)

**Glass Card Template:**
```css
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.glass-card:hover {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  transform: translateY(-4px);
  transition: all 0.3s ease;
}
```

**Button Styles:**
```css
.btn-primary {
  background: linear-gradient(135deg, #00d4ff, #0099cc);
  color: #0f0f1e;
  border: none;
  border-radius: 12px;
  padding: 12px 28px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
  transform: scale(1.05);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Input Styles:**
```css
input, textarea {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #ffffff;
  padding: 12px;
  font-family: inherit;
}

input:focus, textarea:focus {
  outline: none;
  border-color: #00d4ff;
  box-shadow: 0 0 12px rgba(0, 212, 255, 0.3);
}

input::placeholder, textarea::placeholder {
  color: rgba(255, 255, 255, 0.4);
}
```

### Responsive Design

**Desktop (1920px and up)**
- Dashboard: 3-column room grid
- Sidebar navigation (optional future)
- Wide chat area with member list

**Tablet (768px - 1920px)**
- Dashboard: 2-column room grid
- Full-width chat when open
- Collapsible member list

**Mobile (< 768px)**
- Dashboard: 1-column room grid
- Full-screen chat
- Bottom sheet for room info/members
- Hamburger menu for navigation

### Loading & Error States

**Loading Spinner:**
```jsx
<div className="spinner">
  <div className="spinner-ring"></div>
  Loading...
</div>
```

**Error Banner:**
```jsx
<div className="alert alert-error">
  <span className="alert-icon">⚠️</span>
  <div className="alert-message">{errorMessage}</div>
  <button className="alert-close" onClick={() => setError(null)}>×</button>
</div>
```

**Skeleton Loader (for rooms list):**
```jsx
<div className="room-card skeleton">
  <div className="skeleton-line" />
  <div className="skeleton-line short" />
</div>
```

---

## Correctness Properties

### Assessment: Property-Based Testing Not Applicable

This feature does **NOT** apply traditional property-based testing (PBT) for the reasons detailed below. Instead, correctness is verified through example-based unit tests, integration tests, and access control tests (see Testing Strategy section).

### Property 1: Access Control Enforcement

For any user requesting room-specific resources (messages, send message), server-side membership verification ensures only room members receive HTTP 200. Non-members receive HTTP 403 Forbidden.

**Validates: Requirements 5.1, 9.2, 17.1**

**Test Examples:**
- User A joins Room 1, User B joins Room 2
- User A requests GET /api/rooms/2/messages → 403 Forbidden
- User A sends message to Room 2 → 403 Forbidden

### Property 2: Message Scoping by Room

For any message sent via Socket.io, the broadcast uses `io.to(roomId)` ensuring only connected sockets in that room receive the message. Messages never cross room boundaries.

**Validates: Requirements 10.6, 11.4, 15.3**

**Test Examples:**
- Create 3 rooms with 2 users each
- Send message in Room 1
- Verify only Room 1 members receive message:receive event
- Verify Room 2 and 3 members do not receive event

### Property 3: Capacity Limit Enforcement

For any room where members.length >= maxUsers, subsequent join requests are rejected with HTTP 409 Conflict. Capacity is enforced atomically to prevent race conditions.

**Validates: Requirements 6.3, 7.6, 18.2**

**Test Examples:**
- Create room with maxUsers=2, add 2 members
- Attempt 3rd join → 409 Conflict "Room is full"
- Concurrent join attempts at capacity → only 0 additional members added

### Why Traditional PBT Doesn't Apply

1. **Specification-based**: Rules like "name 3-50 chars" are boundaries, not universal properties
2. **Deterministic**: Access control is rule-based, not probabilistic
3. **Integration-heavy**: Socket.io and API endpoints need concrete scenario verification
4. **UI-driven**: Component interactions are better tested with example-based tests

1. **Room Membership Isolation**
   - Users in Room A cannot receive messages from Room B
   - Test: Send message in Room A, verify Room B members don't receive it

2. **Message Scoping**
   - All messages must have roomId field
   - Queries filter by roomId before returning results
   - Test: Send 3 messages to 3 different rooms, verify each room only sees its own messages

3. **Capacity Enforcement**
   - Room members count cannot exceed maxUsers
   - Concurrent join attempts at capacity respect limit
   - Test: Create room with maxUsers=2, attempt 3 concurrent joins, verify only 2 succeed

4. **Access Control**
   - Non-members cannot access private room message history
   - Non-members cannot send messages to a room
   - Test: User C attempts to send message to Room where only User A and B are members, verify 403 Forbidden

5. **Password Security**
   - Room passwords never exposed in API responses
   - Wrong password returns generic error message
   - Test: Verify passwordHash field absent from all API responses

6. **Backward Compatibility**
   - Phase 4 users can still login with existing credentials
   - Old messages without roomId don't appear in room-specific queries
   - Test: Login with Phase 4 account, verify dashboard loads

---

## Testing Strategy

### Testing Approach

**Unit Tests**: Validate individual functions (password hashing, capacity checks, message filtering)  
**Integration Tests**: Verify complete flows (join → chat → send message → leave)  
**Example-Based Tests**: Test specific scenarios (wrong password, room full, room not found)  
**E2E Tests**: Full user journeys (signup → dashboard → join room → chat)  

### Test Coverage Details

**Room Model Tests:**
- Password hashing on save
- Safe JSON method (excludes passwordHash)
- Member validation
- Capacity validation

**Room Controller Tests:**
- Create public room
- Create private room with password hashing
- List rooms (filters public + member private)
- Join public room (capacity check)
- Join private room (password verification)
- Leave room
- Get room messages (member check)

**Message Controller Tests:**
- Send message to room
- Save to MongoDB
- Broadcast via Socket.io
- Access control (member verification)

**Socket.io Handler Tests:**
- room:join event (verify membership)
- room:leave event
- message:send event (room-scoped)
- message:receive broadcast (only to roomId)
- Error handling

**Dashboard Component Tests:**
- Fetch rooms on mount
- Filter rooms by search
- Handle 401 errors (logout)
- Open create room modal
- Join room flow

**CreateRoomModal Tests:**
- Form validation (name, type, password)
- Show/hide password field based on type
- Submit creates room
- Error handling

**Chat Component Tests:**
- Fetch room details and messages
- Socket join on mount
- Socket leave on unmount
- Display messages for current room only
- Send message via Socket.io
- Filter incoming messages by roomId

### Integration Tests

**Room Join Flow:**
1. User clicks Join on public room
2. API call succeeds
3. User redirected to Chat
4. Socket connection established
5. room:join event sent
6. Message list loads for that room

**Message Sending Flow:**
1. User types message
2. User submits (Enter or button)
3. Message sent via Socket.io
4. Message saved to MongoDB
5. Other room members receive message:receive event
6. Message appears in their message list
7. Message does NOT appear in other rooms

**Private Room Password Flow:**
1. User clicks Join on private room
2. Password modal opens
3. User enters wrong password
4. Modal shows error, stays open
5. User enters correct password
6. User redirected to Chat

**Room Leave Flow:**
1. User clicks Leave button
2. API removes user from members
3. Socket leaves room
4. room:leave broadcast sent
5. User redirected to Dashboard

### Property-Based Testing (PBT)

Given the nature of this feature, PBT is NOT applied. Reasons:
- Room creation has specific validation rules (not universal properties)
- UI interactions are example-based
- Message isolation is deterministic, not probabilistic
- Capacity enforcement is rule-based, not a universal property

Instead, use example-based unit tests with specific scenarios.

### Test Coverage Goals

- Unit tests: 80% coverage (models, controllers, utilities)
- Integration tests: All critical flows (join, message send, leave)
- E2E tests: User journeys (signup → dashboard → join → chat → leave)

---

## Implementation Roadmap

### Phase 5 Deliverables

**Backend:**
1. ✅ Room model with schema and validation
2. ✅ Room API endpoints (create, list, details, join, leave)
3. ✅ Message model updates (roomId, senderId fields)
4. ✅ Socket.io room-scoped events
5. Message API endpoints (get history, send message)
6. Access control middleware
7. Error handling standardization
8. Unit tests
9. Integration tests

**Frontend:**
1. Dashboard component
2. RoomCard, RoomList components
3. CreateRoomModal, PasswordModal components
4. Chat component updates (room context)
5. ChatHeader updates (room info)
6. Socket.io integration (room:join, room:leave, message:send)
7. Message filtering by roomId
8. Glassmorphism styling
9. Responsive design
10. Component tests

**DevOps:**
1. MongoDB indexes created
2. Environment variables configured (.env)
3. CORS configured for frontend origin
4. Socket.io CORS configured
5. Rate limiting (recommended future)

---

## Performance Metrics & SLAs

### Target Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Room creation | < 500ms | API response time |
| Join room | < 300ms | API response time |
| Message send (Socket) | < 100ms | Latency to broadcast |
| Message delivery | < 50ms | Time from send to receive |
| Dashboard load | < 2s | Rooms fetched + rendered |
| Chat load | < 1s | Messages fetched + rendered |

### Monitoring Points

- API response times (per endpoint)
- Socket.io event latency
- Database query performance (slow query log)
- Memory usage (Node.js process)
- MongoDB connection pool health
- WebSocket connection stability

---

## Dependencies & Technology Stack

### Backend Stack (Phase 5 Additions)

| Dependency | Version | Purpose |
|------------|---------|---------|
| express | ^4.18 | HTTP server (Phase 4) |
| socket.io | ^4.5 | Real-time communication |
| mongoose | ^6.0 | MongoDB ODM |
| bcrypt | ^5.0 | Password hashing |
| jsonwebtoken | ^9.0 | JWT auth |
| cors | ^2.8 | CORS middleware |
| dotenv | ^16.0 | Environment variables |

### Frontend Stack (Phase 5 Additions)

| Dependency | Version | Purpose |
|------------|---------|---------|
| react | ^18.0 | UI framework (Phase 4) |
| axios | ^1.0 | HTTP client |
| socket.io-client | ^4.5 | Socket.io client |
| react-router-dom | ^6.0 | Routing |
| css (no framework) | - | Custom glassmorphism styles |

All dependencies should use exact versions (no `^` ranges) in production.

---

## Conclusion

This design document provides a complete technical blueprint for Phase 5: Multi-Room Chat Dashboard. The implementation prioritizes:

1. **Security**: Server-side access control, room-scoped messaging, password hashing
2. **Performance**: Indexed database queries, optimized Socket.io broadcasting, efficient state management
3. **Reliability**: Error handling, backward compatibility, atomic operations
4. **User Experience**: Glassmorphism UI, responsive design, real-time updates
5. **Maintainability**: Consistent patterns, clear component hierarchy, standardized error responses

The design fully integrates with Phase 4 authentication while introducing multi-room functionality without breaking changes.

---

**Design Document Version:** 1.0  
**Last Updated:** 2024-01-15  
**Status:** Ready for Implementation  
**Next Phase:** Phase 6 - Tasks & Test Implementation
