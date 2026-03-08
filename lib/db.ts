import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'finance.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const fs = require('fs')
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_he TEXT NOT NULL,
      name_en TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      color TEXT NOT NULL DEFAULT '#3b82f6',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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
    );

    -- Seed default categories if empty
    INSERT OR IGNORE INTO categories (id, name_he, name_en, type, color) VALUES
      (1, 'תרומות', 'Donations', 'income', '#22c55e'),
      (2, 'שכר לימוד', 'Tuition', 'income', '#16a34a'),
      (3, 'מענקים', 'Grants', 'income', '#15803d'),
      (4, 'אירועים', 'Events', 'income', '#4ade80'),
      (5, 'שכר דירה', 'Rent', 'expense', '#ef4444'),
      (6, 'שכר עובדים', 'Salaries', 'expense', '#dc2626'),
      (7, 'חשמל ומים', 'Utilities', 'expense', '#f97316'),
      (8, 'ספרים וציוד', 'Books & Supplies', 'expense', '#a855f7'),
      (9, 'אחזקה', 'Maintenance', 'expense', '#f59e0b'),
      (10, 'אחר', 'Other', 'expense', '#6b7280');
  `)
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
