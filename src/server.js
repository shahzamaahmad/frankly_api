
const { getSupabaseAdmin, getSupabaseAuth } = require('./lib/supabase');
const app = require('./app');

const PORT = process.env.PORT || 4000;
getSupabaseAdmin();
getSupabaseAuth();
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
});

process.on('SIGTERM', () => {
  process.exit(0);
});
