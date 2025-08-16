import { proxy, subscribe } from 'valtio'
import { derive } from 'valtio/utils'
import type { Project, EditorTab, ChatMessage, Agent, CodeSelection } from '@/types'

// Chat history persistence helpers
const CHAT_HISTORY_PREFIX = 'constellation-chat-history-'

const saveChatHistoryToStorage = (projectId: string, messages: ChatMessage[]) => {
  try {
    localStorage.setItem(`${CHAT_HISTORY_PREFIX}${projectId}`, JSON.stringify(messages))
  } catch (error) {
    console.warn('Failed to save chat history to localStorage:', error)
  }
}

const loadChatHistoryFromStorage = (projectId: string): ChatMessage[] | null => {
  try {
    const stored = localStorage.getItem(`${CHAT_HISTORY_PREFIX}${projectId}`)
    if (stored) {
      const messages = JSON.parse(stored)
      // Convert timestamp strings back to Date objects
      return messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    }
  } catch (error) {
    console.warn('Failed to load chat history from localStorage:', error)
  }
  return null
}

interface AppState {
  // Project state
  currentProject: Project | null
  projects: Project[]
  projectFiles: { [path: string]: string }
  previewUrls: {
    frontend: string
    backend: string
    dashboard: string | null
  } | null
  
  // IDE state
  activeTab: string
  tabs: EditorTab[]
  activeView: 'code' | 'preview' | 'encore-dashboard'
  sidebarOpen: boolean
  bottomPanelOpen: boolean
  bottomPanelHeight: number
  
  // Chat state
  chatOpen: boolean
  chatMessages: ChatMessage[]
  chatMode: 'generate' | 'explain' | 'ask'
  // Per-project chat history
  projectChatHistory: { [projectId: string]: ChatMessage[] }
  
  // Agent state
  agents: Agent[]
  activeAgents: string[]
  
  // Editor state
  currentSelection: CodeSelection | null
  
  // UI state
  theme: 'light' | 'dark'
  knowledgeBaseOpen: boolean
}

export const appStore = proxy<AppState>({
  // Project state
  currentProject: null,
  projects: [],
  projectFiles: {},
  previewUrls: null,
  
  // IDE state
  activeTab: '',
  tabs: [],
  activeView: 'code',
  sidebarOpen: true,
  bottomPanelOpen: false,
  bottomPanelHeight: 200,
  
  // Chat state
  chatOpen: true,
  chatMessages: [],
  chatMode: 'generate',
  // Per-project chat history
  projectChatHistory: {},
  
  // Agent state
  agents: [
    {
      id: 'master-orchestrator',
      name: 'Master Orchestrator',
      role: 'Coordinates all agents',
      capabilities: ['Project analysis', 'Task delegation', 'Conflict resolution'],
      status: 'active'
    },
    {
      id: 'encore-backend',
      name: 'Encore Backend Agent',
      role: 'Generates Encore.ts services',
      capabilities: ['Service design', 'API patterns', 'Database design'],
      status: 'idle'
    },
    {
      id: 'solidjs-frontend',
      name: 'SolidJS Frontend Agent', 
      role: 'Creates SolidJS components',
      capabilities: ['Component architecture', 'State management', 'UI/UX'],
      status: 'idle'
    },
    {
      id: 'database-architect',
      name: 'Database Architect',
      role: 'Designs database schemas',
      capabilities: ['PostgreSQL', 'Data modeling', 'Performance'],
      status: 'idle'
    },
    {
      id: 'kb-validator',
      name: 'Knowledge Base Validator',
      role: 'Validates code against KB',
      capabilities: ['Compliance checking', 'Requirement validation'],
      status: 'active'
    },
    {
      id: 'code-explainer',
      name: 'Code Explainer',
      role: 'Explains code and answers questions',
      capabilities: ['Code explanation', 'Documentation', 'Tutorials'],
      status: 'idle'
    }
  ],
  activeAgents: ['master-orchestrator', 'kb-validator'],
  
  // Editor state
  currentSelection: null,
  
  // UI state
  theme: 'dark',
  knowledgeBaseOpen: false,
})

// Derived state
derive({
  isProjectLoaded: (get) => !!get(appStore).currentProject,
  hasActiveTabs: (get) => get(appStore).tabs.length > 0,
  chatMessageCount: (get) => get(appStore).chatMessages.length,
  activeAgentCount: (get) => get(appStore).activeAgents.length,
}, { proxy: appStore })

