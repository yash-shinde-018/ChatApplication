# Requirements Document

## Introduction

This document specifies the requirements for Phase 5: Multi-Room Chat Dashboard feature. The system shall transform the real-time chat application from a single global chat room into a multi-room real-time chat system with a dashboard for room discovery and management.

The feature includes:
- Room creation with public/private types
- Room management and member lifecycle
- Message isolation by room
- Dashboard UI for room discovery and navigation
- Real-time Socket.io communication scoped to rooms
- Full backward compatibility with Phase 4 authentication

## Glossary

- **System**: The Real-Time Chat Application (backend and frontend)
- **User**: An authenticated user of the System
- **Room**: A bounded communication space where Users can exchange Messages
- **Public_Room**: A Room with no password requirement; any User can join
- **Private_Room**: A Room protected by a password; Users must provide correct password to join
- **Room_Member**: A User who has successfully joined a Room
- **Room_Creator**: The User who created a Room; automatically added as Room_Member
- **Message**: A text communication sent by a User within a specific Room
- **Dashboard**: A UI view displaying available Rooms and User's joined Rooms
- **Room_Capacity**: The maximum number of Users allowed as Room_Members simultaneously
- **Password_Hash**: A bcrypt-hashed representation of a Room's password; never exposed to Users

## Requirements

### Requirement 1: Room Database Model

**User Story:** As a developer, I want to store Room data in a structured MongoDB model, so that Rooms can be created, persisted, and retrieved efficiently.

#### Acceptance Criteria

1. THE Room_Model SHALL contain the following fields:
   - `_id`: Unique ObjectId (auto-generated)
   - `name`: String, required, 3-50 characters, trimmed
   - `description`: String, optional, max 500 characters
   - `type`: String (enum: "public" or "private"), required
   - `passwordHash`: String, optional, bcrypt-hashed password (only for Private_Room)
   - `maxUsers`: Number, required, minimum 2, maximum 500
   - `createdBy`: ObjectId reference to User, required
   - `members`: Array of ObjectId references to User, required (at least Room_Creator)
   - `createdAt`: Date (auto-generated)
   - `updatedAt`: Date (auto-generated)

2. THE Room_Model SHALL maintain database indexes on: `name`, `createdBy`, `type`, `createdAt` for query performance

3. THE Room_Model SHALL validate that `members` array includes `createdBy` User at all times

4. THE Room_Model SHALL use bcrypt (salt rounds: 10) to hash Private_Room passwords before persistence

5. THE Room_Model SHALL never expose `passwordHash` in API responses or toJSON() method

6. THE Room_Model SHALL enforce that `maxUsers` is greater than or equal to current `members` array length

---

### Requirement 2: Public Room Creation API

**User Story:** As a User, I want to create public chat rooms, so that other Users can discover and join my conversations.

#### Acceptance Criteria

1. THE CreatePublicRoom_API (POST /api/rooms) SHALL require valid JWT authentication in Authorization header

2. WHEN a CreatePublicRoom_API request is received WITH valid authentication, THE System SHALL accept the following fields:
   - `name`: String, required, 3-50 characters
   - `description`: String, optional, max 500 characters
   - `maxUsers`: Number, required, 2-500

3. WHEN CreatePublicRoom_API request validation fails OR database error occurs, THE System SHALL return HTTP 400 with error details (e.g., "name is required" or "maxUsers must be 2-500")

4. WHEN CreatePublicRoom_API request succeeds, THE System SHALL:
   - Create Room with `type: "public"` and no `passwordHash`
   - Set `createdBy` to authenticated User's ID (from JWT)
   - Initialize `members` array with only the Room_Creator
   - Return HTTP 201 with created Room (without `passwordHash`)

5. THE CreatePublicRoom_API SHALL store the new Room in MongoDB and be retrievable immediately

6. WHERE another User creates a second Public_Room, THE System SHALL allow both Rooms to coexist with different names or same name

---

### Requirement 3: Private Room Creation API

**User Story:** As a User, I want to create password-protected chat rooms, so that only Users with the password can access my private conversations.

