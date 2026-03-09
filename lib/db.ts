// Type definitions for the database models
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
  created_by: number | null
  categories?: { name_he: string; name_en: string; color: string } | null
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
