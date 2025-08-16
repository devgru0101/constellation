const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const promMiddleware = require('prometheus-api-metrics');
const winston = require('winston');
require('dotenv').config();

const app = express();
const PORT = process.env.SERVICE_PORT || 8000;

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
    new winston.transports.File({ filename: 'api-gateway.log' })
  ]
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Prometheus metrics
app.use(promMiddleware());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'api-gateway',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Service discovery and routing
const services = {
  projects: {
    target: process.env.PROJECT_SERVICE_URL || 'http://project-service:8002',
    pathRewrite: { '^/api/projects': '' }
  },
  claude: {
    target: process.env.CLAUDE_SERVICE_URL || 'http://claude-service:8001',
    pathRewrite: { '^/api/(chat|generate)': '/$1' }
  },
  workspace: {
    target: process.env.WORKSPACE_SERVICE_URL || 'http://workspace-service:8003',
    pathRewrite: { '^/api/(workspace|container)': '/$1' }
  }
};

// Proxy configuration
const createServiceProxy = (serviceConfig) => {
  return createProxyMiddleware({
    target: serviceConfig.target,
    changeOrigin: true,
    pathRewrite: serviceConfig.pathRewrite,
    onError: (err, req, res) => {
      logger.error('Proxy error:', { error: err.message, url: req.url });
      res.status(502).json({ error: 'Service temporarily unavailable' });
    },
    onProxyReq: (proxyReq, req, res) => {
      logger.debug('Proxying request:', { method: req.method, url: req.url, target: serviceConfig.target });
    }
  });
};

// Route to services
app.use('/api/projects', createServiceProxy(services.projects));
app.use('/api/chat', createServiceProxy(services.claude));
app.use('/api/generate', createServiceProxy(services.claude));
app.use('/api/workspace', createServiceProxy(services.workspace));
app.use('/api/container', createServiceProxy(services.workspace));

// Authentication routes (handled locally)
app.post('/api/auth/login', async (req, res) => {
  // TODO: Implement authentication
  res.json({ message: 'Authentication not implemented yet' });
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  // TODO: Implement logout
  res.json({ message: 'Logged out successfully' });
});

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
const gracefulShutdown = () => {
  logger.info('Shutting down API Gateway...');
  server.close(() => {
    logger.info('API Gateway stopped');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`API Gateway running on port ${PORT}`);
});

module.exports = app;