const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const winston = require('winston');
require('dotenv').config();

const app = express();
const PORT = process.env.SERVICE_PORT || 8003;

// Logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'workspace-service.log' })
  ]
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'workspace-service',
    version: '1.0.0'
  });
});

// Workspace routes
app.post('/workspace', async (req, res) => {
  try {
    res.json({ success: true, message: 'Workspace creation not implemented yet' });
  } catch (error) {
    logger.error('Workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/container', async (req, res) => {
  try {
    res.json({ success: true, message: 'Container management not implemented yet' });
  } catch (error) {
    logger.error('Container error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Workspace Service running on port ${PORT}`);
});

module.exports = app;