// API client for communicating with Encore.ts backend
import type { Project, ChatMessage, GenerationRequest, GeneratedCode } from '@/types'

class APIClient {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL
  }

  setToken(token: string) {
    this.token = token
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Project APIs
  projects = {
    list: () => this.request<Project[]>('/projects'),
    get: (id: string) => this.request<Project>(`/projects/${id}`),
    create: (data: Partial<Project>) => this.request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id: string, data: Partial<Project>) => this.request<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id: string) => this.request<void>(`/projects/${id}`, {
      method: 'DELETE',
    }),
  }

  // Chat APIs
  chat = {
    send: (data: {
      projectId: string
      message: any
      mode: string
      context?: any
    }) => this.request<ChatMessage>('/chat/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    history: (projectId: string) => this.request<ChatMessage[]>(`/chat/${projectId}/history`),
  }

  // Code Generation APIs
  generate = {
    code: (request: GenerationRequest) => this.request<GeneratedCode>('/generate/code', {
      method: 'POST',
      body: JSON.stringify(request),
    }),
    service: (request: any) => this.request<GeneratedCode>('/generate/service', {
      method: 'POST',
      body: JSON.stringify(request),
    }),
    component: (request: any) => this.request<GeneratedCode>('/generate/component', {
      method: 'POST',
      body: JSON.stringify(request),
    }),
  }

  // Knowledge Base APIs
  knowledgeBase = {
    get: (projectId: string) => this.request<any>(`/projects/${projectId}/knowledge-base`),
    update: (projectId: string, data: any) => this.request<any>(`/projects/${projectId}/knowledge-base`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  }

  // Container/Environment APIs
  containers = {
    list: (projectId: string) => this.request<any[]>(`/projects/${projectId}/containers`),
    create: (projectId: string, config: any) => this.request<any>(`/projects/${projectId}/containers`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),
    start: (containerId: string) => this.request<void>(`/containers/${containerId}/start`, {
      method: 'POST',
    }),
    stop: (containerId: string) => this.request<void>(`/containers/${containerId}/stop`, {
      method: 'POST',
    }),
    logs: (containerId: string) => this.request<any[]>(`/containers/${containerId}/logs`),
  }

  // Demo/Mock APIs for development
  surveys = {
    list: async () => {
      // Mock data for demo
      await new Promise(resolve => setTimeout(resolve, 500))
      return [
        {
          id: '1',
          name: 'Office Building Survey',
          clientName: 'Acme Corp',
          description: 'Comprehensive cabling assessment for 10-story office building',
          type: 'commercial' as const,
          status: 'in-progress' as const,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-20'),
        },
        {
          id: '2',
          name: 'Warehouse Assessment',
          clientName: 'TechCorp Inc',
          description: 'Industrial cabling survey for distribution center',
          type: 'industrial' as const,
          status: 'completed' as const,
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-18'),
        },
        {
          id: '3',
          name: 'Residential Complex',
          clientName: 'Green Valley HOA',
          description: 'Multi-unit residential cabling installation planning',
          type: 'residential' as const,
          status: 'draft' as const,
          createdAt: new Date('2024-01-22'),
          updatedAt: new Date('2024-01-22'),
        },
      ]
    },
    create: async (data: any) => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      return {
        id: Date.now().toString(),
        ...data,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    },
    delete: async ({ id }: { id: string }) => {
      console.log(`Deleting survey ${id}`)
      await new Promise(resolve => setTimeout(resolve, 500))
      return { success: true }
    },
  }
}

export const api = new APIClient()