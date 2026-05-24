const http = require('http');
const app = require('./app');
const { connectDb } = require('./config/db');
const { attach: attachRooms } = require('./modules/rooms/ws');
const { PORT, HOST } = require('./config');

async function start() {
  await connectDb();

  const httpServer = http.createServer(app);
  attachRooms(httpServer);

  httpServer.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
    if (HOST === '0.0.0.0') {
      console.log('Accessible on all network interfaces (LAN + Cloudflare Tunnel ready)');
    }
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
