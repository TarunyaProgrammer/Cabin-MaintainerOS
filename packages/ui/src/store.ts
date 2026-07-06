import { create } from 'zustand';
import { Settings, Repository, PullRequest, ReviewSession, ReviewResult, DiscussionSummary, RepositoryContext, WorkerLog } from '@cabin/shared';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ActiveReviewState {
  pullRequest: PullRequest | null;
  discussionSummary: DiscussionSummary | null;
  repositoryContext: RepositoryContext | null;
  workerLogs: WorkerLog[];
  localPath: string;
  aiReviewResult: ReviewResult | null;
  pipelineRunning: boolean;
  pipelineProgress: { stepName: string; progress: number; status: string } | null;
  aiRunning: boolean;
  aiLogs: string;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  chatStreamingResponse: string;
}

interface CabinStore {
  settings: Settings;
  repositories: Repository[];
  reviews: PullRequest[];
  history: ReviewSession[];
  loadingReviews: boolean;
  loadingHistory: boolean;
  error: string | null;

  // Actions
  loadSettings: () => Promise<void>;
  saveSettings: (settings: Partial<Settings>) => Promise<void>;
  loadRepositories: () => Promise<void>;
  deleteRepository: (id: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  fetchReviews: (force?: boolean) => Promise<void>;

  // Active Review State
  activeReview: ActiveReviewState;
  setActiveReviewPR: (pr: PullRequest) => void;
  fetchAndSetActivePR: (owner: string, repo: string, prNumber: number) => Promise<void>;
  prepareActiveReview: () => Promise<void>;
  runAIReview: () => Promise<void>;
  submitReviewDecision: (action: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT', comment: string) => Promise<void>;
  addLabels: (labels: string[]) => Promise<void>;
  removeLabel: (labelName: string) => Promise<void>;
  addAssignees: (assignees: string[]) => Promise<void>;
  removeAssignees: (assignees: string[]) => Promise<void>;
  resetActiveReview: () => void;
  sendChatMessage: (question: string, context: string) => Promise<void>;
  resolveReviewLocally: (owner: string, repo: string, prNumber: number, comment: string) => Promise<void>;
}

export const useCabinStore = create<CabinStore>((set, get) => ({
  settings: {
    githubToken: '',
    workspacePath: '',
    antigravityPath: '',
    theme: 'dark',
  },
  repositories: [],
  reviews: [],
  history: [],
  loadingReviews: false,
  loadingHistory: false,
  error: null,

  activeReview: {
    pullRequest: null,
    discussionSummary: null,
    repositoryContext: null,
    workerLogs: [],
    localPath: '',
    aiReviewResult: null,
    pipelineRunning: false,
    pipelineProgress: null,
    aiRunning: false,
    aiLogs: '',
    chatMessages: [],
    chatLoading: false,
    chatStreamingResponse: '',
  },

  loadSettings: async () => {
    try {
      const settings = await window.electronAPI.getSettings();
      set({ settings });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  saveSettings: async (newSettings) => {
    try {
      await window.electronAPI.saveSettings(newSettings);
      const settings = await window.electronAPI.getSettings();
      set({ settings });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  loadRepositories: async () => {
    try {
      const repositories = await window.electronAPI.getRepositories();
      set({ repositories });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteRepository: async (id) => {
    try {
      await window.electronAPI.deleteRepository(id);
      await get().loadRepositories();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  loadHistory: async () => {
    set({ loadingHistory: true });
    try {
      const history = await window.electronAPI.getReviewSessions();
      set({ history, loadingHistory: false });
    } catch (err: any) {
      set({ error: err.message, loadingHistory: false });
    }
  },

  fetchReviews: async (force?: boolean) => {
    set({ loadingReviews: true, error: null });
    try {
      const reviews = await window.electronAPI.fetchPendingReviews(force);
      set({ reviews, loadingReviews: false });
    } catch (err: any) {
      set({ error: err.message, loadingReviews: false });
    }
  },

  setActiveReviewPR: (pr) => {
    set((state) => ({
      activeReview: {
        ...state.activeReview,
        pullRequest: pr,
        discussionSummary: null,
        repositoryContext: null,
        workerLogs: [],
        localPath: '',
        aiReviewResult: null,
        pipelineRunning: false,
        pipelineProgress: null,
        aiRunning: false,
        aiLogs: '',
        chatMessages: [],
        chatLoading: false,
        chatStreamingResponse: '',
      },
    }));
  },

  fetchAndSetActivePR: async (owner, repo, prNumber) => {
    try {
      const pr = await window.electronAPI.fetchPRDetails(owner, repo, prNumber);
      set((state) => ({
        activeReview: {
          ...state.activeReview,
          pullRequest: pr,
          discussionSummary: null,
          repositoryContext: null,
          workerLogs: [],
          localPath: '',
          aiReviewResult: null,
          pipelineRunning: false,
          pipelineProgress: null,
          aiRunning: false,
          aiLogs: '',
          chatMessages: [],
          chatLoading: false,
          chatStreamingResponse: '',
        },
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  prepareActiveReview: async () => {
    const { pullRequest } = get().activeReview;
    if (!pullRequest) return;

    set((state) => ({
      activeReview: {
        ...state.activeReview,
        pipelineRunning: true,
        pipelineProgress: { stepName: 'Initializing...', progress: 0, status: 'running' },
      },
    }));

    // Setup real-time progress updates listener
    const unsubscribe = window.electronAPI.onReviewProgress((progressUpdate) => {
      set((state) => ({
        activeReview: {
          ...state.activeReview,
          pipelineProgress: progressUpdate,
        },
      }));
    });

    try {
      const result = await window.electronAPI.prepareReview(
        pullRequest.repoOwner,
        pullRequest.repoName,
        pullRequest.prNumber,
        pullRequest.branchName,
        pullRequest.targetBranch
      );

      set((state) => ({
        activeReview: {
          ...state.activeReview,
          pullRequest: result.pullRequest,
          discussionSummary: result.discussionSummary,
          repositoryContext: result.repositoryContext,
          workerLogs: result.workerLogs,
          localPath: result.localPath,
          pipelineRunning: false,
        },
      }));

      // Update reviews list with the prepared PR status
      set((state) => ({
        reviews: state.reviews.map((r) =>
          r.id === pullRequest.id ? { ...r, ciStatus: result.pullRequest.ciStatus, mergeConflictStatus: result.pullRequest.mergeConflictStatus } : r
        ),
      }));

      await get().loadRepositories();
      window.electronAPI.playBeep().catch(() => {});
    } catch (err: any) {
      set((state) => ({
        activeReview: {
          ...state.activeReview,
          pipelineRunning: false,
          pipelineProgress: { stepName: `Failed: ${err.message}`, progress: 100, status: 'failed' },
        },
      }));
    } finally {
      unsubscribe();
    }
  },

  runAIReview: async () => {
    const { pullRequest, localPath } = get().activeReview;
    if (!pullRequest || !localPath) return;

    set((state) => ({
      activeReview: {
        ...state.activeReview,
        aiRunning: true,
        aiLogs: '[Cabin] Initializing Antigravity Review Runner...\n',
      },
    }));

    const unsubscribe = window.electronAPI.onReviewLog((logChunk) => {
      set((state) => ({
        activeReview: {
          ...state.activeReview,
          aiLogs: state.activeReview.aiLogs + logChunk,
        },
      }));
    });

    try {
      const aiReviewResult = await window.electronAPI.runAIReview(
        pullRequest.id,
        localPath,
        pullRequest.prNumber
      );

      set((state) => ({
        activeReview: {
          ...state.activeReview,
          aiReviewResult,
          aiRunning: false,
        },
      }));
      window.electronAPI.playBeep().catch(() => {});
    } catch (err: any) {
      set((state) => ({
        activeReview: {
          ...state.activeReview,
          aiLogs: state.activeReview.aiLogs + `\n[AI Review Error] ${err.message}\n`,
          aiRunning: false,
        },
      }));
    } finally {
      unsubscribe();
    }
  },

  submitReviewDecision: async (action, comment) => {
    const { pullRequest } = get().activeReview;
    if (!pullRequest) return;

    try {
      await window.electronAPI.submitDecision(
        pullRequest.repoOwner,
        pullRequest.repoName,
        pullRequest.prNumber,
        action,
        comment
      );
      
      // Update review status in active state
      set((state) => ({
        activeReview: {
          ...state.activeReview,
          pullRequest: state.activeReview.pullRequest
            ? { ...state.activeReview.pullRequest, reviewStatus: action.toLowerCase() as any }
            : null,
        },
      }));

      // Refresh history & reviews
      await get().loadHistory();
      await get().fetchReviews();
      window.electronAPI.playBeep().catch(() => {});
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  addLabels: async (labels) => {
    const { pullRequest } = get().activeReview;
    if (!pullRequest) return;
    try {
      await window.electronAPI.addLabels(pullRequest.repoOwner, pullRequest.repoName, pullRequest.prNumber, labels);
      set((state) => ({
        activeReview: {
          ...state.activeReview,
          pullRequest: state.activeReview.pullRequest
            ? { ...state.activeReview.pullRequest, labels: [...state.activeReview.pullRequest.labels, ...labels] }
            : null,
        },
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  removeLabel: async (labelName) => {
    const { pullRequest } = get().activeReview;
    if (!pullRequest) return;
    try {
      await window.electronAPI.removeLabel(pullRequest.repoOwner, pullRequest.repoName, pullRequest.prNumber, labelName);
      set((state) => ({
        activeReview: {
          ...state.activeReview,
          pullRequest: state.activeReview.pullRequest
            ? { ...state.activeReview.pullRequest, labels: state.activeReview.pullRequest.labels.filter((l) => l !== labelName) }
            : null,
        },
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  addAssignees: async (assignees) => {
    const { pullRequest } = get().activeReview;
    if (!pullRequest) return;
    try {
      await window.electronAPI.addAssignees(pullRequest.repoOwner, pullRequest.repoName, pullRequest.prNumber, assignees);
      set((state) => ({
        activeReview: {
          ...state.activeReview,
          pullRequest: state.activeReview.pullRequest
            ? { ...state.activeReview.pullRequest, assignees: [...state.activeReview.pullRequest.assignees, ...assignees] }
            : null,
        },
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  removeAssignees: async (assignees) => {
    const { pullRequest } = get().activeReview;
    if (!pullRequest) return;
    try {
      await window.electronAPI.removeAssignees(pullRequest.repoOwner, pullRequest.repoName, pullRequest.prNumber, assignees);
      set((state) => ({
        activeReview: {
          ...state.activeReview,
          pullRequest: state.activeReview.pullRequest
            ? { ...state.activeReview.pullRequest, assignees: state.activeReview.pullRequest.assignees.filter((a: string) => !assignees.includes(a)) }
            : null,
        },
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  resetActiveReview: () => {
    set((state) => ({
      activeReview: {
        pullRequest: null,
        discussionSummary: null,
        repositoryContext: null,
        workerLogs: [],
        localPath: '',
        aiReviewResult: null,
        pipelineRunning: false,
        pipelineProgress: null,
        aiRunning: false,
        aiLogs: '',
        chatMessages: [],
        chatLoading: false,
        chatStreamingResponse: '',
      },
    }));
  },

  sendChatMessage: async (question, context) => {
    const { pullRequest, localPath } = get().activeReview;
    if (!pullRequest || !localPath) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };

    set((state) => ({
      activeReview: {
        ...state.activeReview,
        chatMessages: [...state.activeReview.chatMessages, userMsg],
        chatLoading: true,
        chatStreamingResponse: '',
      },
    }));

    const unsubscribe = window.electronAPI.onAntigravityChatResponse((chunk) => {
      set((state) => ({
        activeReview: {
          ...state.activeReview,
          chatStreamingResponse: state.activeReview.chatStreamingResponse + chunk,
        },
      }));
    });

    try {
      const fullResponse = await window.electronAPI.askAntigravity(
        localPath,
        pullRequest.prNumber,
        question,
        context
      );

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: fullResponse || get().activeReview.chatStreamingResponse,
        timestamp: Date.now(),
      };

      set((state) => ({
        activeReview: {
          ...state.activeReview,
          chatMessages: [...state.activeReview.chatMessages, assistantMsg],
          chatLoading: false,
          chatStreamingResponse: '',
        },
      }));
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `Error communicating with Antigravity: ${err.message}`,
        timestamp: Date.now(),
      };
      set((state) => ({
        activeReview: {
          ...state.activeReview,
          chatMessages: [...state.activeReview.chatMessages, errorMsg],
          chatLoading: false,
          chatStreamingResponse: '',
        },
      }));
    } finally {
      unsubscribe();
    }
  },

  resolveReviewLocally: async (owner, repo, prNumber, comment) => {
    try {
      await window.electronAPI.resolveReviewLocally(
        owner,
        repo,
        prNumber,
        comment
      );
      const active = get().activeReview.pullRequest;
      if (active && active.repoOwner === owner && active.repoName === repo && active.prNumber === prNumber) {
        set((state) => ({
          activeReview: {
            ...state.activeReview,
            pullRequest: { ...active, reviewStatus: 'approve' },
          },
        }));
      }
      await get().loadHistory();
      await get().fetchReviews();
      window.electronAPI.playBeep().catch(() => {});
    } catch (err: any) {
      set({ error: err.message });
    }
  },
}));
