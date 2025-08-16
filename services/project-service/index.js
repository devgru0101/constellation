const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const winston = require('winston');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.SERVICE_PORT || 8002;

// MongoDB connection
let db;
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/constellation';

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
    new winston.transports.File({ filename: 'project-service.log' })
  ]
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'project-service',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Project routes
app.get('/projects', async (req, res) => {
  try {
    logger.info(`DB status: ${db ? 'connected' : 'null'}`);
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const projects = await db.collection('projects').find({}).toArray();
    logger.info(`Retrieved ${projects.length} projects`);
    
    res.json({ 
      success: true, 
      data: projects, 
      total: projects.length 
    });
  } catch (error) {
    logger.error('Failed to get projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/projects', async (req, res) => {
  try {
    // TODO: Implement project creation
    res.json({ success: true, message: 'Project creation not implemented yet' });
  } catch (error) {
    logger.error('Failed to create project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
const gracefulShutdown = () => {
  logger.info('Shutting down Project Service...');
  server.close(() => {
    logger.info('Project Service stopped');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Initialize MongoDB connection
async function connectToMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URL);
    await client.connect();
    db = client.db();
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    // Don't exit, just log the error and continue without DB
  }
}

// Start server and connect to MongoDB
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Project Service running on port ${PORT}`);
  logger.info(`MongoDB URL: ${MONGODB_URL}`);
  
  // Connect to MongoDB after server starts
  logger.info('Attempting to connect to MongoDB...');
  connectToMongoDB();
});

module.exports = app;