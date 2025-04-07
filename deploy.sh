#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting deployment process..."

# Build client
echo "📦 Building client..."
cd client
npm install
npm run build

# Build server
echo "📦 Building server..."
cd ../server
npm install

# Create production environment file
echo "🔧 Creating production environment file..."
cat > .env << EOL
PORT=5002
NODE_ENV=production
MONGODB_URI=$MONGODB_URI
SESSION_SECRET=$SESSION_SECRET
CLIENT_URL=$CLIENT_URL
MAX_FILE_SIZE=100000000
UPLOAD_DIR=uploads
EOL

# Create uploads directory if it doesn't exist
mkdir -p uploads

# Start the server
echo "🚀 Starting server..."
npm start

echo "✅ Deployment complete!" 