import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import serverDefault from './dist/server/server.js';

const app = new Hono();

// Serve static assets from dist/client
app.use('/*', serveStatic({ root: './dist/client' }));

app.get('/test', (c) => c.text('ok'));

// Fallback to the SSR handler
app.all('*', async (c) => {
  return await serverDefault.fetch(c.req.raw, process.env, {});
});

const port = process.env.PORT || 3000;
console.log(`Starting server on port ${port}...`);

serve({
  fetch: app.fetch,
  port: Number(port),
});