// Actions
export const useAppStore = () => {
  const initializeApp = async () => {
    console.log('🚀 App Store: initializeApp called');
    
    // Load from localStorage
    const savedTheme = localStorage.getItem('constellation-theme')
    if (savedTheme) {
      appStore.theme = savedTheme as 'light' | 'dark'
    }
    
    // Initialize project workspace manager and load existing projects
    try {
      const { projectWorkspaceManager } = await import('@/services/project-workspace');
      await projectWorkspaceManager.initialize();
      
      // Get all projects and update app store
      const projects = await projectWorkspaceManager.getAllProjects();
      appStore.projects = projects.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type as any,
        description: p.description || '',
        status: 'active',
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        knowledgeBase: {
          id: `kb-${p.id}`,
          projectId: p.id,
          auth: { type: 'jwt', roles: ['admin', 'user'] },
          database: { type: 'postgresql', features: [] },
          integrations: [],
          services: [],
          requirements: p.knowledgeBase?.requirements || [],
          businessRules: p.knowledgeBase?.businessRules || []
        }
      }));
      
      // Ensure currentProject is set if workspace manager has an active project
      const currentProject = projectWorkspaceManager.getCurrentProject();
      if (currentProject && !appStore.currentProject) {
        console.log(`🔄 Setting current project from workspace manager: ${currentProject.name} (${currentProject.id})`);
        appStore.currentProject = {
          id: currentProject.id,
          name: currentProject.name,
          type: currentProject.type as any,
          description: currentProject.description || '',
          status: 'active',
          createdAt: currentProject.createdAt,
          updatedAt: currentProject.updatedAt,
          knowledgeBase: {
            id: `kb-${currentProject.id}`,
            projectId: currentProject.id,
            auth: { type: 'jwt', roles: ['admin', 'user'] },
            database: { type: 'postgresql', features: [] },
            integrations: [],
            services: [],
            requirements: currentProject.knowledgeBase?.requirements || [],
            businessRules: currentProject.knowledgeBase?.businessRules || []
          }
        };
      }
      
      console.log(`✅ App Store: Loaded ${projects.length} existing projects into app store`);
      if (appStore.currentProject) {
        console.log(`✅ App Store: Current project: ${appStore.currentProject.name} (${appStore.currentProject.id})`);
      }
    } catch (error) {
      console.error('❌ App Store: Failed to initialize projects:', error);
      console.error('❌ App Store: Error details:', error.message, error.stack);
    }
    
    // Start with clean chat messages
    appStore.chatMessages = []
  }
  
  const openTab = (file: string, content: string, language: string) => {
    const existingTab = appStore.tabs.find(tab => tab.file === file)
    if (existingTab) {
      appStore.activeTab = existingTab.id
      return
    }
    
    const newTab: EditorTab = {
      id: `tab-${Date.now()}`,
      file,
      language,
      content,
      isDirty: false,
      isActive: true
    }
    
    // Mark other tabs as inactive
    appStore.tabs.forEach(tab => {
      tab.isActive = false
    })
    
    appStore.tabs.push(newTab)
    appStore.activeTab = newTab.id
  }
  
  const closeTab = (tabId: string) => {
    const tabIndex = appStore.tabs.findIndex(tab => tab.id === tabId)
    if (tabIndex === -1) return
    
    appStore.tabs.splice(tabIndex, 1)
    
    // If we closed the active tab, activate another one
    if (appStore.activeTab === tabId && appStore.tabs.length > 0) {
      const newActiveTab = appStore.tabs[Math.max(0, tabIndex - 1)]
      appStore.activeTab = newActiveTab.id
      newActiveTab.isActive = true
    } else if (appStore.tabs.length === 0) {
      appStore.activeTab = ''
    }
  }
  
  const updateTabContent = (tabId: string, content: string) => {
    const tab = appStore.tabs.find(tab => tab.id === tabId)
    if (tab) {
      tab.content = content
      tab.isDirty = true
    }
  }
  
  const addChatMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg-${Date.now()}`,
      timestamp: new Date()
    }
    appStore.chatMessages.push(newMessage)
    
    // Also save to project-specific chat history
    if (appStore.currentProject) {
      const projectId = appStore.currentProject.id
      if (!appStore.projectChatHistory[projectId]) {
        appStore.projectChatHistory[projectId] = []
      }
      appStore.projectChatHistory[projectId].push(newMessage)
      
      // Persist to localStorage
      saveChatHistoryToStorage(projectId, appStore.projectChatHistory[projectId])
    }
  }
  
  const loadProjectChatHistory = (projectId: string) => {
    // Load from memory first
    if (appStore.projectChatHistory[projectId]) {
      appStore.chatMessages = [...appStore.projectChatHistory[projectId]]
      return
    }
    
    // Load from localStorage
    const savedHistory = loadChatHistoryFromStorage(projectId)
    if (savedHistory) {
      appStore.projectChatHistory[projectId] = savedHistory
      appStore.chatMessages = [...savedHistory]
    } else {
      // No history found, start fresh
      appStore.chatMessages = []
      appStore.projectChatHistory[projectId] = []
    }
  }
  
  const clearCurrentChatHistory = () => {
    appStore.chatMessages = []
  }
  
  const toggleKnowledgeBase = () => {
    appStore.knowledgeBaseOpen = !appStore.knowledgeBaseOpen
  }
  
  const setCurrentSelection = (selection: CodeSelection | null) => {
    appStore.currentSelection = selection
  }
  
  const setActiveView = (view: 'code' | 'preview' | 'encore-dashboard') => {
    appStore.activeView = view
  }
  
  return {
    initializeApp,
    openTab,
    closeTab,
    updateTabContent,
    addChatMessage,
    loadProjectChatHistory,
    clearCurrentChatHistory,
    toggleKnowledgeBase,
    setCurrentSelection,
    setActiveView,
  }
}

// Persistence
subscribe(appStore, () => {
  localStorage.setItem('constellation-theme', appStore.theme)
})