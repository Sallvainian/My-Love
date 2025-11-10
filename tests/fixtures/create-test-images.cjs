/**
 * Create test images for E2E tests
 * Run with: node tests/fixtures/create-test-images.js
 */

const fs = require('fs');
const path = require('path');

// Create a simple test JPEG image (1x1 red pixel encoded as base64)
const testImageBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';

// Decode base64 to buffer
const testImageBuffer = Buffer.from(testImageBase64, 'base64');

// Write test image
const testImagePath = path.join(__dirname, 'test-image.jpg');
fs.writeFileSync(testImagePath, testImageBuffer);

console.log(`✓ Created test image: ${testImagePath}`);

// Create test text file (for negative testing)
const testTextPath = path.join(__dirname, 'test-file.txt');
fs.writeFileSync(testTextPath, 'This is not an image file');

console.log(`✓ Created test text file: ${testTextPath}`);