#### Acceptance Criteria

1. THE CreatePrivateRoom_API (POST /api/rooms) SHALL require valid JWT authentication

2. WHEN a CreatePrivateRoom_API request is received WITH `type: "private"` AND a `password` field, THE System SHALL:
   - Accept `password`: String, required if `type` is "private", minimum 6 characters
   - Hash the password using bcrypt (10 salt rounds)
   - Store only the hash as `passwordHash` (never the plain password)
   - Create Room with `type: "private"`
   - Set `createdBy` to authenticated User's ID
   - Initialize `members` with only Room_Creator

3. WHEN CreatePrivateRoom_API request fails validation OR database error occurs, THE System SHALL return HTTP 400 describing the error (e.g., "password is required for private rooms" or "password must be at least 6 characters")

4. WHEN CreatePrivateRoom_API succeeds, THE System SHALL return HTTP 201 with created Room, explicitly excluding `passwordHash` from response

5. WHERE a User attempts to create a Private_Room without `password`, THE System SHALL reject with HTTP 400

6. WHEN CreatePrivateRoom_API succeeds, THE private Room SHALL be immediately queryable by `_id` but not discoverable in public Room listings

---

### Requirement 4: List Available Rooms API

**User Story:** As a User, I want to see all available rooms, so that I can discover and join rooms of interest.

#### Acceptance Criteria

1. THE ListRooms_API (GET /api/rooms) SHALL require valid JWT authentication

2. WHEN ListRooms_API request is received, THE System SHALL return HTTP 200 with an array of Rooms

3. THE ListRooms_API response SHALL include:
   - All Public_Rooms (type: "public")
   - All Private_Rooms where the authenticated User is already a Room_Member
   - Exclude Private_Rooms where User is not a member

4. FOR each Room in the ListRooms_API response, THE System SHALL include:
   - `_id`, `name`, `description`, `type`, `maxUsers`, `members` count, `createdAt`
   - EXCLUDE `passwordHash` and full `members` array

5. THE ListRooms_API SHALL order results by `createdAt` descending (newest first)

6. WHEN ListRooms_API is called and no Rooms exist, THE System SHALL return HTTP 200 with empty array

7. WHERE a User is a Room_Member of a Private_Room, THE ListRooms_API SHALL include that Private_Room in results

8. WHEN ListRooms_API is called and no Public_Rooms exist but User is a member of Private_Rooms, THE System SHALL include those Private_Rooms in results

---

### Requirement 5: Get Room Details API

**User Story:** As a User, I want to view detailed information about a specific room, so that I can decide whether to join.

#### Acceptance Criteria

1. THE GetRoomDetails_API (GET /api/rooms/:roomId) SHALL require valid JWT authentication

2. WHEN GetRoomDetails_API request is received WITH valid `roomId`, THE System SHALL:
   - First verify the Room exists (return 404 if not)
   - Then verify access based on Room type:
     - IF Room is Public_Room, THEN allow all authenticated Users
     - IF Room is Private_Room, THEN allow only Room_Members

3. WHEN authenticated User is not a Room_Member of a Private_Room, THE System SHALL return HTTP 403 Forbidden even if room does not exist

4. WHEN `roomId` does not exist, THE System SHALL return HTTP 404 Not Found

5. WHEN GetRoomDetails_API succeeds, THE System SHALL return HTTP 200 with:
   - `_id`, `name`, `description`, `type`, `maxUsers`, `createdBy` (User object with id, username), `members` (array of User objects with id, username), `createdAt`
   - EXCLUDE `passwordHash`

6. THE GetRoomDetails_API SHALL NOT include Message history (messages fetched via separate API)

### Requirement 6: Join Public Room API

**User Story:** As a User, I want to join public rooms without a password, so that I can quickly start chatting.

#### Acceptance Criteria

1. THE JoinPublicRoom_API (POST /api/rooms/:roomId/join) SHALL require valid JWT authentication

