/**
 * Build a Content-Disposition header that handles non-ASCII (Hebrew)
 * filenames safely. Using a raw `filename="<hebrew>.pdf"` makes some
 * browsers fall back to "download" instead of inline preview, and a few
 * proxies mangle the bytes. We emit both an ASCII-only `filename=` for
 * legacy clients and an RFC 5987 `filename*=UTF-8''…` for everyone else.
 */
export function pdfDisposition(
  filename: string,
  mode: 'inline' | 'attachment' = 'inline',
): string {
  // ASCII fallback: replace non-printable / non-ASCII with underscores so
  // the legacy `filename=` slot is always safe to parse.
  const ascii = filename
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/"/g, "'")
    .slice(0, 200)
  const encoded = encodeURIComponent(filename)
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encoded}`
}
