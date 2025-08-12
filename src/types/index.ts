// Core types for Constellation IDE

export interface Project {
  id: string;
  name: string;
  type: 'enterprise-saas' | 'consumer-app' | 'api-service' | 'data-platform' | 'microservices' | 'encore-solidjs' | 'encore-react' | 'fullstack-ts';
  description: string;
  status: 'active' | 'paused' | 'archived' | 'running' | 'stopped' | 'building' | 'error' | 'ready' | 'creating';
  createdAt: Date;
  updatedAt: Date;
  knowledgeBase: KnowledgeBase;
}

export interface KnowledgeBase {
  id: string;
  projectId: string;
  auth: {
    type: 'jwt' | 'oauth' | 'magic-link' | 'none';
    providers?: string[];
    roles?: string[];
  };
  database: {
    type: 'postgresql' | 'mysql' | 'sqlite';
    features: string[];
  };
  integrations: string[];
  services: ServiceDefinition[];
  requirements: string[];
  businessRules: string[];
  techStack?: string;
}

export interface ServiceDefinition {
  name: string;
  purpose: string;
  endpoints: APIEndpoint[];
  database?: {
    tables: string[];
    relationships: string[];
  };
  events?: {
    publishes: string[];
    subscribes: string[];
  };
}

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  auth: boolean;
  parameters?: Parameter[];
  response?: any;
}

export interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

// Chat and Agent System Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type: 'generation' | 'explanation' | 'question';
  context?: ChatContext;
  timestamp: Date;
  agentId?: string;
}

export interface ChatContext {
  file?: string;
  service?: string;
  selection?: CodeSelection;
  projectId: string;
}

export interface CodeSelection {
  file: string;
  service: string;
  code: string;
  lines: {
    start: number;
    end: number;
  };
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  status: 'active' | 'busy' | 'idle';
}

export interface AgentMessage {
  from: string;
  to: string;
  type: 'request' | 'response' | 'notification';
  action: string;
  payload: any;
  correlationId: string;
}

// Code Generation Types
export interface GenerationRequest {
  projectId: string;
  type: 'service' | 'component' | 'feature' | 'fix';
  description: string;
  context?: GenerationContext;
  knowledgeBase: KnowledgeBase;
}

export interface GenerationContext {
  existingCode?: string;
  relatedFiles?: string[];
  dependencies?: string[];
}

export interface GeneratedCode {
  type: 'service' | 'component' | 'migration' | 'test';
  name: string;
  files: GeneratedFile[];
  dependencies?: string[];
  changes?: CodeChange[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: 'typescript' | 'sql' | 'json' | 'yaml';
}

export interface CodeChange {
  type: 'create' | 'update' | 'delete';
  file: string;
  description: string;
  diff?: string;
}

// IDE Interface Types
export interface EditorTab {
  id: string;
  file: string;
  language: string;
  content: string;
  isDirty: boolean;
  isActive: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  isExpanded?: boolean;
}

// Docker and Environment Types
export interface ContainerEnvironment {
  id: string;
  projectId: string;
  status: 'running' | 'stopped' | 'building' | 'error';
  url?: string;
  ports: ContainerPort[];
  logs: ContainerLog[];
}

export interface ContainerPort {
  internal: number;
  external: number;
  protocol: 'http' | 'ws' | 'tcp';
}

export interface ContainerLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  service?: string;
}

// API Response Types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
  suggestions: string[];
}

export interface Violation {
  severity: 'error' | 'warning';
  type: 'unauthorized_feature' | 'missing_requirement' | 'incorrect_implementation';
  location: string;
  message: string;
  kbReference: string;
}