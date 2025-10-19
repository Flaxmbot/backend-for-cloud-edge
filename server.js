import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fetch from 'node-fetch';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads (200MB limit)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 200 * 1024 * 1024, // 200MB
    },
});

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
    });
});

// Helper function to upload to Catbox.moe
async function uploadToCatbox(buffer, filename) {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', buffer, filename);

    const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Catbox upload failed: ${response.statusText}`);
    }

    const url = await response.text();

    if (!url || url.includes('error') || !url.startsWith('http')) {
        throw new Error('Invalid response from Catbox');
    }

    return url.trim();
}

// Upload file endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file provided',
            });
        }

        console.log(`Uploading file: ${req.file.originalname} (${req.file.size} bytes)`);

        // Upload to Catbox.moe
        const url = await uploadToCatbox(req.file.buffer, req.file.originalname);

        console.log(`File uploaded successfully: ${url}`);

        res.json({
            success: true,
            url: url,
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Upload failed',
        });
    }
});

// Upload from URL endpoint
app.post('/api/upload-url', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'No URL provided',
            });
        }

        // Validate URL
        try {
            new URL(url);
        } catch {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL format',
            });
        }

        console.log(`Downloading file from URL: ${url}`);

        // Fetch file from URL
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        const buffer = await response.buffer();
        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        // Extract filename from URL
        const urlPath = new URL(url).pathname;
        const filename = urlPath.split('/').pop() || 'file';

        console.log(`Downloaded ${buffer.length} bytes, uploading to Catbox...`);

        // Upload to Catbox.moe
        const catboxUrl = await uploadToCatbox(buffer, filename);

        console.log(`File uploaded successfully: ${catboxUrl}`);

        res.json({
            success: true,
            url: catboxUrl,
            sourceUrl: url,
            filename: filename,
            size: buffer.length,
            mimetype: contentType,
        });
    } catch (error) {
        console.error('URL upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Upload failed',
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                success: false,
                error: 'File size exceeds 200MB limit',
            });
        }
    }

    res.status(500).json({
        success: false,
        error: 'Internal server error',
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Cloud Edge OS Backend Server`);
    console.log(`📡 Running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Ready to accept requests`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});
