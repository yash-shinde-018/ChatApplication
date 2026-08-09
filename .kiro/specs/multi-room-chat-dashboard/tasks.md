# Implementation Plan: Phase 5 - Multi-Room Chat Dashboard

## Overview

Transform the single-room chat into a scalable multi-room system with room discovery, membership management, and real-time Socket.io communication scoped to rooms. Users can create and discover public/private rooms, manage room membership, send room-scoped messages, and navigate between rooms via a unified dashboard interface.

**Implementation Approach**: Build complete backend models and APIs first (Wave 0-1), then integrate Socket.io (Wave 1), then build frontend components (Wave 2-3), apply glassmorphism styling (Wave 3), and run comprehensive test suites (Wave 4).

---

## Backend: Database Models

- [ ] 1. Create Room MongoDB model with validation and indexes
  - [ ] 1.1 Define Room schema in `backend/src/models/Room.js`
    - Fields: `_id` (ObjectId, auto), `name` (String, 3-50, trimmed, required), `description` (String, ≤500, optional), `type` (enum: 'public'|'private', required), `passwordHash` (String, optional, bcrypt hashed, only for private), `maxUsers` (Number, 2-500, required), `createdBy` (ObjectId → User, required), `members` (Array of ObjectId → User, default: [createdBy]), `createdAt` (Date, auto), `updatedAt` (Date, auto)
    - Add pre-save hook to hash password using bcrypt (10 salt rounds) if type==='private' AND password field exists
    - Implement instance method: `verifyPassword(candidatePassword)` using bcrypt.compare
    - Implement toJSON() override that excludes passwordHash from serialization
    - Add validation: members array includes createdBy, members.length ≤ maxUsers
    - Test: `npm test -- Room.test.js` (must pass all schema validation tests)
    - _Requirements: 1.1, 1.3, 1.4, 1.5_
  
  - [ ] 1.2 Create database indexes on Room collection in `backend/src/models/Room.js`
    - Single indexes: `name`, `createdBy`, `type`, `createdAt` (descending)
    - Composite index: `members` (for array membership queries)
    - In schema: `name: { type: String, index: true }`, etc.
    - Verify with `db.rooms.getIndexes()` after first connection
    - Performance test: Query 1000 rooms by type, measure response time < 50ms
    - _Requirements: 1.2, 1.6_
  
  - [ ] 1.3 Implement Room password hashing and verification in `backend/src/models/Room.js`
    - Pre-save hook: if `this.type === 'private'` AND `this.isModified('password')`, call bcrypt.hash(this.password, 10) and set `this.passwordHash = hash; this.password = undefined`
    - Instance method: `comparePassword(candidatePassword)` → returns Promise<boolean>
    - Test: Create private room with password, verify hash differs from plaintext, verify comparePassword works correctly
    - Test invalid password returns false
    - _Requirements: 1.4, 3.2_

- [ ] 2. Update Message MongoDB model with room and sender context
  - [ ] 2.1 Add `roomId` and `senderId` fields to Message schema in `backend/src/models/Message.js`
    - Add fields: `roomId` (ObjectId → Room, required for new messages), `senderId` (ObjectId → User, required for new messages)
    - Keep existing fields unchanged: `username`, `message`, `timestamp`
    - Add ObjectId validation for both fields
    - Validation: message non-empty string, max 500 chars
    - Test: Create message with roomId/senderId, verify both required, verify validation works
    - _Requirements: 16.1, 16.3_
  
  - [ ] 2.2 Create composite index on Message model in `backend/src/models/Message.js`
    - Add composite index: `roomId` (ascending), `timestamp` (descending)
    - In schema: `db.messages.createIndex({ roomId: 1, timestamp: -1 })`
    - Test: Query messages for specific room, verify index is used (use explain())
    - Performance: 10K messages, query by roomId returns < 100ms
    - _Requirements: 16.6_
  
  - [ ] 2.3 Ensure backward compatibility for messages without roomId
    - Update Message queries: always filter `{ roomId: { $exists: true } }` to exclude legacy messages
    - Verify existing messages without roomId are NOT deleted (migration not needed)
    - Test: Query messages, verify old messages without roomId don't appear
    - _Requirements: 16.4_

---

## Backend: Room Management APIs

