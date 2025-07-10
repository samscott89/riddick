import { readFile } from 'fs/promises'
import { join } from 'path'

import { Miniflare } from 'miniflare'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('Extended Database Schema', () => {
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

  async function executeAllMigrations(db: D1Database): Promise<void> {
    const migrationFiles = [
      '001_create_crates_table.sql',
      '002_create_modules_table.sql',
      '003_create_items_table.sql',
    ]

    for (const filename of migrationFiles) {
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
  }

  describe('Schema Creation', () => {
    it('should create all tables and indexes', async () => {
      const db = await mf.getD1Database('DB')
      await executeAllMigrations(db)

      // Check all tables exist
      const tables = await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        )
        .all()

      const tableNames = tables.results.map(
        (t: Record<string, unknown>) => t.name,
      )
      expect(tableNames).toContain('crates')
      expect(tableNames).toContain('modules')
      expect(tableNames).toContain('items')
    })

    it('should create all required indexes', async () => {
      const db = await mf.getD1Database('DB')
      await executeAllMigrations(db)

      // Check all indexes exist
      const indexes = await db
        .prepare("SELECT name FROM sqlite_master WHERE type='index'")
        .all()

      const indexNames = indexes.results.map(
        (i: Record<string, unknown>) => i.name,
      )

      // Crates table indexes
      expect(indexNames).toContain('idx_crates_name')
      expect(indexNames).toContain('idx_crates_status')
      expect(indexNames).toContain('idx_crates_created_at')

      // Modules table indexes
      expect(indexNames).toContain('idx_modules_crate_id')
      expect(indexNames).toContain('idx_modules_path')

      // Items table indexes
      expect(indexNames).toContain('idx_items_module_id')
      expect(indexNames).toContain('idx_items_type')
      expect(indexNames).toContain('idx_items_name')
    })
  })

  describe('Foreign Key Constraints', () => {
    beforeEach(async () => {
      const db = await mf.getD1Database('DB')
      await executeAllMigrations(db)
      // Enable foreign key constraints
      await db.prepare('PRAGMA foreign_keys = ON').run()
    })

    it('should enforce foreign key constraint between modules and crates', async () => {
      const db = await mf.getD1Database('DB')

      // Try to insert module with non-existent crate_id
      await expect(
        db
          .prepare('INSERT INTO modules (crate_id, path) VALUES (?, ?)')
          .bind(999, 'test::module')
          .run(),
      ).rejects.toThrow()
    })

    it('should enforce foreign key constraint between items and modules', async () => {
      const db = await mf.getD1Database('DB')

      // Try to insert item with non-existent module_id
      await expect(
        db
          .prepare(
            'INSERT INTO items (module_id, name, item_type, source_code) VALUES (?, ?, ?, ?)',
          )
          .bind(999, 'test_fn', 'function', 'fn test_fn() {}')
          .run(),
      ).rejects.toThrow()
    })

    it('should support cascading deletes', async () => {
      const db = await mf.getD1Database('DB')

      // Create test data
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

      // Delete the crate
      await db
        .prepare('DELETE FROM crates WHERE id = ?')
        .bind(crateResult.meta.last_row_id)
        .run()

      // Check that modules and items were cascade deleted
      const modules = await db
        .prepare('SELECT * FROM modules WHERE crate_id = ?')
        .bind(crateResult.meta.last_row_id)
        .all()

      const items = await db
        .prepare('SELECT * FROM items WHERE module_id = ?')
        .bind(moduleResult.meta.last_row_id)
        .all()

      expect(modules.results).toHaveLength(0)
      expect(items.results).toHaveLength(0)
    })
  })

  describe('Data Integrity', () => {
    beforeEach(async () => {
      const db = await mf.getD1Database('DB')
      await executeAllMigrations(db)
      await db.prepare('PRAGMA foreign_keys = ON').run()
    })

    it('should validate item_type values', async () => {
      const db = await mf.getD1Database('DB')

      // Create test crate and module
      const crateResult = await db
        .prepare('INSERT INTO crates (name, version) VALUES (?, ?)')
        .bind('test-crate', '1.0.0')
        .run()

      const moduleResult = await db
        .prepare('INSERT INTO modules (crate_id, path) VALUES (?, ?)')
        .bind(crateResult.meta.last_row_id, 'test::module')
        .run()

      // Test valid item types
      const validTypes = ['function', 'struct', 'enum', 'impl']
      for (const itemType of validTypes) {
        await db
          .prepare(
            'INSERT INTO items (module_id, name, item_type, source_code) VALUES (?, ?, ?, ?)',
          )
          .bind(
            moduleResult.meta.last_row_id,
            `test_${itemType}`,
            itemType,
            `code for ${itemType}`,
          )
          .run()
      }

      // Verify all items were inserted
      const items = await db
        .prepare('SELECT item_type FROM items WHERE module_id = ?')
        .bind(moduleResult.meta.last_row_id)
        .all()

      const itemTypes = items.results.map(
        (i: Record<string, unknown>) => i.item_type,
      )
      expect(itemTypes).toEqual(expect.arrayContaining(validTypes))
    })

    it('should handle complex hierarchical data', async () => {
      const db = await mf.getD1Database('DB')

      // Create test crate
      const crateResult = await db
        .prepare('INSERT INTO crates (name, version, status) VALUES (?, ?, ?)')
        .bind('serde', '1.0.0', 'completed')
        .run()

      // Create multiple modules
      const modules = [
        { path: 'serde', summary: 'Main serde module' },
        { path: 'serde::ser', summary: 'Serialization traits' },
        { path: 'serde::de', summary: 'Deserialization traits' },
      ]

      const moduleIds = []
      for (const module of modules) {
        const result = await db
          .prepare(
            'INSERT INTO modules (crate_id, path, agent_summary) VALUES (?, ?, ?)',
          )
          .bind(crateResult.meta.last_row_id, module.path, module.summary)
          .run()
        moduleIds.push(result.meta.last_row_id)
      }

      // Create items for each module
      const items = [
        {
          moduleIdx: 0,
          name: 'Serialize',
          type: 'struct',
          code: 'pub trait Serialize {}',
        },
        {
          moduleIdx: 0,
          name: 'Deserialize',
          type: 'struct',
          code: 'pub trait Deserialize {}',
        },
        {
          moduleIdx: 1,
          name: 'Serializer',
          type: 'struct',
          code: 'pub trait Serializer {}',
        },
        {
          moduleIdx: 2,
          name: 'Deserializer',
          type: 'struct',
          code: 'pub trait Deserializer {}',
        },
      ]

      for (const item of items) {
        await db
          .prepare(
            'INSERT INTO items (module_id, name, item_type, source_code) VALUES (?, ?, ?, ?)',
          )
          .bind(moduleIds[item.moduleIdx], item.name, item.type, item.code)
          .run()
      }

      // Verify the complete hierarchy
      const crateData = await db
        .prepare(
          `
          SELECT 
            c.name as crate_name,
            c.version,
            m.path as module_path,
            i.name as item_name,
            i.item_type
          FROM crates c
          JOIN modules m ON c.id = m.crate_id
          JOIN items i ON m.id = i.module_id
          WHERE c.id = ?
          ORDER BY m.path, i.name
        `,
        )
        .bind(crateResult.meta.last_row_id)
        .all()

      expect(crateData.results).toHaveLength(4)
      expect(crateData.results[0]).toMatchObject({
        crate_name: 'serde',
        version: '1.0.0',
      })
    })
  })

  describe('Test Data Fixtures', () => {
    beforeEach(async () => {
      const db = await mf.getD1Database('DB')
      await executeAllMigrations(db)
      await db.prepare('PRAGMA foreign_keys = ON').run()
    })

    it('should create comprehensive test data', async () => {
      const db = await mf.getD1Database('DB')

      // Create sample crate
      const crateResult = await db
        .prepare(
          'INSERT INTO crates (name, version, agent_summary, status) VALUES (?, ?, ?, ?)',
        )
        .bind('tokio', '1.0.0', 'Async runtime for Rust', 'completed')
        .run()

      // Add related modules
      const moduleData = [
        { path: 'tokio', summary: 'Main tokio module' },
        { path: 'tokio::time', summary: 'Time utilities' },
        { path: 'tokio::sync', summary: 'Synchronization primitives' },
        { path: 'tokio::net', summary: 'Network types' },
      ]

      const moduleIds = []
      for (const module of moduleData) {
        const result = await db
          .prepare(
            'INSERT INTO modules (crate_id, path, agent_summary) VALUES (?, ?, ?)',
          )
          .bind(crateResult.meta.last_row_id, module.path, module.summary)
          .run()
        moduleIds.push(result.meta.last_row_id)
      }

      // Add items covering all types
      const itemData = [
        { moduleIdx: 0, name: 'main', type: 'function', code: 'fn main() {}' },
        {
          moduleIdx: 0,
          name: 'Runtime',
          type: 'struct',
          code: 'pub struct Runtime {}',
        },
        {
          moduleIdx: 1,
          name: 'sleep',
          type: 'function',
          code: 'pub async fn sleep() {}',
        },
        {
          moduleIdx: 1,
          name: 'Duration',
          type: 'enum',
          code: 'pub enum Duration {}',
        },
        {
          moduleIdx: 2,
          name: 'Mutex',
          type: 'struct',
          code: 'pub struct Mutex<T> {}',
        },
        {
          moduleIdx: 2,
          name: 'RwLock',
          type: 'struct',
          code: 'pub struct RwLock<T> {}',
        },
        {
          moduleIdx: 3,
          name: 'TcpListener',
          type: 'struct',
          code: 'pub struct TcpListener {}',
        },
        {
          moduleIdx: 3,
          name: 'TcpStream',
          type: 'impl',
          code: 'impl TcpStream {}',
        },
      ]

      for (const item of itemData) {
        await db
          .prepare(
            'INSERT INTO items (module_id, name, item_type, source_code, agent_summary) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(
            moduleIds[item.moduleIdx],
            item.name,
            item.type,
            item.code,
            `${item.type} ${item.name}`,
          )
          .run()
      }

      // Verify all data was created
      const summary = await db
        .prepare(
          `
          SELECT 
            COUNT(DISTINCT c.id) as crates_count,
            COUNT(DISTINCT m.id) as modules_count,
            COUNT(DISTINCT i.id) as items_count,
            COUNT(DISTINCT i.item_type) as item_types_count
          FROM crates c
          JOIN modules m ON c.id = m.crate_id
          JOIN items i ON m.id = i.module_id
        `,
        )
        .first()

      expect(summary).toMatchObject({
        crates_count: 1,
        modules_count: 4,
        items_count: 8,
        item_types_count: 4,
      })

      // Test all item types are present
      const itemTypes = await db
        .prepare('SELECT DISTINCT item_type FROM items ORDER BY item_type')
        .all()

      const types = itemTypes.results.map(
        (t: Record<string, unknown>) => t.item_type,
      )
      expect(types).toEqual(['enum', 'function', 'impl', 'struct'])
    })
  })
})
