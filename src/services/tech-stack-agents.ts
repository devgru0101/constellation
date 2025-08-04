/**
 * Tech Stack Agent System - Specialized Claude Code Agents
 * 
 * Provides specialized agents for each technology stack with complete
 * understanding of dev docs, best practices, and project templates.
 */

import { claudeCodeAPI, type ClaudeCodeRequest, type ClaudeCodeResponse } from './claude-code-api';
import { projectWorkspaceManager } from './project-workspace';
import { appStore } from '@/stores/app-store';
import { loggers } from './logging-system';

export interface TechStackAgent {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  expertise: string[];
  templateId: string;
  documentationUrls: string[];
  specializations: string[];
  contextPrompt: string;
}

export interface AgentGenerationRequest {
  agentId: string;
  projectId: string;
  userRequirements: string;
  selectedTechnologies: string[];
  projectTemplate?: string;
  additionalContext?: any;
}

export interface AgentGenerationResult {
  success: boolean;
  projectId: string;
  agentId: string;
  filesGenerated: string[];
  commandsExecuted: string[];
  nextSteps: string[];
  documentationReferences: string[];
  error?: string;
}

class TechStackAgentSystem {
  private agents: Map<string, TechStackAgent> = new Map();
  private activeAgentSessions: Map<string, string> = new Map(); // projectId -> agentId

  constructor() {
    this.initializeAgents();
  }