2. WHEN JoinPublicRoom_API request is received FOR a Public_Room WITH a valid `roomId`, THE System SHALL:
   - Verify the Room exists and `type: "public"`
   - Check Room `members` count < `maxUsers`
   - Add authenticated User to Room `members` array
   - Return HTTP 200 with updated Room object

3. WHEN Room capacity is full (members.length >= maxUsers), THE System SHALL return HTTP 409 Conflict with message "Room is full"

4. WHEN authenticated User is already a Room_Member, THE System SHALL return HTTP 409 Conflict with message "Already a member of this room"

5. WHEN `roomId` is a Private_Room, THE System SHALL first verify JWT and room existence, then reject with HTTP 403 Forbidden

6. WHEN `roomId` does not exist, THE System SHALL return HTTP 404 Not Found

---

### Requirement 7: Join Private Room API

**User Story:** As a User, I want to join password-protected rooms with correct password, so that only authorized Users can access private conversations.

#### Acceptance Criteria

1. THE JoinPrivateRoom_API (POST /api/rooms/:roomId/join) SHALL require valid JWT authentication

2. WHEN JoinPrivateRoom_API request is received WITH `roomId` FOR a Private_Room, THE System SHALL require:
   - `password`: String, provided in request body

3. WHEN `password` field is missing or empty, THE System SHALL return HTTP 400 with message "Password is required"

4. WHEN provided `password` is incorrect (bcrypt comparison fails), THE System SHALL return HTTP 401 Unauthorized with generic message "Invalid password"

5. WHEN provided `password` is correct AND Room capacity allows, THE System SHALL:
   - Add authenticated User to Room `members` array
   - Return HTTP 200 with updated Room object
   - EXCLUDE `passwordHash` from response

6. WHEN Room capacity is full, THE System SHALL return HTTP 409 Conflict with message "Room is full"

7. WHEN authenticated User is already a Room_Member, THE System SHALL return HTTP 409 Conflict with message "Already a member of this room"

8. WHEN `roomId` is a Public_Room, THE System SHALL reject with HTTP 403 (use public join endpoint)

---

### Requirement 8: Leave Room API

**User Story:** As a User, I want to leave rooms, so that I can stop receiving messages from that room.

#### Acceptance Criteria

1. THE LeaveRoom_API (POST /api/rooms/:roomId/leave) SHALL require valid JWT authentication

2. WHEN LeaveRoom_API request is received WITH valid `roomId`, THE System SHALL:
   - Verify authenticated User is a Room_Member
   - Remove User from Room `members` array
   - Return HTTP 200 with confirmation

3. WHEN authenticated User is not a Room_Member, THE System SHALL return HTTP 409 Conflict with message "Not a member of this room"

4. WHEN `roomId` does not exist, THE System SHALL return HTTP 404 Not Found

5. WHEN Room `members` array becomes empty after User leaves, THE System SHALL keep the Room in database (do not auto-delete)

6. THE LeaveRoom_API SHALL not prevent Room_Creator from leaving; creator can leave empty Rooms

---

### Requirement 9: Get Room Message History API

**User Story:** As a User, I want to fetch previous messages in a room, so that I can view chat history after joining.

#### Acceptance Criteria

1. THE GetRoomMessages_API (GET /api/rooms/:roomId/messages) SHALL require valid JWT authentication

2. WHEN GetRoomMessages_API request is received, THE System SHALL verify:
   - Room exists
   - Authenticated User is a Room_Member

3. WHEN User is not a Room_Member of the requested Room, THE System SHALL return HTTP 403 Forbidden

4. WHEN `roomId` does not exist, THE System SHALL return HTTP 404 Not Found

5. WHEN GetRoomMessages_API succeeds (all validation passes), THE System SHALL return HTTP 200 with array of Messages WHERE `roomId` matches

6. THE GetRoomMessages_API response SHALL include only Messages with matching `roomId`; messages from other Rooms SHALL NOT be included

7. THE GetRoomMessages_API SHALL return Messages ordered by `timestamp` ascending (oldest first)

