import { Settings, Repository, ReviewSession } from '@cabin/shared';

export interface ElectronAPI {
  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Partial<Settings>) => Promise<void>;
  getRepositories: () => Promise<Repository[]>;
  saveRepository: (repo: Repository) => Promise<void>;
  deleteRepository: (id: string) => Promise<void>;
  getReviewSessions: () => Promise<ReviewSession[]>;
  fetchPendingReviews: (force?: boolean) => Promise<any[]>;
  prepareReview: (
    owner: string,
    repoName: string,
    prNumber: number,
    branchName: string,
    targetBranch: string
  ) => Promise<any>;
  runAIReview: (
    prId: string,
    repoPath: string,
    prNumber: number
  ) => Promise<any>;
  submitDecision: (
    owner: string,
    repo: string,
    prNumber: number,
    action: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
    commentText: string
  ) => Promise<void>;
  addLabels: (owner: string, repo: string, prNumber: number, labels: string[]) => Promise<void>;
  removeLabel: (owner: string, repo: string, prNumber: number, labelName: string) => Promise<void>;
  addAssignees: (owner: string, repo: string, prNumber: number, assignees: string[]) => Promise<void>;
  removeAssignees: (owner: string, repo: string, prNumber: number, assignees: string[]) => Promise<void>;
  fetchPRDetails: (owner: string, repo: string, prNumber: number) => Promise<any>;
  getRepoLabels: (owner: string, repo: string) => Promise<string[]>;
  getRepoAssignees: (owner: string, repo: string) => Promise<string[]>;
  openExternal: (url: string) => Promise<void>;
  openLocalFolder: (localPath: string) => Promise<void>;
  playBeep: () => Promise<void>;
  onReviewProgress: (callback: (data: { stepName: string; progress: number; status: string }) => void) => () => void;
  onReviewLog: (callback: (data: string) => void) => () => void;
  onPendingReviewsUpdated: (callback: (prs: any[]) => void) => () => void;
  askAntigravity: (repoPath: string, prNumber: number, question: string, context: string) => Promise<string>;
  onAntigravityChatResponse: (callback: (data: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
