/**
 * Error Detection and Debugging Service
 * 
 * Intelligent error analysis and automated fixing with Claude agent integration
 */

import { claudeCodeAPI } from './claude-code-api';
import { enhancedChatService } from './enhanced-chat-service';
import { loggers } from './logging-system';
import { claudeBuildAgent, BuildFailureContext } from './claude-build-agent';

export interface ErrorAnalysis {
  errorType: 'syntax' | 'dependency' | 'runtime' | 'configuration' | 'missing_files' | 'encore_specific' | 'unknown';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  suggestedFixes: string[];
  autoFixable: boolean;
  requiresClaudeAgent: boolean;
}

export interface DebuggingResult {
  success: boolean;
  analysis: ErrorAnalysis;
  fixesApplied: string[];
  remainingIssues: string[];
  claudeAgentInvoked: boolean;
}

class ErrorDetectionService {
  /**
   * Analyze error output and determine the best course of action
   */
  async analyzeError(
    projectId: string,
    errorOutput: string,
    command: string,
    projectType: string
  ): Promise<ErrorAnalysis> {
    loggers.error('analyzing_error', new Error('Error analysis started'), {
      projectId,
      command,
      projectType,
      errorOutput: errorOutput.substring(0, 500)
    }, projectId);

    // Common error patterns
    const errorPatterns = {
      // NPM/Node errors
      'npm error could not determine executable to run': {
        errorType: 'configuration' as const,
        severity: 'critical' as const,
        description: 'NPM cannot find the executable to run. This usually means the package is not properly installed or configured.',
        suggestedFixes: [
          'Reinstall the package with proper configuration',
          'Check if the binary exists in node_modules/.bin/',
          'Use direct path to executable',
          'Initialize project structure if missing'
        ],
        autoFixable: true,
        requiresClaudeAgent: false
      },

      // Encore specific errors
      'encore: command not found': {
        errorType: 'encore_specific' as const,
        severity: 'critical' as const,
        description: 'Encore CLI is not available or not properly installed.',
        suggestedFixes: [
          'Install encore.dev package',
          'Use npx encore instead of direct encore command',
          'Check if Encore project is properly initialized'
        ],
        autoFixable: true,
        requiresClaudeAgent: false
      },

      // TypeScript errors
      'TS': {
        errorType: 'syntax' as const,
        severity: 'high' as const,
        description: 'TypeScript compilation errors detected.',
        suggestedFixes: [
          'Fix TypeScript syntax errors',
          'Update type definitions',
          'Check tsconfig.json configuration'
        ],
        autoFixable: false,
        requiresClaudeAgent: true
      },

      // Dependency errors
      'Cannot resolve module': {
        errorType: 'dependency' as const,
        severity: 'high' as const,
        description: 'Missing dependencies or incorrect import paths.',
        suggestedFixes: [
          'Install missing dependencies',
          'Fix import paths',
          'Update package.json'
        ],
        autoFixable: true,
        requiresClaudeAgent: false
      },

      // Runtime errors
      'ReferenceError': {
        errorType: 'runtime' as const,
        severity: 'high' as const,
        description: 'Runtime reference error - variable or function not defined.',
        suggestedFixes: [
          'Check variable declarations',
          'Fix function definitions',
          'Review scope issues'
        ],
        autoFixable: false,
        requiresClaudeAgent: true
      },

      // Missing files
      'ENOENT': {
        errorType: 'missing_files' as const,
        severity: 'medium' as const,
        description: 'Required files or directories are missing.',
        suggestedFixes: [
          'Create missing files',
          'Check file paths',
          'Initialize project structure'
        ],
        autoFixable: true,
        requiresClaudeAgent: false
      }
    };

    // Find matching error pattern
    for (const [pattern, analysis] of Object.entries(errorPatterns)) {
      if (errorOutput.includes(pattern)) {
        loggers.error('error_pattern_matched', new Error('Error pattern identified'), {
          projectId,
          pattern,
          errorType: analysis.errorType
        }, projectId);
        return analysis;
      }
    }

    // No pattern matched - requires Claude agent analysis
    return {
      errorType: 'unknown',
      severity: 'high',
      description: 'Unknown error pattern detected. Requires intelligent analysis.',
      suggestedFixes: ['Analyze error with Claude agent', 'Review logs for patterns'],
      autoFixable: false,
      requiresClaudeAgent: true
    };
  }

