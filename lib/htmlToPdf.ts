import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

/**
 * Convert an HTML string to a PDF buffer using headless Chromium.
 * Uses @sparticuz/chromium which is optimized for serverless (Vercel/Lambda).
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  // In production (Vercel), use @sparticuz/chromium bundled binary.
  // Locally, try to find a Chrome/Chromium installation.
  const executablePath = await chromium.executablePath()

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 794, height: 1123 }, // A4 at 96 DPI
    executablePath,
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '16mm', bottom: '12mm', left: '16mm' },
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}
