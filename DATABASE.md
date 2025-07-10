# D1 Database Setup

This project uses Cloudflare D1 for data storage with a migration system for schema management.

## Database Configuration

- **Local Database**: `riddick-db` (configured in `wrangler.toml`)
- **Production Database**: `riddick-db-production` (configured in `wrangler.toml`)
- **Binding**: `DB` (available in Worker environment)

## Schema

### Crates Table

The `crates` table tracks Rust crate analysis:

```sql
CREATE TABLE crates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    agent_summary TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, version)
);
```

**Indexes:**
- `idx_crates_name` - On `name` column
- `idx_crates_status` - On `status` column  
- `idx_crates_created_at` - On `created_at` column

## Migration System

### Running Migrations

```bash
# Run migrations locally
npm run migrate:local

# Run migrations on production
npm run migrate:remote
```

### Migration Files

- Located in `migrations/` directory
- Named with format: `001_description.sql`
- Applied in alphabetical order
- Tracked in `_migrations` table

### Creating New Migrations

1. Create a new `.sql` file in `migrations/` directory
2. Use sequential numbering (e.g., `002_add_new_column.sql`)
3. Write idempotent SQL (use `IF NOT EXISTS` etc.)
4. Test locally before deploying

### Migration Runner

The `MigrationRunner` class in `src/migrations.ts` provides:

- `runMigrations()` - Execute pending migrations
- `getMigrationStatus()` - Check migration status
- `loadMigrations()` - Load all migration files

## Development Commands

```bash
# Database utilities
npm run db:create      # Create local D1 database
npm run db:shell       # Test database connection
npm run db:reset       # Reset local database (drops all tables)

# Migration commands
npm run migrate:local  # Run migrations locally
npm run migrate:remote # Run migrations on production
```

## Testing

Database tests are in `src/database.test.ts` and cover:

- Database connection
- Migration execution
- Table structure validation
- Constraint enforcement
- Data operations
- Index creation

Run tests with:
```bash
npm test
```

## Production Deployment

1. Create production D1 database:
   ```bash
   wrangler d1 create riddick-db-production
   ```

2. Update `wrangler.toml` with the production database ID

3. Run production migrations:
   ```bash
   npm run migrate:remote
   ```

4. Deploy Worker:
   ```bash
   npm run deploy
   ```

## Environment Variables

No environment variables are required. Database configuration is handled through `wrangler.toml`.