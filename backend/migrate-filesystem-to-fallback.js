#!/usr/bin/env node
/**
 * Migration Script: Populate fallback storage with existing filesystem projects
 * 
 * This script scans the constellation-projects directory and populates the
 * fallback JSON storage with project metadata.
 */

const fs = require('fs').promises;
const path = require('path');

const WORKSPACE_BASE = '/home/ssitzer/constellation-projects';
const FALLBACK_STORAGE = path.join(__dirname, 'db', 'fallback_projects.json');

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
      metadata: {
        originalFiles: files,
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

async function migrateToFallbackStorage() {
  try {
    console.log('🚀 Starting filesystem to fallback storage migration...\n');
    
    // Check if projects directory exists
    try {
      await fs.access(WORKSPACE_BASE);
    } catch (error) {
      console.error(`❌ Projects directory not found: ${WORKSPACE_BASE}`);
      process.exit(1);
    }
    
    // Create fallback storage directory if needed
    await fs.mkdir(path.dirname(FALLBACK_STORAGE), { recursive: true });
    
    // Initialize or load existing fallback data
    let existingProjects = [];
    try {
      const data = await fs.readFile(FALLBACK_STORAGE, 'utf8');
      existingProjects = JSON.parse(data);
      console.log(`📋 Found ${existingProjects.length} existing projects in fallback storage`);
    } catch (error) {
      console.log('📋 No existing fallback storage found, creating new one');
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
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const projectId of projectDirs) {
      const projectPath = path.join(WORKSPACE_BASE, projectId);
      
      try {
        // Check if project already exists in fallback storage
        const existingProject = existingProjects.find(p => p.id === projectId);
        if (existingProject) {
          console.log(`  ⏭️ Project ${projectId} already exists in fallback storage, skipping`);
          skippedCount++;
          continue;
        }
        
        // Extract project information
        const projectInfo = await extractProjectInfo(projectId, projectPath);
        
        if (!projectInfo) {
          errorCount++;
          continue;
        }
        
        // Add to existing projects
        existingProjects.push(projectInfo);
        
        console.log(`  ✅ Migrated: ${projectInfo.name} (${projectInfo.type})`);
        console.log(`     Files: ${projectInfo.metadata.fileCount}, Created: ${projectInfo.createdAt.toISOString()}`);
        
        migratedCount++;
        
      } catch (error) {
        console.error(`  ❌ Failed to migrate ${projectId}:`, error.message);
        errorCount++;
      }
      
      console.log(''); // Empty line for readability
    }
    
    // Save updated fallback storage
    await fs.writeFile(FALLBACK_STORAGE, JSON.stringify(existingProjects, null, 2));
    
    console.log('📋 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${migratedCount} projects`);
    console.log(`   ⏭️ Skipped (already exists): ${skippedCount} projects`);
    console.log(`   ❌ Failed migrations: ${errorCount} projects`);
    console.log(`   📊 Total processed: ${projectDirs.length} directories`);
    console.log(`   💾 Total in storage: ${existingProjects.length} projects\n`);
    
    // Display all projects in storage
    if (existingProjects.length > 0) {
      console.log('📁 Projects now in fallback storage:');
      for (const project of existingProjects) {
        console.log(`   - ${project.name} (${project.id}) - ${project.type} - ${project.status}`);
      }
    }
    
    console.log(`\n💾 Fallback storage saved to: ${FALLBACK_STORAGE}`);
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateToFallbackStorage().catch(error => {
    console.error('💥 Unhandled migration error:', error);
    process.exit(1);
  });
}

module.exports = { migrateToFallbackStorage };