8. THE GetRoomMessages_API SHALL include for each Message: `_id`, `senderId` (User object with id, username), `message`, `timestamp`, `roomId`

9. WHEN Room has no Message history, THE System SHALL return HTTP 200 with empty array

10. WHERE Room is created but no Messages exist yet, THE GetRoomMessages_API SHALL return empty array, not an error

---

### Requirement 10: Send Message to Room (REST API)

**User Story:** As a User, I want to send messages to the current room via REST API, so that messages are persisted and broadcast to room members.

#### Acceptance Criteria

1. THE SendRoomMessage_API (POST /api/messages) SHALL require valid JWT authentication

2. WHEN SendRoomMessage_API request is received, THE System SHALL require:
   - `message`: String, required, non-empty, trimmed
   - `roomId`: String (ObjectId), required

3. WHEN `message` is empty or missing, THE System SHALL return HTTP 400 with message "Message is required"

4. WHEN `roomId` is missing or invalid ObjectId format, THE System SHALL return HTTP 400 with message "RoomId is required and must be valid"

5. WHEN authenticated User is not a Room_Member of specified `roomId`, THE System SHALL return HTTP 403 Forbidden

6. WHEN SendRoomMessage_API succeeds (all validation passes AND User is Room_Member), THE System SHALL:
   - Create Message document with: `senderId` (from JWT), `roomId`, `message`, `timestamp`
   - Save Message to MongoDB
   - Return HTTP 201 with saved Message (including `_id`, `senderId`, `roomId`, `message`, `timestamp`)
   - Broadcast Message via Socket.io to only Room_Members of that `roomId`

7. THE SendRoomMessage_API SHALL NOT broadcast to Users not in the Room

8. WHERE authenticated User sends multiple messages to same Room, THE System SHALL create separate Message documents for each

---

### Requirement 11: Socket.io Room-Based Communication

**User Story:** As a User, I want to receive messages in real-time scoped to my current room, so that I can see live chat updates without polling.

#### Acceptance Criteria

1. THE Socket_Service SHALL authenticate with JWT token on connection (existing Phase 4 behavior maintained)

2. WHEN authenticated Socket connection is established, THE System SHALL initialize Socket.io room isolation:
   - socket.join(roomId) when User joins Room via API
   - socket.leave(roomId) when User leaves Room via API or navigates away

3. WHEN User sends message via Socket.io event `message:send` WITH `roomId` payload, THE System SHALL:
   - Verify User is Room_Member of specified `roomId`
   - Validate message content (non-empty, string)
   - Save Message to MongoDB with `roomId`
   - Emit `message:receive` event ONLY to sockets in that `roomId`

4. THE Socket_Service SHALL NOT emit messages outside the scoped `roomId` (critical security requirement)

5. WHEN User leaves a Room, THE System SHALL call socket.leave(roomId) to remove Socket from broadcast group

6. WHEN User navigates between Rooms, THE System SHALL leave previous roomId Socket group and join new roomId Socket group

7. THE Socket_Service SHALL emit room-scoped events:
   - `room:join` - broadcast when User joins Room to all members of that Room
   - `room:leave` - broadcast when User leaves Room to all remaining members
   - `message:receive` - broadcast new messages to Room members

8. WHEN Socket disconnects, THE System SHALL automatically leave all roomId groups

---

### Requirement 12: Dashboard UI Component

**User Story:** As a User, I want to see a dashboard with available rooms after login, so that I can browse and manage my chat rooms.

#### Acceptance Criteria

1. THE Dashboard_UI SHALL display after User login instead of direct chat view

2. THE Dashboard_UI SHALL display:
   - "Available Rooms" section showing all Public_Rooms and joined Private_Rooms (from ListRooms_API)
   - "My Rooms" section filtered to show only Rooms where User is Room_Member
   - For each Room: name, description, type badge, member count / max capacity, created date

3. THE Dashboard_UI SHALL provide a "Create Room" button that opens CreateRoom_Modal

4. THE Dashboard_UI SHALL provide a "Search Rooms" feature (frontend filter on room names)

