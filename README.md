# FoxCord

FoxCord is an original Discord-inspired real-time chat platform built on top of a Fluxer-style full-stack architecture (separate client/server/shared workspaces). It mirrors the UX layout and collaborative behavior patterns while using original styling and implementation.

## Folder Structure

```text
.
├── client/                 # React + TypeScript + Tailwind app
├── server/                 # Express + Prisma + Socket.io API
├── shared/                 # Shared TypeScript contracts
├── docker-compose.yml
└── .env.example
```

## Step-by-step Implementation

### 1) Backend foundation
- Express app with security middleware (`helmet`, CORS policy, rate limiting).
- Prisma schema for users, servers, roles, channels, messages, reactions, friend requests, and refresh tokens.
- Zod input validation middleware and auth middleware.

### 2) Auth and profile
- Register/login/logout/refresh flows.
- bcrypt password hashing.
- JWT access + refresh token strategy.
- User profile update and avatar upload (local storage adapter prepared for future S3 replacement).

### 3) Guild/server and channels
- Server create/delete.
- Invite links (`inviteCode`) and join by invite.
- Role-aware server membership (`ADMIN`, `MODERATOR`, `MEMBER`).
- Text + voice channels with category support.

### 4) Messaging and social
- Channel message history and message CRUD.
- Emoji reactions.
- Friend requests with accept/decline status.
- DM/friend data model included (friend request relationship ready for direct-chat extensions).

### 5) Real-time + voice
- Socket.io events for room join, instant message broadcast, typing indicators.
- Voice signaling channels for WebRTC offer/answer/ICE relay and mute state updates.

### 6) Frontend app
- Discord-like 4-pane layout: server rail, channels, chat area, member panel.
- Zustand store for global app state.
- Login/register flow with token persistence.
- Real-time chat feed + typing status + lightweight voice controls.
- Original visual styling with Tailwind tokens.

### 7) Deployment
- Dockerfiles for client/server.
- `docker-compose` for PostgreSQL + backend + frontend services.
- `.env.example` with required settings.


### 8) Continued development (Phase 2)
- Added server permission middleware (`ADMIN`/`MODERATOR`/`MEMBER`) and enforced role-based access for channel and role management.
- Added member listing + role update APIs for server administration.
- Added unread counters and read-receipt persistence with a dedicated message receipt model.
- Added mention-aware UX improvements (highlight + toast notifications) and unread badges in channel navigation.
- Expanded friend flow to materialize accepted friendships and auto-provision DM rooms.
- Added direct-message room/message APIs and Socket.io DM room events.

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env file and edit secrets:
   ```bash
   cp .env.example .env
   ```
3. Generate Prisma client and run migrations:
   ```bash
   npm run prisma:generate -w server
   npm run prisma:migrate -w server
   ```
4. Start locally:
   ```bash
   npm run dev
   ```
5. Or run via Docker:
   ```bash
   docker compose up --build
   ```

## Notes
- No proprietary Discord code/assets are used.
- Layout/interaction pattern is inspired by modern chat UX, but code and styling are original.
- Some advanced flows (full read-receipt tracking, robust permission matrix, production-grade SFU voice scaling) are scaffolded with clear extension points.
