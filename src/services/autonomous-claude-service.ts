/**
 * Autonomous Claude Code Service
 * 
 * Handles Claude Code operating autonomously between user inputs and
 * manages feedback loops where Claude Code requests user input.
 */

import { claudeCodeAPI, type ClaudeCodeRequest, type ClaudeCodeResponse } from './claude-code-api';
import { projectWorkspaceManager } from './project-workspace';
import { appStore } from '@/stores/app-store';
import type { ChatMessage } from '@/types';
import { comprehensiveLogger } from './logging-system';

interface AutonomousTask {
  id: string;
  type: 'build' | 'test' | 'fix' | 'deploy' | 'analyze';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_for_user';
  attempts: number;
  maxAttempts: number;
  context: any;
  userInputRequired?: {
    question: string;
    options?: string[];
    timeout: number;
    resolveCallback?: (response: string) => void;
  };
}

interface AutonomousSession {
  id: string;
  projectId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'completed' | 'error';
  tasks: AutonomousTask[];
  userInterventions: number;
  successfulOperations: number;
  failedOperations: number;
}

class AutonomousClaudeService {
  private sessions: Map<string, AutonomousSession> = new Map();
  private activeSession: AutonomousSession | null = null;
  private taskQueue: AutonomousTask[] = [];
  private isProcessing = false;
  private userResponseTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Start autonomous operation session
   */
  async startAutonomousSession(
    projectId: string, 
    initialGoal: string,
    autonomyLevel: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<string> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: AutonomousSession = {
      id: sessionId,
      projectId,
      startTime: new Date(),
      status: 'active',
      tasks: [],
      userInterventions: 0,
      successfulOperations: 0,
      failedOperations: 0
    };

    this.sessions.set(sessionId, session);
    this.activeSession = session;

    // Log session start
    comprehensiveLogger.logUserInteraction('autonomous_session_start', {
      sessionId,
      projectId,
      initialGoal,
      autonomyLevel,
      timestamp: new Date()
    });

    // Add system message to chat
    const systemMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: `🤖 **Autonomous Mode Activated**\n\nI'll now work independently to achieve: "${initialGoal}"\n\n**Autonomy Level:** ${autonomyLevel}\n**Session ID:** ${sessionId}\n\nI'll keep you updated on my progress and ask for input when needed.`,
      type: 'autonomous_start',
      timestamp: new Date(),
      agentId: 'claude-autonomous'
    };
    appStore.chatMessages.push(systemMessage);

    // Start autonomous processing
    this.processAutonomously(initialGoal, autonomyLevel);

