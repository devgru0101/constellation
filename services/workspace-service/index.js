const BaseService = require('../common/base-service');
const fs = require('fs').promises;
const path = require('path');

// Create service instance
const service = new BaseService({
  serviceName: 'workspace-service',
  port: process.env.SERVICE_PORT || 8003,
  version: '1.0.0'
});

const WORKSPACE_BASE = process.env.WORKSPACE_BASE || '/home/ssitzer/constellation-projects';

// Workspace management routes
service.app.post('/workspace', async (req, res) => {
  try {
    const { projectId, template, files } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    const workspacePath = path.join(WORKSPACE_BASE, projectId);
    
    // Create workspace directory
    await fs.mkdir(workspacePath, { recursive: true });
    
    // Create initial files if provided
    if (files && Array.isArray(files)) {
      for (const file of files) {
        const filePath = path.join(workspacePath, file.path);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, file.content || '');
      }
    }
    
    // Create README if template is specified
    if (template) {
      const readmePath = path.join(workspacePath, 'WORKSPACE_README.md');
      const readmeContent = `# ${projectId}\n\nWorkspace created with template: ${template}\n\nCreated: ${new Date().toISOString()}`;
      await fs.writeFile(readmePath, readmeContent);
    }
    
    service.logger.info(`Workspace created: ${projectId}`);
    
    res.status(201).json({
      success: true,
      data: {
        projectId,
        workspacePath,
        template,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    service.logger.error('Workspace creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

service.app.get('/workspace/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const workspacePath = path.join(WORKSPACE_BASE, projectId);
    
    // Check if workspace exists
    try {
      await fs.access(workspacePath);
    } catch {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    // Get workspace info
    const stats = await fs.stat(workspacePath);
    const files = await fs.readdir(workspacePath);
    
    res.json({
      success: true,
      data: {
        projectId,
        workspacePath,
        files: files.length,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      }
    });
  } catch (error) {
    service.logger.error('Workspace info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

service.app.get('/workspace/:projectId/files', async (req, res) => {
  try {
    const { projectId } = req.params;
    const workspacePath = path.join(WORKSPACE_BASE, projectId);
    
    // Recursive function to get file tree
    async function getFileTree(dirPath, relativePath = '') {
      const items = [];
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          const children = await getFileTree(fullPath, relPath);
          items.push({
            name: entry.name,
            type: 'directory',
            path: relPath,
            children
          });
        } else {
          const stats = await fs.stat(fullPath);
          items.push({
            name: entry.name,
            type: 'file',
            path: relPath,
            size: stats.size,
            modified: stats.mtime
          });
        }
      }
      
      return items;
    }
    
    const fileTree = await getFileTree(workspacePath);
    
    res.json({
      success: true,
      data: {
        projectId,
        files: fileTree
      }
    });
  } catch (error) {
    service.logger.error('File listing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

service.app.post('/workspace/:projectId/files', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { path: filePath, content } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    const workspacePath = path.join(WORKSPACE_BASE, projectId);
    const fullFilePath = path.join(workspacePath, filePath);
    
    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(fullFilePath), { recursive: true });
    
    // Write file
    await fs.writeFile(fullFilePath, content || '');
    
    service.logger.info(`File created: ${projectId}/${filePath}`);
    
    res.status(201).json({
      success: true,
      data: {
        projectId,
        filePath,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    service.logger.error('File creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

service.app.delete('/workspace/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const workspacePath = path.join(WORKSPACE_BASE, projectId);
    
    // Remove workspace directory
    await fs.rm(workspacePath, { recursive: true, force: true });
    
    service.logger.info(`Workspace deleted: ${projectId}`);
    
    res.json({
      success: true,
      message: 'Workspace deleted successfully'
    });
  } catch (error) {
    service.logger.error('Workspace deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Container management routes
service.app.post('/container', async (req, res) => {
  try {
    const { projectId, image, command } = req.body;
    
    service.logger.info('Container creation request', { projectId, image });
    
    // TODO: Implement Docker container management
    res.json({
      success: true,
      message: 'Container management not fully implemented yet',
      data: {
        projectId,
        image,
        command,
        status: 'placeholder'
      }
    });
  } catch (error) {
    service.logger.error('Container error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
service.start();

module.exports = service.app;