  /**
   * Initialize all specialized agents
   */
  private initializeAgents(): void {
    // Encore.ts + SolidJS Agent
    this.agents.set('encore-solidjs', {
      id: 'encore-solidjs',
      name: 'Encore.ts + SolidJS Expert',
      description: 'Full-stack TypeScript applications with Encore.ts backend and SolidJS frontend',
      technologies: ['Encore.ts', 'SolidJS', 'TypeScript', 'PostgreSQL'],
      expertise: [
        'API development with Encore.ts',
        'Service architecture and microservices',
        'Database integration with PostgreSQL',
        'SolidJS reactive frontend development',
        'State management with SolidJS stores',
        'Real-time communication',
        'Authentication and authorization',
        'Testing with Encore.ts test framework'
      ],
      templateId: 'encore-solidjs-starter',
      documentationUrls: [
        'https://encore.dev/docs',
        'https://encore.dev/docs/ts/introduction',
        'https://encore.dev/docs/ts/apis',
        'https://encore.dev/docs/ts/databases',
        'https://encore.dev/docs/ts/auth',
        'https://solidjs.com/docs/latest',
        'https://solidjs.com/guides/getting-started',
        'https://solidjs.com/tutorial'
      ],
      specializations: [
        'Encore.ts service definitions',
        'API endpoint creation and validation',
        'Database schema and migrations',
        'SolidJS component architecture',
        'Reactive data flow patterns',
        'TypeScript integration and type safety'
      ],
      contextPrompt: `You are an expert in Encore.ts and SolidJS development. You have deep knowledge of:

**Encore.ts Framework:**
- Service-oriented architecture with isolated services
- API development with automatic OpenAPI generation
- Built-in database support with PostgreSQL
- Authentication and middleware systems
- Encore CLI and development workflow
- Testing patterns and best practices

**SolidJS Frontend:**
- Fine-grained reactivity system
- Component composition patterns
- Signal-based state management
- JSX and TypeScript integration
- Performance optimization techniques

**Integration Patterns:**
- Full-stack TypeScript applications
- API-first development approach
- Type-safe client-server communication
- Modern deployment and scaling practices

Always follow Encore.ts conventions, use proper service structures, and implement SolidJS best practices for reactive UIs.`
    });

    // Encore.ts + React Agent
    this.agents.set('encore-react', {
      id: 'encore-react',
      name: 'Encore.ts + React Expert',
      description: 'Full-stack applications with Encore.ts backend and React frontend',
      technologies: ['Encore.ts', 'React', 'TypeScript', 'PostgreSQL'],
      expertise: [
        'Encore.ts backend development',
        'React functional components with hooks',
        'State management with React Context/Redux',
        'Component libraries and UI frameworks',
        'Real-time data synchronization',
        'Progressive Web App (PWA) development'
      ],
      templateId: 'encore-react-starter',
      documentationUrls: [
        'https://encore.dev/docs',
        'https://encore.dev/docs/ts/introduction',
        'https://react.dev/',
        'https://react.dev/learn',
        'https://react.dev/reference'
      ],
      specializations: [
        'React hooks and lifecycle management',
        'Component architecture patterns',
        'State management strategies',
        'Performance optimization with React'
      ],
      contextPrompt: `You are an expert in Encore.ts and React development. You specialize in building modern full-stack applications with:

**Encore.ts Backend Expertise:**
- Microservice architecture design
- API development with automatic documentation
- Database integration and schema design
- Authentication and security best practices

**React Frontend Mastery:**
- Modern React with hooks and functional components
- State management patterns (Context, Redux, Zustand)
- Component composition and reusability
- Performance optimization and code splitting

**Full-Stack Integration:**
- Type-safe API consumption
- Real-time data synchronization
- Modern build tools and deployment strategies

Always use TypeScript throughout the stack and follow modern React patterns.`
    });

    // shadcn/ui + Tailwind CSS Agent
    this.agents.set('shadcn-tailwind', {
      id: 'shadcn-tailwind',
      name: 'shadcn/ui + Tailwind CSS Expert',
      description: 'Modern UI development with shadcn/ui components and Tailwind CSS',
      technologies: ['shadcn/ui', 'Tailwind CSS', 'Radix UI', 'TypeScript', 'React'],
      expertise: [
        'shadcn/ui component library integration',
        'Tailwind CSS utility-first styling',
        'Responsive design patterns',
        'Accessibility best practices',
        'Design system implementation',
        'Dark mode and theming',
        'Custom component development'
      ],
      templateId: 'shadcn-tailwind-starter',
      documentationUrls: [
        'https://ui.shadcn.com/',
        'https://ui.shadcn.com/docs/installation',
        'https://ui.shadcn.com/docs/components',
        'https://tailwindcss.com/docs',
        'https://www.radix-ui.com/docs/primitives'
      ],
      specializations: [
        'shadcn/ui component customization',
        'Tailwind CSS configuration and optimization',
        'Design token systems',
        'Component composition patterns'
      ],
      contextPrompt: `You are an expert in modern UI development with shadcn/ui and Tailwind CSS. Your expertise includes:

**shadcn/ui Mastery:**
- Component library setup and configuration
- Customizing and extending base components
- Theming and design token systems
- Accessibility patterns with Radix UI

**Tailwind CSS Expertise:**
- Utility-first CSS methodology
- Responsive design implementation
- Custom utility creation and configuration
- Performance optimization strategies

**Design System Implementation:**
- Consistent design language
- Component composition patterns
- Dark mode and theme switching
- Mobile-first responsive design

Always prioritize accessibility, performance, and maintainable CSS architecture.`
    });

    // Full-Stack TypeScript Agent
    this.agents.set('fullstack-ts', {
      id: 'fullstack-ts',
      name: 'Full-Stack TypeScript Expert',
      description: 'Complete TypeScript applications with Node.js backend and modern frontend',
      technologies: ['TypeScript', 'Node.js', 'Express', 'PostgreSQL', 'React/SolidJS'],
      expertise: [
        'Node.js backend development with Express',
        'TypeScript configuration and advanced types',
        'Database design and ORM integration',
        'API design and documentation',
        'Frontend framework integration',
        'Testing strategies and CI/CD'
      ],
      templateId: 'fullstack-ts-starter',
      documentationUrls: [
        'https://www.typescriptlang.org/docs/',
        'https://nodejs.org/en/docs/',
        'https://expressjs.com/',
        'https://www.postgresql.org/docs/'
      ],
      specializations: [
        'Advanced TypeScript patterns',
        'Server-side architecture',
        'Database modeling and migrations',
        'Full-stack type safety'
      ],
      contextPrompt: `You are a full-stack TypeScript expert specializing in modern web application development. Your expertise spans:

**Backend Development:**
- Node.js with Express framework
- Advanced TypeScript patterns and configuration
- Database design with PostgreSQL
- RESTful API design and GraphQL

**Frontend Integration:**
- Type-safe client-server communication
- Modern frontend framework integration
- State management and data fetching
- Build tools and bundling strategies

**Development Practices:**
- Test-driven development (TDD)
- Continuous integration and deployment
- Code quality and linting
- Performance monitoring and optimization

Always ensure end-to-end type safety and follow modern development best practices.`
    });

    loggers.project('tech_stack_agents_initialized', {
      agentCount: this.agents.size,
      agentIds: Array.from(this.agents.keys())
    });
  }