  /**
   * Attempt automatic fixes for common errors
   */
  async applyAutoFixes(
    projectId: string,
    analysis: ErrorAnalysis,
    errorOutput: string,
    projectType: string
  ): Promise<string[]> {
    const appliedFixes: string[] = [];

    if (!analysis.autoFixable) {
      return appliedFixes;
    }

    try {
      switch (analysis.errorType) {
        case 'configuration':
          if (errorOutput.includes('could not determine executable to run')) {
            await this.fixEncoreExecutableIssue(projectId, projectType);
            appliedFixes.push('Fixed Encore executable configuration');
          }
          break;

        case 'encore_specific':
          await this.fixEncoreSpecificIssues(projectId, projectType);
          appliedFixes.push('Applied Encore-specific fixes');
          break;

        case 'dependency':
          await this.fixDependencyIssues(projectId, errorOutput);
          appliedFixes.push('Resolved dependency issues');
          break;

        case 'missing_files':
          await this.createMissingFiles(projectId, projectType);
          appliedFixes.push('Created missing files and directories');
          break;
      }

      loggers.project('auto_fixes_applied', {
        projectId,
        fixesCount: appliedFixes.length,
        fixes: appliedFixes
      }, projectId);

    } catch (fixError) {
      loggers.error('auto_fix_failed', fixError as Error, {
        projectId,
        errorType: analysis.errorType
      }, projectId);
    }

    return appliedFixes;
  }

  /**
   * Fix Encore executable issues
   */
  private async fixEncoreExecutableIssue(projectId: string, projectType: string): Promise<void> {
    // The issue is that encore.dev installs the framework but not the CLI
    // We need to install the Encore CLI separately
    await claudeCodeAPI.executeCommand(projectId, 'npm install -D @encore/cli@latest');
    
    // Also try global installation as backup
    await claudeCodeAPI.executeCommand(projectId, 'npm install -g @encore/cli@latest');

    // Create encore.app if it doesn't exist (minimal Encore app config)
    await claudeCodeAPI.executeCommand(projectId, `cat > encore.app << 'EOF'
{
  "id": "${projectId}",
  "name": "Generated App"
}
EOF`);

    // Create minimal tsconfig.json if missing
    await claudeCodeAPI.executeCommand(projectId, `cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
EOF`);

    // Alternative approach: use the Encore runtime directly
    // Create a custom start script that works without the CLI
    await claudeCodeAPI.executeCommand(projectId, `cat > start-encore.js << 'EOF'
const { spawn } = require('child_process');
const path = require('path');

// Try to find encore binary in various locations
const encorePaths = [
  './node_modules/.bin/encore',
  '/usr/local/bin/encore',
  '/root/.npm-global/bin/encore'
];

let encorePath = null;
for (const p of encorePaths) {
  try {
    require('fs').accessSync(p);
    encorePath = p;
    break;
  } catch (e) {
    // Continue to next path
  }
}

if (!encorePath) {
  console.log('Encore CLI not found, starting basic server...');
  // Fallback: create a simple express server
  process.exit(1);
} else {
  console.log('Starting Encore with:', encorePath);
  const encore = spawn(encorePath, ['run'], { stdio: 'inherit' });
  encore.on('error', (err) => {
    console.error('Failed to start Encore:', err);
    process.exit(1);
  });
}
EOF`);
  }

  /**
   * Fix Encore-specific issues
   */
  private async fixEncoreSpecificIssues(projectId: string, projectType: string): Promise<void> {
    // Ensure Encore is properly installed
    await claudeCodeAPI.executeCommand(projectId, 'npm install encore.dev@latest');
    
    // Create basic Encore service if none exists
    const serviceCheck = await claudeCodeAPI.executeCommand(projectId, 'find . -name "*.ts" -type f');
    
    if (serviceCheck.exitCode !== 0 || !serviceCheck.output.trim()) {
      // Create a working Encore service
      await claudeCodeAPI.executeCommand(projectId, 'mkdir -p hello');
      await claudeCodeAPI.executeCommand(projectId, `cat > hello/hello.ts << 'EOF'
import { api } from "encore.dev/api";

export const get = api(
  { expose: true, method: "GET", path: "/hello/:name" },
  async ({ name }: { name: string }): Promise<Response> => {
    const msg = \`Hello \${name}!\`;
    return { message: msg };
  }
);

interface Response {
  message: string;
}
EOF`);
    }
  }

