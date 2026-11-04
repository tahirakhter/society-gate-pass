# Database Setup

## Option 1: Using Docker (Recommended for Development)

1. Make sure Docker and Docker Compose are installed

2. Start the PostgreSQL database:
```bash
docker-compose up -d
```

3. Verify the database is running:
```bash
docker-compose ps
```

4. To stop the database:
```bash
docker-compose down
```

5. To stop and remove data:
```bash
docker-compose down -v
```

## Option 2: Local PostgreSQL Installation

If you prefer a local PostgreSQL installation:

### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Create the database:
```bash
sudo -u postgres psql
CREATE DATABASE society_gate_pass;
CREATE USER postgres WITH ENCRYPTED PASSWORD 'postgres';
GRANT ALL PRIVILEGES ON DATABASE society_gate_pass TO postgres;
\q
```

## Connection String

The backend connection string in `backend/.env`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/society_gate_pass?schema=public"
```

The backend should run on port `3001`:
```
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

The frontend should point at the backend in `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Testing the Connection

From the backend directory:
```bash
cd backend
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

This will generate Prisma Client, apply the migration files, and create the initial seed users.