    return sessionId;
  }

  /**
   * Process tasks autonomously
   */
  private async processAutonomously(
    goal: string, 
    autonomyLevel: 'low' | 'medium' | 'high'
  ): Promise<void> {
    if (this.isProcessing || !this.activeSession) return;
    
    this.isProcessing = true;
    
    try {
      // Break down the goal into autonomous tasks
      const tasks = await this.planAutonomousTasks(goal, autonomyLevel);
      this.activeSession.tasks = tasks;
      this.taskQueue = [...tasks];

      // Process tasks sequentially
      while (this.taskQueue.length > 0 && this.activeSession?.status === 'active') {
        const currentTask = this.taskQueue.shift()!;
        await this.executeAutonomousTask(currentTask);
        
        // Small delay between tasks to prevent overwhelming
        await this.delay(1000);
      }

      // Complete session if all tasks are done
      if (this.taskQueue.length === 0 && this.activeSession) {
        await this.completeAutonomousSession();
      }

    } catch (error) {
      comprehensiveLogger.logError('autonomous_processing_error', error, {
        sessionId: this.activeSession?.id,
        goal,
        autonomyLevel
      });
      
      await this.handleAutonomousError(error as Error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Plan autonomous tasks based on goal
   */
  private async planAutonomousTasks(
    goal: string, 
    autonomyLevel: 'low' | 'medium' | 'high'
  ): Promise<AutonomousTask[]> {
    const maxAttempts = autonomyLevel === 'high' ? 5 : autonomyLevel === 'medium' ? 3 : 1;
    
    // Send planning request to Claude Code
    const planningResponse = await claudeCodeAPI.sendMessage({
      message: `Plan autonomous tasks to achieve: "${goal}". Break this down into specific, executable steps. Consider: file creation, building, testing, error fixing, and deployment.`,
      projectId: this.activeSession!.projectId,
      action: 'generate',
      context: {
        autonomyLevel,
        currentProject: projectWorkspaceManager.getCurrentProject()
      }
    });

    // Parse Claude Code's response into tasks
    const tasks: AutonomousTask[] = [];
    
    // Default task structure if Claude Code doesn't provide detailed plan
    const defaultTasks = [
      {
        type: 'analyze' as const,
        description: 'Analyze project requirements and current state',
        priority: 'high' as const
      },
      {
        type: 'build' as const,
        description: 'Generate and build project files',
        priority: 'high' as const
      },
      {
        type: 'test' as const,
        description: 'Test the application and fix any issues',
        priority: 'medium' as const
      },
      {
        type: 'deploy' as const,
        description: 'Deploy and verify the application is running',
        priority: 'medium' as const
      }
    ];

    defaultTasks.forEach((taskDef, index) => {
      tasks.push({
        id: `task-${index + 1}`,
        type: taskDef.type,
        description: taskDef.description,
        priority: taskDef.priority,
        status: 'pending',
        attempts: 0,
        maxAttempts,
        context: { plannedBy: 'claude-code', goal }
      });
    });

    comprehensiveLogger.logProjectEvent('autonomous_tasks_planned', {
      sessionId: this.activeSession!.id,
      tasksCount: tasks.length,
      tasks: tasks.map(t => ({ id: t.id, type: t.type, description: t.description }))
    });

    return tasks;
  }

  /**
   * Execute a single autonomous task
   */
  private async executeAutonomousTask(task: AutonomousTask): Promise<void> {
    task.status = 'running';
    task.attempts++;

    comprehensiveLogger.logProjectEvent('autonomous_task_start', {
      taskId: task.id,
      type: task.type,
      description: task.description,
      attempt: task.attempts
    });

    // Update chat with current task
    const taskMessage: ChatMessage = {
      id: `task-${task.id}-${Date.now()}`,
      role: 'assistant',
      content: `🔄 **Executing Task ${task.attempts}/${task.maxAttempts}**\n\n**${task.type.toUpperCase()}:** ${task.description}`,
      type: 'autonomous_task',
      timestamp: new Date(),
      agentId: 'claude-autonomous'
    };
    appStore.chatMessages.push(taskMessage);

    try {
      const result = await this.executeTaskWithClaudeCode(task);
      
      if (result.needsUserInput) {
        await this.handleUserInputRequest(task, result.needsUserInput);
      } else if (result.success) {
        task.status = 'completed';
        this.activeSession!.successfulOperations++;
        
        // Update chat with success
        taskMessage.content += `\n\n✅ **Completed successfully**`;
        if (result.message) {
          taskMessage.content += `\n\n${result.message}`;
        }
        
        comprehensiveLogger.logProjectEvent('autonomous_task_completed', {
          taskId: task.id,
          result: result.message
        });
      } else {
        await this.handleTaskFailure(task, result.error || 'Unknown error');
      }
    } catch (error) {
      await this.handleTaskFailure(task, (error as Error).message);
    }
  }

  /**
   * Execute task with Claude Code
   */
  private async executeTaskWithClaudeCode(task: AutonomousTask): Promise<ClaudeCodeResponse> {
    const request: ClaudeCodeRequest = {
      message: `Execute autonomous task: ${task.description}. Type: ${task.type}. This is attempt ${task.attempts}/${task.maxAttempts}.`,
      projectId: this.activeSession!.projectId,
      action: task.type === 'analyze' ? 'explain' : 'generate',
      context: {
        ...task.context,
        autonomousTask: true,
        taskType: task.type,
        attempt: task.attempts
      }
    };

    return await claudeCodeAPI.sendMessage(request);
  }

  /**
   * Handle user input request from Claude Code
   */
  private async handleUserInputRequest(
    task: AutonomousTask, 
    inputRequest: { question: string; options?: string[] }
  ): Promise<void> {
    task.status = 'waiting_for_user';
    this.activeSession!.userInterventions++;

    // Create user input message in chat
    const inputMessage: ChatMessage = {
      id: `input-${task.id}-${Date.now()}`,
      role: 'assistant',
      content: `🤔 **Claude Code needs your input:**\n\n${inputRequest.question}`,
      type: 'user_input_required',
      timestamp: new Date(),
      agentId: 'claude-autonomous',
      userInputRequest: {
        question: inputRequest.question,
        options: inputRequest.options,
        taskId: task.id
      }
    };

    if (inputRequest.options) {
      inputMessage.content += '\n\n**Options:**\n';
      inputRequest.options.forEach((option, index) => {
        inputMessage.content += `${index + 1}. ${option}\n`;
      });
    }

    inputMessage.content += '\n\n*Autonomous operation paused. Please respond to continue.*';

    appStore.chatMessages.push(inputMessage);

    // Set up timeout for user response
    const timeout = setTimeout(() => {
      this.handleUserInputTimeout(task);
    }, 300000); // 5 minute timeout

    this.userResponseTimeouts.set(task.id, timeout);

    // Store callback for when user responds
    task.userInputRequired = {
      question: inputRequest.question,
      options: inputRequest.options,
      timeout: 300000,
      resolveCallback: (response: string) => {
        this.handleUserResponse(task, response);
      }
    };

    comprehensiveLogger.logUserInteraction('user_input_requested', {
      taskId: task.id,
      question: inputRequest.question,
      options: inputRequest.options
    });
  }

  /**
   * Handle user response to input request
   */
  async handleUserResponse(task: AutonomousTask, response: string): Promise<void> {
    // Clear timeout
    const timeout = this.userResponseTimeouts.get(task.id);
    if (timeout) {
      clearTimeout(timeout);
      this.userResponseTimeouts.delete(task.id);
    }

    task.status = 'running';
    task.userInputRequired = undefined;

    comprehensiveLogger.logUserInteraction('user_input_received', {
      taskId: task.id,
      response
    });

    // Add user response to chat
    const userResponse: ChatMessage = {
      id: `response-${task.id}-${Date.now()}`,
      role: 'user',
      content: response,
      type: 'user_input_response',
      timestamp: new Date()
    };
    appStore.chatMessages.push(userResponse);

    // Continue task with user's response
    try {
      const result = await claudeCodeAPI.sendMessage({
        message: `User response to "${task.userInputRequired?.question}": ${response}. Continue with the task: ${task.description}`,
        projectId: this.activeSession!.projectId,
        action: 'generate',
        context: {
          ...task.context,
          userResponse: response,
          continuingTask: true
        }
      });

      if (result.success) {
        task.status = 'completed';
        this.activeSession!.successfulOperations++;
      } else {
        await this.handleTaskFailure(task, result.error || 'Failed after user input');
      }
    } catch (error) {
      await this.handleTaskFailure(task, (error as Error).message);
    }

    // Resume autonomous processing
    if (this.activeSession?.status === 'active') {
      this.processAutonomously('continue', 'medium');
    }
  }

  /**
   * Handle user input timeout
   */
  private handleUserInputTimeout(task: AutonomousTask): void {
    comprehensiveLogger.logUserInteraction('user_input_timeout', {
      taskId: task.id,
      question: task.userInputRequired?.question
    });

    // Add timeout message to chat
    const timeoutMessage: ChatMessage = {
      id: `timeout-${task.id}-${Date.now()}`,
      role: 'assistant',
      content: `⏰ **User input timeout for task:** ${task.description}\n\nProceeding autonomously with default behavior.`,
      type: 'autonomous_timeout',
      timestamp: new Date(),
      agentId: 'claude-autonomous'
    };
    appStore.chatMessages.push(timeoutMessage);

    // Continue with default behavior
    task.status = 'running';
    task.userInputRequired = undefined;
    
    if (this.activeSession?.status === 'active') {
      this.processAutonomously('continue with defaults', 'high');
    }
  }

  /**
   * Handle task failure
   */
  private async handleTaskFailure(task: AutonomousTask, error: string): Promise<void> {
    this.activeSession!.failedOperations++;

    comprehensiveLogger.logError('autonomous_task_failed', new Error(error), {
      taskId: task.id,
      attempt: task.attempts,
      maxAttempts: task.maxAttempts
    });

    if (task.attempts < task.maxAttempts) {
      // Retry task
      task.status = 'pending';
      this.taskQueue.unshift(task); // Put back at front of queue
      
      const retryMessage: ChatMessage = {
        id: `retry-${task.id}-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Task failed, retrying:** ${task.description}\n\n**Error:** ${error}\n\n**Attempt:** ${task.attempts}/${task.maxAttempts}`,
        type: 'autonomous_retry',
        timestamp: new Date(),
        agentId: 'claude-autonomous'
      };
      appStore.chatMessages.push(retryMessage);
    } else {
      // Max attempts reached
      task.status = 'failed';
      
      const failureMessage: ChatMessage = {
        id: `failure-${task.id}-${Date.now()}`,
        role: 'assistant',
        content: `❌ **Task failed permanently:** ${task.description}\n\n**Error:** ${error}\n\n**Max attempts reached:** ${task.maxAttempts}\n\nContinuing with next task...`,
        type: 'autonomous_failure',
        timestamp: new Date(),
        agentId: 'claude-autonomous'
      };
      appStore.chatMessages.push(failureMessage);
    }
  }

  /**
   * Complete autonomous session
   */
  private async completeAutonomousSession(): Promise<void> {
    if (!this.activeSession) return;

    this.activeSession.status = 'completed';
    this.activeSession.endTime = new Date();

    const duration = this.activeSession.endTime.getTime() - this.activeSession.startTime.getTime();
    const completedTasks = this.activeSession.tasks.filter(t => t.status === 'completed').length;
    const failedTasks = this.activeSession.tasks.filter(t => t.status === 'failed').length;

    comprehensiveLogger.logProjectEvent('autonomous_session_completed', {
      sessionId: this.activeSession.id,
      duration,
      completedTasks,
      failedTasks,
      userInterventions: this.activeSession.userInterventions,
      successfulOperations: this.activeSession.successfulOperations,
      failedOperations: this.activeSession.failedOperations
    });

    // Add completion message to chat
    const completionMessage: ChatMessage = {
      id: `completion-${this.activeSession.id}`,
      role: 'assistant',
      content: `🎉 **Autonomous Session Completed**\n\n**Duration:** ${Math.round(duration / 1000)}s\n**Tasks Completed:** ${completedTasks}/${this.activeSession.tasks.length}\n**User Interventions:** ${this.activeSession.userInterventions}\n**Success Rate:** ${Math.round((this.activeSession.successfulOperations / (this.activeSession.successfulOperations + this.activeSession.failedOperations)) * 100)}%\n\nReady for new instructions!`,
      type: 'autonomous_complete',
      timestamp: new Date(),
      agentId: 'claude-autonomous'
    };
    appStore.chatMessages.push(completionMessage);

    this.activeSession = null;
  }

  /**
   * Handle autonomous error
   */
  private async handleAutonomousError(error: Error): Promise<void> {
    if (!this.activeSession) return;

    this.activeSession.status = 'error';
    
    const errorMessage: ChatMessage = {
      id: `error-${this.activeSession.id}`,
      role: 'assistant',
      content: `💥 **Autonomous Session Error**\n\n**Error:** ${error.message}\n\nSession paused. Please provide guidance or restart autonomous mode.`,
      type: 'autonomous_error',
      timestamp: new Date(),
      agentId: 'claude-autonomous'
    };
    appStore.chatMessages.push(errorMessage);
  }

  /**
   * Pause autonomous session
   */
  pauseAutonomousSession(): void {
    if (this.activeSession) {
      this.activeSession.status = 'paused';
      
      const pauseMessage: ChatMessage = {
        id: `pause-${this.activeSession.id}`,
        role: 'assistant',
        content: `⏸️ **Autonomous Mode Paused**\n\nI've paused autonomous operation. Send me a message to continue or provide new instructions.`,
        type: 'autonomous_pause',
        timestamp: new Date(),
        agentId: 'claude-autonomous'
      };
      appStore.chatMessages.push(pauseMessage);
    }
  }

  /**
   * Resume autonomous session
   */
  resumeAutonomousSession(): void {
    if (this.activeSession && this.activeSession.status === 'paused') {
      this.activeSession.status = 'active';
      this.processAutonomously('resume previous tasks', 'medium');
    }
  }

  /**
   * Get current session status
   */
  getCurrentSessionStatus(): AutonomousSession | null {
    return this.activeSession;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const autonomousClaudeService = new AutonomousClaudeService();