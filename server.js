import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import serverDefault from './dist/server/server.js';

const app = new Hono();

// API routes — handled FIRST by the SSR/API server bundle
// This prevents static middleware from intercepting /api/* requests
app.all('/api/*', async (c) => {
  return await serverDefault.fetch(c.req.raw, process.env, {});
});

// Serve static assets (JS, CSS, images) from dist/client
app.use('/assets/*', serveStatic({ root: './dist/client' }));
app.use('/manifest.json', serveStatic({ root: './dist/client' }));
app.use('/sw.js', serveStatic({ root: './dist/client' }));
app.use('/favicon*', serveStatic({ root: './dist/client' }));

// All other routes (pages) → SSR handler
app.all('*', async (c) => {
  return await serverDefault.fetch(c.req.raw, process.env, {});
});

const port = process.env.PORT || 3000;
console.log(`Starting MP Repair server on port ${port}...`);

serve({
  fetch: app.fetch,
  port: Number(port),
});