5. WHEN User clicks on a Room card, THE System SHALL:
   - Verify User is Room_Member or Room is Public_Room
   - JOIN the Room (if not already member) via JOIN_API
   - Navigate to Chat_UI for that specific Room

6. THE Dashboard_UI SHALL be responsive on desktop, tablet, and mobile viewports

7. THE Dashboard_UI SHALL use glassmorphism styling (dark background, translucent glass cards, backdrop blur, rounded corners) consistent with Phase 4 authentication UI

8. THE Dashboard_UI SHALL refresh available Rooms on mount and provide manual refresh button

9. WHEN error occurs during Room fetch (API 401/500), THE System SHALL display error banner and logout if 401

---

### Requirement 13: Create Room Modal UI

**User Story:** As a User, I want a form to create new rooms with customizable settings, so that I can define room parameters before creation.

#### Acceptance Criteria

1. THE CreateRoom_Modal SHALL display form fields:
   - `name`: Text input, required, 3-50 characters
   - `description`: Text area, optional, max 500 characters
   - `type`: Radio buttons ("Public" or "Private"), required
   - `maxUsers`: Number input, required, 2-500
   - `password`: Text input, required ONLY when `type` is "Private", minimum 6 characters (hidden input type)

2. WHEN CreateRoom_Modal `type` is changed to "Private", THE System SHALL show password field

3. WHEN CreateRoom_Modal `type` is changed to "Public", THE System SHALL hide password field and clear any password value

4. THE CreateRoom_Modal SHALL validate form on submit and display inline errors (e.g., "Name must be 3-50 characters")

5. WHEN CreateRoom_Modal submit is clicked WITH valid form, THE System SHALL:
   - Call CreateRoom_API (POST /api/rooms)
   - Disable submit button and show loading state
   - Display success message and close Modal
   - Refresh Dashboard Room list
   - Auto-navigate to newly created Room (immediate marking allowed)

6. WHEN CreateRoom_Modal API returns error, THE System SHALL display error banner and keep Modal open

7. THE CreateRoom_Modal SHALL provide a "Cancel" button to close without creating

8. THE CreateRoom_Modal SHALL apply glassmorphism styling (dark overlay, glass card, rounded corners)

---

### Requirement 14: Join Room UI

**User Story:** As a User, I want to join public and private rooms with appropriate flows, so that I can access different types of rooms.

#### Acceptance Criteria

1. WHEN User clicks "Join" on a Public_Room card from Dashboard, THE System SHALL:
   - Call JoinPublicRoom_API for that `roomId`
   - If success (HTTP 200): immediately mark as joined, navigate to Chat_UI for that Room
   - If error 409 (full or already member): display error message, stay on Dashboard
   - If error 404: display "Room not found", refresh Dashboard
   - If error 401: logout User

2. WHEN User clicks "Join" on a Private_Room card from Dashboard, THE System SHALL:
   - Open PasswordPrompt_Modal
   - Accept `password` input from User
   - Call JoinPrivateRoom_API WITH `password` in request body
   - If success: navigate to Chat_UI for that Room
   - If error 401 (wrong password): display "Invalid password", keep Modal open for retry
   - If error 409 (full or already member): display error, close Modal, stay on Dashboard

3. THE PasswordPrompt_Modal SHALL:
   - Display single password input field (hidden input type)
   - Provide "Join" and "Cancel" buttons
   - Show loading state during API call
   - Display error messages below password field

4. WHERE Room is Public_Room, THE join flow SHALL NOT prompt for password

5. WHEN User joins Room successfully, THE Dashboard SHALL NOT mark Room as "joined" until User returns to Dashboard

---

### Requirement 15: Chat UI for Room Context

**User Story:** As a User, I want to see and send messages in a specific room, so that I can have focused conversations without cross-room contamination.

#### Acceptance Criteria

1. THE Chat_UI SHALL display current Room context:
   - Room name as title
   - Room description in header (if exists)
   - Member count and Room capacity (e.g., "3/10 members")
   - "Leave Room" button

