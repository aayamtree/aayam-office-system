/**
 * Google Drive Upload Utilities
 * Handles file uploads to Google Drive using OAuth access token
 */

import { logFileUpload } from './activity-logger';

export interface DriveUploadResult {
    success: boolean;
    fileId?: string;
    webViewLink?: string;
    webContentLink?: string;
    error?: string;
}

export interface DriveConnectionStatus {
    connected: boolean;
    hasDriveScope: boolean;
    error?: string;
}

/**
 * Check if user has granted Google Drive upload permission
 */
export function checkDriveConnection(session: any): DriveConnectionStatus {
    if (!session?.accessToken) {
        return {
            connected: false,
            hasDriveScope: false,
            error: 'Not signed in with Google'
        };
    }

    const scopes = session.scope || '';
    const hasDriveScope = scopes.includes('https://www.googleapis.com/auth/drive.file');

    return {
        connected: !!session.accessToken,
        hasDriveScope,
        error: !hasDriveScope ? 'Drive upload permission not granted' : undefined
    };
}

/**
 * Upload file to Google Drive
 */
export async function uploadToDrive(
    accessToken: string,
    file: File,
    folderId?: string,
    fileName?: string,
    context?: { uploadedTo: string; resourceId?: string }
): Promise<DriveUploadResult> {
    try {
        if (!accessToken) {
            return { success: false, error: 'No access token provided' };
        }

        const metadata = {
            name: fileName || file.name,
            mimeType: file.type,
            ...(folderId && { parents: [folderId] })
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: form
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: errorData.error?.message || `Upload failed: ${response.status}`
            };
        }

        const data = await response.json();

        await makeFilePublic(accessToken, data.id);

        const result = {
            success: true,
            fileId: data.id,
            webViewLink: data.webViewLink,
            webContentLink: data.webContentLink
        };

        // Log the upload activity
        if (context) {
            await logFileUpload({
                fileName: fileName || file.name,
                fileSize: file.size,
                fileType: file.type,
                fileUrl: result.webViewLink || getDriveShareLink(data.id),
                uploadedTo: context.uploadedTo,
                resourceId: context.resourceId
            });
        }

        return result;

    } catch (error: any) {
        console.error('Drive upload error:', error);
        return {
            success: false,
            error: error.message || 'Upload failed'
        };
    }
}

/**
 * Find a folder by name inside a parent, or create it
 */
export async function findOrCreateFolder(
    accessToken: string,
    folderName: string,
    parentFolderId?: string
): Promise<{ folderId: string | null; error?: string }> {
    try {
        // Search for existing folder
        let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        if (parentFolderId) {
            query += ` and '${parentFolderId}' in parents`;
        }

        const searchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.files?.length > 0) {
                return { folderId: searchData.files[0].id };
            }
        }

        // Create folder
        const metadata: any = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            ...(parentFolderId && { parents: [parentFolderId] })
        };

        const createRes = await fetch(
            'https://www.googleapis.com/drive/v3/files?fields=id',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metadata)
            }
        );

        if (!createRes.ok) {
            return { folderId: null, error: `Failed to create folder: ${createRes.status}` };
        }

        const data = await createRes.json();
        return { folderId: data.id };

    } catch (error: any) {
        return { folderId: null, error: error.message };
    }
}

/**
 * Get or create the project folder hierarchy:
 *   My Drive > Aayam Projects > {jobNumber} - {projectName}
 * Returns the project subfolder ID for uploading files into
 */
export async function getProjectFolder(
    accessToken: string,
    jobNumber: string,
    projectName: string
): Promise<{ folderId: string | null; error?: string }> {
    // 1. Find or create "Aayam Projects" root folder
    const root = await findOrCreateFolder(accessToken, 'Aayam Projects');
    if (!root.folderId) return root;

    // 2. Find or create project subfolder inside it
    const projectFolderName = `${jobNumber} - ${projectName}`.slice(0, 100);
    const project = await findOrCreateFolder(accessToken, projectFolderName, root.folderId);
    return project;
}

/**
 * Make a Drive file publicly viewable
 */
async function makeFilePublic(accessToken: string, fileId: string): Promise<void> {
    try {
        await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    role: 'reader',
                    type: 'anyone'
                })
            }
        );
    } catch (error) {
        console.warn('Failed to make file public:', error);
    }
}

/**
 * Get direct thumbnail/preview URL for a Drive file
 */
export function getDrivePreviewUrl(fileId: string): string {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
}

/**
 * Get shareable link for a Drive file
 */
export function getDriveShareLink(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Delete a file from Google Drive
 */
export async function deleteFromDrive(
    accessToken: string,
    fileId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                }
            }
        );

        if (!response.ok) {
            return { success: false, error: `Delete failed: ${response.status}` };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
