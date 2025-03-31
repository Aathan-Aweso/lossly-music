# Lossless Music Streamer

A Spotify-like web player streaming service that delivers high-quality, lossless audio streaming.

## Features

- Lossless audio quality streaming
- Modern, responsive UI
- User authentication
- Playlist management
- Search functionality
- Real-time playback controls

## Tech Stack

- Frontend: React.js, TailwindCSS
- Backend: Node.js, Express
- Database: MongoDB
- Audio Processing: Web Audio API
- Authentication: JWT

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd client
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   MONGODB_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   PORT=5000
   ```
4. Start the development server:
   ```bash
   npm run dev:full
   ```

## Project Structure

```
├── client/                 # React frontend
├── server/                 # Node.js backend
│   ├── controllers/       # Route controllers
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   └── middleware/       # Custom middleware
└── uploads/              # Music file storage
```

## License

MIT 