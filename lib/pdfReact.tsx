import React from 'react'
import path from 'path'
import fs from 'fs'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
  pdf,
} from '@react-pdf/renderer'
import type { StatementMemberData } from './statementPdf'

// Register NotoSansHebrew once per process. Throws if the TTF is missing
// rather than falling back silently to Helvetica (which renders Hebrew as
// boxes). On Vercel, next.config.js outputFileTracingIncludes ships the
// fonts/ directory with each PDF route.
let notoFontRegistered = false
function ensureNotoFont() {
  if (notoFontRegistered) return
  const base = path.join(process.cwd(), 'fonts')
  const regular = path.join(base, 'NotoSansHebrew-Regular.ttf')
  const bold = path.join(base, 'NotoSansHebrew-Bold.ttf')
  if (!fs.existsSync(regular)) {
    throw new Error(
      `PDF font missing at ${regular}. On Vercel, ensure next.config.js outputFileTracingIncludes covers ./fonts/**`,
    )
  }
  Font.register({
    family: 'NotoHebrew',
    fonts: [
      { src: regular, fontWeight: 400 },
      { src: bold, fontWeight: 700 },
    ],
  })
  notoFontRegistered = true
}

function resolveLogoSrc(logoDataUrl: string | undefined): string | null {
  if (logoDataUrl && logoDataUrl.trim()) return logoDataUrl.trim()
  const localPath = path.join(process.cwd(), 'public', 'logo.png')
  if (fs.existsSync(localPath)) return localPath
  return null
}

