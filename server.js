import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { crawlPage } from './crawler.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const OUTPUT_DIR = './output';
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Serve output files directly (so they can be downloaded or viewed)
app.use('/output', express.static(OUTPUT_DIR));

// Keep track of recent crawl jobs
const jobs = [];

/**
 * Endpoint to trigger crawl
 * Body: { url: "https://nol.yanolja.com/..." }
 */
app.post('/api/crawl', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required.' });
  }

  const jobId = `job_${Date.now()}`;
  const job = {
    id: jobId,
    url,
    status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    result: null
  };

  jobs.push(job);

  // Return job ID immediately to the caller (non-blocking)
  res.status(202).json({
    message: 'Crawl job started in background',
    jobId,
    statusUrl: `/api/jobs/${jobId}`
  });

  // Run the crawler asynchronously
  (async () => {
    try {
      const result = await crawlPage(url, OUTPUT_DIR);
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.result = {
        markdownUrl: `/output/${path.basename(result.markdownPath)}`,
        jsonUrl: `/output/${path.basename(result.jsonPath)}`,
        data: result.data
      };
      console.log(`[Server] Job ${jobId} completed successfully.`);
    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.error = error.message;
      console.error(`[Server] Job ${jobId} failed:`, error);
    }
  })();
});

/**
 * Get all crawl jobs
 */
app.get('/api/jobs', (req, res) => {
  res.json(jobs);
});

/**
 * Get status of specific job
 */
app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

/**
 * Health check / Status API
 */
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    uptime: process.uptime(),
    activeJobs: jobs.filter(j => j.status === 'running').length,
    completedJobs: jobs.filter(j => j.status === 'completed').length,
    failedJobs: jobs.filter(j => j.status === 'failed').length
  });
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Yanolja Crawler Background Service running!`);
  console.log(`Port: ${PORT}`);
  console.log(`Endpoints available:`);
  console.log(`  POST /api/crawl  - Trigger crawl job`);
  console.log(`  GET  /api/jobs   - List all crawl jobs`);
  console.log(`  GET  /api/status - Service status overview`);
  console.log(`==================================================`);
});
