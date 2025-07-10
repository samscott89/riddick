import { readFile } from 'fs/promises'
import { join } from 'path'

import { Miniflare } from 'miniflare'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('Migration Rollback Scenarios', () => {
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

  async function executeMigration(
    db: D1Database,
    filename: string,
  ): Promise<void> {
    const migrationSql = await readFile(
      join(process.cwd(), 'migrations', filename),
      'utf-8',
    )

    const statements = migrationSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    for (const statement of statements) {
      await db.prepare(statement).run()
    }
  }

  async function executeRollback(
    db: D1Database,
    rollbackSql: string,
  ): Promise<void> {
    const statements = rollbackSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    for (const statement of statements) {
      await db.prepare(statement).run()
    }
  }

  describe('Forward and Backward Migration Tests', () => {
    it('should rollback modules table migration', async () => {
      const db = await mf.getD1Database('DB')
      await db.prepare('PRAGMA foreign_keys = ON').run()

      // Apply base migration
      await executeMigration(db, '001_create_crates_table.sql')

      // Apply modules migration
      await executeMigration(db, '002_create_modules_table.sql')

      // Verify modules table exists
      const modulesBefore = await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='modules'",
        )
        .first()
      expect(modulesBefore).toBeDefined()

      // Rollback modules migration
      const rollbackSql = `
        DROP INDEX IF EXISTS idx_modules_path;
        DROP INDEX IF EXISTS idx_modules_crate_id;
        DROP TABLE IF EXISTS modules;
      `
      await executeRollback(db, rollbackSql)

      // Verify modules table no longer exists
      const modulesAfter = await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='modules'",
        )
        .first()
      expect(modulesAfter).toBeNull()

      // Verify crates table still exists
      const cratesAfter = await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='crates'",
        )
        .first()
      expect(cratesAfter).toBeDefined()
    })

    it('should rollback items table migration', async () => {
      const db = await mf.getD1Database('DB')
      await db.prepare('PRAGMA foreign_keys = ON').run()

      // Apply all migrations
      await executeMigration(db, '001_create_crates_table.sql')
      await executeMigration(db, '002_create_modules_table.sql')
      await executeMigration(db, '003_create_items_table.sql')

      // Verify items table exists
      const itemsBefore = await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='items'",
        )
        .first()
      expect(itemsBefore).toBeDefined()

      // Rollback items migration
      const rollbackSql = `
        DROP INDEX IF EXISTS idx_items_name;
        DROP INDEX IF EXISTS idx_items_type;
        DROP INDEX IF EXISTS idx_items_module_id;
        DROP TABLE IF EXISTS items;
      `
      await executeRollback(db, rollbackSql)

      // Verify items table no longer exists
      const itemsAfter = await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='items'",
        )
        .first()
      expect(itemsAfter).toBeNull()

      // Verify modules table still exists
      const modulesAfter = await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='modules'",
        )
        .first()
      expect(modulesAfter).toBeDefined()
    })

    it('should preserve data correctly during rollback', async () => {
      const db = await mf.getD1Database('DB')
      await db.prepare('PRAGMA foreign_keys = ON').run()

      // Apply base migration and add test data
      await executeMigration(db, '001_create_crates_table.sql')

      const crateResult = await db
        .prepare('INSERT INTO crates (name, version, status) VALUES (?, ?, ?)')
        .bind('test-crate', '1.0.0', 'completed')
        .run()

      // Apply modules migration and add test data
      await executeMigration(db, '002_create_modules_table.sql')

      const moduleResult = await db
        .prepare(
          'INSERT INTO modules (crate_id, path, agent_summary) VALUES (?, ?, ?)',
        )
        .bind(crateResult.meta.last_row_id, 'test::module', 'Test module')
        .run()

      // Apply items migration and add test data
      await executeMigration(db, '003_create_items_table.sql')

      await db
        .prepare(
          'INSERT INTO items (module_id, name, item_type, source_code) VALUES (?, ?, ?, ?)',
        )
        .bind(
          moduleResult.meta.last_row_id,
          'test_fn',
          'function',
          'fn test_fn() {}',
        )
        .run()

      // Verify all data exists
      const cratesBefore = await db
        .prepare('SELECT COUNT(*) as count FROM crates')
        .first()
      const modulesBefore = await db
        .prepare('SELECT COUNT(*) as count FROM modules')
        .first()
      const itemsBefore = await db
        .prepare('SELECT COUNT(*) as count FROM items')
        .first()

      expect(cratesBefore).toMatchObject({ count: 1 })
      expect(modulesBefore).toMatchObject({ count: 1 })
      expect(itemsBefore).toMatchObject({ count: 1 })

      // Rollback items migration
      const itemsRollback = `
        DROP INDEX IF EXISTS idx_items_name;
        DROP INDEX IF EXISTS idx_items_type;
        DROP INDEX IF EXISTS idx_items_module_id;
        DROP TABLE IF EXISTS items;
      `
      await executeRollback(db, itemsRollback)

      // Verify crates and modules data preserved
      const cratesAfter = await db
        .prepare('SELECT COUNT(*) as count FROM crates')
        .first()
      const modulesAfter = await db
        .prepare('SELECT COUNT(*) as count FROM modules')
        .first()

      expect(cratesAfter).toMatchObject({ count: 1 })
      expect(modulesAfter).toMatchObject({ count: 1 })

      // Verify items table gone
      await expect(
        db.prepare('SELECT COUNT(*) as count FROM items').first(),
      ).rejects.toThrow()

      // Rollback modules migration
      const modulesRollback = `
        DROP INDEX IF EXISTS idx_modules_path;
        DROP INDEX IF EXISTS idx_modules_crate_id;
        DROP TABLE IF EXISTS modules;
      `
      await executeRollback(db, modulesRollback)

      // Verify crates data still preserved
      const cratesFinal = await db
        .prepare('SELECT COUNT(*) as count FROM crates')
        .first()
      expect(cratesFinal).toMatchObject({ count: 1 })

      // Verify modules table gone
      await expect(
        db.prepare('SELECT COUNT(*) as count FROM modules').first(),
      ).rejects.toThrow()
    })

    it('should properly remove all constraints during rollback', async () => {
      const db = await mf.getD1Database('DB')
      await db.prepare('PRAGMA foreign_keys = ON').run()

      // Apply all migrations
      await executeMigration(db, '001_create_crates_table.sql')
      await executeMigration(db, '002_create_modules_table.sql')
      await executeMigration(db, '003_create_items_table.sql')

      // Verify foreign key constraints exist by checking schema
      const moduleSchema = await db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type='table' AND name='modules'",
        )
        .first()

      const itemSchema = await db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type='table' AND name='items'",
        )
        .first()

      expect(moduleSchema?.sql).toContain('FOREIGN KEY')
      expect(itemSchema?.sql).toContain('FOREIGN KEY')

      // Rollback in reverse order
      await executeRollback(
        db,
        `
        DROP INDEX IF EXISTS idx_items_name;
        DROP INDEX IF EXISTS idx_items_type;
        DROP INDEX IF EXISTS idx_items_module_id;
        DROP TABLE IF EXISTS items;
      `,
      )

      await executeRollback(
        db,
        `
        DROP INDEX IF EXISTS idx_modules_path;
        DROP INDEX IF EXISTS idx_modules_crate_id;
        DROP TABLE IF EXISTS modules;
      `,
      )

      // Verify all indexes are removed
      const allIndexes = await db
        .prepare("SELECT name FROM sqlite_master WHERE type='index'")
        .all()

      const indexNames = allIndexes.results.map(
        (i: Record<string, unknown>) => i.name,
      )

      // Should only have crates indexes remaining
      expect(indexNames).not.toContain('idx_modules_crate_id')
      expect(indexNames).not.toContain('idx_modules_path')
      expect(indexNames).not.toContain('idx_items_module_id')
      expect(indexNames).not.toContain('idx_items_type')
      expect(indexNames).not.toContain('idx_items_name')

      // Crates indexes should still exist
      expect(indexNames).toContain('idx_crates_name')
      expect(indexNames).toContain('idx_crates_status')
      expect(indexNames).toContain('idx_crates_created_at')
    })

    it('should handle partial rollback scenarios', async () => {
      const db = await mf.getD1Database('DB')
      await db.prepare('PRAGMA foreign_keys = ON').run()

      // Apply all migrations
      await executeMigration(db, '001_create_crates_table.sql')
      await executeMigration(db, '002_create_modules_table.sql')
      await executeMigration(db, '003_create_items_table.sql')

      // Add test data
      const crateResult = await db
        .prepare('INSERT INTO crates (name, version) VALUES (?, ?)')
        .bind('test-crate', '1.0.0')
        .run()

      const moduleResult = await db
        .prepare('INSERT INTO modules (crate_id, path) VALUES (?, ?)')
        .bind(crateResult.meta.last_row_id, 'test::module')
        .run()

      await db
        .prepare(
          'INSERT INTO items (module_id, name, item_type, source_code) VALUES (?, ?, ?, ?)',
        )
        .bind(
          moduleResult.meta.last_row_id,
          'test_fn',
          'function',
          'fn test_fn() {}',
        )
        .run()

      // Rollback only the items migration
      await executeRollback(
        db,
        `
        DROP INDEX IF EXISTS idx_items_name;
        DROP INDEX IF EXISTS idx_items_type;
        DROP INDEX IF EXISTS idx_items_module_id;
        DROP TABLE IF EXISTS items;
      `,
      )

      // Verify we can still work with modules
      const moduleData = await db
        .prepare('SELECT * FROM modules WHERE crate_id = ?')
        .bind(crateResult.meta.last_row_id)
        .first()

      expect(moduleData).toBeDefined()
      expect(moduleData).toMatchObject({
        path: 'test::module',
      })

      // Verify we can add new modules
      await db
        .prepare('INSERT INTO modules (crate_id, path) VALUES (?, ?)')
        .bind(crateResult.meta.last_row_id, 'test::another_module')
        .run()

      const allModules = await db
        .prepare('SELECT COUNT(*) as count FROM modules WHERE crate_id = ?')
        .bind(crateResult.meta.last_row_id)
        .first()

      expect(allModules).toMatchObject({ count: 2 })
    })
  })
})
