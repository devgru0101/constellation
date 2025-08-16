/**
 * Project Management Routes - MongoDB Integration
 */

const express = require('express');
const { Project } = require('../db/models');
const router = express.Router();

/**
 * Get all projects
 */
router.get('/projects', async (req, res) => {
  try {
    console.log('📡 API: GET /projects called from', req.get('User-Agent') || 'Unknown');
    console.log('📡 API: Headers:', {
      origin: req.get('Origin'),
      referer: req.get('Referer'),
      host: req.get('Host')
    });
    
    const projects = await Project.findAll();
    console.log(`📡 API: Retrieved ${projects.length} projects from storage`);
    
    // Format projects for frontend compatibility
    const formattedProjects = projects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      type: project.type,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      workspacePath: project.workspacePath,
      knowledgeBase: project.knowledgeBase,
      metadata: project.metadata
    }));

    console.log(`📡 API: Sending response with ${formattedProjects.length} projects`);
    res.json({
      success: true,
      projects: formattedProjects,
      total: formattedProjects.length
    });
  } catch (error) {
    console.error('❌ API: Failed to fetch projects:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get single project by ID
 */
router.get('/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: `Project ${projectId} not found`
      });
    }

    res.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        type: project.type,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        workspacePath: project.workspacePath,
        knowledgeBase: project.knowledgeBase,
        metadata: project.metadata
      }
    });
  } catch (error) {
    console.error('Failed to fetch project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Create new project
 */
router.post('/projects', async (req, res) => {
  try {
    const projectData = req.body;
    
    // Validate required fields
    if (!projectData.name || !projectData.type) {
      return res.status(400).json({
        success: false,
        error: 'Project name and type are required'
      });
    }

    // Generate unique project ID
    const projectId = `project-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    const project = await Project.create({
      id: projectId,
      name: projectData.name,
      description: projectData.description || '',
      type: projectData.type,
      status: 'creating',
      workspacePath: `/home/ssitzer/constellation-projects/${projectId}`,
      knowledgeBase: projectData.knowledgeBase || {
        requirements: [],
        businessRules: [],
        techStack: [],
        apis: []
      },
      containerConfig: projectData.containerConfig || null
    });

    res.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        type: project.type,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        workspacePath: project.workspacePath,
        knowledgeBase: project.knowledgeBase
      }
    });
  } catch (error) {
    console.error('Failed to create project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update project
 */
router.put('/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const updates = req.body;

    const success = await Project.updateById(projectId, updates);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: `Project ${projectId} not found`
      });
    }

    const updatedProject = await Project.findById(projectId);
    
    res.json({
      success: true,
      project: {
        id: updatedProject.id,
        name: updatedProject.name,
        description: updatedProject.description,
        type: updatedProject.type,
        status: updatedProject.status,
        createdAt: updatedProject.createdAt,
        updatedAt: updatedProject.updatedAt,
        workspacePath: updatedProject.workspacePath,
        knowledgeBase: updatedProject.knowledgeBase,
        metadata: updatedProject.metadata
      }
    });
  } catch (error) {
    console.error('Failed to update project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update project status
 */
router.patch('/projects/:projectId/status', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const success = await Project.updateStatus(projectId, status);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: `Project ${projectId} not found`
      });
    }

    res.json({
      success: true,
      projectId,
      status
    });
  } catch (error) {
    console.error('Failed to update project status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Delete project
 */
router.delete('/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const success = await Project.deleteById(projectId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: `Project ${projectId} not found`
      });
    }

    res.json({
      success: true,
      projectId,
      message: `Project ${projectId} deleted successfully`
    });
  } catch (error) {
    console.error('Failed to delete project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update project files (for file sync)
 */
router.post('/projects/:projectId/files', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { files } = req.body;

    if (!files) {
      return res.status(400).json({
        success: false,
        error: 'Files data is required'
      });
    }

    const success = await Project.updateFiles(projectId, files);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: `Project ${projectId} not found`
      });
    }

    res.json({
      success: true,
      projectId,
      filesCount: Object.keys(files).length,
      message: 'Project files updated successfully'
    });
  } catch (error) {
    console.error('Failed to update project files:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Migration endpoint - migrate filesystem projects to MongoDB
 */
router.post('/projects/migrate', async (req, res) => {
  try {
    const { migrateProjects } = require('../migrate-projects');
    
    // This will run the migration in the background
    migrateProjects().then(() => {
      console.log('✅ Background project migration completed');
    }).catch(error => {
      console.error('❌ Background project migration failed:', error);
    });

    res.json({
      success: true,
      message: 'Project migration started in background'
    });
  } catch (error) {
    console.error('Failed to start project migration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;