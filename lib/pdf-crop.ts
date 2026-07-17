// Client-side PDF/image rendering + region cropping, used by the job-sheet
// import to cut each detected job out of the sheet into its own thumbnail.
// pdf.js is loaded on demand from cdnjs (allowed CDN); rendering a local File
// never taints the canvas, so crops export cleanly.

const PDFJS_VERSION = '3.11.174';
const PDFJS_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

let pdfjsPromise: Promise<any> | null = null;

function loadPdfjs(): Promise<any> {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return resolve((window as any).pdfjsLib);
    }
    const s = document.createElement('script');
    s.src = PDFJS_SRC;
    s.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) return reject(new Error('pdf.js failed to load'));
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      resolve(lib);
    };
    s.onerror = () => reject(new Error('Could not load pdf.js'));
    document.head.appendChild(s);
  });
  return pdfjsPromise;
}

export interface BBox { page?: number; x: number; y: number; w: number; h: number }

/** A per-page rendered canvas cache so we render each page once. */
export class SheetRenderer {
  private canvases: Record<number, HTMLCanvasElement> = {};
  private pdf: any = null;
  private image: HTMLImageElement | null = null;
  private isPdf: boolean;

  constructor(private file: File) {
    this.isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }

  async init() {
    if (this.isPdf) {
      const pdfjsLib = await loadPdfjs();
      const buf = await this.file.arrayBuffer();
      this.pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    } else {
      this.image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not load image'));
        img.src = URL.createObjectURL(this.file);
      });
    }
  }

  private async pageCanvas(page1: number): Promise<HTMLCanvasElement> {
    if (this.canvases[page1]) return this.canvases[page1];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    if (this.isPdf) {
      const page = await this.pdf.getPage(page1);
      const unscaled = page.getViewport({ scale: 1 });
      const target = 2200; // long side px for crisp crops
      const scale = target / Math.max(unscaled.width, unscaled.height);
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
    } else {
      canvas.width = this.image!.naturalWidth;
      canvas.height = this.image!.naturalHeight;
      ctx.drawImage(this.image!, 0, 0);
    }
    this.canvases[page1] = canvas;
    return canvas;
  }

  /** Crop a normalized bbox (0-1) from its page → JPEG File. Returns null on bad box. */
  async crop(bbox: BBox, name: string): Promise<File | null> {
    try {
      const page1 = Math.max(1, bbox.page || 1);
      const src = await this.pageCanvas(page1);
      // clamp + small padding
      const pad = 0.01;
      let x = Math.max(0, (bbox.x ?? 0) - pad);
      let y = Math.max(0, (bbox.y ?? 0) - pad);
      let w = Math.min(1 - x, (bbox.w ?? 0) + pad * 2);
      let h = Math.min(1 - y, (bbox.h ?? 0) + pad * 2);
      if (w <= 0.02 || h <= 0.02) return null; // too small to be real
      const sx = Math.round(x * src.width);
      const sy = Math.round(y * src.height);
      const sw = Math.round(w * src.width);
      const sh = Math.round(h * src.height);
      const out = document.createElement('canvas');
      out.width = sw;
      out.height = sh;
      out.getContext('2d')!.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob: Blob | null = await new Promise((res) => out.toBlob(res, 'image/jpeg', 0.85));
      if (!blob) return null;
      return new File([blob], `${name.replace(/[^\w-]+/g, '_').slice(0, 60)}_crop.jpg`, { type: 'image/jpeg' });
    } catch {
      return null;
    }
  }
}
