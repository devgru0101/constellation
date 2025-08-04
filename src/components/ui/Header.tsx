import React, { useState } from 'react'
import { useSnapshot } from 'valtio'
import { appStore, useAppStore } from '@/stores/app-store'
import { Database, Rocket, Terminal, RefreshCw } from 'lucide-react'
import { ProjectSelector } from '@/components/project/ProjectSelector'
import { RealTerminalModal } from '@/components/system/RealTerminalModal'
import { claudeCodeAPI } from '@/services/claude-code-api'
import { errorDetectionService } from '@/services/error-detection-service'

export const Header: React.FC = () => {
  const state = useSnapshot(appStore)
  const { toggleKnowledgeBase, setActiveView, addChatMessage } = useAppStore()
  const [hostTerminalOpen, setHostTerminalOpen] = useState(false)
  const [isRebuilding, setIsRebuilding] = useState(false)

  const tabs: { id: typeof state.activeView; label: string }[] = [
    { id: 'code', label: 'Code' },
    { id: 'preview', label: 'Preview' },
    { id: 'encore-dashboard', label: 'Encore Dashboard' },
  ]

  const handleForceRebuild = async () => {
    if (!state.currentProject || isRebuilding) return;

    setIsRebuilding(true);

    addChatMessage({
      role: 'assistant',
      content: `🔄 **Force Rebuild**: Starting complete container rebuild...\n\n🚢 Destroying current container...\n🏗️ Creating fresh container...\n📦 Installing dependencies...\n🚀 Starting application...`,
      type: 'generation',
      agentId: 'master-orchestrator'
    });

    try {
      // Import Claude Code API for proper container management
      const { claudeCodeAPI } = await import('@/services/claude-code-api');
      
      addChatMessage({
        role: 'assistant',
        content: `🚢 **Force Rebuild**: Destroying current container...`,
        type: 'generation',
        agentId: 'master-orchestrator'
      });

      // Destroy current workspace and container
      try {
        await claudeCodeAPI.destroyWorkspace(state.currentProject.id);
      } catch (error) {
        // Ignore if workspace/container doesn't exist
        console.log('No existing workspace to destroy:', error);
      }

      addChatMessage({
        role: 'assistant',
        content: `🏗️ **Force Rebuild**: Creating fresh container...`,
        type: 'generation',
        agentId: 'master-orchestrator'
      });

      // Create new workspace
      const newWorkspace = await claudeCodeAPI.createProjectWorkspace(
        state.currentProject.id, 
        state.currentProject.name
      );

      // Determine project type and container configuration
      const isEncoreProject = state.currentProject.type?.includes('encore') || 
                             state.currentProject.type === 'microservices';

      const containerConfig = {
        image: 'node:18-alpine',
        ports: isEncoreProject ? [3000, 4000, 9091] : [3000, 4000], // Include Encore dashboard port
        environment: {
          NODE_ENV: 'development',
          ...(isEncoreProject && { ENCORE_ENVIRONMENT: 'development' })
        }
      };

      // Create and start container
      const containerId = await claudeCodeAPI.createContainer(state.currentProject.id, containerConfig);

      addChatMessage({
        role: 'assistant',
        content: `✅ **Force Rebuild**: Container created successfully (${containerId.substring(0, 12)})\n\n📦 **Installing dependencies...**`,
        type: 'generation',
        agentId: 'master-orchestrator'
      });

      // Install dependencies in the new container
      const installResult = await claudeCodeAPI.executeCommand(state.currentProject.id, 'npm install');
      
      if (installResult.exitCode !== 0) {
        addChatMessage({
          role: 'assistant',
          content: `❌ **Force Rebuild**: Failed to install dependencies.\n\n\`\`\`\n${installResult.output}\n\`\`\``,
          type: 'generation',
          agentId: 'master-orchestrator'
        });
        return;
      }

      addChatMessage({
        role: 'assistant',
        content: `✅ **Force Rebuild**: Dependencies installed successfully\n\n${isEncoreProject ? '🏗️ **Initializing Encore project...**' : '🚀 **Starting application...**'}`,
        type: 'generation',
        agentId: 'master-orchestrator'
      });

      // For Encore projects, initialize a basic project structure first
      if (isEncoreProject) {
        const initResult = await claudeCodeAPI.executeCommand(state.currentProject.id, 'npx encore app init . --name="' + state.currentProject.name + '"');
        
        if (initResult.exitCode !== 0) {
          // If init fails, try creating minimal project structure manually
          await claudeCodeAPI.executeCommand(state.currentProject.id, 'mkdir -p hello');
          await claudeCodeAPI.executeCommand(state.currentProject.id, `cat > hello/hello.ts << 'EOF'
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
          
          addChatMessage({
            role: 'assistant',
            content: `✅ **Force Rebuild**: Basic Encore project structure created\n\n🚀 **Starting application...**`,
            type: 'generation',
            agentId: 'master-orchestrator'
          });
        } else {
          addChatMessage({
            role: 'assistant',
            content: `✅ **Force Rebuild**: Encore project initialized successfully\n\n🚀 **Starting application...**`,
            type: 'generation',
            agentId: 'master-orchestrator'
          });
        }
      }

      // Start the application based on project type
      const startCommand = isEncoreProject ? 'npx encore run' : 'npm run dev';
      
      // Start application in background (don't wait for completion)
      claudeCodeAPI.executeCommand(state.currentProject.id, startCommand).then((result) => {
        if (result.exitCode === 0) {
          addChatMessage({
            role: 'assistant',
            content: `✅ **Force Rebuild**: Application started successfully!\n\n🌐 **Application URLs:**\n- Frontend: http://localhost:3000\n- Backend API: http://localhost:4000\n${isEncoreProject ? '- Encore Dashboard: http://localhost:9091' : ''}\n\n🎉 **Status**: Ready for development!`,
            type: 'generation',
            agentId: 'master-orchestrator'
          });
        } else {
          // Use error detection service for intelligent debugging
          errorDetectionService.debugError(
            state.currentProject.id,
            result.output,
            startCommand,
            state.currentProject.type,
            1 // First attempt
          ).then(async (debugResult) => {
            if (debugResult.success) {
              addChatMessage({
                role: 'assistant',
                content: `🔧 **Force Rebuild**: Detected and fixed application issues!\n\n✅ **Fixes Applied:**\n${debugResult.fixesApplied.map(fix => `• ${fix}`).join('\n')}\n\n🔄 **Retrying application start...**`,
                type: 'generation',
                agentId: 'debugging-agent'
              });

              // Retry starting the application after fixes
              const retryResult = await claudeCodeAPI.executeCommand(state.currentProject.id, startCommand);
              if (retryResult.exitCode === 0) {
                addChatMessage({
                  role: 'assistant',
                  content: `✅ **Force Rebuild**: Application started successfully after debugging!\n\n🌐 **Application URLs:**\n- Frontend: http://localhost:3000\n- Backend API: http://localhost:4000\n${isEncoreProject ? '- Encore Dashboard: http://localhost:9091' : ''}\n\n🎉 **Status**: Ready for development!`,
                  type: 'generation',
                  agentId: 'master-orchestrator'
                });
              } else {
                addChatMessage({
                  role: 'assistant',
                  content: `⚠️ **Force Rebuild**: Application still has issues after attempted fixes.\n\n🔍 **Analysis:** ${debugResult.analysis.description}\n\n📋 **Remaining Issues:**\n${debugResult.remainingIssues.map(issue => `• ${issue}`).join('\n')}\n\n\`\`\`\n${retryResult.output}\n\`\`\``,
                  type: 'generation',
                  agentId: 'debugging-agent'
                });
              }
            } else {
              addChatMessage({
                role: 'assistant',
                content: `❌ **Force Rebuild**: Unable to automatically fix application issues.\n\n🔍 **Analysis:** ${debugResult.analysis.description}\n\n💡 **Suggested Actions:**\n${debugResult.analysis.suggestedFixes.map(fix => `• ${fix}`).join('\n')}\n\n\`\`\`\n${result.output}\n\`\`\``,
                type: 'generation',
                agentId: 'debugging-agent'
              });
            }
          }).catch((debugError) => {
            addChatMessage({
              role: 'assistant',
              content: `❌ **Force Rebuild**: Error during debugging analysis: ${(debugError as Error).message}\n\n⚠️ **Original Error:**\n\`\`\`\n${result.output}\n\`\`\``,
              type: 'generation',
              agentId: 'master-orchestrator'
            });
          });
        }
      }).catch((error) => {
        // Handle command execution errors with error detection
        errorDetectionService.debugError(
          state.currentProject.id,
          (error as Error).message,
          startCommand,
          state.currentProject.type,
          1 // First attempt
        ).then((debugResult) => {
          addChatMessage({
            role: 'assistant',
            content: `❌ **Force Rebuild**: Command execution failed.\n\n🔍 **Analysis:** ${debugResult.analysis.description}\n\n💡 **Suggested Actions:**\n${debugResult.analysis.suggestedFixes.map(fix => `• ${fix}`).join('\n')}\n\nError: ${(error as Error).message}`,
            type: 'generation',
            agentId: 'debugging-agent'
          });
        }).catch(() => {
          addChatMessage({
            role: 'assistant',
            content: `❌ **Force Rebuild**: Error starting application: ${(error as Error).message}`,
            type: 'generation',
            agentId: 'master-orchestrator'
          });
        });
      });

      // Immediate success message for container creation
      addChatMessage({
        role: 'assistant',
        content: `✅ **Force Rebuild**: Container rebuild completed successfully!\n\n🚀 Application is starting up in the fresh container. Please check the preview panel.`,
        type: 'generation',
        agentId: 'master-orchestrator'
      });

    } catch (error) {
      addChatMessage({
        role: 'assistant',
        content: `❌ **Force Rebuild**: Container rebuild failed: ${(error as Error).message}\n\nThis may indicate an issue with the Claude Code CLI or container system.`,
        type: 'generation',
        agentId: 'master-orchestrator'
      });
    } finally {
      setIsRebuilding(false);
    }
  };

  return (
    <div className="header h-[54px] bg-constellation-bg-secondary border-b border-constellation-border flex items-center px-4 gap-4">
      {/* Project Selector */}
      <ProjectSelector />

      {/* Header Tabs */}
      <div className="header-tabs flex gap-1 ml-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`header-tab px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 relative ${
              state.activeView === tab.id
                ? 'text-constellation-text-primary bg-constellation-bg-tertiary'
                : 'text-constellation-text-secondary hover:text-constellation-text-primary hover:bg-constellation-bg-tertiary'
            }`}
            onClick={() => setActiveView(tab.id)}
          >
            {tab.label}
            {state.activeView === tab.id && (
              <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-constellation-accent-blue" />
            )}
          </button>
        ))}
      </div>

      {/* Header Actions */}
      <div className="header-actions ml-auto flex gap-3">
        <button
          className="btn btn-secondary flex items-center gap-2 px-4 py-1.5 bg-constellation-bg-tertiary border border-constellation-border text-constellation-text-secondary hover:text-constellation-text-primary hover:border-constellation-text-tertiary rounded-md text-sm transition-colors"
          onClick={toggleKnowledgeBase}
        >
          <div className="w-2 h-2 bg-constellation-success rounded-full" />
          Knowledge Base
        </button>
        
        <button 
          className="btn btn-secondary flex items-center gap-2 px-4 py-1.5 bg-constellation-bg-tertiary border border-constellation-border text-constellation-text-secondary hover:text-constellation-text-primary hover:border-constellation-text-tertiary rounded-md text-sm transition-colors"
          onClick={() => setHostTerminalOpen(true)}
        >
          <Terminal size={14} />
          Host Terminal
        </button>
        
        <button className="btn btn-secondary flex items-center gap-2 px-4 py-1.5 bg-constellation-bg-tertiary border border-constellation-border text-constellation-text-secondary hover:text-constellation-text-primary hover:border-constellation-text-tertiary rounded-md text-sm transition-colors">
          <Database size={14} />
          Reset Database
        </button>
        
        <button 
          onClick={handleForceRebuild}
          disabled={isRebuilding}
          className="btn btn-secondary flex items-center gap-2 px-4 py-1.5 bg-constellation-bg-tertiary border border-constellation-border text-constellation-text-secondary hover:text-constellation-text-primary hover:border-constellation-text-tertiary rounded-md text-sm transition-colors disabled:opacity-50"
          title="Force rebuild the project container"
        >
          {isRebuilding ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          {isRebuilding ? 'Rebuilding...' : 'Force Rebuild'}
        </button>
        
        <button className="btn btn-primary flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-constellation-accent-yellow to-constellation-accent-green text-constellation-bg-primary font-medium rounded-md text-sm hover:opacity-90 transition-opacity">
          <Rocket size={14} />
          Deploy
        </button>
      </div>

      {/* Real Terminal Modal */}
      <RealTerminalModal 
        isOpen={hostTerminalOpen}
        onClose={() => setHostTerminalOpen(false)}
      />
    </div>
  )
}