2. WHEN Chat_UI mounts for a `roomId`, THE System SHALL:
   - Call GetRoomMessages_API to load Message history for that `roomId`
   - Set up Socket.io room subscription (socket.join(roomId))
   - Display existing Messages
   - Show loading state until Messages loaded

3. THE Chat_UI message list SHALL display ONLY messages WHERE `roomId` matches current Room

4. WHEN new Message is received via Socket.io for current Room, THE System SHALL:
   - Display Message immediately in list
   - Append to existing Messages (prevent duplicates)

5. WHEN Message from different `roomId` arrives via Socket.io, THE System SHALL NOT display it (filter by roomId)

6. THE Chat_UI MessageInput SHALL include current User's username

7. WHEN User clicks "Leave Room" button, THE System SHALL:
   - Call LeaveRoom_API for current `roomId`
   - Call socket.leave(roomId)
   - Return to Dashboard

8. WHEN User navigates to different Room (via link, routing, or browser navigation), THE System SHALL automatically:
   - Call socket.leave(previousRoomId) from previous Room
   - Call socket.join(newRoomId) for new Room
   - Fetch new Room's message history

9. THE Chat_UI SHALL refresh Token validation on component mount (GET /api/auth/me) and logout if 401

10. WHEN Socket disconnects while User is in Chat (connection confirmed lost), THE System SHALL display "Disconnected" status and attempt reconnection

---

### Requirement 16: Message Model Updates

**User Story:** As a developer, I want Message documents to track room association, so that messages are correctly scoped to rooms.

#### Acceptance Criteria

1. THE Message_Model SHALL add the following required fields:
   - `roomId`: ObjectId reference to Room, required for all new messages
   - `senderId`: ObjectId reference to User, required for all new messages

2. THE Message_Model SHALL maintain existing fields (unchanged):
   - `username`: String, required
   - `message`: String, required
   - `timestamp`: Date, required

3. THE Message_Model SHALL validate on save that `roomId` and `senderId` are valid ObjectIds

4. THE Message_Model SHALL maintain backward compatibility:
   - Existing messages without `roomId` SHALL NOT be deleted
   - Queries SHALL handle missing `roomId` gracefully
   - Old messages without `roomId` SHALL NOT appear in Room-specific message queries

5. WHEN saving new Message via POST /api/messages, THE System SHALL require both `roomId` and `senderId`

6. THE Message_Model SHALL maintain index on `roomId` for efficient Room message queries

---

### Requirement 17: Room Security and Access Control

**User Story:** As a system designer, I want to enforce server-side access control, so that Users cannot access rooms they're not members of.

#### Acceptance Criteria

1. WHEN User requests Room-specific data (GetRoomMessages_API, SendRoomMessage_API, etc.), THE System SHALL:
   - Extract userId from JWT token (never trust client-supplied userId)
   - Verify User is Room_Member by querying Room `members` array
   - Allow request only if User found in `members`
   - Reject with HTTP 403 if not a member

2. WHEN User requests Public_Room details, THE System SHALL allow all authenticated Users (no Room_Member check needed)

3. WHEN User requests Private_Room details, THE System SHALL check Room_Member status

4. THE Room_Capacity_Enforcement SHALL occur server-side:
   - Check `members.length < maxUsers` before adding User
   - Return HTTP 409 if capacity exceeded
   - Prevent concurrent race conditions (use atomic MongoDB operations)

5. WHEN Private_Room password is checked, THE System SHALL:
   - Use bcrypt.compare(providedPassword, storedPasswordHash)
   - Never expose passwordHash in response
   - Return generic error "Invalid password" (never reveal if room exists vs password wrong)

6. THE System SHALL prevent Users from modifying Room settings (name, description, maxUsers, passwordHash) after creation (not in Phase 5 scope, but requirement noted for future)

7. WHEN Socket.io message is sent WITH `roomId`, THE System SHALL verify User is Room_Member before saving and broadcasting

8. WHERE User attempts to join Room they're already member of, THE System SHALL return HTTP 409 (idempotent but signal to client)