- [ ] 3. Implement POST /api/rooms endpoint (create public/private rooms)
  - [ ] 3.1 Create room creation endpoint in `backend/src/controllers/roomController.js`
    - Export: `exports.createRoom = async (req, res) => { ... }`
    - Extract userId from `req.user.userId` (set by authMiddleware)
    - Validate request body: name (3-50), description (optional, ≤500), type (enum: 'public'|'private'), maxUsers (2-500), password (required if type==='private', min 6 chars)
    - For private rooms: hash password using bcrypt (10 rounds) before saving
    - Create Room document: `{ name, description, type, passwordHash (if private), maxUsers, createdBy: userId, members: [userId], createdAt: new Date() }`
    - Return HTTP 201 with created room (exclude passwordHash using toJSON())
    - Return HTTP 400 on validation errors with specific field messages
    - Test: Create public room (check 201, createdBy set), create private room with password (check 201, passwordHash exists), validate field errors (check 400)
    - _Requirements: 2.1-2.4, 3.1-3.4_
  
  - [ ] 3.2 Add route in `backend/src/routes/roomRoutes.js`
    - Add: `router.post('/', authMiddleware, roomController.createRoom);`
    - Test: POST /api/rooms with valid JWT returns 201, without JWT returns 401
    - _Requirements: 2.1_

- [ ] 4. Implement GET /api/rooms endpoint (list available rooms)
  - [ ] 4.1 Create room listing endpoint in `backend/src/controllers/roomController.js`
    - Export: `exports.listRooms = async (req, res) => { ... }`
    - Extract userId from req.user
    - Query: Find all public rooms OR private rooms where userId in members
    - MongoDB query: `{ $or: [ { type: 'public' }, { type: 'private', members: userId } ] }`
    - Response: Array of rooms with `_id, name, description, type, maxUsers, memberCount (not array), createdAt` (exclude passwordHash, full members array)
    - Order by createdAt descending
    - Return HTTP 200
    - Test: Create 2 public + 2 private rooms, user joins 1 private, verify user only sees public + 1 private
    - _Requirements: 4.1-4.5_
  
  - [ ] 4.2 Add route in `backend/src/routes/roomRoutes.js`
    - Add: `router.get('/', authMiddleware, roomController.listRooms);`
    - Test: GET /api/rooms with valid JWT returns 200, without JWT returns 401
    - _Requirements: 4.1_

- [ ] 5. Implement GET /api/rooms/:roomId endpoint (get room details)
  - [ ] 5.1 Create room details endpoint in `backend/src/controllers/roomController.js`
    - Export: `exports.getRoomDetails = async (req, res) => { ... }`
    - Extract userId and roomId from params
    - Query room by _id; return 404 if not found
    - For public rooms: allow all authenticated users
    - For private rooms: check `members.includes(userId)`, return 403 if not member
    - Response: `_id, name, description, type, maxUsers, createdBy (with id, username), members (array with id, username for each), createdAt` (exclude passwordHash)
    - Return HTTP 200
    - Test: User A joins public room, gets details (200); User B tries private room not member (403); User B joins and gets details (200)
    - _Requirements: 5.1-5.6_
  
  - [ ] 5.2 Add route in `backend/src/routes/roomRoutes.js`
    - Add: `router.get('/:roomId', authMiddleware, roomController.getRoomDetails);`
    - Test: GET /api/rooms/{valid-id} returns 200, {invalid-id} returns 404
    - _Requirements: 5.1_

- [ ] 6. Implement POST /api/rooms/:roomId/join endpoint (join public and private rooms)
  - [ ] 6.1 Create room join endpoint in `backend/src/controllers/roomController.js`
    - Export: `exports.joinRoom = async (req, res) => { ... }`
    - Extract userId, roomId, and optional password from request
    - Query room by _id; return 404 if not found
    - Check room type:
      - **Public room**: Skip password check
      - **Private room**: Require password in request body, compare with stored hash using `room.comparePassword(password)`, return 401 "Invalid password" if mismatch (generic message, no "room not found" leakage)
    - Check capacity: `members.length >= maxUsers` → return 409 "Room is full"
    - Check existing membership: `members.includes(userId)` → return 409 "Already a member of this room"
    - Add user to members: `room.members.push(userId); room.save();` (atomic: use findOneAndUpdate with atomic increment)
    - Return HTTP 200 with updated room
    - Test: Join public room (200), join full room (409), join already-member (409), join private with wrong password (401), join private with correct password (200)
    - _Requirements: 6.1-6.6, 7.1-7.8_
  
  - [ ] 6.2 Add route in `backend/src/routes/roomRoutes.js`
    - Add: `router.post('/:roomId/join', authMiddleware, roomController.joinRoom);`
    - Test: POST /api/rooms/{roomId}/join with valid JWT returns 200 or appropriate error
    - _Requirements: 6.1, 7.1_

