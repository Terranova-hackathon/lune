// Proxies /api to the backend.
// In Docker, compose sets API_URL=http://backend:3001.
// when running `npm start` on your machine (no docker)
// it falls back to the backend published on localhost.

const target = process.env.API_URL || 'http://localhost:3001';

module.exports = {
  '/api': { target, secure: false, changeOrigin: false },
};
