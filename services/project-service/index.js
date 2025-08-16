const BaseService = require('../common/base-service');
const { MongoClient } = require('mongodb');

// MongoDB connection
let db;
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/constellation';

// Create service instance
const service = new BaseService({
  serviceName: 'project-service',
  port: process.env.SERVICE_PORT || 8002,
  version: '1.0.0'
});

// MongoDB connection helper
async function connectToMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URL);
    await client.connect();
    db = client.db();
    service.logger.info('Connected to MongoDB');
  } catch (error) {
    service.logger.error('Failed to connect to MongoDB:', error);
    // Don't exit, just log the error and continue without DB
  }
}

// Project routes
service.app.get('/projects', async (req, res) => {
  try {
    service.logger.info(`DB status: ${db ? 'connected' : 'null'}`);
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const projects = await db.collection('projects').find({}).toArray();
    service.logger.info(`Retrieved ${projects.length} projects`);
    
    res.json({ 
      success: true, 
      data: projects, 
      total: projects.length 
    });
  } catch (error) {
    service.logger.error('Failed to get projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

service.app.post('/projects', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const { name, description, type } = req.body;
    const project = {
      id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      type: type || 'general',
      status: 'ready',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workspacePath: `/home/ssitzer/constellation-projects/${project.id}`,
      knowledgeBase: {
        requirements: [],
        businessRules: [],
        techStack: [],
        apis: []
      },
      containerConfig: null,
      metadata: {
        originalFiles: [],
        fileCount: 0
      }
    };
    
    await db.collection('projects').insertOne(project);
    service.logger.info(`Created new project: ${project.id}`);
    
    res.status(201).json({ 
      success: true, 
      data: project 
    });
  } catch (error) {
    service.logger.error('Failed to create project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

service.app.get('/projects/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const project = await db.collection('projects').findOne({ id: req.params.id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ 
      success: true, 
      data: project 
    });
  } catch (error) {
    service.logger.error('Failed to get project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

service.app.put('/projects/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    const result = await db.collection('projects').updateOne(
      { id: req.params.id },
      { $set: updates }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    service.logger.info(`Updated project: ${req.params.id}`);
    res.json({ 
      success: true, 
      message: 'Project updated successfully' 
    });
  } catch (error) {
    service.logger.error('Failed to update project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

service.app.delete('/projects/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const result = await db.collection('projects').deleteOne({ id: req.params.id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    service.logger.info(`Deleted project: ${req.params.id}`);
    res.json({ 
      success: true, 
      message: 'Project deleted successfully' 
    });
  } catch (error) {
    service.logger.error('Failed to delete project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server and connect to MongoDB
const server = service.start();

// Connect to MongoDB after server starts
connectToMongoDB();

module.exports = service.app;