- [ ] 7. Implement POST /api/rooms/:roomId/leave endpoint (leave room)
  - [ ] 7.1 Create room leave endpoint in `backend/src/controllers/roomController.js`
    - Export: `exports.leaveRoom = async (req, res) => { ... }`
    - Extract userId and roomId
    - Query room by _id; return 404 if not found
    - Check membership: `members.includes(userId)` → if false, return 409 "Not a member of this room"
    - Remove user: `room.members = room.members.filter(id => id.toString() !== userId)`
    - Save room; do NOT auto-delete empty rooms
    - Return HTTP 200 with confirmation
    - Test: Leave room (200), non-member leaves (409), room persists after all leave (verify with GET)
    - _Requirements: 8.1-8.6_
  
  - [ ] 7.2 Add route in `backend/src/routes/roomRoutes.js`
    - Add: `router.post('/:roomId/leave', authMiddleware, roomController.leaveRoom);`
    - Test: POST /api/rooms/{roomId}/leave returns 200 or appropriate error
    - _Requirements: 8.1_

- [ ] 8. Implement GET /api/rooms/:roomId/messages endpoint (get room message history)
  - [ ] 8.1 Create message history endpoint in `backend/src/controllers/messageController.js`
    - Export: `exports.getRoomMessages = async (req, res) => { ... }`
    - Extract userId and roomId
    - Query room; return 404 if not found
    - Check membership: if `!members.includes(userId)`, return 403 Forbidden
    - Query messages: `Message.find({ roomId, roomId: { $exists: true } }).sort({ timestamp: 1 }).populate('senderId', 'id username')`
    - Response: Array of messages with `_id, senderId (user object), roomId, message, timestamp`
    - Return HTTP 200 (empty array if no messages, not 404)
    - Test: Member gets history (200), non-member gets 403, room not found gets 404, empty room returns [] not 404
    - _Requirements: 9.1-9.10_
  
  - [ ] 8.2 Add route in `backend/src/routes/messageRoutes.js`
    - Add: `router.get('/room/:roomId', authMiddleware, messageController.getRoomMessages);`
    - Test: GET /api/rooms/{roomId}/messages returns 200 with array or appropriate error
    - _Requirements: 9.1_

- [ ] 9. Implement POST /api/messages endpoint (send message to room via REST)
  - [ ] 9.1 Create message send endpoint in `backend/src/controllers/messageController.js`
    - Export: `exports.sendMessage = async (req, res) => { ... }`
    - Extract userId from JWT, message and roomId from body
    - Validate: message non-empty, roomId valid ObjectId format; return 400 if invalid
    - Query room; return 404 if not found
    - Check membership: if `!members.includes(userId)`, return 403 Forbidden
    - Create message: `Message.create({ roomId, senderId: userId, message, timestamp: new Date() })`
    - Save and populate senderId
    - Return HTTP 201 with saved message
    - **Also broadcast via Socket.io to room members** (see Socket.io section 9.3)
    - Test: Member sends (201), non-member sends (403), invalid roomId (400), empty message (400)
    - _Requirements: 10.1-10.8_
  
  - [ ] 9.2 Add route in `backend/src/routes/messageRoutes.js`
    - Add: `router.post('/', authMiddleware, messageController.sendMessage);`
    - Test: POST /api/messages with valid data returns 201, without roomId returns 400
    - _Requirements: 10.1_



---

## Backend: Socket.io Integration

- [ ] 10. Configure and secure Socket.io server
  - [ ] 10.1 Set up Socket.io authentication in `backend/src/server.js`
    - Configure io with CORS: `const io = new Server(server, { cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true } })`
    - Add auth middleware: `io.use((socket, next) => { const token = socket.handshake.auth.token; jwt.verify(token, JWT_SECRET, (err, decoded) => { if (err) return next(new Error('Auth failed')); socket.userId = decoded.userId; next(); }); })`
    - Test: Connect without token (should reject), connect with valid token (should accept), connect with invalid token (should reject)
    - _Requirements: 11.1_
  
  - [ ] 10.2 Initialize Socket.io event handlers in `backend/src/sockets/chatSocket.js`
    - Export initialization function called from server.js
    - Set up event handlers for: room:join, room:leave, message:send
    - Log connections/disconnections for debugging
    - Test: Connect authenticated socket, verify socket.userId is set
    - _Requirements: 11.1_

