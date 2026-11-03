# Society Gate Pass

A QR-code-based visitor entry management system for gated residential societies. House owners generate time-bound, manually controllable QR codes for visitors. Security staff verify these QR codes at the gate to allow or deny entry.

## Features

### Core Capabilities

- **Role-Based Access Control**
  - Admin: System administration, user/house management, full visibility
  - Owner: Visitor pass creation, pass management, entry history
  - Security: Gate validation, QR code scanning, entry logging

- **Visitor Pass Management**
  - Generate time-bound QR codes for visitors
  - Manual pass creation and AI-assisted pass creation
  - Pass status tracking: active, used, revoked, expired
  - Owner-controlled pass deactivation
  - QR code display and download

- **AI-Powered Features**
  - Natural language visitor pass creation assistant
  - Intelligent visitor search by name, CNIC, house number, date range
  - Multi-step AI assistant for missing visitor information
  - Unified AI agent router with role-specific workflows

- **Security & Validation**
  - JWT-based authentication with refresh tokens
  - QR code validation at gate
  - Entry log tracking
  - Admin-controlled user lifecycle

- **Admin Dashboard**
  - User management (create/activate/deactivate accounts)
  - House creation and owner assignment
  - View all visitors, passes, and entry logs
  - Pass validation and deactivation

## Tech Stack

### Backend
- **Framework**: NestJS
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: JWT (access + refresh tokens)
- **AI Integration**: Google Gemini API

### Frontend
- **Framework**: Next.js (App Router)
- **UI**: React with Tailwind CSS
- **State Management**: React hooks
- **API Client**: Fetch API

## Project Structure

```
society-gate-pass/
├── backend/                 # NestJS API
│   ├── src/
│   │   ├── auth/           # Authentication & JWT
│   │   ├── users/          # User management
│   │   ├── houses/         # House management
│   │   ├── visit-tokens/   # Visitor pass/QR management
│   │   ├── entry-logs/     # Entry tracking
│   │   ├── ai/             # AI assistant & search
│   │   └── prisma/         # Database service
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   ├── migrations/     # DB migrations
│   │   └── seed.ts         # Seed data
│   └── package.json
│
├── frontend/                # Next.js App
│   ├── app/
│   │   ├── login/          # Login page
│   │   ├── register/       # Registration (admin only)
│   │   ├── dashboard/      # Role-specific dashboards
│   │   ├── admin/          # Admin controls
│   │   ├── passes/         # Visitor passes
│   │   └── profile/        # User profile
│   ├── components/         # Reusable React components
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Utility functions
│   └── package.json
│
├── AGENTS.md               # Agent/developer guide
├── DEVELOPMENT_PHASES.md   # Phase breakdown
└── society_gate_pass_requirement.md  # Full requirements
```

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+ (via Docker)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd society-gate-pass
   ```

2. **Start the database**
   ```bash
   npm run deps
   ```

3. **Setup backend**
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed
   cd ..
   ```

4. **Setup frontend**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

5. **Configure environment**
   - Copy `development.env` to `.env.local` in backend and frontend
   - Update `NEXT_PUBLIC_API_URL=http://localhost:3001` in frontend

6. **Start development servers**
   ```bash
   # Terminal 1: Backend
   cd backend
   npm run start:dev

   # Terminal 2: Frontend
   cd frontend
   npm run dev
   ```

   Backend runs on `http://localhost:3001`
   Frontend runs on `http://localhost:3000`

### Stop Services

```bash
npm run deps:down
```

## Development

### Backend Commands

```bash
cd backend

# Lint
npm run lint

# Build
npm run build

# Tests
npm run test -- --runInBand

# Development server
npm run start:dev

# Database
npx prisma migrate dev
npx prisma db seed
npx prisma generate
```

### Frontend Commands

```bash
cd frontend

# Lint
npm run lint

# Type check
npx tsc --noEmit

# Development server
npm run dev

# Build
npm run build

# Production start
npm run start
```

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token

### Users (Admin)
- `GET /users` - List users
- `POST /users` - Create user
- `PUT /users/:id` - Update user
- `PATCH /users/:id/deactivate` - Deactivate user

### Houses
- `GET /houses` - List houses (admin) / own houses (owner)
- `POST /houses` - Create house (admin)
- `GET /houses/:id` - Get house details

### Visitor Passes
- `POST /visit-tokens` - Create visitor pass
- `GET /visit-tokens` - List all passes (admin)
- `GET /visit-tokens/my` - List owner's passes
- `GET /visit-tokens/recent` - Recent passes (security)
- `GET /visit-tokens/:id` - Get pass details
- `PATCH /visit-tokens/:id/deactivate` - Deactivate pass
- `PATCH /visit-tokens/:id/validate` - Validate at gate

### AI Assistant
- `POST /ai/agent` - Unified AI assistant (create pass, search visitors, deactivate pass)
- `POST /ai/visitor-pass/assistant` - Legacy: AI pass creation
- `POST /ai/visitor-search` - Legacy: AI visitor search

### Entry Logs
- `GET /entry-logs` - View entry logs

## User Roles & Permissions

### Admin
- Manage system configuration
- Create and manage users
- Create and assign houses
- View all visitors, passes, and logs
- Validate and deactivate passes

### Owner
- Create and manage visitor passes
- View own pass history
- Deactivate own passes
- Search own visitor records
- View entry history for assigned houses

### Security
- View visitor passes for validation
- Scan and validate QR codes
- Record entry logs
- View recent pass activity

## Development Phases

See [DEVELOPMENT_PHASES.md](./DEVELOPMENT_PHASES.md) for detailed phase breakdown.

- **Phase 1**: Foundation (auth, RBAC, user/house management) ✅
- **Phase 2**: Visitor passes & AI assistance ✅
- **Phase 3**: AI visitor search agent ✅
- **Phase 4**: Unified AI agent & role-specific workflows ✅

## Documentation

- [AGENTS.md](./AGENTS.md) - Agent/developer working guide
- [DEVELOPMENT_PHASES.md](./DEVELOPMENT_PHASES.md) - Phase breakdown and completed work
- [society_gate_pass_requirement.md](./society_gate_pass_requirement.md) - Full product requirements
- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - Database configuration details
- [backend/MIGRATIONS.md](./backend/prisma/MIGRATIONS.md) - Database migration history
- [frontend/AGENTS.md](./frontend/AGENTS.md) - Frontend-specific developer guide

## Contributing

Follow the conventions in [AGENTS.md](./AGENTS.md):
- Prefer implementing features over updating specs
- Keep backend and frontend aligned with requirements
- Run lint, type checks, and tests before committing
- Use conventional commits for clarity

## License

Proprietary - All rights reserved
