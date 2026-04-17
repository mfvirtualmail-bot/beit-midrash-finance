import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const typeFilter = searchParams.get('type') || 'all' // 'all' | 'member' | 'donor'

    // Fetch members
    let membersQuery = supabase.from('members').select('*').order('name')
    if (search) {
      membersQuery = membersQuery.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
    }

    // Fetch donors
    let donorsQuery = supabase.from('donors').select('*').order('name_he')
    if (search) {
      donorsQuery = donorsQuery.or(`name_he.ilike.%${search}%,name_en.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const [membersRes, donorsRes] = await Promise.all([
      typeFilter !== 'donor' ? membersQuery : Promise.resolve({ data: [] }),
      typeFilter !== 'member' ? donorsQuery : Promise.resolve({ data: [] }),
    ])

    // Fetch member financial totals
    const [chargesRes, paymentsRes, purchasesRes] = await Promise.all([
      supabase.from('member_charges').select('member_id, amount, description'),
      supabase.from('member_payments').select('member_id, amount'),
      supabase.from('transactions').select('member_id, amount').not('member_id', 'is', null).eq('type', 'purchase'),
    ])

    // Fetch donor totals
    const donorDonationsRes = await supabase.from('donor_donations').select('donor_id, amount')

    const charges = chargesRes.data ?? []
    const payments = paymentsRes.data ?? []
    const purchases = purchasesRes.data ?? []
    const donorDonations = donorDonationsRes.data ?? []

    // Build unified client list
    const clients: Array<{
      id: string
      source: 'member' | 'donor'
      sourceId: number
      name: string
      nameEn: string | null
      email: string | null
      phone: string | null
      address: string | null
      notes: string | null
      active: boolean
      balance: number | null
      totalDonated: number | null
    }> = []

    for (const m of (membersRes.data ?? [])) {
      const memberCharges = charges.filter(c => c.member_id === m.id)
      const tc = memberCharges.reduce((s: number, c: { amount: number }) => s + Number(c.amount), 0)
        + purchases.filter(p => p.member_id === m.id).reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0)
      const tp = payments.filter(p => p.member_id === m.id).reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0)
      clients.push({
        id: `member-${m.id}`,
        source: 'member',
        sourceId: m.id,
        name: m.name,
        nameEn: null,
        email: m.email ?? null,
        phone: m.phone ?? null,
        address: m.address ?? null,
        notes: m.notes ?? null,
        active: m.active === 1 || m.active === true,
        balance: tp - tc,
        totalDonated: null,
      })
    }

    for (const d of (donorsRes.data ?? [])) {
      const total = donorDonations.filter(dd => dd.donor_id === d.id).reduce((s: number, dd: { amount: number }) => s + Number(dd.amount), 0)
      clients.push({
        id: `donor-${d.id}`,
        source: 'donor',
        sourceId: d.id,
        name: d.name_he,
        nameEn: d.name_en ?? null,
        email: d.email ?? null,
        phone: d.phone ?? null,
        address: d.address ?? null,
        notes: d.notes ?? null,
        active: d.active === true || d.active === 1,
        balance: null,
        totalDonated: total,
      })
    }

    // Sort: by name
    clients.sort((a, b) => a.name.localeCompare(b.name, 'he'))

    return NextResponse.json(clients)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
