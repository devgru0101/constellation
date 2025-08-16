const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const winston = require('winston');
require('dotenv').config();

const app = express();
const PORT = process.env.SERVICE_PORT || 8001;

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
    new winston.transports.File({ filename: 'claude-service.log' })
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
    service: 'claude-service',
    version: '1.0.0'
  });
});

// Claude AI routes
app.post('/chat', async (req, res) => {
  try {
    res.json({ success: true, message: 'Claude chat not implemented yet' });
  } catch (error) {
    logger.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/generate', async (req, res) => {
  try {
    res.json({ success: true, message: 'Code generation not implemented yet' });
  } catch (error) {
    logger.error('Generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Claude Service running on port ${PORT}`);
});

module.exports = app;