const fmt = (n: number) =>
  `€${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// React-PDF cannot render HTML. Strip tags + decode the few common entities
// so user-authored rich header/footer at least appears as plain text.
function stripHtml(s: string): string {
  if (!s) return ''
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

interface OrgSettings {
  orgName: string
  orgAddress: string
  orgPhone: string
  orgEmail: string
  headerHtml: string
  footerHtml: string
  invoiceHeaderHe: string
  invoiceFooterHe: string
  logoDataUrl: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Statement document
// ─────────────────────────────────────────────────────────────────────────────

const stmtStyles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    fontFamily: 'NotoHebrew',
    color: '#1f2937',
    direction: 'rtl',
  },
  headerBar: {
    flexDirection: 'row-reverse',
    backgroundColor: '#2563eb',
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerRight: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1 },
  logo: { width: 48, height: 48, objectFit: 'contain', marginLeft: 10 },
  orgInfo: { flex: 1, textAlign: 'right' },
  orgName: { fontSize: 14, fontWeight: 700, color: '#ffffff' },
  orgSub: { fontSize: 8, color: '#dbeafe', marginTop: 2 },
  headerLeft: { textAlign: 'left' },
  docTitle: { fontSize: 18, fontWeight: 700, color: '#ffffff', letterSpacing: 1 },
  docDate: { fontSize: 9, color: '#dbeafe', marginTop: 2 },

  headerNote: {
    backgroundColor: '#eff6ff',
    borderRightWidth: 3,
    borderRightColor: '#2563eb',
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 12,
    paddingRight: 12,
    fontSize: 9,
    color: '#1e40af',
    marginBottom: 10,
    textAlign: 'right',
  },

  recipientBlock: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
    textAlign: 'right',
  },
  recipientLabel: { fontSize: 8, color: '#94a3b8' },
  recipientName: { fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 2 },
  recipientAddress: { fontSize: 9, color: '#64748b', marginTop: 2 },

  table: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4 },
  tableHeader: {
    flexDirection: 'row-reverse',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  th: { padding: 6, fontSize: 9, fontWeight: 700, color: '#475569' },
  thPeriod: { width: '22%', textAlign: 'right' },
  thDesc: { width: '38%', textAlign: 'right' },
  thCharge: { width: '20%', textAlign: 'left' },
  thPayment: { width: '20%', textAlign: 'left' },
  tr: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  trEven: { backgroundColor: '#ffffff' },
  trOdd: { backgroundColor: '#f8fafc' },
  td: { padding: 6, fontSize: 9 },
  tdPeriod: { width: '22%', textAlign: 'right', color: '#64748b' },
  tdDesc: { width: '38%', textAlign: 'right', fontWeight: 700, color: '#1e293b' },
  tdCharge: { width: '20%', textAlign: 'left', color: '#dc2626', fontWeight: 700 },
  tdPayment: { width: '20%', textAlign: 'left', color: '#16a34a', fontWeight: 700 },

  totalsBlock: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    marginTop: 10,
  },
  totalsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 12,
    paddingRight: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  totalsRowLast: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 12,
    paddingRight: 12,
  },
  totalsLabel: { fontSize: 10, fontWeight: 700, color: '#475569' },
  totalsCharge: { fontSize: 11, fontWeight: 700, color: '#dc2626' },
  totalsPayment: { fontSize: 11, fontWeight: 700, color: '#16a34a' },

  balanceBlock: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 6,
    marginTop: 10,
  },
  balancePaid: { backgroundColor: '#16a34a' },
  balanceLabel: { fontSize: 13, fontWeight: 700, color: '#ffffff' },
  balanceAmount: { fontSize: 17, fontWeight: 700, color: '#ffffff' },

  empty: {
    padding: 24,
    textAlign: 'center',
    color: '#94a3b8',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 6,
    fontSize: 11,
  },

  footer: {
    marginTop: 14,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
  },
})

export function StatementDocument({
  members,
  settings,
}: {
  members: StatementMemberData[]
  settings: OrgSettings
}) {
  ensureNotoFont()
  const logo = resolveLogoSrc(settings.logoDataUrl)
  const today = new Date().toISOString().split('T')[0]
  const headerText = stripHtml(settings.headerHtml || settings.invoiceHeaderHe || '')
  const footerText = stripHtml(settings.footerHtml || settings.invoiceFooterHe || '')

  return (
    <Document>
      {members.map((m) => {
        const balanceStyle =
          m.balance <= 0 ? [stmtStyles.balanceBlock, stmtStyles.balancePaid] : stmtStyles.balanceBlock
        const balanceText =
          m.balance > 0
            ? fmt(m.balance)
            : m.balance < 0
              ? `זיכוי ${fmt(Math.abs(m.balance))}`
              : '€0.00'
        return (
          <Page size="A4" style={stmtStyles.page} key={m.member.id}>
            <View style={stmtStyles.headerBar}>
              <View style={stmtStyles.headerRight}>
                {logo ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image src={logo} style={stmtStyles.logo} />
                ) : null}
                <View style={stmtStyles.orgInfo}>
                  <Text style={stmtStyles.orgName}>{settings.orgName}</Text>
                  {settings.orgAddress ? (
                    <Text style={stmtStyles.orgSub}>{settings.orgAddress}</Text>
                  ) : null}
                  {settings.orgPhone || settings.orgEmail ? (
                    <Text style={stmtStyles.orgSub}>
                      {[settings.orgPhone, settings.orgEmail].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={stmtStyles.headerLeft}>
                <Text style={stmtStyles.docTitle}>דף חשבון</Text>
                <Text style={stmtStyles.docDate}>{today}</Text>
              </View>
            </View>

            {headerText ? <Text style={stmtStyles.headerNote}>{headerText}</Text> : null}

            <View style={stmtStyles.recipientBlock}>
              <Text style={stmtStyles.recipientLabel}>לכבוד</Text>
              <Text style={stmtStyles.recipientName}>{m.member.name}</Text>
              {m.member.address ? (
                <Text style={stmtStyles.recipientAddress}>{m.member.address}</Text>
              ) : null}
            </View>

            {m.lines.length === 0 ? (
              <Text style={stmtStyles.empty}>אין נתונים לתקופה זו</Text>
            ) : (
              <>
                <View style={stmtStyles.table}>
                  <View style={stmtStyles.tableHeader} fixed>
                    <Text style={[stmtStyles.th, stmtStyles.thPeriod]}>תקופה / שבוע</Text>
                    <Text style={[stmtStyles.th, stmtStyles.thDesc]}>פריט / תיאור</Text>
                    <Text style={[stmtStyles.th, stmtStyles.thCharge]}>חיוב (€)</Text>
                    <Text style={[stmtStyles.th, stmtStyles.thPayment]}>תשלום (€)</Text>
                  </View>
                  {m.lines.map((line, i) => (
                    <View
                      key={i}
                      style={[stmtStyles.tr, i % 2 === 0 ? stmtStyles.trEven : stmtStyles.trOdd]}
                      wrap={false}
                    >
                      <Text style={[stmtStyles.td, stmtStyles.tdPeriod]}>{line.period}</Text>
                      <Text style={[stmtStyles.td, stmtStyles.tdDesc]}>{line.description}</Text>
                      <Text style={[stmtStyles.td, stmtStyles.tdCharge]}>
                        {line.charge > 0 ? fmt(line.charge) : ''}
                      </Text>
                      <Text style={[stmtStyles.td, stmtStyles.tdPayment]}>
                        {line.payment > 0 ? fmt(line.payment) : ''}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={stmtStyles.totalsBlock} wrap={false}>
                  <View style={stmtStyles.totalsRow}>
                    <Text style={stmtStyles.totalsLabel}>סה&quot;כ חיובים</Text>
                    <Text style={stmtStyles.totalsCharge}>{fmt(m.totalCharged)}</Text>
                  </View>
                  <View style={stmtStyles.totalsRowLast}>
                    <Text style={stmtStyles.totalsLabel}>סה&quot;כ תשלומים</Text>
                    <Text style={stmtStyles.totalsPayment}>{fmt(m.totalPaid)}</Text>
                  </View>
                </View>

                <View style={balanceStyle} wrap={false}>
                  <Text style={stmtStyles.balanceLabel}>יתרת חוב</Text>
                  <Text style={stmtStyles.balanceAmount}>{balanceText}</Text>
                </View>
              </>
            )}

            {footerText ? <Text style={stmtStyles.footer}>{footerText}</Text> : null}
          </Page>
        )
      })}
    </Document>
  )
}

export async function renderStatementPdf(
  members: StatementMemberData[],
  settings: OrgSettings,
): Promise<Buffer> {
  const instance = pdf(<StatementDocument members={members} settings={settings} />)
  const stream = await instance.toBuffer()
  return await streamToBuffer(stream as unknown as NodeJS.ReadableStream)
}

// ─────────────────────────────────────────────────────────────────────────────
// Collection list document
// ─────────────────────────────────────────────────────────────────────────────

interface CollectionRow {
  name: string
  owed: number
}

interface CollectionOrg {
  orgName: string
  orgAddress: string
  logoDataUrl: string
}

const colStyles = StyleSheet.create({
  page: {
    padding: 26,
    fontSize: 10,
    fontFamily: 'NotoHebrew',
    color: '#1f2937',
    direction: 'rtl',
  },
  headerBar: {
    flexDirection: 'row-reverse',
    backgroundColor: '#2563eb',
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerRight: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1 },
  logo: { width: 44, height: 44, objectFit: 'contain', marginLeft: 10 },
  orgInfo: { flex: 1, textAlign: 'right' },
  orgName: { fontSize: 14, fontWeight: 700, color: '#ffffff' },
  orgSub: { fontSize: 8, color: '#dbeafe', marginTop: 2 },
  headerLeft: { textAlign: 'left' },
  docTitle: { fontSize: 17, fontWeight: 700, color: '#ffffff', letterSpacing: 1 },
  docDate: { fontSize: 9, color: '#dbeafe', marginTop: 2 },

  table: { borderWidth: 1, borderColor: '#cbd5e1' },
  tableHeader: {
    flexDirection: 'row-reverse',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  th: {
    padding: 8,
    fontSize: 10,
    fontWeight: 700,
    color: '#334155',
    borderLeftWidth: 1,
    borderLeftColor: '#cbd5e1',
  },
  thNum: { width: '6%', textAlign: 'center' },
  thName: { width: '32%', textAlign: 'right' },
  thOwed: { width: '18%', textAlign: 'left' },
  thCollected: { width: '18%', textAlign: 'right' },
  thNotes: { width: '26%', textAlign: 'right', borderLeftWidth: 0 },

  tr: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  trEven: { backgroundColor: '#ffffff' },
  trOdd: { backgroundColor: '#f8fafc' },
  td: {
    padding: 7,
    fontSize: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#cbd5e1',
    minHeight: 22,
  },
  tdNum: { width: '6%', textAlign: 'center', color: '#64748b' },
  tdName: { width: '32%', textAlign: 'right', fontWeight: 700, color: '#0f172a' },
  tdOwed: { width: '18%', textAlign: 'left', color: '#dc2626', fontWeight: 700 },
  tdCollected: { width: '18%' },
  tdNotes: { width: '26%', borderLeftWidth: 0 },

  tfoot: {
    flexDirection: 'row-reverse',
    backgroundColor: '#1e40af',
  },
  tfootLabel: {
    width: '38%',
    padding: 9,
    fontSize: 11,
    fontWeight: 700,
    color: '#ffffff',
    textAlign: 'right',
  },
  tfootAmount: {
    width: '18%',
    padding: 9,
    fontSize: 11,
    fontWeight: 700,
    color: '#ffffff',
    textAlign: 'left',
  },
  tfootBlank: { width: '44%', padding: 9 },

  empty: {
    padding: 32,
    textAlign: 'center',
    color: '#94a3b8',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 6,
    fontSize: 12,
  },

  summary: {
    marginTop: 8,
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
  },
})

export function CollectionDocument({
  rows,
  totalOwed,
  org,
}: {
  rows: CollectionRow[]
  totalOwed: number
  org: CollectionOrg
}) {
  ensureNotoFont()
  const logo = resolveLogoSrc(org.logoDataUrl)
  const today = new Date().toISOString().split('T')[0]

  return (
    <Document>
      <Page size="A4" style={colStyles.page}>
        <View style={colStyles.headerBar} fixed>
          <View style={colStyles.headerRight}>
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logo} style={colStyles.logo} />
            ) : null}
            <View style={colStyles.orgInfo}>
              <Text style={colStyles.orgName}>{org.orgName}</Text>
              {org.orgAddress ? <Text style={colStyles.orgSub}>{org.orgAddress}</Text> : null}
            </View>
          </View>
          <View style={colStyles.headerLeft}>
            <Text style={colStyles.docTitle}>רשימת גבייה</Text>
            <Text style={colStyles.docDate}>{today}</Text>
          </View>
        </View>

        {rows.length === 0 ? (
          <Text style={colStyles.empty}>אין חברים עם יתרת חוב</Text>
        ) : (
          <>
            <View style={colStyles.table}>
              <View style={colStyles.tableHeader} fixed>
                <Text style={[colStyles.th, colStyles.thNum]}>#</Text>
                <Text style={[colStyles.th, colStyles.thName]}>שם</Text>
                <Text style={[colStyles.th, colStyles.thOwed]}>חוב (€)</Text>
                <Text style={[colStyles.th, colStyles.thCollected]}>סכום שנגבה</Text>
                <Text style={[colStyles.th, colStyles.thNotes]}>הערות</Text>
              </View>
              {rows.map((r, i) => (
                <View
                  key={i}
                  style={[colStyles.tr, i % 2 === 0 ? colStyles.trEven : colStyles.trOdd]}
                  wrap={false}
                >
                  <Text style={[colStyles.td, colStyles.tdNum]}>{i + 1}</Text>
                  <Text style={[colStyles.td, colStyles.tdName]}>{r.name}</Text>
                  <Text style={[colStyles.td, colStyles.tdOwed]}>{fmt(r.owed)}</Text>
                  <Text style={[colStyles.td, colStyles.tdCollected]}> </Text>
                  <Text style={[colStyles.td, colStyles.tdNotes]}> </Text>
                </View>
              ))}
              <View style={colStyles.tfoot} wrap={false}>
                <Text style={colStyles.tfootLabel}>
                  סה&quot;כ חוב ({rows.length} חברים)
                </Text>
                <Text style={colStyles.tfootAmount}>{fmt(totalOwed)}</Text>
                <Text style={colStyles.tfootBlank}> </Text>
              </View>
            </View>
            <Text style={colStyles.summary}>הופק בתאריך {today}</Text>
          </>
        )}
      </Page>
    </Document>
  )
}

export async function renderCollectionPdf(
  rows: CollectionRow[],
  totalOwed: number,
  org: CollectionOrg,
): Promise<Buffer> {
  const instance = pdf(<CollectionDocument rows={rows} totalOwed={totalOwed} org={org} />)
  const stream = await instance.toBuffer()
  return await streamToBuffer(stream as unknown as NodeJS.ReadableStream)
}

// ─────────────────────────────────────────────────────────────────────────────

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (c: Buffer) => chunks.push(Buffer.from(c)))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}