- [ ] 11. Implement Socket.io room join/leave events
  - [ ] 11.1 Implement room:join event handler in `backend/src/sockets/chatSocket.js`
    - Handler: `socket.on('room:join', async (data) => { const roomId = data.roomId; ... })`
    - Validate: roomId provided and valid ObjectId format
    - Query Room and check `members.includes(socket.userId)`; if false, emit socket:error
    - If valid: call `socket.join(roomId)` and emit `room:joined` to `io.to(roomId)` with `{ userId: socket.userId, roomId }`
    - Test: Non-member join (socket:error), member join (room:joined broadcast), verify socket in room
    - _Requirements: 11.2, 11.7_
  
  - [ ] 11.2 Implement room:leave event handler in `backend/src/sockets/chatSocket.js`
    - Handler: `socket.on('room:leave', async (data) => { const roomId = data.roomId; ... })`
    - Call `socket.leave(roomId)` and emit `room:left` to remaining members: `io.to(roomId).emit('room:left', { userId: socket.userId, roomId })`
    - Test: Member leaves, verify room:left broadcast, verify socket not in room
    - _Requirements: 11.2, 11.5, 11.7_

- [ ] 12. Implement Socket.io message sending with room scoping
  - [ ] 12.1 Implement message:send event handler in `backend/src/sockets/chatSocket.js`
    - Handler: `socket.on('message:send', async (data) => { const { roomId, message } = data; ... })`
    - Validate: message non-empty, roomId valid ObjectId; if invalid, emit socket:error
    - Query Room and check `members.includes(socket.userId)`; if false, emit socket:error
    - Create Message: `await Message.create({ senderId: socket.userId, roomId, message, timestamp: new Date() })`
    - Populate senderId for response
    - **Critical: Broadcast ONLY to roomId using `io.to(roomId).emit('message:receive', messageData)`** (NOT `io.emit()` or `broadcast.emit()`)
    - Test: Send from member (broadcast to room members only), send from non-member (socket:error), verify no cross-room broadcasting
    - _Requirements: 11.3, 11.4, 11.7_
  
  - [ ] 12.2 Verify room-scoped message isolation (security critical)
    - Create 2 rooms with different users
    - Send message in Room A
    - Verify ONLY Room A members receive message:receive
    - Verify Room B members do NOT receive message
    - Test: 3 rooms, send 3 messages, verify each room only sees its own messages
    - _Requirements: 11.4_

- [ ] 13. Implement Socket.io error handling and disconnections
  - [ ] 13.1 Implement socket:error event for validation failures in `backend/src/sockets/chatSocket.js`
    - Emit to specific socket (not broadcast): `socket.emit('socket:error', { message: 'descriptive error' })`
    - Use for: validation failures, membership check failures, message send failures
    - Test: Send invalid data, verify socket:error emitted to sender only
    - _Requirements: 11.7_
  
  - [ ] 13.2 Handle socket disconnect in `backend/src/sockets/chatSocket.js`
    - Handler: `socket.on('disconnect', () => { console.log('User disconnected: ' + socket.userId); })`
    - Socket.io automatically removes socket from all joined rooms on disconnect
    - No manual cleanup needed (Socket.io handles it)
    - Test: Connect to room, disconnect, verify socket not in room
    - _Requirements: 11.8_

---

## Frontend: Dashboard Components

