#!/usr/bin/env node
/**
 * Migration Script: Filesystem Projects to MongoDB
 * 
 * This script migrates existing projects from the constellation-projects directory
 * to the new MongoDB-based storage system.
 */

const fs = require('fs').promises;
const path = require('path');
const { database, Project } = require('./db/models');

const WORKSPACE_BASE = '/home/ssitzer/constellation-projects';

async function scanProjectDirectory(projectPath) {
  try {
    const files = [];
    const entries = await fs.readdir(projectPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      
      const fullPath = path.join(projectPath, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await scanProjectDirectory(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const relativePath = path.relative(projectPath, fullPath);
        files.push(relativePath);
      }
    }
    
    return files;
  } catch (error) {
    console.warn(`Warning: Could not scan directory ${projectPath}:`, error.message);
    return [];
  }
}

async function detectProjectType(projectPath, files) {
  // Check for Encore.ts projects
  if (files.includes('encore.app')) {
    // Check if it has SolidJS or React
    const packageJsonPath = path.join(projectPath, 'package.json');
    try {
      const packageJson = await fs.readFile(packageJsonPath, 'utf8');
      const pkg = JSON.parse(packageJson);
      const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
      
      if (dependencies['solid-js']) return 'encore-solidjs';
      if (dependencies['react']) return 'encore-react';
      return 'encore-solidjs'; // Default for Encore projects
    } catch (error) {
      return 'encore-solidjs';
    }
  }
  
  // Check for full-stack TypeScript
  if (files.includes('package.json') && files.includes('tsconfig.json')) {
    return 'fullstack-ts';
  }
  
  // Default
  return 'encore-solidjs';
}

async function extractProjectInfo(projectId, projectPath) {
  try {
    console.log(`📂 Analyzing project: ${projectId}`);
    
    // Read workspace README for basic info
    const readmePath = path.join(projectPath, 'WORKSPACE_README.md');
    let projectName = projectId;
    let description = '';
    let createdAt = new Date();
    
    try {
      const readmeContent = await fs.readFile(readmePath, 'utf8');
      const nameMatch = readmeContent.match(/# (.+) Workspace/);
      if (nameMatch) {
        projectName = nameMatch[1];
      }
      
      const createdMatch = readmeContent.match(/Created: (.+)/);
      if (createdMatch) {
        createdAt = new Date(createdMatch[1]);
      }
    } catch (error) {
      console.warn(`  ⚠️ Could not read workspace README: ${error.message}`);
      // Try to extract name from project ID
      if (projectId.startsWith('project-')) {
        const parts = projectId.replace('project-', '').split('-');
        if (parts.length > 2) {
          projectName = parts.slice(0, -2).join(' ') || projectId;
        }
      }
    }
    
    // Scan for project files
    const files = await scanProjectDirectory(projectPath);
    
    // Detect project type
    const projectType = await detectProjectType(projectPath, files);
    
    // Get directory stats for timestamps
    const stats = await fs.stat(projectPath);
    
    // Determine tech stack based on project type
    const techStackMap = {
      'encore-solidjs': ['Encore.ts', 'SolidJS', 'TypeScript', 'PostgreSQL'],
      'encore-react': ['Encore.ts', 'React', 'TypeScript', 'PostgreSQL'],
      'fullstack-ts': ['Node.js', 'TypeScript', 'Express', 'PostgreSQL'],
      'microservices': ['Encore.ts', 'TypeScript', 'PostgreSQL', 'Redis']
    };
    
    return {
      id: projectId,
      name: projectName,
      description: description || `Migrated ${projectType} project`,
      type: projectType,
      status: 'ready',
      createdAt: createdAt,
      updatedAt: stats.mtime,
      workspacePath: projectPath,
      knowledgeBase: {
        requirements: [],
        businessRules: [],
        techStack: techStackMap[projectType] || ['TypeScript', 'Node.js'],
        apis: []
      },
      containerConfig: null,
      files: files,
      metadata: {
        migrated: true,
        migrationDate: new Date(),
        originalPath: projectPath,
        fileCount: files.length
      }
    };
  } catch (error) {
    console.error(`  ❌ Failed to analyze project ${projectId}:`, error.message);
    return null;
  }
}

async function migrateProjects() {
  try {
    console.log('🚀 Starting project migration to MongoDB...\n');
    
    // Connect to database
    await database.connect();
    Project.init(database);
    
    // Check if projects directory exists
    try {
      await fs.access(WORKSPACE_BASE);
    } catch (error) {
      console.error(`❌ Projects directory not found: ${WORKSPACE_BASE}`);
      process.exit(1);
    }
    
    // Get all project directories
    const entries = await fs.readdir(WORKSPACE_BASE, { withFileTypes: true });
    const projectDirs = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => entry.name);
    
    console.log(`📊 Found ${projectDirs.length} potential projects to migrate\n`);
    
    if (projectDirs.length === 0) {
      console.log('✅ No projects found to migrate');
      return;
    }
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const projectId of projectDirs) {
      const projectPath = path.join(WORKSPACE_BASE, projectId);
      
      try {
        // Check if project already exists in MongoDB
        const existingProject = await Project.findById(projectId);
        if (existingProject) {
          console.log(`  ⏭️ Project ${projectId} already exists in database, skipping`);
          continue;
        }
        
        // Extract project information
        const projectInfo = await extractProjectInfo(projectId, projectPath);
        
        if (!projectInfo) {
          errorCount++;
          continue;
        }
        
        // Save to MongoDB
        await Project.create(projectInfo);
        
        console.log(`  ✅ Migrated: ${projectInfo.name} (${projectInfo.type})`);
        console.log(`     Files: ${projectInfo.files.length}, Created: ${projectInfo.createdAt.toISOString()}`);
        
        migratedCount++;
        
      } catch (error) {
        console.error(`  ❌ Failed to migrate ${projectId}:`, error.message);
        errorCount++;
      }
      
      console.log(''); // Empty line for readability
    }
    
    console.log('📋 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${migratedCount} projects`);
    console.log(`   ❌ Failed migrations: ${errorCount} projects`);
    console.log(`   📊 Total processed: ${projectDirs.length} directories\n`);
    
    // Display migrated projects
    if (migratedCount > 0) {
      const allProjects = await Project.findAll();
      console.log('📁 Projects now in database:');
      for (const project of allProjects) {
        console.log(`   - ${project.name} (${project.id}) - ${project.type} - ${project.status}`);
      }
    }
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await database.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateProjects().catch(error => {
    console.error('💥 Unhandled migration error:', error);
    process.exit(1);
  });
}

module.exports = { migrateProjects };