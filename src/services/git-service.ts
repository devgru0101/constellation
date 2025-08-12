/**
 * Git-like Version Control Service
 * 
 * Implements a Git-like system for tracking code changes made by Claude Code.
 * Provides commit history, branching, and rollback functionality.
 */

import { loggers } from './logging-system';

export interface GitHubAuth {
  token: string;
  username: string;
  email: string;
  connectedAt: Date;
}

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  cloneUrl: string;
  htmlUrl: string;
}

export interface GitCommit {
  id: string;
  message: string;
  timestamp: Date;
  author: string;
  changes: {
    added: string[];
    modified: string[];
    deleted: string[];
  };
  claudeGenerated?: boolean;
  parentCommit?: string;
  snapshot: { [path: string]: string }; // Complete file snapshot
}

export interface GitBranch {
  name: string;
  headCommit: string;
  createdAt: Date;
  author: string;
}

export interface GitRepository {
  projectId: string;
  currentBranch: string;
  branches: { [branchName: string]: GitBranch };
  commits: { [commitId: string]: GitCommit };
  workingDirectory: { [path: string]: string };
  githubRepository?: GitHubRepository;
  remoteUrl?: string;
}

class GitService {
  private repositories: Map<string, GitRepository> = new Map();
  private githubAuth: GitHubAuth | null = null;

  /**
   * Initialize Git repository for a project
   */
  async initializeRepository(projectId: string, initialFiles: { [path: string]: string }): Promise<void> {
    const initialCommitId = this.generateCommitId();
    
    const initialCommit: GitCommit = {
      id: initialCommitId,
      message: 'Initial commit',
      timestamp: new Date(),
      author: 'System',
      changes: {
        added: Object.keys(initialFiles),
        modified: [],
        deleted: []
      },
      snapshot: { ...initialFiles }
    };

    const mainBranch: GitBranch = {
      name: 'main',
      headCommit: initialCommitId,
      createdAt: new Date(),
      author: 'System'
    };

    const repository: GitRepository = {
      projectId,
      currentBranch: 'main',
      branches: { main: mainBranch },
      commits: { [initialCommitId]: initialCommit },
      workingDirectory: { ...initialFiles }
    };

    this.repositories.set(projectId, repository);
    
    // Persist repository state
    await this.persistRepository(projectId);
    
    loggers.git('repository_initialized', {
      projectId,
      initialCommitId,
      fileCount: Object.keys(initialFiles).length
    }, projectId);
  }

  /**
   * Create a commit from current changes
   */
  async createCommit(
    projectId: string, 
    message: string, 
    newFiles: { [path: string]: string },
    claudeGenerated: boolean = false
  ): Promise<string> {
    const repository = this.repositories.get(projectId);
    if (!repository) {
      throw new Error(`Repository not found for project ${projectId}`);
    }

    const currentBranch = repository.branches[repository.currentBranch];
    const parentCommit = repository.commits[currentBranch.headCommit];
    
    // Calculate changes
    const changes = this.calculateChanges(parentCommit.snapshot, newFiles);
    
    // Only create commit if there are actual changes
    if (changes.added.length === 0 && changes.modified.length === 0 && changes.deleted.length === 0) {
      loggers.git('no_changes_to_commit', { projectId, message }, projectId);
      return currentBranch.headCommit; // Return existing commit ID
    }

    const commitId = this.generateCommitId();
    
    const commit: GitCommit = {
      id: commitId,
      message,
      timestamp: new Date(),
      author: claudeGenerated ? 'Claude Code' : 'User',
      changes,
      claudeGenerated,
      parentCommit: currentBranch.headCommit,
      snapshot: { ...newFiles }
    };

    // Update repository
    repository.commits[commitId] = commit;
    repository.branches[repository.currentBranch].headCommit = commitId;
    repository.workingDirectory = { ...newFiles };

    // Persist changes
    await this.persistRepository(projectId);
    
    loggers.git('commit_created', {
      projectId,
      commitId,
      message,
      claudeGenerated,
      changesCount: changes.added.length + changes.modified.length + changes.deleted.length
    }, projectId);

    return commitId;
  }

