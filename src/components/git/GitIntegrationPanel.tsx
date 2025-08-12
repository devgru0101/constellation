import React, { useState, useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { appStore } from '@/stores/app-store';
import { gitService, type GitCommit as GitServiceCommit, type GitHubRepository } from '@/services/git-service';
import { CommitDiffViewer } from './CommitDiffViewer';
import { 
  GitBranch, 
  Plus, 
  Settings, 
  Github, 
  GitCommit,
  GitMerge,
  Clock,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Upload,
  Key
} from 'lucide-react';

interface GitState {
  isConnected: boolean;
  currentBranch: string;
  branches: string[];
  commits: GitServiceCommit[];
  status: 'clean' | 'dirty' | 'syncing';
  githubRepository?: GitHubRepository;
  githubRepositories: GitHubRepository[];
}

interface GitIntegrationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitIntegrationPanel: React.FC<GitIntegrationPanelProps> = ({
  isOpen,
  onClose
}) => {
  const state = useSnapshot(appStore);
  const [gitState, setGitState] = useState<GitState>({
    isConnected: false,
    currentBranch: 'main',
    branches: ['main'],
    commits: [],
    status: 'clean',
    githubRepositories: []
  });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showCreateRepoModal, setShowCreateRepoModal] = useState(false);
  const [showRepositoryListModal, setShowRepositoryListModal] = useState(false);
  const [showRepositoryBrowser, setShowRepositoryBrowser] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDescription, setNewRepoDescription] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<GitServiceCommit | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCloning, setIsCloning] = useState(false);

  // Load GitHub auth status on mount
  useEffect(() => {
    const authStatus = gitService.getGitHubAuthStatus();
    const githubAuth = gitService.loadGitHubAuth();
    
    setGitState(prev => ({
      ...prev,
      isConnected: authStatus.connected
    }));

    // Load repository data if current project exists
    if (state.currentProject) {
      loadRepositoryData(state.currentProject.id);
    }
  }, [state.currentProject]);

  const loadRepositoryData = async (projectId: string) => {
    try {
      await gitService.loadRepository(projectId);
      const repoStatus = gitService.getRepositoryStatus(projectId);
      const commitHistory = gitService.getCommitHistory(projectId);
      
      if (repoStatus) {
        setGitState(prev => ({
          ...prev,
          currentBranch: repoStatus.currentBranch,
          branches: repoStatus.branches,
          commits: commitHistory,
          status: repoStatus.hasChanges ? 'dirty' : 'clean'
        }));
      }
    } catch (error) {
      console.error('Failed to load repository data:', error);
    }
  };

  if (!isOpen) return null;

  const handleGitHubConnect = async () => {
    if (!githubToken.trim()) {
      setShowConnectModal(true);
      return;
    }

    setLoading(true);
    try {
      const auth = await gitService.connectToGitHub(githubToken);
      const repositories = await gitService.getGitHubRepositories();
      
      setGitState(prev => ({
        ...prev,
        isConnected: true,
        githubRepositories: repositories
      }));
      
      setShowConnectModal(false);
      setGithubToken('');
    } catch (error) {
      console.error('Failed to connect to GitHub:', error);
      alert('Failed to connect to GitHub. Please check your token.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim() || !state.currentProject) return;

    try {
      await gitService.createBranch(state.currentProject.id, newBranchName.trim());
      await loadRepositoryData(state.currentProject.id);
      setNewBranchName('');
    } catch (error) {
      console.error('Failed to create branch:', error);
      alert('Failed to create branch');
    }
  };

  const handleSwitchBranch = async (branchName: string) => {
    if (!state.currentProject) return;

    try {
      setGitState(prev => ({ ...prev, status: 'syncing' }));
      const files = await gitService.switchBranch(state.currentProject.id, branchName);
      
      // Update app store with new files
      appStore.projectFiles = files;
      
      // Refresh file tree
      const refreshEvent = new CustomEvent('refresh-file-tree', {
        detail: { projectId: state.currentProject.id }
      });
      window.dispatchEvent(refreshEvent);
      
      await loadRepositoryData(state.currentProject.id);
    } catch (error) {
      console.error('Failed to switch branch:', error);
      alert('Failed to switch branch');
      setGitState(prev => ({ ...prev, status: 'clean' }));
    }
  };

  const handleCreateRepository = async () => {
    if (!newRepoName.trim()) return;

    setLoading(true);
    try {
      const githubRepo = await gitService.createGitHubRepository(
        newRepoName,
        newRepoDescription,
        newRepoPrivate
      );
      
      if (state.currentProject) {
        await gitService.linkToGitHubRepository(state.currentProject.id, githubRepo);
        setGitState(prev => ({ ...prev, githubRepository: githubRepo }));
      }
      
      setShowCreateRepoModal(false);
      setNewRepoName('');
      setNewRepoDescription('');
      setNewRepoPrivate(false);
    } catch (error) {
      console.error('Failed to create repository:', error);
      alert('Failed to create repository');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkRepository = async (githubRepo: GitHubRepository) => {
    if (!state.currentProject) return;

    try {
      await gitService.linkToGitHubRepository(state.currentProject.id, githubRepo);
      setGitState(prev => ({ ...prev, githubRepository: githubRepo }));
      setShowRepositoryListModal(false);
    } catch (error) {
      console.error('Failed to link repository:', error);
      alert('Failed to link repository');
    }
  };

  const handleCloneRepository = async (githubRepo: GitHubRepository) => {
    console.log('🚀 UI: Starting clone process for', githubRepo.name);
    setIsCloning(true);
    
    try {
      console.log('⏳ UI: Calling git service to clone repository...');
      const { projectId, files } = await gitService.cloneGitHubRepository(githubRepo);
      
      console.log('📋 UI: Clone completed, creating project with', Object.keys(files).length, 'files');
      
      // Create a new project in the app store
      const newProject = {
        id: projectId,
        name: githubRepo.name,
        description: githubRepo.description || `Cloned from ${githubRepo.fullName}`,
        type: 'fullstack-ts' as const,
        status: 'ready' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        knowledgeBase: {
          id: `kb-${projectId}`,
          projectId,
          auth: { type: 'none' as const },
          database: { type: 'postgresql' as const, features: [] },
          integrations: [],
          services: [],
          requirements: [],
          businessRules: []
        }
      };

      console.log('🏪 UI: Adding project to app store...');
      // Add to app store
      appStore.projects.push(newProject);
      appStore.currentProject = newProject;
      appStore.projectFiles = files;
      
      console.log('🔧 UI: Updating git state...');
      // Update git state
      setGitState(prev => ({ 
        ...prev, 
        githubRepository: githubRepo,
        isConnected: true 
      }));

      console.log('🚪 UI: Closing modals...');
      // Close modals
      setShowRepositoryBrowser(false);
      setShowRepositoryListModal(false);

      console.log('🌳 UI: Refreshing file tree...');
      // Refresh file tree
      const refreshEvent = new CustomEvent('refresh-file-tree', {
        detail: { projectId }
      });
      window.dispatchEvent(refreshEvent);

      console.log('✅ UI: Clone process completed successfully!');
      alert(`Successfully cloned ${githubRepo.name}! Check the browser console for details.`);
    } catch (error) {
      console.error('💥 UI: Clone failed with error:', error);
      
      // Show detailed error information
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      alert(`Failed to clone repository: ${errorMessage}\n\nPlease check the browser console (F12) for more details.`);
    } finally {
      setIsCloning(false);
    }
  };

  const handleViewCommitChanges = (commitId: string) => {
    if (!state.currentProject) return;
    
    const commit = gitState.commits.find(c => c.id === commitId);
    if (!commit) return;
    
    setSelectedCommit(commit);
    setShowDiffViewer(true);
  };

  const handleRestoreToCommit = async (commitId: string) => {
    if (!state.currentProject) return;

    try {
      const files = await gitService.rollbackToCommit(state.currentProject.id, commitId);
      
      // Update app store with restored files
      appStore.projectFiles = files;
      
      // Refresh file tree
      const refreshEvent = new CustomEvent('refresh-file-tree', {
        detail: { projectId: state.currentProject.id }
      });
      window.dispatchEvent(refreshEvent);
      
      await loadRepositoryData(state.currentProject.id);
      
      alert(`Restored to commit ${commitId.substring(0, 8)}`);
    } catch (error) {
      console.error('Failed to restore commit:', error);
      alert('Failed to restore to commit');
    }
  };

  const getStatusIcon = () => {
    switch (gitState.status) {
      case 'clean':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'dirty':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'syncing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-constellation-bg-primary border border-constellation-border rounded-lg w-[800px] h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-constellation-border">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-constellation-accent-blue" />
            <h2 className="text-lg font-semibold text-constellation-text-primary">
              Source Control
            </h2>
            {getStatusIcon()}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-constellation-bg-secondary rounded"
          >
            <X className="w-5 h-5 text-constellation-text-secondary" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Git Actions */}
          <div className="w-1/3 border-r border-constellation-border p-4 overflow-y-auto">
            {/* GitHub Connection */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-constellation-text-primary mb-3">
                GitHub Integration
              </h3>
              {!gitState.isConnected ? (
                <button
                  onClick={() => setShowConnectModal(true)}
                  className="flex items-center gap-2 w-full p-3 bg-constellation-bg-secondary border border-constellation-border rounded-lg hover:bg-constellation-bg-tertiary transition-colors"
                >
                  <Github className="w-4 h-4" />
                  <span className="text-sm">Connect GitHub Account</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="p-3 bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-lg">
                    <div className="flex items-center gap-2 text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      <span>Connected to GitHub</span>
                    </div>
                    {gitState.githubRepository && (
                      <div className="mt-1 text-xs text-constellation-text-secondary flex items-center gap-1">
                        <span>{gitState.githubRepository.fullName}</span>
                        <a
                          href={gitState.githubRepository.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-constellation-accent-blue hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => gitService.disconnectFromGitHub()}
                    className="text-xs text-constellation-text-tertiary hover:text-red-400"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>

            {/* Branch Management */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-constellation-text-primary mb-3">
                Branches
              </h3>
              
              {/* Current Branch */}
              <div className="flex items-center gap-2 p-2 bg-constellation-bg-secondary rounded mb-2">
                <GitBranch className="w-4 h-4 text-constellation-accent-blue" />
                <span className="text-sm font-medium text-constellation-text-primary">
                  {gitState.currentBranch}
                </span>
                <span className="text-xs bg-constellation-accent-blue bg-opacity-20 text-constellation-accent-blue px-2 py-1 rounded">
                  current
                </span>
              </div>

              {/* Other Branches */}
              {gitState.branches
                .filter(branch => branch !== gitState.currentBranch)
                .map(branch => (
                  <div
                    key={branch}
                    onClick={() => handleSwitchBranch(branch)}
                    className="flex items-center gap-2 p-2 hover:bg-constellation-bg-secondary rounded cursor-pointer"
                  >
                    <GitBranch className="w-4 h-4 text-constellation-text-tertiary" />
                    <span className="text-sm text-constellation-text-secondary">
                      {branch}
                    </span>
                  </div>
                ))}

              {/* Create New Branch */}
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="New branch name"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateBranch()}
                  className="flex-1 px-3 py-2 bg-constellation-bg-secondary border border-constellation-border rounded text-sm text-constellation-text-primary placeholder-constellation-text-tertiary focus:outline-none focus:border-constellation-accent-blue"
                />
                <button
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim()}
                  className="p-2 bg-constellation-accent-blue text-white rounded hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Repository Actions */}
            <div>
              <h3 className="text-sm font-medium text-constellation-text-primary mb-3">
                Repository
              </h3>
              <div className="space-y-2">
                <button 
                  onClick={() => setShowRepositoryBrowser(true)}
                  disabled={!gitState.isConnected}
                  className="flex items-center gap-2 w-full p-2 text-left hover:bg-constellation-bg-secondary rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Github className="w-4 h-4" />
                  Browse & Clone Repositories
                </button>
                <button 
                  onClick={() => setShowCreateRepoModal(true)}
                  disabled={!gitState.isConnected}
                  className="flex items-center gap-2 w-full p-2 text-left hover:bg-constellation-bg-secondary rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Create Repository
                </button>
                <button 
                  onClick={() => setShowRepositoryListModal(true)}
                  disabled={!gitState.isConnected}
                  className="flex items-center gap-2 w-full p-2 text-left hover:bg-constellation-bg-secondary rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <GitMerge className="w-4 h-4" />
                  Link Repository
                </button>
                {gitState.githubRepository && (
                  <button 
                    onClick={() => gitService.pushToGitHub(state.currentProject?.id || '')}
                    className="flex items-center gap-2 w-full p-2 text-left hover:bg-constellation-bg-secondary rounded text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    Push to GitHub
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Commit History */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-constellation-text-primary">
                Commit History
              </h3>
              <div className="text-xs text-constellation-text-tertiary">
                {gitState.commits.length} commits
              </div>
            </div>

            {gitState.commits.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-constellation-text-tertiary">
                <GitCommit className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">No commits yet</p>
                <p className="text-xs mt-1">Make your first commit when Claude Code generates code</p>
              </div>
            ) : (
              <div className="space-y-3">
                {gitState.commits.map((commit) => (
                  <div
                    key={commit.id}
                    className="border border-constellation-border rounded-lg p-4 hover:bg-constellation-bg-secondary transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <GitCommit className="w-4 h-4 text-constellation-accent-blue" />
                        <span className="text-sm font-medium text-constellation-text-primary">
                          {commit.message}
                        </span>
                        {commit.claudeGenerated && (
                          <span className="text-xs bg-constellation-accent-green bg-opacity-20 text-constellation-accent-green px-2 py-1 rounded">
                            Claude
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-constellation-text-tertiary">
                        <Clock className="w-3 h-3" />
                        {commit.timestamp.toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="text-xs text-constellation-text-secondary mb-2">
                      {commit.author} • {commit.id.substring(0, 8)}
                    </div>

                    <div className="flex gap-4 text-xs">
                      {commit.changes.added.length > 0 && (
                        <span className="text-green-400">
                          +{commit.changes.added.length} added
                        </span>
                      )}
                      {commit.changes.modified.length > 0 && (
                        <span className="text-yellow-400">
                          ~{commit.changes.modified.length} modified
                        </span>
                      )}
                      {commit.changes.deleted.length > 0 && (
                        <span className="text-red-400">
                          -{commit.changes.deleted.length} deleted
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button 
                        onClick={() => handleViewCommitChanges(commit.id)}
                        className="text-xs px-3 py-1 bg-constellation-bg-tertiary border border-constellation-border rounded hover:bg-constellation-bg-secondary"
                      >
                        View Changes
                      </button>
                      <button 
                        onClick={() => handleRestoreToCommit(commit.id)}
                        className="text-xs px-3 py-1 bg-constellation-bg-tertiary border border-constellation-border rounded hover:bg-constellation-bg-secondary"
                      >
                        Restore to This Point
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GitHub Connect Modal */}
      {showConnectModal && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-constellation-bg-primary border border-constellation-border rounded-lg p-6 w-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-constellation-text-primary">
                Connect GitHub Account
              </h3>
              <button
                onClick={() => setShowConnectModal(false)}
                className="p-1 hover:bg-constellation-bg-secondary rounded"
              >
                <X className="w-5 h-5 text-constellation-text-secondary" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-constellation-text-secondary">
                Enter your GitHub Personal Access Token to enable repository integration.
              </p>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-constellation-text-primary">
                  Personal Access Token
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-constellation-text-tertiary" />
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full pl-10 pr-3 py-2 bg-constellation-bg-secondary border border-constellation-border rounded text-sm text-constellation-text-primary placeholder-constellation-text-tertiary focus:outline-none focus:border-constellation-accent-blue"
                  />
                </div>
                <p className="text-xs text-constellation-text-tertiary">
                  <a 
                    href="https://github.com/settings/tokens" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-constellation-accent-blue hover:underline"
                  >
                    Create a token
                  </a> with 'repo' permissions
                </p>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={handleGitHubConnect}
                  disabled={!githubToken.trim() || loading}
                  className="flex-1 flex items-center justify-center gap-2 p-3 bg-[#238636] hover:bg-[#2ea043] disabled:bg-gray-600 text-white rounded transition-colors"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Github className="w-4 h-4" />
                  )}
                  {loading ? 'Connecting...' : 'Connect'}
                </button>
                <button 
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-3 bg-constellation-bg-secondary border border-constellation-border rounded hover:bg-constellation-bg-tertiary transition-colors text-constellation-text-primary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Repository Modal */}
      {showCreateRepoModal && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-constellation-bg-primary border border-constellation-border rounded-lg p-6 w-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-constellation-text-primary">
                Create Repository
              </h3>
              <button
                onClick={() => setShowCreateRepoModal(false)}
                className="p-1 hover:bg-constellation-bg-secondary rounded"
              >
                <X className="w-5 h-5 text-constellation-text-secondary" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-constellation-text-primary">
                  Repository Name
                </label>
                <input
                  type="text"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  placeholder="my-awesome-project"
                  className="w-full mt-1 px-3 py-2 bg-constellation-bg-secondary border border-constellation-border rounded text-sm text-constellation-text-primary placeholder-constellation-text-tertiary focus:outline-none focus:border-constellation-accent-blue"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-constellation-text-primary">
                  Description
                </label>
                <input
                  type="text"
                  value={newRepoDescription}
                  onChange={(e) => setNewRepoDescription(e.target.value)}
                  placeholder="A brief description of your project"
                  className="w-full mt-1 px-3 py-2 bg-constellation-bg-secondary border border-constellation-border rounded text-sm text-constellation-text-primary placeholder-constellation-text-tertiary focus:outline-none focus:border-constellation-accent-blue"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="private-repo"
                  checked={newRepoPrivate}
                  onChange={(e) => setNewRepoPrivate(e.target.checked)}
                  className="w-4 h-4 text-constellation-accent-blue"
                />
                <label htmlFor="private-repo" className="text-sm text-constellation-text-primary">
                  Private repository
                </label>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={handleCreateRepository}
                  disabled={!newRepoName.trim() || loading}
                  className="flex-1 flex items-center justify-center gap-2 p-3 bg-constellation-accent-blue hover:bg-opacity-80 disabled:bg-gray-600 text-white rounded transition-colors"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {loading ? 'Creating...' : 'Create'}
                </button>
                <button 
                  onClick={() => setShowCreateRepoModal(false)}
                  className="px-4 py-3 bg-constellation-bg-secondary border border-constellation-border rounded hover:bg-constellation-bg-tertiary transition-colors text-constellation-text-primary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Repository List Modal */}
      {showRepositoryListModal && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-constellation-bg-primary border border-constellation-border rounded-lg p-6 w-[500px] max-h-[600px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-constellation-text-primary">
                Link Repository
              </h3>
              <button
                onClick={() => setShowRepositoryListModal(false)}
                className="p-1 hover:bg-constellation-bg-secondary rounded"
              >
                <X className="w-5 h-5 text-constellation-text-secondary" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {gitState.githubRepositories.length === 0 ? (
                <p className="text-sm text-constellation-text-secondary text-center py-8">
                  No repositories found
                </p>
              ) : (
                <div className="space-y-2">
                  {gitState.githubRepositories.map(repo => (
                    <div
                      key={repo.id}
                      onClick={() => handleLinkRepository(repo)}
                      className="p-3 border border-constellation-border rounded-lg hover:bg-constellation-bg-secondary cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-constellation-text-primary">
                            {repo.name}
                          </div>
                          <div className="text-xs text-constellation-text-secondary">
                            {repo.fullName}
                          </div>
                          {repo.description && (
                            <div className="text-xs text-constellation-text-tertiary mt-1">
                              {repo.description}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {repo.private && (
                            <span className="text-xs bg-yellow-500 bg-opacity-20 text-yellow-400 px-2 py-1 rounded">
                              Private
                            </span>
                          )}
                          <ExternalLink className="w-4 h-4 text-constellation-text-tertiary" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Repository Browser Modal */}
      {showRepositoryBrowser && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-constellation-bg-primary border border-constellation-border rounded-lg w-[700px] max-h-[700px] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-constellation-border">
              <h3 className="text-lg font-semibold text-constellation-text-primary">
                Browse GitHub Repositories
              </h3>
              <button
                onClick={() => setShowRepositoryBrowser(false)}
                className="p-1 hover:bg-constellation-bg-secondary rounded"
              >
                <X className="w-5 h-5 text-constellation-text-secondary" />
              </button>
            </div>
            
            {/* Search Bar */}
            <div className="p-4 border-b border-constellation-border">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 bg-constellation-bg-secondary border border-constellation-border rounded text-sm text-constellation-text-primary placeholder-constellation-text-tertiary focus:outline-none focus:border-constellation-accent-blue"
                />
                <button
                  onClick={async () => {
                    if (!gitState.isConnected) return;
                    setLoading(true);
                    try {
                      const repositories = await gitService.getGitHubRepositories();
                      setGitState(prev => ({ ...prev, githubRepositories: repositories }));
                    } catch (error) {
                      console.error('Failed to refresh repositories:', error);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-constellation-bg-tertiary rounded"
                >
                  <RefreshCw className={`w-4 h-4 text-constellation-text-tertiary ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            
            {/* Repository List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-constellation-accent-blue" />
                  <span className="ml-2 text-constellation-text-secondary">Loading repositories...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {gitState.githubRepositories
                    .filter(repo => 
                      searchQuery === '' || 
                      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      repo.description.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(repo => (
                      <div
                        key={repo.id}
                        className="border border-constellation-border rounded-lg p-4 hover:bg-constellation-bg-secondary transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-constellation-text-primary truncate">
                                {repo.name}
                              </h4>
                              {repo.private && (
                                <span className="text-xs bg-yellow-500 bg-opacity-20 text-yellow-400 px-2 py-0.5 rounded">
                                  Private
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-constellation-text-secondary mb-1">
                              {repo.fullName}
                            </div>
                            {repo.description && (
                              <p className="text-sm text-constellation-text-tertiary line-clamp-2">
                                {repo.description}
                              </p>
                            )}
                          </div>
                          <a
                            href={repo.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-3 p-1 hover:bg-constellation-bg-tertiary rounded"
                          >
                            <ExternalLink className="w-4 h-4 text-constellation-text-tertiary" />
                          </a>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCloneRepository(repo)}
                            disabled={isCloning}
                            className="flex items-center gap-2 px-3 py-1.5 bg-constellation-accent-blue text-white rounded text-sm hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isCloning ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                            {isCloning ? 'Cloning...' : 'Clone & Create Project'}
                          </button>
                          
                          {state.currentProject && (
                            <button
                              onClick={() => handleLinkRepository(repo)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-constellation-bg-tertiary border border-constellation-border rounded text-sm hover:bg-constellation-bg-secondary"
                            >
                              <GitMerge className="w-3 h-3" />
                              Link to Current
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                  {gitState.githubRepositories.length === 0 && !loading && (
                    <div className="text-center py-8 text-constellation-text-secondary">
                      <Github className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">No repositories found</p>
                      <p className="text-xs mt-1">Make sure you're connected to GitHub</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Commit Diff Viewer */}
      {showDiffViewer && selectedCommit && (
        <CommitDiffViewer
          isOpen={showDiffViewer}
          onClose={() => {
            setShowDiffViewer(false);
            setSelectedCommit(null);
          }}
          commitId={selectedCommit.id}
          commitMessage={selectedCommit.message}
          diffs={(() => {
            if (!state.currentProject || !selectedCommit.parentCommit) {
              // For initial commit or if no parent, show all files as added
              return Object.keys(selectedCommit.snapshot).map(path => ({
                path,
                newContent: selectedCommit.snapshot[path],
                type: 'added' as const
              }));
            }
            
            // Get diff between parent and current commit
            const diff = gitService.getCommitDiff(
              state.currentProject.id,
              selectedCommit.parentCommit,
              selectedCommit.id
            );
            
            return [
              ...diff.added.map(item => ({
                path: item.path,
                newContent: item.content,
                type: 'added' as const
              })),
              ...diff.modified.map(item => ({
                path: item.path,
                oldContent: item.oldContent,
                newContent: item.newContent,
                type: 'modified' as const
              })),
              ...diff.deleted.map(item => ({
                path: item.path,
                oldContent: item.content,
                type: 'deleted' as const
              }))
            ];
          })()}
        />
      )}
    </div>
  );
};