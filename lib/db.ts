import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

function _hashSync(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

// Dynamic import for sql.js to avoid module format issues
type SqlJsDatabase = {
  run(sql: string, params?: unknown[]): void
  exec(sql: string): { columns: string[]; values: unknown[][] }[]
  prepare(sql: string): {
    bind(params?: unknown[]): boolean
    step(): boolean
    getAsObject(): Record<string, unknown>
    free(): void
  }
  export(): Uint8Array
  close(): void
}

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
  const initSqlJs = require('sql.js')
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

  // Users & sessions
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Members
  database.run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id)
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS member_charges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id)
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS member_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      amount REAL NOT NULL CHECK(amount > 0),
      date TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'cash',
      reference TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id)
    )
  `)

  // Migration: add created_by to transactions
  try { database.run(`ALTER TABLE transactions ADD COLUMN created_by INTEGER REFERENCES users(id)`) } catch { /* already exists */ }

  // Seed default users
  const userCount = database.exec("SELECT COUNT(*) as c FROM users")
  const uc = userCount.length > 0 ? (userCount[0].values[0][0] as number) : 0
  if (uc === 0) {
    database.run(`INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)`,
      ['admin', _hashSync('admin123'), 'מנהל / Admin'])
    database.run(`INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)`,
      ['user1', _hashSync('1234'), 'משתמש 1 / User 1'])
    database.run(`INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)`,
      ['user2', _hashSync('1234'), 'משתמש 2 / User 2'])
    saveDb()
  }

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

export interface User {
  id: number
  username: string
  display_name: string
  created_at: string
}

export interface Member {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  active: number
  created_at: string
  total_charges?: number
  total_payments?: number
  balance?: number
}

export interface MemberCharge {
  id: number
  member_id: number
  description: string
  amount: number
  date: string
  notes: string | null
  created_at: string
  created_by_name?: string
}

export interface MemberPayment {
  id: number
  member_id: number
  amount: number
  date: string
  method: string
  reference: string | null
  notes: string | null
  created_at: string
  created_by_name?: string
}
