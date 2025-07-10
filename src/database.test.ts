import { readFile } from 'fs/promises'
import { join } from 'path'

import { Miniflare } from 'miniflare'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('D1 Database', () => {
  let mf: Miniflare

  beforeEach(async () => {
    mf = new Miniflare({
      modules: true,
      script: `
        export default {
          async fetch(request, env, ctx) {
            return new Response('OK')
          }
        }
      `,
      d1Databases: {
        DB: 'test-db',
      },
    })
  })

  afterEach(async () => {
    await mf.dispose()
  })

  async function executeMigration(db: D1Database): Promise<void> {
    const migrationSql = await readFile(
      join(process.cwd(), 'migrations', '001_create_crates_table.sql'),
      'utf-8',
    )

    // Split SQL statements and execute them individually
    const statements = migrationSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    for (const statement of statements) {
      await db.prepare(statement).run()
    }
  }

  describe('Database Creation', () => {
    it('should create database connection', async () => {
      const db = await mf.getD1Database('DB')
      expect(db).toBeDefined()
    })

    it('should execute basic SQL', async () => {
      const db = await mf.getD1Database('DB')
      const result = await db.prepare('SELECT 1 as test').first()
      expect(result).toEqual({ test: 1 })
    })
  })

  describe('Migration SQL', () => {
    it('should execute migration SQL successfully', async () => {
      const db = await mf.getD1Database('DB')

      await executeMigration(db)

      // Verify table was created
      const tableInfo = await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='crates'",
        )
        .first()

      expect(tableInfo).toEqual({ name: 'crates' })
    })

    it('should have correct table structure', async () => {
      const db = await mf.getD1Database('DB')

      await executeMigration(db)

      // Check table structure
      const columns = await db.prepare('PRAGMA table_info(crates)').all()

      const columnNames = columns.results.map(
        (col: Record<string, unknown>) => col.name,
      )
      expect(columnNames).toContain('id')
      expect(columnNames).toContain('name')
      expect(columnNames).toContain('version')
      expect(columnNames).toContain('agent_summary')
      expect(columnNames).toContain('status')
      expect(columnNames).toContain('error_message')
      expect(columnNames).toContain('created_at')
    })

    it('should enforce UNIQUE constraint on name and version', async () => {
      const db = await mf.getD1Database('DB')

      await executeMigration(db)

      // Insert first record
      await db
        .prepare('INSERT INTO crates (name, version) VALUES (?, ?)')
        .bind('test-crate', '1.0.0')
        .run()

      // Try to insert duplicate - should fail
      await expect(
        db
          .prepare('INSERT INTO crates (name, version) VALUES (?, ?)')
          .bind('test-crate', '1.0.0')
          .run(),
      ).rejects.toThrow()
    })

    it('should apply default values correctly', async () => {
      const db = await mf.getD1Database('DB')

      await executeMigration(db)

      // Insert minimal record
      await db
        .prepare('INSERT INTO crates (name, version) VALUES (?, ?)')
        .bind('test-crate', '1.0.0')
        .run()

      // Check default values
      const record = await db
        .prepare('SELECT * FROM crates WHERE name = ? AND version = ?')
        .bind('test-crate', '1.0.0')
        .first()

      expect(record).toBeDefined()
      expect(record).toMatchObject({
        name: 'test-crate',
        version: '1.0.0',
        status: 'pending',
        agent_summary: null,
        error_message: null,
      })

      expect(record?.created_at).toBeDefined()
      expect(record?.id).toBeDefined()
    })

    it('should create indexes', async () => {
      const db = await mf.getD1Database('DB')

      await executeMigration(db)

      // Check indexes exist
      const indexes = await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='crates'",
        )
        .all()

      const indexNames = indexes.results.map(
        (idx: Record<string, unknown>) => idx.name,
      )
      expect(indexNames).toContain('idx_crates_name')
      expect(indexNames).toContain('idx_crates_status')
      expect(indexNames).toContain('idx_crates_created_at')
    })
  })

  describe('Data Operations', () => {
    beforeEach(async () => {
      const db = await mf.getD1Database('DB')
      await executeMigration(db)
    })

    it('should insert and retrieve crate records', async () => {
      const db = await mf.getD1Database('DB')

      await db
        .prepare(
          'INSERT INTO crates (name, version, agent_summary, status) VALUES (?, ?, ?, ?)',
        )
        .bind('serde', '1.0.0', 'Serialization framework', 'completed')
        .run()

      const record = await db
        .prepare('SELECT * FROM crates WHERE name = ?')
        .bind('serde')
        .first()

      expect(record).toMatchObject({
        name: 'serde',
        version: '1.0.0',
        agent_summary: 'Serialization framework',
        status: 'completed',
      })
    })

    it('should update crate status', async () => {
      const db = await mf.getD1Database('DB')

      await db
        .prepare('INSERT INTO crates (name, version) VALUES (?, ?)')
        .bind('tokio', '1.0.0')
        .run()

      await db
        .prepare(
          'UPDATE crates SET status = ?, agent_summary = ? WHERE name = ? AND version = ?',
        )
        .bind('completed', 'Async runtime', 'tokio', '1.0.0')
        .run()

      const record = await db
        .prepare('SELECT * FROM crates WHERE name = ?')
        .bind('tokio')
        .first()

      expect(record).toMatchObject({
        status: 'completed',
        agent_summary: 'Async runtime',
      })
    })

    it('should handle error cases', async () => {
      const db = await mf.getD1Database('DB')

      await db
        .prepare(
          'INSERT INTO crates (name, version, status, error_message) VALUES (?, ?, ?, ?)',
        )
        .bind('failed-crate', '1.0.0', 'failed', 'Network timeout')
        .run()

      const record = await db
        .prepare('SELECT * FROM crates WHERE name = ?')
        .bind('failed-crate')
        .first()

      expect(record).toMatchObject({
        status: 'failed',
        error_message: 'Network timeout',
      })
    })
  })
})
