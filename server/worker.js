/**
 * Background worker process for job queue.
 */

const jobQueue = require('./job-queue');
const config = require('./config');

const workerId = process.env.CORTEX_WORKER_ID || `worker-${process.pid}`;
const workerConfig = config.getConfig().queue?.workers || {};
const concurrency = Number(workerConfig.concurrency ?? 1);
const pollIntervalMs = Number(workerConfig.pollIntervalMs ?? 1500);

jobQueue.startWorker({ workerId, concurrency, pollIntervalMs });

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
