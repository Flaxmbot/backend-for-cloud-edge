# Cloud Edge OS Backend Server

Backend server for Cloud Edge OS with Catbox.moe file upload integration.

## Features

- 🚀 File upload to Catbox.moe (up to 200MB)
- 🔗 URL-based file upload
- 📊 Health check endpoint
- 🔒 CORS protection
- 📝 Request logging
- ⚡ Fast and lightweight

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 3. Start Server

```bash
# Development mode (auto-restart)
npm run dev

# Production mode
npm start
```

Server runs on `http://localhost:3001`

## API Endpoints

### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "development"
}
```

### Upload File

```http
POST /api/upload
Content-Type: multipart/form-data
```

**Request:**
- Body: FormData with `file` field
- Max size: 200MB

**Response:**
```json
{
  "success": true,
  "url": "https://files.catbox.moe/abc123.jpg",
  "filename": "image.jpg",
  "size": 1024000,
  "mimetype": "image/jpeg"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "File size exceeds 200MB limit"
}
```

### Upload from URL

```http
POST /api/upload-url
Content-Type: application/json
```

**Request:**
```json
{
  "url": "https://example.com/image.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://files.catbox.moe/abc123.jpg",
  "sourceUrl": "https://example.com/image.jpg"
}
```

## Testing

### Test Health Endpoint

```bash
curl http://localhost:3001/api/health
```

### Test File Upload

```bash
curl -X POST http://localhost:3001/api/upload \
  -F "file=@/path/to/file.jpg"
```

### Test URL Upload

```bash
curl -X POST http://localhost:3001/api/upload-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/image.jpg"}'
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:5173` |
| `CATBOX_USER_HASH` | Catbox user hash (optional) | - |

## Error Handling

The server handles various error cases:

### File Upload Errors

- **File too large**: Returns 413 status
- **No file provided**: Returns 400 status
- **Network error**: Returns 502 status
- **Invalid file**: Returns 400 status

### URL Upload Errors

- **Invalid URL**: Returns 400 status
- **URL fetch failed**: Returns 400 status
- **Network error**: Returns 502 status

### CORS Errors

- **Origin not allowed**: Returns 403 status

## Logging

All requests are logged with:
- Timestamp
- HTTP method
- Request path
- Request body (for non-file uploads)

Example log:
```
[2024-01-01T00:00:00.000Z] POST /api/upload
Uploading file: image.jpg (1024000 bytes)
File uploaded successfully: https://files.catbox.moe/abc123.jpg
```

## Security

### CORS Configuration

Configure allowed origins in `.env`:

```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### File Size Limits

- Maximum file size: 200MB
- Enforced by multer middleware
- Double-checked in upload handler

### Input Validation

- File presence validation
- URL format validation
- Protocol validation (HTTP/HTTPS only)
- MIME type validation

## Deployment

### Railway

1. Create new project on [Railway.app](https://railway.app/)
2. Connect GitHub repository
3. Set root directory to `backend`
4. Add environment variables
5. Deploy

### Render

1. Create new Web Service on [Render.com](https://render.com/)
2. Connect GitHub repository
3. Set build command: `cd backend && npm install`
4. Set start command: `cd backend && npm start`
5. Add environment variables
6. Deploy

### Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set buildpack
heroku buildpacks:set heroku/nodejs

# Add environment variables
heroku config:set PORT=3001
heroku config:set NODE_ENV=production
heroku config:set ALLOWED_ORIGINS=https://yourdomain.com

# Deploy
git push heroku main
```

### Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t cloud-edge-backend .
docker run -p 3001:3001 --env-file .env cloud-edge-backend
```

## Dependencies

- **express** (^4.18.2) - Web framework
- **node-catbox** (^1.0.0) - Catbox.moe API client
- **multer** (^1.4.5-lts.1) - File upload middleware
- **cors** (^2.8.5) - CORS middleware
- **dotenv** (^16.3.1) - Environment variables

## Troubleshooting

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3001 | xargs kill -9
```

### Module Not Found

```bash
rm -rf node_modules package-lock.json
npm install
```

### CORS Errors

1. Check `ALLOWED_ORIGINS` includes frontend URL
2. Restart server after changing `.env`
3. Clear browser cache

### Upload Fails

1. Check Catbox.moe is accessible
2. Verify file size < 200MB
3. Check internet connection
4. Review server logs

## Development

### Watch Mode

```bash
npm run dev
```

Uses Node.js `--watch` flag for auto-restart on file changes.

### Debug Mode

```bash
NODE_ENV=development node --inspect server.js
```

Connect debugger to `localhost:9229`

## License

MIT
