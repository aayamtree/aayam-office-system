/**
 * Lazy loaders for heavy dependencies
 * This reduces initial bundle size by loading these libraries only when needed
 */

// Lazy load xlsx (900KB) - only when exporting to Excel
export async function loadXLSX() {
  const XLSX = await import('xlsx');
  return XLSX;
}

// Lazy load @react-pdf/renderer (500KB) - only when generating PDFs
export async function loadReactPDF() {
  const pdf = await import('@react-pdf/renderer');
  return pdf;
}
