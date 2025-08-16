/**
 * API Configuration
 * Centralized configuration for all API endpoints
 */

// Environment-based API configuration
const getApiConfig = () => {
  const isProduction = import.meta.env.PROD;
  
  // Docker environment detection
  const isDocker = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  
  if (isDocker || isProduction) {
    // Docker/Production environment - use current origin with API gateway
    return {
      baseUrl: window.location.origin,
      apiUrl: `${window.location.origin}/api`,
      wsUrl: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`,
    };
  } else {
    // Local development - assume services are running on localhost
    return {
      baseUrl: 'http://localhost:8000',
      apiUrl: 'http://localhost:8000/api',
      wsUrl: 'ws://localhost:8000/ws',
    };
  }
};

export const API_CONFIG = getApiConfig();

// Specific service endpoints
export const ENDPOINTS = {
  // Project endpoints
  projects: {
    list: `${API_CONFIG.apiUrl}/projects`,
    create: `${API_CONFIG.apiUrl}/projects`,
    get: (id: string) => `${API_CONFIG.apiUrl}/projects/${id}`,
    update: (id: string) => `${API_CONFIG.apiUrl}/projects/${id}`,
    delete: (id: string) => `${API_CONFIG.apiUrl}/projects/${id}`,
  },
  
  // Workspace endpoints
  workspace: {
    create: `${API_CONFIG.apiUrl}/workspace`,
    get: (projectId: string) => `${API_CONFIG.apiUrl}/workspace/${projectId}`,
    files: (projectId: string) => `${API_CONFIG.apiUrl}/workspace/${projectId}/files`,
    delete: (projectId: string) => `${API_CONFIG.apiUrl}/workspace/${projectId}`,
  },
  
  // Claude AI endpoints
  claude: {
    chat: `${API_CONFIG.apiUrl}/chat`,
    generate: `${API_CONFIG.apiUrl}/generate`,
    analyze: `${API_CONFIG.apiUrl}/analyze`,
  },
  
  // Container endpoints
  container: {
    create: `${API_CONFIG.apiUrl}/container`,
    exec: (id: string) => `${API_CONFIG.apiUrl}/container/${id}/exec`,
    destroy: (id: string) => `${API_CONFIG.apiUrl}/container/${id}`,
  },
  
  // System endpoints
  health: `${API_CONFIG.apiUrl}/health`,
  logs: `${API_CONFIG.apiUrl}/logs`,
  
  // WebSocket endpoints
  terminal: `${API_CONFIG.wsUrl}/terminal`,
  chat: `${API_CONFIG.wsUrl}/chat`,
};

// API request helpers
export const createApiUrl = (path: string) => `${API_CONFIG.apiUrl}${path}`;
export const createWsUrl = (path: string) => `${API_CONFIG.wsUrl}${path}`;

// Legacy localhost detection and warning
export const isLegacyLocalhost = (url: string) => {
  return url.includes('localhost:8000') || url.includes('127.0.0.1:8000');
};

export const warnLegacyUrl = (url: string) => {
  if (isLegacyLocalhost(url)) {
    console.warn(`⚠️  Legacy localhost URL detected: ${url}. Please update to use API_CONFIG.`);
  }
};