- [ ] 14. Create Dashboard component (main room discovery view)
  - [ ] 14.1 Set up Dashboard component structure in `frontend/src/components/dashboard/Dashboard.jsx`
    - Functional component with hooks (useState, useEffect, useContext)
    - Import AuthContext for userId and logout function
    - Import api service for API calls
    - State: `rooms` (all available), `filteredRooms` (search-filtered), `searchQuery` (string), `loading` (boolean), `error` (string|null)
    - useEffect on mount: call `GET /api/auth/me` to validate token (logout if 401); call `GET /api/rooms` to fetch available rooms
    - Render: title "Dashboard", search input, create room button, room list sections
    - Test: Component mounts, loading shows, rooms load, error handled correctly, 401 logs out
    - _Requirements: 12.1, 12.8_
  
  - [ ] 14.2 Implement room filtering and search in Dashboard
    - State: `searchQuery` and `filteredRooms`
    - useEffect: filter rooms by name: `rooms.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))`
    - Render "Available Rooms" section: public rooms + member private rooms
    - Render "My Rooms" section: rooms where user is member
    - Order by createdAt descending (most recent first)
    - Show "No rooms found" message if empty
    - Test: Enter search text, verify filtering works, switch sections
    - _Requirements: 12.2, 12.4_
  
  - [ ] 14.3 Implement Dashboard refresh and error handling
    - Add "Refresh" button in header
    - onClick: call `GET /api/rooms` again, update rooms state
    - Implement error banner: if error, display error message with close button
    - If 401 error on any API call: logout immediately and redirect to login
    - Other errors: show error banner with retry button (refresh)
    - Test: Refresh works, errors display, 401 causes logout
    - _Requirements: 12.8, 12.9_
  
  - [ ] 14.4 Add Create Room button to Dashboard
    - Button: "Create Room" in header
    - onClick: setShowCreateModal(true)
    - Pass CreateRoomModal component with isOpen, onClose, onCreated handlers
    - On successful creation: close modal, call handleRefresh(), show success message
    - Test: Button opens modal, successful create refreshes list
    - _Requirements: 12.3_

- [ ] 15. Create RoomCard component (individual room display)
  - [ ] 15.1 Design and implement RoomCard in `frontend/src/components/dashboard/RoomCard.jsx`
    - Props: `room` (object), `isMember` (boolean), `onJoin` (function), `onEnter` (function)
    - Display: room name, description, type badge (Public/Private), member count (e.g., "3/10"), created date formatted
    - Add password icon (🔒) for private rooms
    - Apply glassmorphism styling: `background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); padding: 16px; transition: all 0.3s ease;`
    - On hover: increase box-shadow, slight scale-up (transform: scale(1.02))
    - Test: Component renders, styling visible, hover effect works
    - _Requirements: 12.2, 19.1_
  
  - [ ] 15.2 Implement RoomCard interaction
    - If isMember is false: show "Join" button → onClick calls onJoin(room._id)
    - If isMember is true: show "Enter" button → onClick calls onEnter(room._id)
    - For private rooms not member: button text "Join (Private)" with lock icon
    - Test: Join button works, Enter button works, private room shows lock icon
    - _Requirements: 14.1, 14.2_

- [ ] 16. Create RoomList component (map room cards)
  - [ ] 16.1 Build RoomList component in `frontend/src/components/dashboard/RoomList.jsx`
    - Props: `rooms` (array), `title` (string), `onJoin` (function), `onEnter` (function)
    - Map rooms array: render RoomCard for each room
    - Show empty state message: "No rooms yet" if empty
    - Use CSS Grid for responsive layout: `display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;`
    - Desktop (1920px+): 3 columns, Tablet (768-1920px): 2 columns, Mobile (<768px): 1 column
    - Test: Renders all cards, empty state shows, grid responsive
    - _Requirements: 12.2, 19.5_

- [ ] 17. Create CreateRoomModal component
  - [ ] 17.1 Design CreateRoomModal form in `frontend/src/components/dashboard/CreateRoomModal.jsx`
    - Props: `isOpen` (boolean), `onClose` (function), `onCreated` (function)
    - Form fields: name (text input), description (textarea), type (radio: Public/Private), maxUsers (number), password (text input, initially hidden)
    - Apply glassmorphism: overlay dark (rgba(0,0,0,0.7)), modal card with glass effect, rounded 16px
    - Buttons: "Create" (primary), "Cancel" (secondary)
    - Test: Modal shows/hides, form fields visible, styling applied
    - _Requirements: 13.1, 13.8, 19.1_
  
  - [ ] 17.2 Implement conditional password field visibility
    - Initially: password field hidden with `display: none`
    - onChange type radio: if type === 'private', set `display: block` for password field; if 'public', set `display: none`
    - Add label: "Password (min 6 chars)" visible only for private rooms
    - Clear password value when switching to public
    - Test: Type changes show/hide password field, value clears
    - _Requirements: 13.2, 13.3_
  
  - [ ] 17.3 Implement form validation and submission
    - State: `formData` (object), `errors` (object), `loading` (boolean), `serverError` (string|null)
    - Validation on submit: name 3-50 chars, maxUsers 2-500, password 6+ for private, description max 500
    - Display inline errors below each field if validation fails
    - Call `POST /api/rooms` with form data (include password for private)
    - Set loading state on submit button during API call
    - Test: Validation errors show, empty name rejected, API call made on valid submit
    - _Requirements: 13.4, 13.5_
  
  - [ ] 17.4 Implement modal success and error handling
    - On success: close modal, call `onCreated()` (Dashboard refreshes list), show success toast
    - Auto-navigate to newly created room if desired (optional)
    - On error: display error banner, keep modal open for retry
    - Show descriptive server error message
    - Test: Success closes modal, error keeps modal open, error message displays
    - _Requirements: 13.5, 13.6_