  /**
   * Create a new branch
   */
  async createBranch(projectId: string, branchName: string, fromCommit?: string): Promise<void> {
    const repository = this.repositories.get(projectId);
    if (!repository) {
      throw new Error(`Repository not found for project ${projectId}`);
    }

    if (repository.branches[branchName]) {
      throw new Error(`Branch ${branchName} already exists`);
    }

    const sourceCommit = fromCommit || repository.branches[repository.currentBranch].headCommit;
    
    const newBranch: GitBranch = {
      name: branchName,
      headCommit: sourceCommit,
      createdAt: new Date(),
      author: 'User'
    };

    repository.branches[branchName] = newBranch;
    
    await this.persistRepository(projectId);
    
    loggers.git('branch_created', {
      projectId,
      branchName,
      fromCommit: sourceCommit
    }, projectId);
  }

  /**
   * Switch to a different branch
   */
  async switchBranch(projectId: string, branchName: string): Promise<{ [path: string]: string }> {
    const repository = this.repositories.get(projectId);
    if (!repository) {
      throw new Error(`Repository not found for project ${projectId}`);
    }

    const targetBranch = repository.branches[branchName];
    if (!targetBranch) {
      throw new Error(`Branch ${branchName} not found`);
    }

    // Get the snapshot from the head commit of target branch
    const headCommit = repository.commits[targetBranch.headCommit];
    repository.currentBranch = branchName;
    repository.workingDirectory = { ...headCommit.snapshot };

    await this.persistRepository(projectId);
    
    loggers.git('branch_switched', {
      projectId,
      branchName,
      commitId: targetBranch.headCommit
    }, projectId);

    return repository.workingDirectory;
  }

  /**
   * Rollback to a specific commit
   */
  async rollbackToCommit(projectId: string, commitId: string): Promise<{ [path: string]: string }> {
    const repository = this.repositories.get(projectId);
    if (!repository) {
      throw new Error(`Repository not found for project ${projectId}`);
    }

    const targetCommit = repository.commits[commitId];
    if (!targetCommit) {
      throw new Error(`Commit ${commitId} not found`);
    }

    // Update current branch head to point to target commit
    repository.branches[repository.currentBranch].headCommit = commitId;
    repository.workingDirectory = { ...targetCommit.snapshot };

    await this.persistRepository(projectId);
    
    loggers.git('rollback_completed', {
      projectId,
      targetCommitId: commitId,
      message: targetCommit.message
    }, projectId);

    return repository.workingDirectory;
  }

  /**
   * Get commit history for current branch
   */
  getCommitHistory(projectId: string, limit: number = 50): GitCommit[] {
    const repository = this.repositories.get(projectId);
    if (!repository) {
      return [];
    }

    const commits: GitCommit[] = [];
    let currentCommitId = repository.branches[repository.currentBranch].headCommit;
    
    while (currentCommitId && commits.length < limit) {
      const commit = repository.commits[currentCommitId];
      if (!commit) break;
      
      commits.push(commit);
      currentCommitId = commit.parentCommit || '';
    }

    return commits;
  }

  /**
   * Get repository status
   */
  getRepositoryStatus(projectId: string): {
    currentBranch: string;
    branches: string[];
    hasChanges: boolean;
    lastCommit?: GitCommit;
  } | null {
    const repository = this.repositories.get(projectId);
    if (!repository) {
      return null;
    }

    const currentBranch = repository.branches[repository.currentBranch];
    const lastCommit = repository.commits[currentBranch.headCommit];
    
    // Check if working directory has changes compared to last commit
    const hasChanges = lastCommit ? 
      JSON.stringify(repository.workingDirectory) !== JSON.stringify(lastCommit.snapshot) : 
      false;

    return {
      currentBranch: repository.currentBranch,
      branches: Object.keys(repository.branches),
      hasChanges,
      lastCommit
    };
  }

  /**
   * Calculate changes between two file snapshots
   */
  private calculateChanges(
    oldSnapshot: { [path: string]: string },
    newSnapshot: { [path: string]: string }
  ): { added: string[]; modified: string[]; deleted: string[] } {
    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];

