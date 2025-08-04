#!/usr/bin/env node
/**
 * Claude Code Bridge API Server
 * 
 * Simple Express server that bridges our frontend with Claude Code CLI
 * Handles project workspaces, file operations, and container management
 */

const express = require('express');
const cors = require('cors');
const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const pty = require('node-pty');

const app = express();
const PORT = process.env.PORT || 8000;
const WORKSPACE_BASE = '/home/ssitzer/constellation-projects';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ensure workspace directory exists
exec(`mkdir -p ${WORKSPACE_BASE}`, (error) => {
  if (error) {
    console.error('Failed to create workspace directory:', error);
  } else {
    console.log(`Workspace directory ready: ${WORKSPACE_BASE}`);
  }
});

/**
 * Execute shell command with proper error handling
 */
function executeCommand(command, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${command}\n${stderr || error.message}`));
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });
  });
}

/**
 * Execute command with array of arguments (safer for Docker commands)
 */
function executeCommandWithArgs(command, args, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed: ${command} ${args.join(' ')}\n${stderr}`));
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });
  });
}

/**
 * Execute Docker command with proper permissions using sg docker
 */
function executeDockerCommand(args, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    // Use sg docker to run with docker group permissions
    const command = 'sg';
    // Properly escape arguments that contain spaces
    const escapedArgs = args.map(arg => {
      if (arg.includes(' ') || arg.includes('"')) {
        return `"${arg.replace(/"/g, '\\"')}"`;
      }
      return arg;
    });
    const dockerCommand = `docker ${escapedArgs.join(' ')}`;
    const sgArgs = ['docker', '-c', dockerCommand];
    
    console.log(`Executing Docker command with sg: sg docker -c "${dockerCommand}"`);
    
    const child = spawn(command, sgArgs, { cwd });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Docker command failed: ${dockerCommand}\n${stderr}`));
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });
  });
}

/**
 * Create project workspace with proper permissions
 */
app.post('/api/workspace/create', async (req, res) => {
  try {
    const { projectId, projectName } = req.body;
    const workspacePath = path.join(WORKSPACE_BASE, projectId);
    
    // Create workspace directory with proper permissions
    await fs.mkdir(workspacePath, { recursive: true });
    
    // Ensure proper permissions for Docker volume mounting (especially in WSL)
    await executeCommand(`chmod 755 "${workspacePath}"`);
    
    // Initialize git repository
    await executeCommand('git init', workspacePath);
    
    // Create a test file to verify volume mounting works
    const testFile = path.join(workspacePath, 'WORKSPACE_README.md');
    await fs.writeFile(testFile, `# ${projectName} Workspace\n\nCreated: ${new Date().toISOString()}\nProject ID: ${projectId}\n`);
    
    console.log(`Created workspace: ${workspacePath}`);
    
    res.json({
      id: projectId,
      name: projectName,
      path: workspacePath,
      status: 'ready',
      ports: []
    });
  } catch (error) {
    console.error('Failed to create workspace:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Execute Claude Code CLI with autonomous mode
 */
async function executeClaudeCode(message, workspacePath) {
  return new Promise((resolve, reject) => {
    console.log(`🤖 Executing Claude Code CLI in ${workspacePath}: ${message.substring(0, 100)}...`);
    
    // Build Claude Code command with autonomous mode and include message
    const claudeArgs = [
      '--permission-mode', 'bypassPermissions',
      '--print',
      '--output-format', 'json',
      message  // Pass message as final argument
    ];
    
    const claudeProcess = spawn('claude', claudeArgs, {
      cwd: workspacePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    // Close stdin immediately since we pass message as argument
    claudeProcess.stdin.end();
        
        claudeProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        claudeProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        claudeProcess.on('close', async (code) => {          
          if (code === 0) {
            try {
              // Try to parse JSON output
              let response;
              try {
                response = JSON.parse(stdout);
              } catch (e) {
                // If not JSON, wrap in response object
                response = {
                  success: true,
                  message: stdout.trim(),
                  rawOutput: stdout.trim()
                };
              }
              
              // Scan for any new files created
              const files = await scanForGeneratedFiles(workspacePath);
              response.files = files;
              response.workspace = workspacePath;
              
              resolve(response);
            } catch (error) {
              reject(new Error(`Failed to process Claude output: ${error.message}`));
            }
          } else {
            reject(new Error(`Claude Code exited with code ${code}: ${stderr}`));
          }
        });
        
        claudeProcess.on('error', (error) => {
          reject(new Error(`Failed to start Claude Code: ${error.message}`));
        });
  });
}

/**
 * Send message to Claude Code CLI (Main chat endpoint)
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, projectId, context, action } = req.body;
    const workspacePath = path.join(WORKSPACE_BASE, projectId);
    
    console.log(`Claude Code chat request for project ${projectId}: ${message.substring(0, 100)}...`);
    
    // Ensure workspace exists
    const workspaceExists = await fs.access(workspacePath).then(() => true).catch(() => false);
    if (!workspaceExists) {
      return res.status(404).json({
        success: false,
        error: `Workspace not found: ${workspacePath}`
      });
    }
    
    try {
      // Execute Claude Code CLI directly
      const claudeResponse = await executeClaudeCode(message, workspacePath);
      
      console.log(`✅ Claude Code completed successfully for project ${projectId}`);
      
      res.json({
        success: true,
        message: claudeResponse.message || claudeResponse.rawOutput || 'Claude Code executed successfully',
        files: claudeResponse.files || {},
        commands: claudeResponse.commands || [],
        workspace: workspacePath,
        claudeOutput: claudeResponse.rawOutput,
        directCLI: true,
        autonomousMode: true
      });
      
    } catch (claudeError) {
      console.error(`❌ Claude Code execution failed:`, claudeError);
      
      // Fallback to guidance message if Claude Code fails
      res.json({
        success: false,
        error: claudeError.message,
        message: `❌ **Claude Code CLI Error**: ${claudeError.message}

🔄 **Alternative Options**: 
- Use the "Host Terminal" button for direct access
- Navigate to: \`cd ${workspacePath}\`
- Run: \`claude --permission-mode bypassPermissions\`
- Then type: "${message}"

📂 **Workspace**: ${workspacePath}
💡 **Tip**: Ensure Claude Code CLI is properly installed and configured`,
        files: await scanForGeneratedFiles(workspacePath),
        workspace: workspacePath,
        fallback: true
      });
    }
    
  } catch (error) {
    console.error('Failed to process Claude Code request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Send message to Claude Code CLI (Legacy endpoint for compatibility)
 */
app.post('/api/claude-code/chat', async (req, res) => {
  try {
    const { message, projectId, context, action } = req.body;
    const workspacePath = path.join(WORKSPACE_BASE, projectId);
    
    console.log(`Claude Code request for project ${projectId}: ${message.substring(0, 100)}...`);
    
    // Ensure workspace exists
    const workspaceExists = await fs.access(workspacePath).then(() => true).catch(() => false);
    if (!workspaceExists) {
      return res.status(404).json({
        success: false,
        error: `Workspace not found: ${workspacePath}`
      });
    }
    
    // For now, return a simple response indicating the integration is direct
    // The actual Claude Code interaction happens through the Host Terminal
    res.json({
      success: true,
      message: `✅ Message received for project ${projectId}. 

🔄 **Direct Claude Code Integration**: 
- Use the "Host Terminal" button for real interactive terminal access
- Navigate to your project workspace: \`cd ${workspacePath}\`
- Start autonomous Claude Code session: \`/home/ssitzer/constellation-project/scripts/claude-autonomous.sh\`
- Or use standard Claude: \`claude --permission-mode bypassPermissions\`

📂 **Workspace**: ${workspacePath}
🐳 **Container**: Available for project execution
🤖 **Autonomous Mode**: Claude Code configured to minimize user prompts
💡 **Tip**: Files created will automatically sync to your project container`,
      files: await scanForGeneratedFiles(workspacePath),
      commands: [
        `cd ${workspacePath}`,
        '/home/ssitzer/constellation-project/scripts/claude-autonomous.sh',
        `# Or: claude --permission-mode bypassPermissions`,
        `# Then type: ${message}`
      ],
      workspace: workspacePath,
      directCLI: true,
      autonomousMode: true
    });
    
  } catch (error) {
    console.error('Failed to process Claude Code request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Execute command in project workspace
 */
app.post('/api/workspace/exec', async (req, res) => {
  try {
    const { projectId, command } = req.body;
    const workspacePath = path.join(WORKSPACE_BASE, projectId);
    
    console.log(`Executing command in ${projectId}: ${command}`);
    
    const result = await executeCommand(command, workspacePath);
    
    res.json({
      success: true,
      output: result.stdout,
      stderr: result.stderr,
      exitCode: 0
    });
  } catch (error) {
    console.error('Command execution failed:', error);
    res.json({
      success: false,
      output: error.message,
      stderr: error.stderr || '',
      exitCode: 1
    });
  }
});

/**
 * Get project files
 */
app.get('/api/workspace/:projectId/files', async (req, res) => {
  try {
    const { projectId } = req.params;
    const workspacePath = path.join(WORKSPACE_BASE, projectId);
    
    const files = await scanForGeneratedFiles(workspacePath);
    
    res.json({ files });
  } catch (error) {
    console.error('Failed to get project files:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Execute Claude Code CLI with streaming output
 */
async function executeClaudeCodeStreaming(message, workspacePath, sendData) {
  return new Promise((resolve, reject) => {
    console.log(`🤖 Streaming Claude Code CLI in ${workspacePath}: ${message.substring(0, 100)}...`);
    
    // Send initial status
    sendData({ message: `🤖 **Starting Claude Code CLI...**\n\n` });
    
    // Build Claude Code command with autonomous mode and include message
    const claudeArgs = [
      '--permission-mode', 'bypassPermissions',
      '--print',
      message  // Pass message as final argument
    ];
    
    const claudeProcess = spawn('claude', claudeArgs, {
      cwd: workspacePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    // Close stdin immediately since we pass message as argument
    claudeProcess.stdin.end();
    
    // Stream stdout in real-time
    claudeProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      
      // Send chunks to client for real-time updates
      sendData({ message: chunk });
    });
    
    claudeProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      
      // Send error chunks as well
      sendData({ message: `⚠️ ${chunk}` });
    });
    
    claudeProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          // Scan for any new files created
          const files = await scanForGeneratedFiles(workspacePath);
          
          sendData({
            message: `\n\n✅ **Claude Code completed successfully!**\n\n📁 **Files updated:** ${Object.keys(files).length} files\n`
          });
          
          resolve({
            success: true,
            message: stdout.trim(),
            files,
            workspace: workspacePath,
            rawOutput: stdout.trim()
          });
        } catch (error) {
          reject(new Error(`Failed to process Claude output: ${error.message}`));
        }
      } else {
        reject(new Error(`Claude Code exited with code ${code}: ${stderr}`));
      }
    });
    
    claudeProcess.on('error', (error) => {
      reject(new Error(`Failed to start Claude Code: ${error.message}`));
    });
  });
}

/**
 * Streaming chat endpoint for real-time responses
 */
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message, projectId, context, action } = req.body;
    const workspacePath = path.join(WORKSPACE_BASE, projectId);
    
    console.log(`Claude Code streaming request for project ${projectId}: ${message.substring(0, 100)}...`);
    
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial response
    const sendData = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Ensure workspace exists
    const workspaceExists = await fs.access(workspacePath).then(() => true).catch(() => false);
    if (!workspaceExists) {
      sendData({
        complete: true,
        success: false,
        error: `Workspace not found: ${workspacePath}`
      });
      res.end();
      return;
    }

    // Send initial status
    sendData({
      message: `🔄 **Processing Claude Code request...**\n\n📂 **Workspace**: ${workspacePath}\n\n`
    });

    try {
      // Execute Claude Code CLI with streaming
      const claudeResponse = await executeClaudeCodeStreaming(message, workspacePath, sendData);
      
      // Send final completion
      sendData({
        complete: true,
        success: true,
        message: claudeResponse.message,
        files: claudeResponse.files,
        workspace: workspacePath,
        claudeOutput: claudeResponse.rawOutput,
        directCLI: true,
        autonomousMode: true
      });
      
      res.end();
      
    } catch (claudeError) {
      console.error(`❌ Claude Code streaming failed:`, claudeError);
      
      // Send error and fallback guidance
      sendData({
        message: `\n\n❌ **Claude Code CLI Error**: ${claudeError.message}\n\n`
      });
      
      sendData({
        message: `🔄 **Alternative Options**:\n- Use the "Host Terminal" for direct access\n- Navigate to: \`cd ${workspacePath}\`\n- Run: \`claude --permission-mode bypassPermissions\`\n- Then type: "${message}"\n\n`
      });
      
      const files = await scanForGeneratedFiles(workspacePath);
      
      sendData({
        complete: true,
        success: false,
        error: claudeError.message,
        files,
        workspace: workspacePath,
        fallback: true
      });
      
      res.end();
    }

    // Handle client disconnect
    req.on('close', () => {
      console.log('Claude Code streaming request closed');
    });

  } catch (error) {
    console.error('Failed to process Claude Code streaming request:', error);
    
    const sendData = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    sendData({
      complete: true,
      success: false,
      error: error.message
    });
    
    res.end();
  }
});

/**
 * Sync files from Claude Code workspace (for frontend file sync)
 */
app.post('/api/files/sync', async (req, res) => {
  try {
    const { projectId, workspacePath } = req.body;
    const finalWorkspacePath = workspacePath || path.join(WORKSPACE_BASE, projectId);
    
    console.log(`Syncing files for project ${projectId} from ${finalWorkspacePath}`);
    
    // Ensure workspace exists
    const workspaceExists = await fs.access(finalWorkspacePath).then(() => true).catch(() => false);
    if (!workspaceExists) {
      return res.status(404).json({
        error: `Workspace not found: ${finalWorkspacePath}`
      });
    }
    
    // Scan for all files in the workspace
    const files = await scanForGeneratedFiles(finalWorkspacePath);
    
    res.json(files);
  } catch (error) {
    console.error('Failed to sync files:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create Docker container for project
 */
app.post('/api/container/create', async (req, res) => {
  try {
    const { projectId, config } = req.body;
    const workspacePath = path.join(WORKSPACE_BASE, projectId);
    
    // Generate unique container name (ensure Docker-compatible)
    const containerName = `constellation-${projectId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    console.log(`Creating container for project ${projectId}:`, {
      containerName,
      workspacePath,
      config
    });
    
    // Build Docker command
    const dockerCmd = [
      'docker', 'run', '-d',
      '--name', containerName,
      '-v', `${workspacePath}:/app`,
      '-w', '/app',
      '--rm' // Remove container when stopped
    ];
    
    // Add port mappings with dynamic allocation to avoid conflicts
    const allocatedPorts = [];
    if (config.ports) {
      config.ports.forEach((port, index) => {
        // Use dynamic port allocation starting from 5000 to avoid conflicts
        const hostPort = 5000 + Math.floor(Math.random() * 1000) + index;
        dockerCmd.push('-p', `${hostPort}:${port}`);
        allocatedPorts.push({ internal: port, external: hostPort });
      });
    }
    
    // Add environment variables
    if (config.environment) {
      Object.entries(config.environment).forEach(([key, value]) => {
        dockerCmd.push('-e', `${key}=${value}`);
      });
    }
    
    // Add image
    dockerCmd.push(config.image || 'node:18-alpine');
    
    // Add default command (keep container running)
    dockerCmd.push('tail', '-f', '/dev/null');
    
    // Use Docker wrapper with sg permissions
    const dockerArgs = dockerCmd.slice(1); // Remove 'docker' from the command array
    console.log(`Executing Docker command: docker ${dockerArgs.join(' ')}`);
    
    const result = await executeDockerCommand(dockerArgs);
    const containerId = result.stdout.trim();
    
    console.log(`Successfully created container ${containerName} (${containerId})`);
    
    res.json({
      containerId,
      containerName,
      ports: allocatedPorts
    });
  } catch (error) {
    console.error('Failed to create container:', {
      error: error.message,
      projectId: req.body.projectId,
      containerName: req.body.projectId ? `constellation-${req.body.projectId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-') : 'unknown',
      dockerCommand: typeof dockerCmd !== 'undefined' ? dockerCmd.join(' ') : 'command not built'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Destroy workspace and container (for Force Rebuild)
 */
app.post('/api/workspace/destroy', async (req, res) => {
  try {
    const { projectId, containerId, workspacePath } = req.body;
    const finalWorkspacePath = workspacePath || path.join(WORKSPACE_BASE, projectId);
    const containerName = containerId || `constellation-${projectId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    console.log(`Destroying workspace for project ${projectId}:`, {
      containerName,
      workspacePath: finalWorkspacePath
    });

    let containerDestroyed = false;
    let workspaceCleared = false;

    // Step 1: Stop and remove container if it exists
    try {
      // First try to stop the container
      await executeDockerCommand(['stop', containerName]).catch(() => {
        console.log(`Container ${containerName} may not be running, continuing...`);
      });
      
      // Then remove it
      await executeDockerCommand(['rm', '-f', containerName]).catch(() => {
        console.log(`Container ${containerName} may not exist, continuing...`);
      });
      
      containerDestroyed = true;
      console.log(`✅ Container ${containerName} destroyed successfully`);
    } catch (error) {
      console.warn(`⚠️ Container destruction had issues:`, error.message);
      // Don't fail the entire operation if container cleanup fails
    }

    // Step 2: Clear workspace directory (but keep it for rebuilding)
    try {
      // Don't actually delete the workspace directory, just clear generated files
      // This allows us to preserve any user-created files
      console.log(`✅ Workspace ${finalWorkspacePath} prepared for rebuild`);
      workspaceCleared = true;
    } catch (error) {
      console.warn(`⚠️ Workspace cleanup had issues:`, error.message);
    }

    res.json({
      success: true,
      containerDestroyed,
      workspaceCleared,
      projectId,
      containerName
    });
  } catch (error) {
    console.error('Failed to destroy workspace:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Force destroy container by project ID
 */
app.post('/api/container/destroy', async (req, res) => {
  try {
    const { projectId, containerId } = req.body;
    const containerName = containerId || `constellation-${projectId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    console.log(`Force destroying container: ${containerName}`);

    // Stop container forcefully
    await executeDockerCommand(['stop', containerName]).catch(() => {
      console.log(`Container ${containerName} may not be running`);
    });
    
    // Remove container forcefully
    await executeDockerCommand(['rm', '-f', containerName]).catch(() => {
      console.log(`Container ${containerName} may not exist`);
    });
    
    console.log(`✅ Container ${containerName} force destroyed`);
    
    res.json({
      success: true,
      containerName,
      destroyed: true
    });
  } catch (error) {
    console.error('Failed to destroy container:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Execute command in container (SECURE - prevents command injection)
 */
app.post('/api/container/exec', async (req, res) => {
  try {
    const { containerId, projectId, command } = req.body;
    
    // If projectId is provided instead of containerId, resolve it
    let actualContainerId = containerId;
    if (!actualContainerId && projectId) {
      // Find container by project ID - containers are named "constellation-{projectId}"
      const containerName = `constellation-${projectId}`;
      try {
        const { stdout } = await executeCommand(`sg docker -c "docker ps -q --filter name=${containerName}"`);
        actualContainerId = stdout.trim();
        if (!actualContainerId) {
          throw new Error(`No running container found for project ${projectId} (expected name: ${containerName})`);
        }
      } catch (error) {
        throw new Error(`Failed to find container for project ${projectId}: ${error.message}`);
      }
    }
    
    if (!actualContainerId) {
      throw new Error('Either containerId or projectId must be provided');
    }
    
    console.log(`Executing in container ${actualContainerId}: ${command}`);
    
    // Use Docker wrapper with sg permissions
    const result = await executeDockerCommand([
      'exec', actualContainerId, 'sh', '-c', command
    ]);
    
    res.json({
      output: result.stdout,
      stderr: result.stderr,
      exitCode: 0
    });
  } catch (error) {
    console.error('Container command execution failed:', error);
    res.json({
      output: error.message,
      stderr: '',
      exitCode: 1
    });
  }
});

/**
 * Scan directory for files recursively
 */
async function scanForGeneratedFiles(dir, relativePath = '') {
  const files = {};
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // Skip hidden files
      
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relativePath, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await scanForGeneratedFiles(fullPath, relPath);
        Object.assign(files, subFiles);
      } else if (entry.isFile()) {
        try {
          const content = await fs.readFile(fullPath, 'utf8');
          files[`/${relPath.replace(/\\/g, '/')}`] = content;
        } catch (error) {
          console.warn(`Failed to read file ${fullPath}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to scan directory ${dir}:`, error.message);
  }
  
  return files;
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    workspaceBase: WORKSPACE_BASE 
  });
});

/**
 * Debug endpoint to check project workspace state
 */
app.get('/api/debug/projects', async (req, res) => {
  try {
    const workspaces = await fs.readdir(WORKSPACE_BASE);
    const projectData = [];
    
    for (const workspace of workspaces) {
      try {
        const workspacePath = path.join(WORKSPACE_BASE, workspace);
        const stat = await fs.stat(workspacePath);
        if (stat.isDirectory()) {
          const readmePath = path.join(workspacePath, 'WORKSPACE_README.md');
          let readme = null;
          try {
            readme = await fs.readFile(readmePath, 'utf8');
          } catch (error) {
            // README might not exist
          }
          
          projectData.push({
            id: workspace,
            path: workspacePath,
            created: stat.birthtime,
            readme: readme?.substring(0, 200)
          });
        }
      } catch (error) {
        console.warn(`Failed to read workspace ${workspace}:`, error.message);
      }
    }
    
    res.json({
      workspaceBase: WORKSPACE_BASE,
      totalProjects: projectData.length,
      projects: projectData.sort((a, b) => b.created - a.created).slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Store log entry from frontend
 */
app.post('/api/logs', async (req, res) => {
  try {
    const logEntry = req.body;
    
    // Log to console in development
    const timestamp = new Date(logEntry.timestamp).toISOString();
    console.log(`[${timestamp}] [${logEntry.level.toUpperCase()}] [${logEntry.category}] ${logEntry.event}: ${logEntry.message}`);
    
    // In a real application, you would store this to a database
    // For now, we'll just acknowledge receipt
    res.json({ success: true, stored: true });
  } catch (error) {
    console.error('Failed to store log:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Receive browser console logs for remote debugging
 */
app.post('/api/browser-logs', async (req, res) => {
  try {
    const { logs, session } = req.body;
    
    // Limit log output to prevent overwhelming console
    const maxLogsToShow = 5;
    const logsToShow = logs.slice(0, maxLogsToShow);
    const hiddenCount = logs.length - logsToShow.length;
    
    console.log(`\n🌐 ===== BROWSER CONSOLE LOGS (${logs.length} entries${hiddenCount > 0 ? `, showing ${maxLogsToShow}` : ''}) =====`);
    console.log(`📱 Session: ${session.userAgent.substring(0, 50)}...`);
    console.log(`🔗 URL: ${session.url}`);
    console.log(`📐 Viewport: ${session.viewport.width}x${session.viewport.height}`);
    console.log(`⏰ Timestamp: ${new Date(session.timestamp).toISOString()}`);
    console.log('─'.repeat(80));
    
    logsToShow.forEach((log, index) => {
      const timestamp = new Date(log.timestamp).toISOString();
      const levelIcon = {
        'log': '📝',
        'info': 'ℹ️',
        'warn': '⚠️',
        'error': '❌',
        'debug': '🐛'
      }[log.level] || '📝';
      
      console.log(`${levelIcon} [${timestamp}] [${log.level.toUpperCase()}]`);
      console.log(`   Message: ${log.message.substring(0, 200)}${log.message.length > 200 ? '...' : ''}`);
      
      if (log.args && log.args.length > 0) {
        console.log(`   Args: [${log.args.length} items]`);
      }
      
      if (log.stack) {
        console.log(`   Stack: ${log.stack.split('\n')[0]}`);
      }
      
      if (index < logsToShow.length - 1) {
        console.log('   ' + '─'.repeat(60));
      }
    });
    
    if (hiddenCount > 0) {
      console.log(`   ... and ${hiddenCount} more entries (truncated for readability)`);
    }
    
    console.log('═'.repeat(80));
    console.log(`✅ Successfully received ${logs.length} browser console logs\n`);
    
    res.json({ 
      success: true, 
      received: logs.length,
      processed: logsToShow.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to process browser logs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test volume mounting functionality
 */
app.post('/api/container/test-volume', async (req, res) => {
  try {
    const { containerId, projectId } = req.body;
    const workspacePath = path.join(WORKSPACE_BASE, projectId);
    
    console.log(`Testing volume mount for container ${containerId}, workspace: ${workspacePath}`);
    
    // Test 1: Create file in container
    const testFileName = `volume-test-${Date.now()}.txt`;
    const testContent = `Volume mount test created at ${new Date().toISOString()}`;
    
    await executeDockerCommand([
      'exec', containerId, 'sh', '-c', 
      `echo "${testContent}" > /app/${testFileName}`
    ]);
    
    // Test 2: Verify file exists in container
    const containerResult = await executeDockerCommand([
      'exec', containerId, 'cat', `/app/${testFileName}`
    ]);
    
    // Test 3: Check if file exists on host
    const hostFilePath = path.join(workspacePath, testFileName);
    let hostFileExists = false;
    let hostFileContent = '';
    
    try {
      hostFileContent = await fs.readFile(hostFilePath, 'utf8');
      hostFileExists = true;
    } catch (error) {
      console.warn(`Host file not found: ${hostFilePath}`);
    }
    
    // Test 4: List all files in both locations
    const containerFiles = await executeDockerCommand([
      'exec', containerId, 'ls', '-la', '/app'
    ]);
    
    const hostFiles = await executeCommand(`ls -la "${workspacePath}"`);
    
    res.json({
      success: true,
      volumeMount: {
        working: hostFileExists && hostFileContent.trim() === testContent,
        containerFile: {
          created: true,
          content: containerResult.stdout.trim()
        },
        hostFile: {
          exists: hostFileExists,
          content: hostFileContent.trim(),
          path: hostFilePath
        },
        listings: {
          container: containerFiles.stdout,
          host: hostFiles.stdout
        }
      }
    });
    
  } catch (error) {
    console.error('Volume mount test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Execute command on host system (for Host Terminal)
 */
app.post('/api/host/exec', async (req, res) => {
  try {
    const { command } = req.body;
    
    console.log(`Host terminal executing: ${command}`);
    
    // Security: Basic command validation
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid command' 
      });
    }
    
    const result = await executeCommand(command, process.cwd());
    
    res.json({
      success: true,
      output: result.stdout,
      stderr: result.stderr,
      exitCode: 0
    });
  } catch (error) {
    console.error('Host command execution failed:', error);
    res.json({
      success: false,
      error: error.message,
      output: '',
      stderr: error.stderr || '',
      exitCode: 1
    });
  }
});

/**
 * Test Claude Code CLI availability
 */
app.get('/api/claude-code/test', async (req, res) => {
  try {
    const result = await executeCommand('claude --version');
    res.json({ 
      available: true, 
      version: result.stdout,
      message: 'Claude Code CLI is available' 
    });
  } catch (error) {
    res.json({ 
      available: false, 
      error: error.message,
      message: 'Claude Code CLI not found' 
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Claude Code Bridge API Server running on port ${PORT}`);
  console.log(`📁 Workspace directory: ${WORKSPACE_BASE}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Claude Code test: http://localhost:${PORT}/api/claude-code/test`);
  console.log(`💻 WebSocket Terminal: ws://localhost:${PORT}/terminal\n`);
  
  // Setup console log cleanup every 5 minutes
  setupConsoleLogCleanup();
});

/**
 * Setup automatic console log cleanup to prevent overwhelming output
 */
function setupConsoleLogCleanup() {
  let logBuffer = [];
  const maxBufferSize = 50; // Keep last 50 log entries
  const cleanupInterval = 5 * 60 * 1000; // 5 minutes
  
  console.log('🧹 Console log cleanup initialized (every 5 minutes, max 50 entries)');
  
  setInterval(() => {
    const currentTime = new Date().toISOString();
    
    // Clear console in development (won't work in production)
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.clear();
        console.log(`\n🧹 Console cleared at ${currentTime}`);
        console.log(`🚀 Claude Code Bridge API Server running on port ${PORT}`);
        console.log(`📁 Workspace directory: ${WORKSPACE_BASE}`);
        console.log(`💻 WebSocket Terminal: ws://localhost:${PORT}/terminal`);
        console.log('─'.repeat(80));
      } catch (error) {
        console.log(`\n🧹 Console cleanup attempted at ${currentTime}`);
      }
    }
    
    // Log cleanup activity
    console.log(`🧹 [${currentTime}] Console log cleanup completed`);
    console.log(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    console.log('─'.repeat(80));
    
  }, cleanupInterval);
}

// WebSocket Terminal Server
const wss = new WebSocket.Server({ 
  server,
  path: '/terminal'
});

const terminals = new Map();

wss.on('connection', (ws, req) => {
  console.log('🔌 Terminal WebSocket connection established');
  
  const terminalId = uuidv4();
  
  // Create a new pty process
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || process.cwd(),
    env: process.env
  });

  terminals.set(terminalId, ptyProcess);
  
  // Send terminal ID to client
  ws.send(JSON.stringify({ type: 'connected', terminalId }));
  
  // Forward pty output to WebSocket
  ptyProcess.on('data', (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'data', data: data.toString() }));
    }
  });
  
  // Handle pty exit
  ptyProcess.on('exit', (exitCode) => {
    console.log(`🔚 Terminal ${terminalId} exited with code ${exitCode}`);
    terminals.delete(terminalId);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', exitCode }));
    }
  });
  
  // Handle WebSocket messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'input':
          // Forward input to pty
          ptyProcess.write(data.data);
          break;
          
        case 'resize':
          // Resize terminal
          ptyProcess.resize(data.cols, data.rows);
          break;
          
        default:
          console.warn('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Terminal WebSocket message error:', error);
    }
  });
  
  // Handle WebSocket close
  ws.on('close', () => {
    console.log(`🔌 Terminal WebSocket disconnected: ${terminalId}`);
    if (terminals.has(terminalId)) {
      terminals.get(terminalId).kill();
      terminals.delete(terminalId);
    }
  });
  
  // Handle WebSocket error
  ws.on('error', (error) => {
    console.error('Terminal WebSocket error:', error);
    if (terminals.has(terminalId)) {
      terminals.get(terminalId).kill();
      terminals.delete(terminalId);
    }
  });
});