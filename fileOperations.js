import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const TEMP_DIR = path.join(os.tmpdir(), 'cloudedge-files');

// Ensure temp directory exists
async function ensureTempDir() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create temp directory:', error);
    }
}

ensureTempDir();

/**
 * Create a zip archive from files
 */
export async function zipFiles(files, archiveName = 'archive.zip') {
    try {
        const zip = new AdmZip();
        
        for (const file of files) {
            if (file.isDirectory) {
                zip.addFile(`${file.name}/`, Buffer.alloc(0));
            } else {
                const content = Buffer.from(file.content || '', 'utf8');
                zip.addFile(file.name, content);
            }
        }
        
        const buffer = zip.toBuffer();
        
        return {
            success: true,
            buffer,
            size: buffer.length,
            archiveName,
        };
    } catch (error) {
        console.error('Zip error:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Extract files from a zip archive
 */
export async function unzipFile(buffer) {
    try {
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        
        const files = entries.map(entry => ({
            name: entry.entryName,
            content: entry.isDirectory ? null : entry.getData().toString('utf8'),
            isDirectory: entry.isDirectory,
            size: entry.header.size,
            compressedSize: entry.header.compressedSize,
            date: entry.header.time,
        }));
        
        return {
            success: true,
            files,
            count: files.length,
        };
    } catch (error) {
        console.error('Unzip error:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * List contents of a zip file without extracting
 */
export async function listZipContents(buffer) {
    try {
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        
        const files = entries.map(entry => ({
            name: entry.entryName,
            isDirectory: entry.isDirectory,
            size: entry.header.size,
            compressedSize: entry.header.compressedSize,
            compressionRatio: entry.header.size > 0 
                ? ((1 - entry.header.compressedSize / entry.header.size) * 100).toFixed(1) + '%'
                : '0%',
            date: entry.header.time.toISOString(),
        }));
        
        return {
            success: true,
            files,
            count: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            totalCompressed: files.reduce((sum, f) => sum + f.compressedSize, 0),
        };
    } catch (error) {
        console.error('List zip error:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Create a tar.gz archive
 */
export async function createTarGz(files, archiveName = 'archive.tar.gz') {
    // Note: This would require 'tar' package
    // For now, we'll use zip as the primary compression method
    return zipFiles(files, archiveName.replace('.tar.gz', '.zip'));
}

/**
 * Extract tar.gz archive
 */
export async function extractTarGz(buffer) {
    // Note: This would require 'tar' package
    // For now, we'll treat it as zip
    return unzipFile(buffer);
}
