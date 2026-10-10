// Which picture stands for a job on Dispatch / Pack cards.
//   1. jobs.thumbnail_url  — a crop cut from the print-run sheet, or hand-picked
//   2. the job's own first image file (jobs.files)
//   3. nothing → the card shows the product-type icon instead
// PDFs, Google Drive "view" links and invoices are never used: the browser
// cannot draw them inside an <img>.

type JobFile = { url?: string; name?: string; type?: string | null };

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|bmp)$/i;

function isDrawableImage(f: JobFile): boolean {
  const url = f?.url || '';
  if (!url) return false;
  if (/drive\.google\.com/i.test(url)) return false;
  const type = (f.type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  if (type && type !== 'application/octet-stream') return false;
  return IMAGE_EXT.test((f.name || '').trim());
}

export function pickJobThumbnail(job: { thumbnail_url?: string | null; files?: unknown } | null | undefined): string | null {
  if (!job) return null;
  if (job.thumbnail_url) return job.thumbnail_url;
  const files = Array.isArray(job.files) ? (job.files as JobFile[]) : [];
  const img = files.find(isDrawableImage);
  return img?.url || null;
}
