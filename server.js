import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fetch from 'node-fetch';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import {
    executePython,
    executeJava,
    executeCpp,
    executeJavaScript,
    installPythonPackage,
    checkEnvironment,
} from './codeExecutor.js';
import {
    zipFiles,
    unzipFile,
    listZipContents,
} from './fileOperations.js';

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

// Logging middleware with error handling
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Request timeout middleware
app.use((req, res, next) => {
  // Set timeout for all requests (5 minutes)
  req.setTimeout(300000);
  res.setTimeout(300000);
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

// Helper function to upload to Catbox.moe with enhanced error handling
async function uploadToCatbox(buffer, filename) {
  try {
    // Validate inputs
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty file buffer provided');
    }

    if (!filename || filename.trim().length === 0) {
      throw new Error('Invalid filename provided');
    }

    // Check file size (200MB limit)
    const maxSize = 200 * 1024 * 1024;
    if (buffer.length > maxSize) {
      throw new Error('File size exceeds 200MB limit');
    }

    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', buffer, filename);

    // Add timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout

    let response;
    try {
      response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Catbox upload timeout - operation took too long');
      }
      throw new Error(`Network error during Catbox upload: ${fetchError.message}`);
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Catbox upload failed with status ${response.status}: ${response.statusText}`);
    }

    const url = await response.text();

    if (!url || url.includes('error') || (!url.startsWith('http') && !url.startsWith('https'))) {
      throw new Error('Invalid response from Catbox - upload may have failed');
    }

    return url.trim();
  } catch (error) {
    console.error('Catbox upload error:', error);
    // Log error without sensitive data
    console.log('Catbox error type:', error?.constructor?.name || 'Unknown');
    throw error;
  }
}

// Upload file endpoint with enhanced validation
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided',
        code: 'NO_FILE'
      });
    }

    // Additional validation
    if (!req.file.originalname || req.file.originalname.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename',
        code: 'INVALID_FILENAME'
      });
    }

    if (req.file.size === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot upload empty file',
        code: 'EMPTY_FILE'
      });
    }

    console.log(`Uploading file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Upload to Catbox.moe with retry logic
    let url;
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        url = await uploadToCatbox(req.file.buffer, req.file.originalname);
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error;
        console.log(`Upload attempt ${attempt} failed:`, error.message);

        if (attempt < 3) {
          // Wait before retry (exponential backoff)
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!url) {
      throw lastError;
    }

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
    // Log error without sensitive data
    console.log('Upload error type:', error?.constructor?.name || 'Unknown');

    res.status(500).json({
      success: false,
      error: error.message || 'Upload failed',
      code: 'UPLOAD_FAILED'
    });
  }
});