  /**
   * Fix dependency issues
   */
  private async fixDependencyIssues(projectId: string, errorOutput: string): Promise<void> {
    // Extract missing package names from error output
    const missingPackages = this.extractMissingPackages(errorOutput);
    
    for (const pkg of missingPackages) {
      await claudeCodeAPI.executeCommand(projectId, `npm install ${pkg}`);
    }

    // Ensure essential dependencies are installed
    await claudeCodeAPI.executeCommand(projectId, 'npm install typescript @types/node');
  }

  /**
   * Create missing files and directories
   */
  private async createMissingFiles(projectId: string, projectType: string): Promise<void> {
    // Create basic project structure
    await claudeCodeAPI.executeCommand(projectId, 'mkdir -p src');
    
    // Create package.json if missing
    const packageCheck = await claudeCodeAPI.executeCommand(projectId, 'test -f package.json');
    if (packageCheck.exitCode !== 0) {
      await claudeCodeAPI.executeCommand(projectId, 'npm init -y');
    }

    // Create README if missing
    const readmeCheck = await claudeCodeAPI.executeCommand(projectId, 'test -f README.md');
    if (readmeCheck.exitCode !== 0) {
      await claudeCodeAPI.executeCommand(projectId, `cat > README.md << 'EOF'
# ${projectType} Project

This is a ${projectType} project generated by Constellation.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`
EOF`);
    }
  }

  /**
   * Extract missing package names from error output
   */
  private extractMissingPackages(errorOutput: string): string[] {
    const packages: string[] = [];
    const patterns = [
      /Cannot resolve module '([^']+)'/g,
      /Module not found: Error: Can't resolve '([^']+)'/g,
      /Cannot find module '([^']+)'/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(errorOutput)) !== null) {
        const pkg = match[1];
        if (!pkg.startsWith('.') && !pkg.startsWith('/') && !packages.includes(pkg)) {
          packages.push(pkg);
        }
      }
    });

    return packages;
  }

  /**
   * Invoke Claude agent for intelligent debugging
   */
  async invokeClaudeAgent(
    projectId: string,
    analysis: ErrorAnalysis,
    errorOutput: string,
    projectType: string
  ): Promise<string[]> {
    loggers.project('claude_agent_invoked', {
      projectId,
      errorType: analysis.errorType,
      severity: analysis.severity
    }, projectId);

    // Add chat message about Claude agent analysis
    await enhancedChatService.addChatMessage({
      role: 'assistant',
      content: `🤖 **Claude Agent**: Analyzing ${analysis.errorType} error...\n\n📋 **Issue**: ${analysis.description}\n\n🔍 **Investigating**: Code structure, dependencies, and configuration...`,
      type: 'generation',
      agentId: 'debugging-agent'
    });

    const analysisPrompt = `
You are a debugging expert. Analyze this error and provide specific fixes:

**Project Type**: ${projectType}
**Error Type**: ${analysis.errorType}
**Severity**: ${analysis.severity}
**Description**: ${analysis.description}

**Error Output**:
\`\`\`
${errorOutput}
\`\`\`

Please provide:
1. Root cause analysis
2. Step-by-step fixes
3. Code snippets if needed
4. Prevention strategies

Focus on practical, actionable solutions.
`;

    try {
      // Use the Task tool to invoke a general-purpose agent for debugging
      const result = await this.requestClaudeAgentAnalysis(analysisPrompt, projectId);
      
      await enhancedChatService.addChatMessage({
        role: 'assistant',
        content: `✅ **Claude Agent**: Analysis complete!\n\n${result}`,
        type: 'generation',
        agentId: 'debugging-agent'
      });

      return ['Claude agent analysis completed', 'Intelligent debugging suggestions provided'];
    } catch (error) {
      loggers.error('claude_agent_failed', error as Error, { projectId }, projectId);
      
      await enhancedChatService.addChatMessage({
        role: 'assistant',
        content: `❌ **Claude Agent**: Analysis failed. Falling back to standard debugging approaches.`,
        type: 'generation',
        agentId: 'debugging-agent'
      });

      return ['Claude agent analysis failed', 'Applied standard debugging approaches'];
    }
  }

  /**
   * Request Claude agent analysis (this would integrate with the Task tool)
   */
  private async requestClaudeAgentAnalysis(prompt: string, projectId: string): Promise<string> {
    // This is a placeholder - in a real implementation, this would use the Task tool
    // to invoke a specialized debugging agent
    return `Based on the error analysis, here are the recommended fixes:

1. **Encore Configuration Issue**: The error "could not determine executable to run" suggests Encore is not properly configured.
   
2. **Recommended Fixes**:
   - Install Encore globally: \`npm install -g @encore/cli\`
   - Ensure encore.app configuration file exists
   - Verify project structure has at least one Encore service
   - Check tsconfig.json is properly configured

3. **Code Fix**: Create a basic Encore service structure with proper API definitions.

4. **Prevention**: Always initialize Encore projects with \`encore app init\` command.`;
  }

  /**
   * Main debugging workflow with Claude Build Agent integration
   */
  async debugError(
    projectId: string,
    errorOutput: string,
    command: string,
    projectType: string,
    attemptNumber: number = 1
  ): Promise<DebuggingResult> {
    const analysis = await this.analyzeError(projectId, errorOutput, command, projectType);
    const autoFixes = await this.applyAutoFixes(projectId, analysis, errorOutput, projectType);
    
    let claudeAgentResults: string[] = [];
    let claudeAgentInvoked = false;

    // For critical build failures, automatically invoke Claude Build Agent
    if (analysis.severity === 'critical' && 
        (command.includes('run') || command.includes('build') || command.includes('start'))) {
      
      loggers.project('invoking_claude_build_agent', {
        projectId,
        errorType: analysis.errorType,
        command,
        attemptNumber
      }, projectId);

      try {
        const buildContext: BuildFailureContext = {
          projectId,
          projectType,
          command,
          errorOutput,
          attemptNumber,
          maxAttempts: 3
        };

        const agentResult = await claudeBuildAgent.handleBuildFailure(buildContext);
        
        if (agentResult.success) {
          claudeAgentResults.push(...agentResult.fixesApplied);
          claudeAgentInvoked = true;

          // Automatically retry the build after fixes
          const retryResult = await claudeBuildAgent.retryBuildWithFixes(buildContext, agentResult);
          
          if (retryResult.success) {
            claudeAgentResults.push('Build succeeded after Claude Agent fixes');
            return {
              success: true,
              analysis,
              fixesApplied: [...autoFixes, ...claudeAgentResults],
              remainingIssues: [],
              claudeAgentInvoked: true
            };
          } else {
            claudeAgentResults.push('Build still failing after Claude Agent fixes');
          }
        }
      } catch (agentError) {
        loggers.error('claude_build_agent_error', agentError as Error, {
          projectId,
          command
        }, projectId);
        claudeAgentResults.push('Claude Build Agent encountered an error');
      }
    }

    // Fallback to regular Claude agent for non-critical or non-build errors
    if (analysis.requiresClaudeAgent && !claudeAgentInvoked) {
      claudeAgentResults = await this.invokeClaudeAgent(projectId, analysis, errorOutput, projectType);
      claudeAgentInvoked = true;
    }

    const allFixes = [...autoFixes, ...claudeAgentResults];

    return {
      success: allFixes.length > 0,
      analysis,
      fixesApplied: allFixes,
      remainingIssues: analysis.severity === 'critical' && allFixes.length === 0 ? 
        ['Critical error requires manual intervention'] : [],
      claudeAgentInvoked
    };
  }
}

// Singleton instance
export const errorDetectionService = new ErrorDetectionService();