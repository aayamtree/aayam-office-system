// File fingerprinting — SHA-256 of the file's actual bytes.
//
// Why: the Product Library used to happily re-upload, re-scan (paid Claude
// call) and re-import the exact same print sheet, creating duplicate products
// every time. A content hash catches the same file even if it was renamed,
// and is computed in the browser before anything is uploaded, so a repeat
// upload costs nothing.

/** SHA-256 hex digest of a File/Blob, computed in the browser. */
export async function hashFile(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** SHA-256 hex digest of a buffer, for server-side use. */
export async function hashBuffer(buf: ArrayBuffer): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(Buffer.from(buf)).digest('hex');
}

/** Short, human-readable form for logs and UI. */
export function shortHash(hash: string | null | undefined): string {
  return hash ? hash.slice(0, 10) : '';
}
