# Prisma Migrations

## Initial Setup

1. Make sure the PostgreSQL database is running:
```bash
docker-compose up -d
```

2. Generate Prisma Client:
```bash
cd backend
npx prisma generate
```

3. Create and run the initial migration:
```bash
npx prisma migrate dev --name init
```

4. Seed the database with initial data:
```bash
npx prisma db seed
```

## Common Prisma Commands

### Generate Prisma Client
After changing schema.prisma:
```bash
npx prisma generate
```

### Create a new migration
```bash
npx prisma migrate dev --name migration_name
```

### Apply migrations in production
```bash
npx prisma migrate deploy
```

### Reset database (⚠️ DESTRUCTIVE)
```bash
npx prisma migrate reset
```

### View database in Prisma Studio
```bash
npx prisma studio
```

## Migration Notes

- Migration files are stored in `prisma/migrations/`
- Each migration is timestamped and named
- Never modify migration files manually after they're created
- Always test migrations in development before deploying to production

## Rollback Strategy

If a migration causes issues:

1. **Development**: Use `npx prisma migrate reset` to rollback all migrations
2. **Production**: Create a new migration that reverts the changes

Example rollback migration:
```bash
# Create a new migration that undoes previous changes
npx prisma migrate dev --name rollback_previous_change
```
