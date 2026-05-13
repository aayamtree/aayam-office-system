/**
 * Google Drive Integration Utilities
 * Handles Drive link parsing, file verification, and metadata fetching
 */

const DRIVE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;

export interface DriveFileInfo {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    thumbnailLink?: string;
    modifiedTime?: string;
}

export interface DriveVerificationResult {
    success: boolean;
    file?: DriveFileInfo;
    error?: string;
}

/**
 * Extract Google Drive file ID from various link formats
 * Supports:
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://drive.google.com/folders/FOLDER_ID
 */
export function extractFileIdFromLink(link: string): string | null {
    if (!link) return null;

    const patterns = [
        /\/d\/([a-zA-Z0-9_-]+)/,           // /d/FILE_ID
        /\/folders\/([a-zA-Z0-9_-]+)/,     // /folders/FOLDER_ID
        /[?&]id=([a-zA-Z0-9_-]+)/,         // id=FILE_ID
    ];

    for (const pattern of patterns) {
        const match = link.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

/**
 * Verify if a Google Drive file exists and is accessible
 * Returns file metadata if successful
 */
export async function verifyDriveFile(fileId: string): Promise<DriveVerificationResult> {
    if (!fileId) {
        return { success: false, error: 'No file ID provided' };
    }

    if (!DRIVE_API_KEY) {
        console.warn('Google Drive API key not configured');
        return { success: false, error: 'API key not configured' };
    }

    try {
        const fields = 'id,name,mimeType,modifiedTime,size,thumbnailLink';
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?key=${DRIVE_API_KEY}&fields=${fields}`;

        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                return { success: false, error: 'File not found' };
            } else if (response.status === 403) {
                return { success: false, error: 'Access denied - check file sharing settings' };
            }
            return { success: false, error: `API error: ${response.status}` };
        }

        const data = await response.json();

        return {
            success: true,
            file: {
                id: data.id,
                name: data.name || 'Unnamed file',
                mimeType: data.mimeType,
                size: data.size,
                thumbnailLink: data.thumbnailLink,
                modifiedTime: data.modifiedTime
            }
        };
    } catch (error: any) {
        console.error('Drive verification error:', error);
        return {
            success: false,
            error: error.message || 'Failed to verify file'
        };
    }
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes?: string): string {
    if (!bytes) return 'Unknown size';

    const size = parseInt(bytes);
    if (isNaN(size)) return 'Unknown size';

    if (size === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(size) / Math.log(k));

    return Math.round((size / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file type icon emoji based on MIME type
 */
export function getFileIcon(mimeType: string): string {
    if (mimeType.includes('folder')) return '📁';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('video')) return '🎥';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('document')) return '📝';
    if (mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('presentation')) return '📽️';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return '📦';
    return '📎';
}
