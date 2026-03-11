import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * Generate a PDF from an HTML element.
 * Captures the element as a canvas image and places it into an A4 PDF.
 * Supports Hebrew RTL text since it renders the HTML as-is.
 */
export async function generatePdfFromElement(element: HTMLElement, filename: string): Promise<Blob> {
  // Capture at high resolution
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const imgWidth = canvas.width
  const imgHeight = canvas.height

  // A4 dimensions in mm
  const a4Width = 210
  const a4Height = 297
  const margin = 10

  const contentWidth = a4Width - 2 * margin
  const contentHeight = a4Height - 2 * margin

  // Scale image to fit A4 width
  const ratio = contentWidth / (imgWidth / 2) // /2 because scale: 2
  const scaledHeight = (imgHeight / 2) * ratio

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  if (scaledHeight <= contentHeight) {
    // Fits on one page
    pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, scaledHeight)
  } else {
    // Multi-page: slice the canvas into page-sized chunks
    const pageCanvasHeight = contentHeight / ratio * 2 // in canvas pixels (scale=2)
    let yOffset = 0
    let pageNum = 0

    while (yOffset < imgHeight) {
      if (pageNum > 0) pdf.addPage()

      const sliceHeight = Math.min(pageCanvasHeight, imgHeight - yOffset)
      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = imgWidth
      sliceCanvas.height = sliceHeight
      const ctx = sliceCanvas.getContext('2d')!
      ctx.drawImage(canvas, 0, yOffset, imgWidth, sliceHeight, 0, 0, imgWidth, sliceHeight)

      const sliceData = sliceCanvas.toDataURL('image/png')
      const sliceScaledHeight = (sliceHeight / 2) * ratio
      pdf.addImage(sliceData, 'PNG', margin, margin, contentWidth, sliceScaledHeight)

      yOffset += sliceHeight
      pageNum++
    }
  }

  return pdf.output('blob')
}

/**
 * Generate a multi-member PDF where each member gets their own page(s).
 * Takes an array of HTML elements (one per member).
 */
export async function generateMultiMemberPdf(elements: HTMLElement[], filename: string): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const a4Width = 210
  const a4Height = 297
  const margin = 10
  const contentWidth = a4Width - 2 * margin
  const contentHeight = a4Height - 2 * margin

  for (let i = 0; i < elements.length; i++) {
    if (i > 0) pdf.addPage()

    const canvas = await html2canvas(elements[i], {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    const imgData = canvas.toDataURL('image/png')
    const imgWidth = canvas.width
    const imgHeight = canvas.height
    const ratio = contentWidth / (imgWidth / 2)
    const scaledHeight = (imgHeight / 2) * ratio

    if (scaledHeight <= contentHeight) {
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, scaledHeight)
    } else {
      const pageCanvasHeight = contentHeight / ratio * 2
      let yOffset = 0
      let first = true

      while (yOffset < imgHeight) {
        if (!first) pdf.addPage()
        first = false

        const sliceHeight = Math.min(pageCanvasHeight, imgHeight - yOffset)
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = imgWidth
        sliceCanvas.height = sliceHeight
        const ctx = sliceCanvas.getContext('2d')!
        ctx.drawImage(canvas, 0, yOffset, imgWidth, sliceHeight, 0, 0, imgWidth, sliceHeight)

        const sliceData = sliceCanvas.toDataURL('image/png')
        const sliceScaledHeight = (sliceHeight / 2) * ratio
        pdf.addImage(sliceData, 'PNG', margin, margin, contentWidth, sliceScaledHeight)

        yOffset += sliceHeight
      }
    }
  }

  return pdf.output('blob')
}

/**
 * Trigger a direct download of a Blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Create a blob URL for PDF preview in an iframe.
 */
export function createPdfPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}