---

### Requirement 18: Room Capacity Enforcement

**User Story:** As a Room_Creator, I want room capacity limits enforced, so that conversations don't become too crowded.

#### Acceptance Criteria

1. WHEN CreateRoom_API receives `maxUsers`, THE System SHALL validate:
   - `maxUsers` is integer >= 2
   - `maxUsers` is integer <= 500
   - Return HTTP 400 if validation fails

2. WHEN JoinPublicRoom_API or JoinPrivateRoom_API is called, THE System SHALL:
   - Count current Room_Members (members array length)
   - Compare to Room `maxUsers`
   - Reject with HTTP 409 "Room is full" if count >= maxUsers
   - Allow join if count < maxUsers

3. WHEN User leaves Room, THE System SHALL NOT automatically delete Room (even if members array becomes empty)

4. WHERE multiple Users attempt to join full Room simultaneously, THE System SHALL accept only remaining slots (atomic operation)

---

### Requirement 19: Glassmorphism UI Styling

**User Story:** As a designer, I want consistent modern UI across dashboard and room interfaces, so that the application feels cohesive.

#### Acceptance Criteria

1. THE Dashboard_UI, CreateRoom_Modal, and PasswordPrompt_Modal SHALL apply consistent styling:
   - Dark background color (similar to Phase 4 auth pages)
   - Translucent glass-effect cards (background: rgba with low alpha, backdrop-filter: blur)
   - Rounded corners (16px minimum)
   - Subtle shadows and borders for depth
   - Smooth transitions and hover effects

2. THE Chat_UI header SHALL apply glassmorphism styling to room context display

3. THE error messages, success banners, and modals SHALL apply glass styling

4. ALL interactive elements (buttons, inputs, cards) SHALL maintain consistent styling across all views

5. THE UI SHALL be responsive:
   - Desktop: 1920px+ (multi-column layout)
   - Tablet: 768px-1920px (adaptive layout)
   - Mobile: <768px (single column, full-width)

6. THE color scheme SHALL use dark theme to maintain consistency with Phase 4 authentication (regardless of system preferences)

---

### Requirement 20: Backward Compatibility with Phase 4

**User Story:** As an administrator, I want all Phase 4 features to work unchanged, so that existing users retain functionality.

#### Acceptance Criteria

1. THE User registration endpoint (POST /api/auth/register) SHALL remain unchanged

2. THE User login endpoint (POST /api/auth/login) SHALL remain unchanged

3. THE Get current user endpoint (GET /api/auth/me) SHALL remain unchanged

4. THE JWT authentication and token structure SHALL remain unchanged

5. WHEN authenticated User requests old global message endpoints (if any), THE System SHALL handle gracefully or deprecate with notice

6. WHEN Socket.io connections are made or fail, THE System SHALL guarantee JWT authentication compatibility is maintained regardless of connection status

7. THE Message model backward compatibility:
   - Existing messages without `roomId` SHALL still be queryable
   - New messages MUST have `roomId`
   - Old messages SHALL NOT appear in Room-specific queries (they belong to no room)

8. WHEN Phase 4 User logs in, THE System SHALL show Dashboard and provide transition flow or onboarding to assist with familiar functionality

9. ALL existing API authentication behavior SHALL be preserved

---

## Summary of Acceptance Criteria Count

Total Requirements: **20**  
Total Acceptance Criteria: **105**

Key Testing Focus Areas:
- Public/private room creation and password security
- Room access control and capacity enforcement
- Message isolation by room (critical: cross-room message leakage prevention)
- Socket.io room scoping
- Dashboard and UI navigation flows
- Backward compatibility with Phase 4

---

## Next Steps

This requirements document is complete and ready for review. User feedback should focus on:
1. Clarity of room access control requirements
2. Message isolation semantics
3. Socket.io room scoping correctness
4. API design and response format
5. UI/UX flow for room navigation
6. Backward compatibility concerns

After requirements approval, the workflow will proceed to Phase 2: Design Document Creation.
