/**
 * Base Service Class
 * Common functionality for all microservices
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const winston = require('winston');
require('dotenv').config();

class BaseService {
  constructor(options = {}) {
    this.app = express();
    this.serviceName = options.serviceName || 'unknown-service';
    this.port = options.port || process.env.SERVICE_PORT || 8000;
    this.version = options.version || '1.0.0';
    
    this.setupLogging();
    this.setupMiddleware();
    this.setupHealthCheck();
  }

  setupLogging() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.label({ label: this.serviceName }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ 
          filename: `${this.serviceName}.log`,
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });
  }

  setupMiddleware() {
    // Security
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({ 
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000', 
      credentials: true 
    }));
    
    // Compression
    this.app.use(compression());
    
    // Logging
    this.app.use(morgan('combined', {
      stream: { write: message => this.logger.info(message.trim()) }
    }));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  setupHealthCheck() {
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        service: this.serviceName,
        version: this.version,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
  }

  // Standard error handler
  setupErrorHandler() {
    this.app.use((err, req, res, next) => {
      this.logger.error('Unhandled error:', { 
        error: err.message, 
        stack: err.stack,
        url: req.url,
        method: req.method
      });
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  // Graceful shutdown
  setupGracefulShutdown() {
    const gracefulShutdown = () => {
      this.logger.info(`Shutting down ${this.serviceName}...`);
      this.server.close(() => {
        this.logger.info(`${this.serviceName} stopped`);
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  }

  // Start the service
  start() {
    this.setupErrorHandler();
    this.setupGracefulShutdown();
    
    this.server = this.app.listen(this.port, '0.0.0.0', () => {
      this.logger.info(`${this.serviceName} running on port ${this.port}`);
    });

    return this.server;
  }

  // Add routes
  addRoutes(path, router) {
    this.app.use(path, router);
    this.logger.info(`Routes added: ${path}`);
  }

  // Add middleware
  addMiddleware(middleware) {
    this.app.use(middleware);
  }
}

module.exports = BaseService;