    // Find added and modified files
    for (const path in newSnapshot) {
      if (!(path in oldSnapshot)) {
        added.push(path);
      } else if (oldSnapshot[path] !== newSnapshot[path]) {
        modified.push(path);
      }
    }

    // Find deleted files
    for (const path in oldSnapshot) {
      if (!(path in newSnapshot)) {
        deleted.push(path);
      }
    }

    return { added, modified, deleted };
  }

  /**
   * Generate unique commit ID
   */
  private generateCommitId(): string {
    return `commit-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Persist repository to storage
   */
  private async persistRepository(projectId: string): Promise<void> {
    const repository = this.repositories.get(projectId);
    if (!repository) return;

    try {
      // Save to localStorage for now (could be enhanced to use backend storage)
      const key = `constellation-git-${projectId}`;
      localStorage.setItem(key, JSON.stringify({
        ...repository,
        commits: Object.fromEntries(
          Object.entries(repository.commits).map(([id, commit]) => [
            id,
            { ...commit, timestamp: commit.timestamp.toISOString() }
          ])
        ),
        branches: Object.fromEntries(
          Object.entries(repository.branches).map(([name, branch]) => [
            name,
            { ...branch, createdAt: branch.createdAt.toISOString() }
          ])
        )
      }));
    } catch (error) {
      loggers.error('git_persistence_failed', error as Error, { projectId }, projectId);
    }
  }

  /**
   * Load repository from storage
   */
  async loadRepository(projectId: string): Promise<boolean> {
    try {
      const key = `constellation-git-${projectId}`;
      const stored = localStorage.getItem(key);
      
      if (!stored) return false;

      const data = JSON.parse(stored);
      
      // Restore Date objects
      const repository: GitRepository = {
        ...data,
        commits: Object.fromEntries(
          Object.entries(data.commits).map(([id, commit]: [string, any]) => [
            id,
            { ...commit, timestamp: new Date(commit.timestamp) }
          ])
        ),
        branches: Object.fromEntries(
          Object.entries(data.branches).map(([name, branch]: [string, any]) => [
            name,
            { ...branch, createdAt: new Date(branch.createdAt) }
          ])
        )
      };

      this.repositories.set(projectId, repository);
      
      loggers.git('repository_loaded', {
        projectId,
        branchCount: Object.keys(repository.branches).length,
        commitCount: Object.keys(repository.commits).length
      }, projectId);

      return true;
    } catch (error) {
      loggers.error('git_load_failed', error as Error, { projectId }, projectId);
      return false;
    }
  }

  /**
   * GitHub Authentication and Repository Management
   */

  /**
   * Connect to GitHub with personal access token
   */
  async connectToGitHub(token: string): Promise<GitHubAuth> {
    try {
      // Verify token by getting user info
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error('Invalid GitHub token');
      }

      const userData = await response.json();
      
      this.githubAuth = {
        token,
        username: userData.login,
        email: userData.email || '',
        connectedAt: new Date()
      };

      // Persist GitHub auth
      localStorage.setItem('constellation-github-auth', JSON.stringify({
        ...this.githubAuth,
        connectedAt: this.githubAuth.connectedAt.toISOString()
      }));

      loggers.git('github_connected', {
        username: userData.login,
        userId: userData.id
      });

      return this.githubAuth;
    } catch (error) {
      loggers.error('github_connection_failed', error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from GitHub
   */
  disconnectFromGitHub(): void {
    this.githubAuth = null;
    localStorage.removeItem('constellation-github-auth');
    loggers.git('github_disconnected', {});
  }

  /**
   * Load GitHub authentication from storage
   */
  loadGitHubAuth(): GitHubAuth | null {
    try {
      const stored = localStorage.getItem('constellation-github-auth');
      if (!stored) return null;

      const data = JSON.parse(stored);
      this.githubAuth = {
        ...data,
        connectedAt: new Date(data.connectedAt)
      };

      return this.githubAuth;
    } catch (error) {
      loggers.error('github_auth_load_failed', error as Error);
      return null;
    }
  }

  /**
   * Get current GitHub authentication status
   */
  getGitHubAuthStatus(): { connected: boolean; username?: string } {
    return {
      connected: !!this.githubAuth,
      username: this.githubAuth?.username
    };
  }

  /**
   * Create a new GitHub repository
   */
  async createGitHubRepository(
    name: string,
    description: string,
    isPrivate: boolean = false
  ): Promise<GitHubRepository> {
    if (!this.githubAuth) {
      throw new Error('Not connected to GitHub');
    }

    try {
      const response = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.githubAuth.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          private: isPrivate,
          auto_init: false
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create repository');
      }

      const repoData = await response.json();
      
      const githubRepo: GitHubRepository = {
        id: repoData.id,
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description || '',
        private: repoData.private,
        cloneUrl: repoData.clone_url,
        htmlUrl: repoData.html_url
      };

      loggers.git('github_repository_created', {
        repositoryName: name,
        repositoryId: repoData.id,
        isPrivate
      });

      return githubRepo;
    } catch (error) {
      loggers.error('github_repository_creation_failed', error as Error, { name, description, isPrivate });
      throw error;
    }
  }

  /**
   * Check GitHub API rate limits and token permissions
   */
  async checkGitHubTokenPermissions(): Promise<{
    valid: boolean;
    rateLimit: {
      limit: number;
      remaining: number;
      reset: Date;
    };
    permissions: string[];
  }> {
    if (!this.githubAuth) {
      throw new Error('Not connected to GitHub');
    }

    try {
      console.log('🔍 Checking GitHub token permissions and rate limits...');
      
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${this.githubAuth.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const rateLimit = {
        limit: parseInt(response.headers.get('x-ratelimit-limit') || '0'),
        remaining: parseInt(response.headers.get('x-ratelimit-remaining') || '0'),
        reset: new Date(parseInt(response.headers.get('x-ratelimit-reset') || '0') * 1000)
      };

      console.log('📊 Rate limit status:', rateLimit);

      if (!response.ok) {
        console.error('❌ Token validation failed:', response.status, response.statusText);
        return {
          valid: false,
          rateLimit,
          permissions: []
        };
      }

      // Check token scopes
      const scopes = response.headers.get('x-oauth-scopes') || '';
      const permissions = scopes.split(',').map(s => s.trim()).filter(s => s);
      
      console.log('🔐 Token scopes:', permissions);

      return {
        valid: true,
        rateLimit,
        permissions
      };
    } catch (error) {
      console.error('💥 Error checking token permissions:', error);
      throw error;
    }
  }

  /**
   * Get user's GitHub repositories
   */
  async getGitHubRepositories(): Promise<GitHubRepository[]> {
    if (!this.githubAuth) {
      throw new Error('Not connected to GitHub');
    }

    try {
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=50', {
        headers: {
          'Authorization': `token ${this.githubAuth.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const reposData = await response.json();
      
      return reposData.map((repo: any): GitHubRepository => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        private: repo.private,
        cloneUrl: repo.clone_url,
        htmlUrl: repo.html_url
      }));
    } catch (error) {
      loggers.error('github_repositories_fetch_failed', error as Error);
      throw error;
    }
  }

  /**
   * Link local repository to GitHub repository
   */
  async linkToGitHubRepository(projectId: string, githubRepo: GitHubRepository): Promise<void> {
    const repository = this.repositories.get(projectId);
    if (!repository) {
      throw new Error(`Repository not found for project ${projectId}`);
    }

    repository.githubRepository = githubRepo;
    repository.remoteUrl = githubRepo.cloneUrl;

    await this.persistRepository(projectId);
    
    loggers.git('repository_linked_to_github', {
      projectId,
      githubRepositoryName: githubRepo.fullName,
      githubRepositoryId: githubRepo.id
    }, projectId);
  }

  /**
   * Clone a GitHub repository and create a new project
   */
  async cloneGitHubRepository(githubRepo: GitHubRepository): Promise<{
    projectId: string;
    files: { [path: string]: string };
  }> {
    console.log('🔄 Starting clone for repository:', githubRepo.fullName);
    
    if (!this.githubAuth) {
      console.error('❌ Not connected to GitHub');
      throw new Error('Not connected to GitHub');
    }

    try {
      // Check token permissions and rate limits first
      const tokenCheck = await this.checkGitHubTokenPermissions();
      
      if (!tokenCheck.valid) {
        throw new Error('GitHub token is invalid or expired');
      }
      
      if (tokenCheck.rateLimit.remaining < 10) {
        throw new Error(`GitHub API rate limit nearly exceeded. Remaining: ${tokenCheck.rateLimit.remaining}`);
      }
      
      if (!tokenCheck.permissions.includes('repo') && !tokenCheck.permissions.includes('public_repo')) {
        console.warn('⚠️ Token may not have required repo permissions:', tokenCheck.permissions);
      }
      
      console.log('🔍 Checking repository access...');
      
      // First, check if we can access the repository
      const repoResponse = await fetch(
        `https://api.github.com/repos/${githubRepo.fullName}`,
        {
          headers: {
            'Authorization': `token ${this.githubAuth.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!repoResponse.ok) {
        const errorText = await repoResponse.text();
        console.error('❌ Repository access failed:', repoResponse.status, errorText);
        throw new Error(`Cannot access repository: ${repoResponse.status} ${repoResponse.statusText}`);
      }

      console.log('✅ Repository access confirmed');

      // Get repository contents from GitHub API
      console.log('📁 Fetching repository contents...');
      const response = await fetch(
        `https://api.github.com/repos/${githubRepo.fullName}/contents`,
        {
          headers: {
            'Authorization': `token ${this.githubAuth.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Contents fetch failed:', response.status, errorText);
        throw new Error(`Failed to fetch repository contents: ${response.status} ${response.statusText}`);
      }

      const contents = await response.json();
      console.log('📄 Found', contents.length, 'items in repository root');
      
      const files: { [path: string]: string } = {};
      
      // Recursively fetch all files
      console.log('⬇️ Starting file download...');
      await this.fetchRepositoryFiles(githubRepo.fullName, '', files);
      
      console.log('📦 Downloaded', Object.keys(files).length, 'files');

      // Generate project ID based on repository name
      const projectId = `cloned-${githubRepo.name}-${Date.now()}`;
      console.log('🆔 Generated project ID:', projectId);

      // Initialize git repository for the cloned project
      console.log('🔧 Initializing git repository...');
      await this.initializeRepository(projectId, files);
      
      // Link to the GitHub repository
      console.log('🔗 Linking to GitHub repository...');
      await this.linkToGitHubRepository(projectId, githubRepo);

      console.log('✅ Clone completed successfully!');
      
      loggers.git('repository_cloned', {
        projectId,
        repositoryName: githubRepo.fullName,
        fileCount: Object.keys(files).length
      });

      return { projectId, files };
    } catch (error) {
      console.error('💥 Clone failed:', error);
      loggers.error('repository_clone_failed', error as Error, {
        repositoryName: githubRepo.fullName
      });
      throw error;
    }
  }

  /**
   * Recursively fetch all files from a GitHub repository
   */
  private async fetchRepositoryFiles(
    repoFullName: string,
    path: string,
    files: { [path: string]: string },
    maxFiles: number = 50
  ): Promise<void> {
    if (Object.keys(files).length >= maxFiles) {
      console.log(`📊 Reached maximum file limit (${maxFiles}), stopping fetch`);
      return; // Prevent fetching too many files
    }

    try {
      const url = `https://api.github.com/repos/${repoFullName}/contents${path ? `/${path}` : ''}`;
      console.log(`📁 Fetching contents for path: ${path || 'root'}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${this.githubAuth!.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ Failed to fetch contents for ${path}: ${response.status} ${response.statusText}`);
        return;
      }

      const contents = await response.json();
      console.log(`📋 Found ${contents.length} items in ${path || 'root'}`);
      
      for (const item of contents) {
        if (Object.keys(files).length >= maxFiles) {
          console.log(`📊 Reached maximum file limit during processing, stopping`);
          break;
        }

        if (item.type === 'file' && item.size <= 512 * 1024) { // Max 512KB per file (reduced for safety)
          try {
            console.log(`📄 Downloading file: ${item.path} (${item.size} bytes)`);
            // Fetch file content
            const fileResponse = await fetch(item.download_url);
            if (fileResponse.ok) {
              const content = await fileResponse.text();
              files[item.path] = content;
              console.log(`✅ Downloaded: ${item.path}`);
            } else {
              console.warn(`⚠️ Failed to download file ${item.path}: ${fileResponse.status}`);
            }
          } catch (error) {
            console.warn(`❌ Error downloading file ${item.path}:`, error);
          }
        } else if (item.type === 'file' && item.size > 512 * 1024) {
          console.log(`⏭️ Skipping large file: ${item.path} (${item.size} bytes)`);
        } else if (item.type === 'dir') {
          console.log(`📂 Entering directory: ${item.path}`);
          // Recursively fetch directory contents
          await this.fetchRepositoryFiles(repoFullName, item.path, files, maxFiles);
        }
      }
    } catch (error) {
      console.error(`💥 Error fetching contents for path ${path}:`, error);
    }
  }

  /**
   * Get repository branches from GitHub
   */
  async getGitHubRepositoryBranches(githubRepo: GitHubRepository): Promise<string[]> {
    if (!this.githubAuth) {
      throw new Error('Not connected to GitHub');
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${githubRepo.fullName}/branches`,
        {
          headers: {
            'Authorization': `token ${this.githubAuth.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch repository branches');
      }

      const branches = await response.json();
      return branches.map((branch: any) => branch.name);
    } catch (error) {
      loggers.error('github_branches_fetch_failed', error as Error, {
        repositoryName: githubRepo.fullName
      });
      return ['main']; // Return default branch
    }
  }

  /**
   * Push commits to GitHub repository
   */
  async pushToGitHub(projectId: string): Promise<void> {
    const repository = this.repositories.get(projectId);
    if (!repository) {
      throw new Error(`Repository not found for project ${projectId}`);
    }

    if (!repository.githubRepository || !this.githubAuth) {
      throw new Error('Repository not linked to GitHub or not authenticated');
    }

    try {
      // In a real implementation, this would use git commands or GitHub API
      // For now, we'll simulate the push and log it
      const commitHistory = this.getCommitHistory(projectId, 10);
      
      loggers.git('github_push_simulated', {
        projectId,
        repositoryName: repository.githubRepository.fullName,
        commitsCount: commitHistory.length
      }, projectId);

      // Note: In a production environment, you would integrate with actual git commands
      // or use GitHub's API to create commits and push changes
      console.log(`Simulated push of ${commitHistory.length} commits to ${repository.githubRepository.fullName}`);
      
    } catch (error) {
      loggers.error('github_push_failed', error as Error, { 
        projectId,
        repositoryName: repository.githubRepository?.fullName 
      }, projectId);
      throw error;
    }
  }

  /**
   * Get differences between two commits for visualization
   */
  getCommitDiff(projectId: string, fromCommitId: string, toCommitId: string): {
    added: { path: string; content: string }[];
    modified: { path: string; oldContent: string; newContent: string }[];
    deleted: { path: string; content: string }[];
  } {
    const repository = this.repositories.get(projectId);
    if (!repository) {
      return { added: [], modified: [], deleted: [] };
    }

    const fromCommit = repository.commits[fromCommitId];
    const toCommit = repository.commits[toCommitId];
    
    if (!fromCommit || !toCommit) {
      return { added: [], modified: [], deleted: [] };
    }

    const changes = this.calculateChanges(fromCommit.snapshot, toCommit.snapshot);
    
    return {
      added: changes.added.map(path => ({
        path,
        content: toCommit.snapshot[path] || ''
      })),
      modified: changes.modified.map(path => ({
        path,
        oldContent: fromCommit.snapshot[path] || '',
        newContent: toCommit.snapshot[path] || ''
      })),
      deleted: changes.deleted.map(path => ({
        path,
        content: fromCommit.snapshot[path] || ''
      }))
    };
  }
}

// Singleton instance
export const gitService = new GitService();