// Upload from URL endpoint with enhanced validation and error handling
app.post('/api/upload-url', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'No URL provided',
        code: 'NO_URL'
      });
    }

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
        code: 'INVALID_URL'
      });
    }

    // Validate protocol
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({
        success: false,
        error: 'Only HTTP and HTTPS URLs are supported',
        code: 'UNSUPPORTED_PROTOCOL'
      });
    }

    console.log(`Downloading file from URL: ${url}`);

    // Fetch file from URL with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Cloud-Edge-OS/1.0'
        }
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Download timeout - URL took too long to respond');
      }
      throw new Error(`Failed to fetch URL: ${fetchError.message}`);
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Check file size
    const maxSize = 200 * 1024 * 1024; // 200MB
    if (buffer.length > maxSize) {
      throw new Error('Downloaded file exceeds 200MB limit');
    }

    if (buffer.length === 0) {
      throw new Error('Downloaded file is empty');
    }

    // Extract filename from URL or headers
    const urlPath = parsedUrl.pathname;
    let filename = urlPath.split('/').pop() || 'file';

    // Try to get filename from content-disposition header
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '');
      }
    }

    console.log(`Downloaded ${buffer.length} bytes, uploading to Catbox...`);

    // Upload to Catbox.moe with retry logic
    let catboxUrl;
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        catboxUrl = await uploadToCatbox(buffer, filename);
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error;
        console.log(`URL upload attempt ${attempt} failed:`, error.message);

        if (attempt < 3) {
          // Wait before retry (exponential backoff)
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!catboxUrl) {
      throw lastError;
    }

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
    // Log error without sensitive data
    console.log('URL upload error type:', error?.constructor?.name || 'Unknown');

    res.status(500).json({
      success: false,
      error: error.message || 'Upload failed',
      code: 'URL_UPLOAD_FAILED'
    });
  }
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  // Log error without sensitive data
  console.log('Error type:', err?.constructor?.name || 'Unknown');
  console.log('Error code:', err?.code || 'Unknown');

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'File size exceeds 200MB limit',
        code: 'FILE_TOO_LARGE'
      });
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field',
        code: 'INVALID_FILE_FIELD'
      });
    }
  }

  // Handle timeout errors
  if (err.code === 'ECONNRESET' || err.message?.includes('timeout')) {
    return res.status(408).json({
      success: false,
      error: 'Request timeout - operation took too long',
      code: 'REQUEST_TIMEOUT'
    });
  }

  // Handle network errors
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE'
    });
  }

  // Handle Catbox-specific errors
  if (err.message?.includes('Catbox')) {
    return res.status(502).json({
      success: false,
      error: 'External service error - please try again later',
      code: 'EXTERNAL_SERVICE_ERROR'
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

// Code Execution Endpoints

// Unified code execution endpoint
app.post('/api/execute', async (req, res) => {
    try {
        const { code, language, input } = req.body;
        
        if (!code) {
            return res.status(400).json({ success: false, error: 'No code provided' });
        }

        if (!language) {
            return res.status(400).json({ success: false, error: 'No language specified' });
        }

        let result;
        
        switch (language.toLowerCase()) {
            case 'python':
            case 'py':
                result = await executePython(code, input);
                break;
            
            case 'javascript':
            case 'js':
                result = await executeJavaScript(code, input);
                break;
            
            case 'java':
                const className = code.match(/class\s+(\w+)/)?.[1] || 'Main';
                result = await executeJava(code, className, input);
                break;
            
            case 'c':
            case 'cpp':
            case 'c++':
                result = await executeCpp(code, language === 'c' ? 'c' : 'cpp', input);
                break;
            
            default:
                return res.status(400).json({
                    success: false,
                    error: `Unsupported language: ${language}`
                });
        }
        
        res.json(result);
    } catch (error) {
        console.error('Code execution error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check environment
app.get('/api/code/environment', async (req, res) => {
    try {
        const environment = await checkEnvironment();
        res.json({ success: true, environment });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Execute Python code
app.post('/api/code/execute/python', async (req, res) => {
    try {
        const { code, input } = req.body;
        
        if (!code) {
            return res.status(400).json({ success: false, error: 'No code provided' });
        }

        const result = await executePython(code, input);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Execute Java code
app.post('/api/code/execute/java', async (req, res) => {
    try {
        const { code, className, input } = req.body;
        
        if (!code) {
            return res.status(400).json({ success: false, error: 'No code provided' });
        }

        const result = await executeJava(code, className || 'Main', input);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Execute C/C++ code
app.post('/api/code/execute/cpp', async (req, res) => {
    try {
        const { code, language, input } = req.body;
        
        if (!code) {
            return res.status(400).json({ success: false, error: 'No code provided' });
        }

        const result = await executeCpp(code, language || 'cpp', input);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Execute JavaScript code
app.post('/api/code/execute/javascript', async (req, res) => {
    try {
        const { code, input } = req.body;
        
        if (!code) {
            return res.status(400).json({ success: false, error: 'No code provided' });
        }

        const result = await executeJavaScript(code, input);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Install Python package
app.post('/api/code/install/python', async (req, res) => {
    try {
        const { packageName } = req.body;
        
        if (!packageName) {
            return res.status(400).json({ success: false, error: 'No package name provided' });
        }

        const result = await installPythonPackage(packageName);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// File Operations Endpoints

// Create zip archive
app.post('/api/files/zip', async (req, res) => {
    try {
        const { files, archiveName } = req.body;
        
        if (!files || !Array.isArray(files)) {
            return res.status(400).json({ success: false, error: 'No files provided' });
        }

        const result = await zipFiles(files, archiveName || 'archive.zip');
        
        if (result.success) {
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${result.archiveName}"`);
            res.send(result.buffer);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Extract zip archive
app.post('/api/files/unzip', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file provided' });
        }

        const result = await unzipFile(req.file.buffer);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// List zip contents
app.post('/api/files/zip/list', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file provided' });
        }

        const result = await listZipContents(req.file.buffer);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Gmail API endpoints with OAuth

// Gmail OAuth configuration
const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'http://localhost:3001/api/gmail/callback'
);

// Gmail OAuth - Start authentication
app.get('/api/gmail/auth', (req, res) => {
    const { userId, email } = req.query;
    
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/gmail.compose',
        ],
        state: JSON.stringify({ userId, email }),
        prompt: 'consent',
    });
    
    res.redirect(authUrl);
});

// Gmail OAuth - Callback
app.get('/api/gmail/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        const { userId, email } = JSON.parse(state);
        
        const { tokens } = await oauth2Client.getToken(code);
        
        res.send(`
            <html>
                <body>
                    <h2>Authentication Successful!</h2>
                    <p>You can close this window now.</p>
                    <script>
                        window.opener.postMessage({
                            type: 'gmail-auth-success',
                            accessToken: '${tokens.access_token}',
                            refreshToken: '${tokens.refresh_token}',
                            email: '${email}',
                            userId: '${userId}'
                        }, '*');
                        setTimeout(() => window.close(), 1000);
                    </script>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Gmail OAuth callback error:', error);
        res.status(500).send('Authentication failed');
    }
});

// Sync emails from Gmail
app.post('/api/gmail/sync', async (req, res) => {
    try {
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({ success: false, error: 'Access token required' });
        }

        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 50,
            labelIds: ['INBOX'],
        });
        
        const messages = await Promise.all(
            (response.data.messages || []).map(async (msg) => {
                const detail = await gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'full',
                });
                return detail.data;
            })
        );
        
        res.json({ success: true, messages });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send email via Gmail
app.post('/api/gmail/send', async (req, res) => {
    try {
        const { accessToken, from, to, cc, bcc, subject, body } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({ success: false, error: 'Access token required' });
        }

        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        // Build email message
        const messageParts = [
            `From: ${from}`,
            `To: ${to.join(', ')}`,
        ];
        
        if (cc && cc.length > 0) {
            messageParts.push(`Cc: ${cc.join(', ')}`);
        }
        
        if (bcc && bcc.length > 0) {
            messageParts.push(`Bcc: ${bcc.join(', ')}`);
        }
        
        messageParts.push(`Subject: ${subject}`);
        messageParts.push('');
        messageParts.push(body);
        
        const message = messageParts.join('\n');
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Send error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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
