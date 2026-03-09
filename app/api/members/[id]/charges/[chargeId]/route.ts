import { NextRequest, NextResponse } from 'next/server'
import { getDb, runSql } from '@/lib/db'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; chargeId: string } }) {
  try {
    const db = await getDb()
    runSql(db, `DELETE FROM member_charges WHERE id = ? AND member_id = ?`,
      [Number(params.chargeId), Number(params.id)])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
