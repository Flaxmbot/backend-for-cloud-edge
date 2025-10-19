// Simple test script for upload endpoints
// Run with: node test-upload.js

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

const API_URL = 'http://localhost:3001';

async function testHealthCheck() {
  console.log('\n=== Testing Health Check ===');
  try {
    const response = await fetch(`${API_URL}/api/health`);
    const data = await response.json();
    console.log('✓ Health check passed:', data);
    return true;
  } catch (error) {
    console.error('✗ Health check failed:', error.message);
    return false;
  }
}

async function testFileUpload() {
  console.log('\n=== Testing File Upload ===');
  try {
    // Create a test file
    const testContent = 'Hello, this is a test file for Catbox upload!';
    const testFilePath = './test-file.txt';
    fs.writeFileSync(testFilePath, testContent);

    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath));

    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    
    // Clean up test file
    fs.unlinkSync(testFilePath);

    if (data.success) {
      console.log('✓ File upload passed');
      console.log('  Catbox URL:', data.url);
      console.log('  Filename:', data.filename);
      console.log('  Size:', data.size, 'bytes');
      return true;
    } else {
      console.error('✗ File upload failed:', data.error);
      return false;
    }
  } catch (error) {
    console.error('✗ File upload failed:', error.message);
    return false;
  }
}

async function testUrlUpload() {
  console.log('\n=== Testing URL Upload ===');
  try {
    const response = await fetch(`${API_URL}/api/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://raw.githubusercontent.com/github/gitignore/main/Node.gitignore'
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log('✓ URL upload passed');
      console.log('  Catbox URL:', data.url);
      console.log('  Source URL:', data.sourceUrl);
      return true;
    } else {
      console.error('✗ URL upload failed:', data.error);
      return false;
    }
  } catch (error) {
    console.error('✗ URL upload failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('Starting upload endpoint tests...');
  console.log('Make sure the backend server is running on port 3001');
  
  const healthOk = await testHealthCheck();
  
  if (!healthOk) {
    console.log('\n❌ Server is not running. Start it with: npm start');
    return;
  }

  await testFileUpload();
  await testUrlUpload();
  
  console.log('\n=== Tests Complete ===\n');
}

runTests();