  /**
   * Get all available agents
   */
  getAvailableAgents(): TechStackAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): TechStackAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get recommended agent based on tech stack selection
   */
  getRecommendedAgent(technologies: string[]): TechStackAgent | null {
    const techLower = technologies.map(t => t.toLowerCase());
    
    // Check for Encore.ts + SolidJS combination
    if (techLower.includes('encore.ts') && techLower.includes('solidjs')) {
      return this.agents.get('encore-solidjs') || null;
    }
    
    // Check for Encore.ts + React combination
    if (techLower.includes('encore.ts') && techLower.includes('react')) {
      return this.agents.get('encore-react') || null;
    }
    
    // Check for shadcn/ui + Tailwind CSS
    if (techLower.includes('shadcn/ui') || techLower.includes('tailwind css')) {
      return this.agents.get('shadcn-tailwind') || null;
    }
    
    // Default to full-stack TypeScript
    if (techLower.includes('typescript') || techLower.includes('node.js')) {
      return this.agents.get('fullstack-ts') || null;
    }
    
    return null;
  }

  /**
   * Generate application using specialized agent
   */
  async generateApplication(request: AgentGenerationRequest): Promise<AgentGenerationResult> {
    const agent = this.agents.get(request.agentId);
    if (!agent) {
      throw new Error(`Agent ${request.agentId} not found`);
    }

    const sessionId = `agent-${request.agentId}-${Date.now()}`;
    
    try {
      loggers.project('tech_stack_agent_generation_started', {
        sessionId,
        agentId: request.agentId,
        projectId: request.projectId,
        technologiesCount: request.selectedTechnologies.length,
        hasTemplate: !!request.projectTemplate
      }, request.projectId);

      // Mark agent as active for this project
      this.activeAgentSessions.set(request.projectId, request.agentId);

      // Prepare specialized context for the agent
      const agentContext = this.prepareAgentContext(agent, request);

      // Send specialized request to Claude Code
      const claudeRequest: ClaudeCodeRequest = {
        message: this.buildAgentMessage(agent, request),
        projectId: request.projectId,
        action: 'generate',
        context: agentContext
      };

      // Add agent message to chat
      this.addAgentChatMessage(
        `🤖 **${agent.name}** is generating your application...`,
        agent.id
      );

      const response = await claudeCodeAPI.sendMessage(claudeRequest);

      // Process the response
      const result = await this.processAgentResponse(agent, request, response);

      loggers.project('tech_stack_agent_generation_completed', {
        sessionId,
        agentId: request.agentId,
        projectId: request.projectId,
        success: result.success,
        filesGenerated: result.filesGenerated.length,
        commandsExecuted: result.commandsExecuted.length
      }, request.projectId);

      return result;

    } catch (error) {
      loggers.error('tech_stack_agent_generation_failed', error as Error, {
        sessionId,
        agentId: request.agentId,
        projectId: request.projectId
      }, request.projectId);

      this.addAgentChatMessage(
        `❌ **${agent.name}** encountered an error: ${(error as Error).message}`,
        agent.id
      );

      return {
        success: false,
        projectId: request.projectId,
        agentId: request.agentId,
        filesGenerated: [],
        commandsExecuted: [],
        nextSteps: [],
        documentationReferences: [],
        error: (error as Error).message
      };
    } finally {
      // Clear active session
      this.activeAgentSessions.delete(request.projectId);
    }
  }

  /**
   * Prepare specialized context for agent
   */
  private prepareAgentContext(agent: TechStackAgent, request: AgentGenerationRequest): any {
    return {
      agent: {
        id: agent.id,
        name: agent.name,
        expertise: agent.expertise,
        technologies: agent.technologies,
        specializations: agent.specializations
      },
      userRequirements: request.userRequirements,
      selectedTechnologies: request.selectedTechnologies,
      projectTemplate: request.projectTemplate,
      documentationUrls: agent.documentationUrls,
      contextPrompt: agent.contextPrompt,
      ...request.additionalContext
    };
  }

  /**
   * Build specialized message for agent
   */
  private buildAgentMessage(agent: TechStackAgent, request: AgentGenerationRequest): string {
    return `${agent.contextPrompt}

**PROJECT GENERATION REQUEST:**

**User Requirements:**
${request.userRequirements}

**Selected Technologies:**
${request.selectedTechnologies.map(tech => `- ${tech}`).join('\n')}

**Agent Specialization:**
You are the ${agent.name} with expertise in: ${agent.expertise.join(', ')}

**Instructions:**
1. Generate a complete application following best practices for ${agent.technologies.join(', ')}
2. Create proper project structure with all necessary configuration files
3. Implement core functionality based on user requirements
4. Include comprehensive documentation and comments
5. Set up development environment with proper scripts
6. Follow the specific patterns and conventions for each technology
7. Ensure type safety throughout the application
8. Include testing setup and examples

**Key Focus Areas:**
${agent.specializations.map(spec => `- ${spec}`).join('\n')}

**Documentation References:**
${agent.documentationUrls.map(url => `- ${url}`).join('\n')}

Please generate a complete, production-ready application structure that demonstrates best practices for ${agent.technologies.join(' + ')}.`;
  }

  /**
   * Process agent response and extract meaningful information
   */
  private async processAgentResponse(
    agent: TechStackAgent,
    request: AgentGenerationRequest,
    response: ClaudeCodeResponse
  ): Promise<AgentGenerationResult> {
    const result: AgentGenerationResult = {
      success: response.success !== false,
      projectId: request.projectId,
      agentId: agent.id,
      filesGenerated: response.files ? Object.keys(response.files) : [],
      commandsExecuted: response.commands || [],
      nextSteps: [],
      documentationReferences: agent.documentationUrls
    };

    // Extract next steps from response message
    if (response.message) {
      const nextStepsMatch = response.message.match(/(?:next steps?|what's next|to do):?\s*\n?((?:[-•*]\s*.+\n?)+)/i);
      if (nextStepsMatch) {
        result.nextSteps = nextStepsMatch[1]
          .split('\n')
          .filter(line => line.trim())
          .map(line => line.replace(/^[-•*]\s*/, '').trim());
      }
    }

    // Add default next steps if none found
    if (result.nextSteps.length === 0) {
      result.nextSteps = [
        'Review generated project structure',
        'Install dependencies with npm install',
        'Start development server',
        'Begin implementing your specific requirements',
        'Set up testing environment',
        'Configure deployment pipeline'
      ];
    }

    // Add agent-specific completion message
    this.addAgentChatMessage(
      `✅ **${agent.name}** completed generation!\n\n` +
      `📁 **Files Generated:** ${result.filesGenerated.length}\n` +
      `⚡ **Commands:** ${result.commandsExecuted.length}\n` +
      `📚 **Technologies:** ${agent.technologies.join(', ')}\n\n` +
      `🎯 **Next Steps:**\n${result.nextSteps.map(step => `• ${step}`).join('\n')}`,
      agent.id
    );

    return result;
  }

  /**
   * Add agent message to chat
   */
  private addAgentChatMessage(content: string, agentId: string): void {
    appStore.chatMessages.push({
      id: `agent-${agentId}-${Date.now()}-${Math.random()}`,
      role: 'assistant',
      content,
      type: 'generation',
      timestamp: new Date(),
      agentId
    });
  }

  /**
   * Get active agent for project
   */
  getActiveAgent(projectId: string): TechStackAgent | null {
    const agentId = this.activeAgentSessions.get(projectId);
    return agentId ? this.agents.get(agentId) || null : null;
  }

  /**
   * Get technology combinations for project templates
   */
  getTechnologyCombinations(): Array<{
    id: string;
    name: string;
    description: string;
    technologies: string[];
    agentId: string;
    recommended: boolean;
  }> {
    return [
      {
        id: 'encore-solidjs-full',
        name: 'Encore.ts + SolidJS + shadcn/ui',
        description: 'Full-stack TypeScript with reactive frontend and beautiful UI',
        technologies: ['Encore.ts', 'SolidJS', 'shadcn/ui', 'Tailwind CSS', 'PostgreSQL'],
        agentId: 'encore-solidjs',
        recommended: true
      },
      {
        id: 'encore-react-full',
        name: 'Encore.ts + React + shadcn/ui',
        description: 'Full-stack TypeScript with React and modern UI components',
        technologies: ['Encore.ts', 'React', 'shadcn/ui', 'Tailwind CSS', 'PostgreSQL'],
        agentId: 'encore-react',
        recommended: true
      },
      {
        id: 'encore-solidjs-basic',
        name: 'Encore.ts + SolidJS',
        description: 'Core full-stack setup with reactive frontend',
        technologies: ['Encore.ts', 'SolidJS', 'TypeScript', 'PostgreSQL'],
        agentId: 'encore-solidjs',
        recommended: false
      },
      {
        id: 'encore-react-basic',
        name: 'Encore.ts + React',
        description: 'Traditional full-stack setup with React',
        technologies: ['Encore.ts', 'React', 'TypeScript', 'PostgreSQL'],
        agentId: 'encore-react',
        recommended: false
      },
      {
        id: 'fullstack-ts-modern',
        name: 'Node.js + TypeScript + React',
        description: 'Custom full-stack TypeScript application',
        technologies: ['Node.js', 'TypeScript', 'React', 'Express', 'PostgreSQL'],
        agentId: 'fullstack-ts',
        recommended: false
      }
    ];
  }
}

// Singleton instance
export const techStackAgentSystem = new TechStackAgentSystem();
export type { TechStackAgent, AgentGenerationRequest, AgentGenerationResult };