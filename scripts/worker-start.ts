import { startDownloadWorker } from '@/lib/worker';

console.log('[Worker] Starting download worker...');

startDownloadWorker()
  .then(() => {
    console.log('[Worker] Worker started successfully and is listening for jobs');
  })
  .catch((error) => {
    console.error('[Worker] Fatal error starting worker:', error);
    process.exit(1);
  });

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Worker] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Worker] SIGINT received, shutting down gracefully...');
  process.exit(0);
});
