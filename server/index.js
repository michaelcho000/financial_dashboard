import express from 'express';
import cors from 'cors';
import { prisma, DEFAULT_STATE_ID, APP_STATE_ID } from './prismaClient.js';
import { logger } from './logger.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  logger.info('incoming request', { method: req.method, url: req.originalUrl });
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info('completed request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs,
    });
  });
  next();
});

app.get('/api/standalone-costing', async (_req, res, next) => {
  try {
    const record = await prisma.standaloneCostingState.findUnique({
      where: { id: DEFAULT_STATE_ID },
    });
    if (!record) {
      return res.json({ state: null, version: null, updatedAt: null });
    }
    let parsedState = null;
    try {
      parsedState = JSON.parse(record.state);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('failed to parse stored state', { message });
      return res.status(500).json({ message: 'Stored state is invalid JSON' });
    }
    return res.json({ state: parsedState, version: record.version, updatedAt: record.updatedAt });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/standalone-costing', async (req, res, next) => {
  try {
    const { state, version } = req.body ?? {};
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ message: 'state payload is required' });
    }

    const resolvedVersion = typeof version === 'number' ? version : 1;
    let stateString = '';
    try {
      stateString = JSON.stringify(state);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('failed to serialize state', { message });
      return res.status(400).json({ message: 'state payload is not serializable' });
    }

    const result = await prisma.standaloneCostingState.upsert({
      where: { id: DEFAULT_STATE_ID },
      update: { state: stateString, version: resolvedVersion },
      create: { id: DEFAULT_STATE_ID, state: stateString, version: resolvedVersion },
    });

    logger.info('standalone costing state persisted', { version: result.version });

    return res.status(200).json({ state, version: result.version, updatedAt: result.updatedAt });
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/standalone-costing', async (_req, res, next) => {
  try {
    await prisma.standaloneCostingState
      .delete({ where: { id: DEFAULT_STATE_ID } })
      .catch(error => {
        if (error && typeof error === 'object' && error.code === 'P2025') {
          return null;
        }
        throw error;
      });
    logger.info('standalone costing state cleared');
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

app.get('/api/app-state', async (_req, res, next) => {
  try {
    const record = await prisma.appState.findUnique({ where: { id: APP_STATE_ID } });
    if (!record) {
      return res.json({ data: null, version: null, updatedAt: null });
    }
    let parsed = null;
    try {
      parsed = JSON.parse(record.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('failed to parse app state', { message });
      return res.status(500).json({ message: 'Stored app state is invalid' });
    }
    return res.json({ data: parsed, version: record.version, updatedAt: record.updatedAt });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/app-state', async (req, res, next) => {
  try {
    const { data, version } = req.body ?? {};
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ message: 'data payload is required' });
    }

    let serialized = '';
    try {
      serialized = JSON.stringify(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('failed to serialize app state', { message });
      return res.status(400).json({ message: 'data payload is not serializable' });
    }

    const resolvedVersion = typeof version === 'number' ? version : 1;

    const result = await prisma.appState.upsert({
      where: { id: APP_STATE_ID },
      update: { data: serialized, version: resolvedVersion },
      create: { id: APP_STATE_ID, data: serialized, version: resolvedVersion },
    });

    logger.info('app state persisted', { version: result.version });

    return res.status(200).json({ data, version: result.version, updatedAt: result.updatedAt });
  } catch (error) {
    return next(error);
  }
});

app.use((err, _req, res, _next) => {
  logger.error('request failed', { message: err.message });
  return res.status(500).json({ message: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  logger.info(`Standalone costing API server listening on port ${PORT}`);
});

const gracefulShutdown = async () => {
  logger.info('shutting down server');
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
