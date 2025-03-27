# Lossless Music Streamer - Frontend

This is the frontend application for the Lossless Music Streamer, a high-quality music streaming service built with React.

## Features

- User authentication (login, register, profile management)
- Music playback with lossless quality
- Playlist management (create, edit, delete)
- Search functionality for songs and playlists
- Library management with liked songs
- Modern and responsive UI with dark theme

## Technologies Used

- React 18
- React Router v6
- Axios for API requests
- TailwindCSS for styling
- Context API for state management

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add the following:
   ```
   REACT_APP_API_URL=http://localhost:5000
   ```

4. Start the development server:
   ```bash
   npm start
   ```

The app will be available at `http://localhost:3000`.

## Project Structure

```
src/
  ├── components/      # Reusable UI components
  ├── contexts/        # React Context providers
  ├── pages/           # Page components
  ├── App.js          # Main app component
  ├── index.js        # Entry point
  └── index.css       # Global styles
```

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App

## Environment Variables

- `REACT_APP_API_URL` - Backend API URL (default: http://localhost:5000)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

MIT License 