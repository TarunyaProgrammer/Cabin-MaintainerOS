import { contextBridge, ipcRenderer } from 'electron';
import { Settings, Repository, ReviewSession } from '@cabin/shared';

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings & DB
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('db:get-settings'),
  saveSettings: (settings: Partial<Settings>): Promise<void> => ipcRenderer.invoke('db:save-settings', settings),

  // Repositories
  getRepositories: (): Promise<Repository[]> => ipcRenderer.invoke('db:get-repositories'),
  saveRepository: (repo: Repository): Promise<void> => ipcRenderer.invoke('db:save-repository', repo),
  deleteRepository: (id: string): Promise<void> => ipcRenderer.invoke('db:delete-repository', id),

  // Review History
  getReviewSessions: (): Promise<ReviewSession[]> => ipcRenderer.invoke('db:get-review-sessions'),

  // GitHub / Octokit Calls
  fetchPendingReviews: (force?: boolean): Promise<any[]> => ipcRenderer.invoke('github:fetch-pending', force),

  // Pipelines & AI Execution
  prepareReview: (
    owner: string,
    repoName: string,
    prNumber: number,
    branchName: string,
    targetBranch: string
  ): Promise<any> => ipcRenderer.invoke('review:prepare', owner, repoName, prNumber, branchName, targetBranch),
  
  runAIReview: (
    prId: string,
    repoPath: string,
    prNumber: number
  ): Promise<any> => ipcRenderer.invoke('review:run-ai', prId, repoPath, prNumber),

  submitDecision: (
    owner: string,
    repo: string,
    prNumber: number,
    action: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
    commentText: string
  ): Promise<void> => ipcRenderer.invoke('github:submit-review', owner, repo, prNumber, action, commentText),

  addLabels: (owner: string, repo: string, prNumber: number, labels: string[]): Promise<void> =>
    ipcRenderer.invoke('github:add-labels', owner, repo, prNumber, labels),
  removeLabel: (owner: string, repo: string, prNumber: number, labelName: string): Promise<void> =>
    ipcRenderer.invoke('github:remove-label', owner, repo, prNumber, labelName),
  addAssignees: (owner: string, repo: string, prNumber: number, assignees: string[]): Promise<void> =>
    ipcRenderer.invoke('github:add-assignees', owner, repo, prNumber, assignees),
  removeAssignees: (owner: string, repo: string, prNumber: number, assignees: string[]): Promise<void> =>
    ipcRenderer.invoke('github:remove-assignees', owner, repo, prNumber, assignees),
  fetchPRDetails: (owner: string, repo: string, prNumber: number): Promise<any> =>
    ipcRenderer.invoke('github:fetch-pr-details', owner, repo, prNumber),
  getRepoLabels: (owner: string, repo: string): Promise<string[]> =>
    ipcRenderer.invoke('github:get-repo-labels', owner, repo),
  getRepoAssignees: (owner: string, repo: string): Promise<string[]> =>
    ipcRenderer.invoke('github:get-repo-assignees', owner, repo),

  // Utilities
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('util:open-external', url),
  openLocalFolder: (localPath: string): Promise<void> => ipcRenderer.invoke('util:open-folder', localPath),
  playBeep: (): Promise<void> => ipcRenderer.invoke('util:play-beep'),

  // Progress Logging listeners
  onReviewProgress: (callback: (data: { stepName: string; progress: number; status: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('review:progress-update', listener);
    return () => ipcRenderer.removeListener('review:progress-update', listener);
  },

  onReviewLog: (callback: (data: string) => void) => {
    const listener = (_event: any, data: string) => callback(data);
    ipcRenderer.on('review:log-update', listener);
    return () => ipcRenderer.removeListener('review:log-update', listener);
  },

  onPendingReviewsUpdated: (callback: (prs: any[]) => void) => {
    const listener = (_event: any, data: any[]) => callback(data);
    ipcRenderer.on('github:pending-updated', listener);
    return () => ipcRenderer.removeListener('github:pending-updated', listener);
  },

  askAntigravity: (repoPath: string, prNumber: number, question: string, context: string): Promise<string> =>
    ipcRenderer.invoke('review:chat', repoPath, prNumber, question, context),

  onAntigravityChatResponse: (callback: (data: string) => void) => {
    const listener = (_event: any, data: string) => callback(data);
    ipcRenderer.on('review:chat-log', listener);
    return () => ipcRenderer.removeListener('review:chat-log', listener);
  }
});
