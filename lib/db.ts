// Type definitions for the database models
export type TransactionType = 'income' | 'expense' | 'purchase'

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
  member_id: number | null
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
  role: 'super_admin' | 'user'
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

// Donors
export interface Donor {
  id: number
  name_he: string
  name_en: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  active: boolean
  created_at: string
  total_donated?: number
}

// Invoices
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled'

export interface Invoice {
  id: number
  number: string
  date: string
  due_date: string | null
  member_id: number | null
  donor_id: number | null
  title_he: string
  title_en: string | null
  status: InvoiceStatus
  notes: string | null
  created_at: string
  created_by: number | null
  items?: InvoiceItem[]
  member_name?: string
  member_email?: string | null
  donor_name_he?: string
  total?: number
}

export interface InvoiceItem {
  id: number
  invoice_id: number
  description_he: string
  description_en: string | null
  quantity: number
  unit_price: number
  amount: number
}

// Collectors (agents)
export interface Collector {
  id: number
  name: string
  phone: string | null
  email: string | null
  commission_percent: number
  active: boolean
  notes: string | null
  created_at: string
  total_collected?: number
  total_commission?: number
}

// Recurring Transactions
export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly' | 'hebrew_monthly'

export interface RecurringTransaction {
  id: number
  name_he: string
  name_en: string | null
  type: TransactionType
  amount: number
  category_id: number | null
  frequency: RecurringFrequency
  day_of_month: number | null       // 1-31 for monthly/yearly
  hebrew_day: number | null          // 1-30 for hebrew_monthly
  hebrew_month: number | null        // Hebcal month number for yearly
  start_date: string
  end_date: string | null
  last_generated: string | null
  active: boolean
  notes: string | null
  created_at: string
  category_name_he?: string
  category_name_en?: string
  category_color?: string
}
