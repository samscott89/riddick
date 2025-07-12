import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

export interface Migration {
  id: string
  filename: string
  sql: string
}

export class MigrationRunner {
  private db: D1Database
  private migrationsDir: string

  constructor(db: D1Database, migrationsDir: string = 'migrations') {
    this.db = db
    this.migrationsDir = migrationsDir
  }

  async initializeMigrationsTable(): Promise<void> {
    await this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS _migrations (
          id TEXT PRIMARY KEY,
          filename TEXT NOT NULL,
          applied_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`,
      )
      .run()
  }

  async getAppliedMigrations(): Promise<string[]> {
    const result = await this.db
      .prepare('SELECT id FROM _migrations ORDER BY applied_at')
      .all()
    return result.results.map((row) => row.id as string)
  }

  async loadMigrations(): Promise<Migration[]> {
    const files = await readdir(this.migrationsDir)
    const migrationFiles = files.filter((file) => file.endsWith('.sql')).sort()

    const migrations: Migration[] = []
    for (const filename of migrationFiles) {
      const filepath = join(this.migrationsDir, filename)
      const sql = await readFile(filepath, 'utf-8')
      const id = filename.replace('.sql', '')
      migrations.push({ id, filename, sql })
    }

    return migrations
  }

  async runMigrations(): Promise<void> {
    await this.initializeMigrationsTable()

    const appliedMigrations = await this.getAppliedMigrations()
    const allMigrations = await this.loadMigrations()

    for (const migration of allMigrations) {
      if (!appliedMigrations.includes(migration.id)) {
         
        console.log(`Running migration: ${migration.filename}`)

        try {
          // Execute the migration SQL - split into individual statements
          const statements = migration.sql
            .split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)

          for (const statement of statements) {
            await this.db.prepare(statement).run()
          }

          // Record the migration as applied
          await this.db
            .prepare('INSERT INTO _migrations (id, filename) VALUES (?, ?)')
            .bind(migration.id, migration.filename)
            .run()

           
          console.log(`✓ Migration ${migration.filename} completed`)
        } catch (error) {
           
          console.error(`✗ Migration ${migration.filename} failed:`, error)
          throw error
        }
      } else {
         
        console.log(`⏭ Migration ${migration.filename} already applied`)
      }
    }
  }

  async getMigrationStatus(): Promise<{
    applied: string[]
    pending: string[]
    total: number
  }> {
    await this.initializeMigrationsTable()

    const applied = await this.getAppliedMigrations()
    const allMigrations = await this.loadMigrations()
    const pending = allMigrations
      .filter((m) => !applied.includes(m.id))
      .map((m) => m.id)

    return {
      applied,
      pending,
      total: allMigrations.length,
    }
  }
}
