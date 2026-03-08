import initSqlJs from 'sql.js'
import type { Database as SqlJsDatabase } from 'sql.js'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'data', 'finance.db')

let db: SqlJsDatabase | null = null
let initPromise: Promise<SqlJsDatabase> | null = null

function saveDb() {
  if (db) {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const data = db.export()
    fs.writeFileSync(DB_PATH, Buffer.from(data))
  }
}

async function initDatabase(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs()
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  let database: SqlJsDatabase
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    database = new SQL.Database(fileBuffer)
  } else {
    database = new SQL.Database()
  }

  database.run('PRAGMA foreign_keys = ON')
  initSchema(database)
  saveDbInstance(database)
  return database
}

function saveDbInstance(database: SqlJsDatabase) {
  db = database
}

export async function getDb(): Promise<SqlJsDatabase> {
  if (db) return db
  if (!initPromise) {
    initPromise = initDatabase()
  }
  return initPromise
}

// Helper to run queries and return results as array of objects
export function queryAll(database: SqlJsDatabase, sql: string, params: (string | number | null)[] = []): Record<string, unknown>[] {
  const stmt = database.prepare(sql)
  stmt.bind(params)
  const results: Record<string, unknown>[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Record<string, unknown>)
  }
  stmt.free()
  return results
}

export function queryOne(database: SqlJsDatabase, sql: string, params: (string | number | null)[] = []): Record<string, unknown> | null {
  const results = queryAll(database, sql, params)
  return results[0] || null
}

export function runSql(database: SqlJsDatabase, sql: string, params: (string | number | null)[] = []): { lastId: number } {
  database.run(sql, params)
  const result = database.exec("SELECT last_insert_rowid() as id")
  const lastId = result.length > 0 ? (result[0].values[0][0] as number) : 0
  saveDb()
  return { lastId }
}

function initSchema(database: SqlJsDatabase) {
  database.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_he TEXT NOT NULL,
      name_en TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      color TEXT NOT NULL DEFAULT '#3b82f6',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      amount REAL NOT NULL CHECK(amount > 0),
      description_he TEXT,
      description_en TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Seed default categories if empty
  const count = database.exec("SELECT COUNT(*) as c FROM categories")
  const catCount = count.length > 0 ? (count[0].values[0][0] as number) : 0
  if (catCount === 0) {
    database.run(`INSERT INTO categories (id, name_he, name_en, type, color) VALUES (1, 'תרומות', 'Donations', 'income', '#22c55e')`)
    database.run(`INSERT INTO categories (id, name_he, name_en, type, color) VALUES (2, 'שכר לימוד', 'Tuition', 'income', '#16a34a')`)
    database.run(`INSERT INTO categories (id, name_he, name_en, type, color) VALUES (3, 'מענקים', 'Grants', 'income', '#15803d')`)
    database.run(`INSERT INTO categories (id, name_he, name_en, type, color) VALUES (4, 'אירועים', 'Events', 'income', '#4ade80')`)
    database.run(`INSERT INTO categories (id, name_he, name_en, type, color) VALUES (5, 'שכר דירה', 'Rent', 'expense', '#ef4444')`)
    database.run(`INSERT INTO categories (id, name_he, name_en, type, color) VALUES (6, 'שכר עובדים', 'Salaries', 'expense', '#dc2626')`)
    database.run(`INSERT INTO categories (id, name_he, name_en, type, color) VALUES (7, 'חשמל ומים', 'Utilities', 'expense', '#f97316')`)
    database.run(`INSERT INTO categories (id, name_he, name_en, type, color) VALUES (8, 'ספרים וציוד', 'Books & Supplies', 'expense', '#a855f7')`)
    database.run(`INSERT INTO categories (id, name_he, name_en, type, color) VALUES (9, 'אחזקה', 'Maintenance', 'expense', '#f59e0b')`)
    database.run(`INSERT INTO categories (id, name_he, name_en, type, color) VALUES (10, 'אחר', 'Other', 'expense', '#6b7280')`)
    saveDb()
  }
}

export type TransactionType = 'income' | 'expense'

export interface Category {
  id: number
  name_he: string
  name_en: string
  type: TransactionType
  color: string
  created_at: string
}

export interface Transaction {
  id: number
  type: TransactionType
  amount: number
  description_he: string | null
  description_en: string | null
  category_id: number | null
  date: string
  notes: string | null
  created_at: string
  category_name_he?: string
  category_name_en?: string
  category_color?: string
}