- [ ] 18. Create PasswordModal component (private room password prompt)
  - [ ] 18.1 Design PasswordModal in `frontend/src/components/dashboard/PasswordModal.jsx`
    - Props: `isOpen` (boolean), `roomName` (string), `onJoin` (function), `onCancel` (function)
    - Display: room name as title, single password input (hidden type), "Join" and "Cancel" buttons
    - Apply glassmorphism styling (dark overlay, glass card, rounded 16px)
    - Test: Modal shows/hides, room name displayed, styling applied
    - _Requirements: 14.3, 13.8, 19.1_
  
  - [ ] 18.2 Implement password submission and error handling
    - State: `password` (string), `error` (string|null), `loading` (boolean)
    - Join button onClick: call `onJoin(password)` (Dashboard handles API call)
    - Set loading state during submission
    - On error 401 (wrong password): display error message, keep modal open for retry
    - On error 409 (room full/already member): display error, close modal
    - On success: close modal, navigate to Chat
    - Test: Wrong password shows error, correct password closes modal, error scenarios handled
    - _Requirements: 14.2, 14.3_

---

## Notes

- All backend tasks use TypeScript/JavaScript with Node.js/Express
- All frontend tasks use React (JSX)
- Database: MongoDB Atlas (no local setup changes needed)
- Socket.io v4.5+
- Bcrypt v5.0+ for password hashing
- Tests use your existing test framework (Jest, Vitest, or Mocha)
- Optional tasks marked with `*` can be skipped for MVP but are recommended
- Tasks are organized by category to enable parallel work across teams
- Each task builds on previous steps; follow dependency graph for optimal scheduling

---

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": [
        "1.1", "1.2", "1.3",
        "2.1", "2.2", "2.3",
        "8.1", "8.2"
      ],
      "description": "Database models and Socket.io infrastructure setup"
    },
    {
      "id": 1,
      "tasks": [
        "3.1", "3.2",
        "4.1", "4.2",
        "5.1", "5.2", "5.3",
        "6.1", "6.2",
        "7.1", "7.2", "7.3", "7.4",
        "9.1", "9.2", "9.3", "9.4", "10.1", "10.2"
      ],
      "description": "Backend API endpoints, access control, and Socket.io event handlers"
    },
    {
      "id": 2,
      "tasks": [
        "11.1", "11.2", "11.3", "11.4",
        "12.1", "12.2",
        "13.1",
        "14.1", "14.2", "14.3", "14.4",
        "15.1", "15.2"
      ],
      "description": "Frontend dashboard and modal components"
    },
    {
      "id": 3,
      "tasks": [
        "16.1", "16.2", "16.3", "16.4",
        "17.1", "17.2",
        "18.1",
        "19.1", "19.2", "19.3", "19.4",
        "20.1", "20.2"
      ],
      "description": "Chat component updates, styling, and error handling"
    },
    {
      "id": 4,
      "tasks": [
        "21.1", "21.2", "21.3",
        "22.1", "22.2",
        "23.1", "23.2", "23.3", "23.4", "23.5", "23.6",
        "24.1", "24.2",
        "25.1", "25.2",
        "26.1", "26.2", "26.3", "26.4",
        "27.1", "27.2", "27.3",
        "28.1", "28.2", "28.3",
        "29.1", "29.2",
        "30.1", "30.2", "30.3", "30.4",
        "31.1", "31.2"
      ],
      "description": "Testing: backend and frontend unit, integration, and E2E tests"
    },
    {
      "id": 5,
      "tasks": ["32", "33", "34"],
      "description": "Final checkpoints and verification"
    }
  ]
}
```

---

**Tasks Document Version:** 1.0  
**Created:** 2024-01-15  
**Status:** Ready for Implementation  
**Total Tasks:** 34 major tasks with 131 sub-tasks  
**Estimated Duration:** 4-6 weeks for full team  

