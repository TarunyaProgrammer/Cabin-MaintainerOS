import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import isDev from 'electron-is-dev';

// Import Cabin services
import { CabinDatabase } from '@cabin/database';
import { GitService } from '@cabin/git';
import { GitHubService } from '@cabin/github';
import { ReviewPipeline } from '@cabin/review-engine';
import { AntigravityProvider } from '@cabin/providers';
import { Settings, Repository, ReviewSession } from '@cabin/shared';

let mainWindow: BrowserWindow | null = null;
let db: CabinDatabase | null = null;
let lastSyncTime = 0;
let isSyncing = false;

// Initialize Cabin workspace paths
const userHome = process.env.HOME || process.env.USERPROFILE || '';
const cabinRoot = path.join(userHome, 'Cabin');
const dbDir = path.join(cabinRoot, 'settings');
const dbPath = path.join(dbDir, 'cabin.db');
const reposDir = path.join(cabinRoot, 'repositories');

async function initializeApp() {
  // Ensure workspace directories exist
  [cabinRoot, dbDir, reposDir, path.join(cabinRoot, 'cache'), path.join(cabinRoot, 'logs')].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Initialize database
  db = new CabinDatabase(dbPath);
  await db.initialize();
  
  // Make sure database has correct default workspace path
  const settings = await db.getSettings();
  if (!settings.workspacePath) {
    await db.saveSettings({ workspacePath: cabinRoot });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0F0F11', // Dark background to match Raycast/Linear theme
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../ui/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function syncPendingReviews(force: boolean = false): Promise<any[]> {
  if (!db) return [];
  if (isSyncing) return [];

  const settings = await db.getSettings();
  if (!settings.githubToken) return [];

  // Rate limit throttle guard: bypass if forced (manual refresh)
  const throttleWindow = 2 * 60 * 1000; // 2 minutes
  if (!force && lastSyncTime > 0 && (Date.now() - lastSyncTime < throttleWindow)) {
    console.log('[Sync] Throttled. Skipping network call.');
    return [];
  }

  isSyncing = true;
  console.log(`[Sync] Fetching pending reviews from GitHub (force=${force})...`);
  try {
    const ghService = new GitHubService(settings.githubToken);
    const prs = await ghService.fetchAssignedReviews();
    
    // Save to cache
    await db.saveCachedPullRequests(prs);
    lastSyncTime = Date.now();
    console.log(`[Sync] Successfully synced ${prs.length} PRs.`);

    // Broadcast update to frontend UI
    if (mainWindow) {
      mainWindow.webContents.send('github:pending-updated', prs);
    }
    return prs;
  } catch (err: any) {
    console.error('[Sync] Error syncing reviews:', err);
    throw err;
  } finally {
    isSyncing = false;
  }
}

// -------------------------------------------------------------
// IPC Handlers Setup
// -------------------------------------------------------------
function setupIpcHandlers() {
  // Settings & DB
  ipcMain.handle('db:get-settings', async (): Promise<Settings> => {
    if (!db) throw new Error('Database not initialized');
    return await db.getSettings();
  });

  ipcMain.handle('db:save-settings', async (_event: any, settings: Partial<Settings>): Promise<void> => {
    if (!db) throw new Error('Database not initialized');
    await db.saveSettings(settings);
  });

  // Repositories
  ipcMain.handle('db:get-repositories', async (): Promise<Repository[]> => {
    if (!db) throw new Error('Database not initialized');
    return await db.getRepositories();
  });

  ipcMain.handle('db:save-repository', async (_event: any, repo: Repository): Promise<void> => {
    if (!db) throw new Error('Database not initialized');
    await db.saveRepository(repo);
  });

  ipcMain.handle('db:delete-repository', async (_event: any, id: string): Promise<void> => {
    if (!db) throw new Error('Database not initialized');
    await db.deleteRepository(id);
  });

  // History
  ipcMain.handle('db:get-review-sessions', async (): Promise<ReviewSession[]> => {
    if (!db) throw new Error('Database not initialized');
    return await db.getReviewSessions();
  });

  // Fetch pending review requests (returns cache instantly, syncs in background)
  ipcMain.handle('github:fetch-pending', async (_event: any, force?: boolean): Promise<any[]> => {
    if (!db) throw new Error('Database not initialized');
    
    // Return cached PRs immediately
    const cachedPRs = await db.getCachedPullRequests();
    
    // Trigger background sync in the background without blocking the response
    syncPendingReviews(force).catch((err) => {
      console.error('[IPC github:fetch-pending] Background sync failed:', err);
    });

    return cachedPRs;
  });

  // Execute Git Checkout & Worker Pipeline
  ipcMain.handle(
    'review:prepare',
    async (_event: any, owner: string, repoName: string, prNumber: number, branchName: string, targetBranch: string) => {
      if (!db || !mainWindow) throw new Error('App or DB not ready');
      const settings = await db.getSettings();
      const token = settings.githubToken;
      
      const gitService = new GitService(token);
      const ghService = new GitHubService(token);
      const pipeline = new ReviewPipeline(gitService, ghService, reposDir);

      let activeBranch = branchName;
      let activeTarget = targetBranch;
      if (!activeBranch || !activeTarget) {
        const details = await ghService.fetchPRDetails(owner, repoName, prNumber);
        activeBranch = details.head.ref;
        activeTarget = details.base.ref || 'main';
      }

      // Run pipeline, notify UI of state updates
      const result = await pipeline.execute(
        owner,
        repoName,
        prNumber,
        activeBranch,
        activeTarget,
        (progress: any) => {
          if (mainWindow) {
            mainWindow.webContents.send('review:progress-update', progress);
          }
        }
      );

      // Restore review status and past decisions from database to prevent overwrite on preparation complete
      let reviewStatus: 'approve' | 'request_changes' | 'comment' | 'pending' = 'pending';
      let pastDecisions: string[] = [];
      try {
        const cached = await db.getCachedPullRequests();
        const matchCached = cached.find(p => p.prNumber === prNumber && p.repoOwner === owner && p.repoName === repoName);
        if (matchCached && matchCached.reviewStatus !== 'pending') {
          reviewStatus = matchCached.reviewStatus;
        }

        const sessions = await db.getReviewSessions();
        const prSessions = sessions.filter(s => s.prNumber === prNumber && s.repoOwner === owner && s.repoName === repoName);
        pastDecisions = Array.from(new Set(prSessions.map(s => s.decision)));
        
        if (reviewStatus === 'pending' && pastDecisions.length > 0) {
          reviewStatus = pastDecisions[0] as any;
        }
      } catch {}
      
      result.pullRequest.reviewStatus = reviewStatus;
      (result.pullRequest as any).pastDecisions = pastDecisions;

      // Save repository to database if not present
      await db.saveRepository({
        id: `${owner}/${repoName}`,
        name: repoName,
        owner,
        localPath: result.localPath,
        lastSyncedAt: new Date().toISOString(),
      });

      return result;
    }
  );

  // Run Antigravity AI review CLI
  ipcMain.handle('review:run-ai', async (_event: any, prId: string, repoPath: string, prNumber: number) => {
    if (!db || !mainWindow) throw new Error('App or DB not ready');
    const settings = await db.getSettings();
    const token = settings.githubToken;
    const cliPath = settings.antigravityPath || 'mock'; // Default to simulation if empty

    const aiProvider = new AntigravityProvider();

    // Trigger AI execution. Pass log callbacks back to renderer UI.
    const reviewResult = await aiProvider.review(
      repoPath,
      prNumber,
      token,
      cliPath,
      (logLine: any) => {
        if (mainWindow) {
          mainWindow.webContents.send('review:log-update', logLine);
        }
      }
    );

    return reviewResult;
  });

  // Chat with Antigravity AI CLI
  ipcMain.handle('review:chat', async (_event: any, repoPath: string, prNumber: number, question: string, context: string) => {
    if (!db || !mainWindow) throw new Error('App or DB not ready');
    const settings = await db.getSettings();
    const token = settings.githubToken;
    const cliPath = settings.antigravityPath || 'mock';

    const aiProvider = new AntigravityProvider();
    const response = await aiProvider.chat(
      repoPath,
      prNumber,
      token,
      cliPath,
      question,
      context,
      (logChunk: string) => {
        if (mainWindow) {
          mainWindow.webContents.send('review:chat-log', logChunk);
        }
      }
    );
    return response;
  });

  // Submit final review decision to GitHub
  ipcMain.handle(
    'github:submit-review',
    async (_event: any, owner: string, repo: string, prNumber: number, action: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT', commentText: string) => {
      if (!db) throw new Error('Database not initialized');
      const settings = await db.getSettings();
      const ghService = new GitHubService(settings.githubToken);
      await ghService.submitReview(owner, repo, prNumber, action, commentText);

      // Record in local review sessions database
      const reviewSession: ReviewSession = {
        id: `${owner}-${repo}-${prNumber}-${Date.now()}`,
        prNumber,
        repositoryId: `${owner}/${repo}`,
        repoName: repo,
        repoOwner: owner,
        decision: action.toLowerCase() as any,
        reviewedAt: new Date().toISOString(),
        aiSummary: commentText.substring(0, 200),
        reviewResult: {
          summary: commentText,
          overallRisk: 'low',
          confidence: 100,
          highSeverityFindings: [],
          mediumSeverityFindings: [],
          lowSeverityFindings: [],
          filesMentioned: [],
          suggestions: [],
          estimatedApprovalRecommendation: action === 'APPROVE' ? 'approve' : 'request_changes',
        },
        discussionSummary: {
          summary: 'Review submitted via Cabin.',
          requestedChanges: action === 'REQUEST_CHANGES' ? [commentText] : [],
          questions: [],
          pendingReplies: [],
          resolvedDiscussions: 0,
          openConversations: 0,
        },
        workerLogs: [],
      };
      await db.saveReviewSession(reviewSession);

      // Update review status in cached pull requests table
      const prId = `${owner}/${repo}/${prNumber}`;
      await db.updateCachedPullRequestStatus(prId, action.toLowerCase());
    }
  );

  ipcMain.handle(
    'github:add-labels',
    async (_event: any, owner: string, repo: string, prNumber: number, labels: string[]) => {
      if (!db) throw new Error('Database not initialized');
      const settings = await db.getSettings();
      const ghService = new GitHubService(settings.githubToken);
      await ghService.addLabels(owner, repo, prNumber, labels);
    }
  );

  ipcMain.handle(
    'github:remove-label',
    async (_event: any, owner: string, repo: string, prNumber: number, labelName: string) => {
      if (!db) throw new Error('Database not initialized');
      const settings = await db.getSettings();
      const ghService = new GitHubService(settings.githubToken);
      await ghService.removeLabel(owner, repo, prNumber, labelName);
    }
  );

  ipcMain.handle(
    'github:add-assignees',
    async (_event: any, owner: string, repo: string, prNumber: number, assignees: string[]) => {
      if (!db) throw new Error('Database not initialized');
      const settings = await db.getSettings();
      const ghService = new GitHubService(settings.githubToken);
      await ghService.addAssignees(owner, repo, prNumber, assignees);
    }
  );

  ipcMain.handle(
    'github:remove-assignees',
    async (_event: any, owner: string, repo: string, prNumber: number, assignees: string[]) => {
      if (!db) throw new Error('Database not initialized');
      const settings = await db.getSettings();
      const ghService = new GitHubService(settings.githubToken);
      await ghService.removeAssignees(owner, repo, prNumber, assignees);
    }
  );

  ipcMain.handle(
    'github:fetch-pr-details',
    async (_event: any, owner: string, repo: string, prNumber: number) => {
      if (!db) throw new Error('Database not initialized');
      const settings = await db.getSettings();
      const ghService = new GitHubService(settings.githubToken);
      const prDetails = await ghService.fetchPRDetails(owner, repo, prNumber);
      
      // Query local database for previous decisions or cached review statuses
      let reviewStatus: 'approve' | 'request_changes' | 'comment' | 'pending' = 'pending';
      let pastDecisions: string[] = [];
      try {
        const cached = await db.getCachedPullRequests();
        const matchCached = cached.find(p => p.prNumber === prNumber && p.repoOwner === owner && p.repoName === repo);
        if (matchCached && matchCached.reviewStatus !== 'pending') {
          reviewStatus = matchCached.reviewStatus;
        }

        const sessions = await db.getReviewSessions();
        const prSessions = sessions.filter(s => s.prNumber === prNumber && s.repoOwner === owner && s.repoName === repo);
        pastDecisions = Array.from(new Set(prSessions.map(s => s.decision)));
        
        if (reviewStatus === 'pending' && pastDecisions.length > 0) {
          reviewStatus = pastDecisions[0] as any; // Fallback to latest
        }
      } catch (err) {
        console.error('[fetch-pr-details] Database lookup failed:', err);
      }

      const pr = {
        id: `${owner}/${repo}/${prNumber}`,
        prNumber,
        repositoryId: `${owner}/${repo}`,
        repoName: repo,
        repoOwner: owner,
        title: prDetails.title,
        author: prDetails.user?.login || 'unknown',
        authorAvatarUrl: prDetails.user?.avatar_url || undefined,
        requestedDate: prDetails.created_at,
        labels: prDetails.labels?.map((l: any) => l.name) || [],
        ciStatus: 'unknown',
        mergeConflictStatus: 'unknown',
        dcoStatus: 'unknown',
        lastUpdated: prDetails.updated_at,
        aiStatus: 'pending',
        reviewStatus,
        pastDecisions,
        branchName: prDetails.head.ref,
        targetBranch: prDetails.base.ref || 'main',
        description: prDetails.body || '',
        assignees: prDetails.assignees?.map((a: any) => a.login) || [],
      };
      return pr;
    }
  );

  ipcMain.handle(
    'github:get-repo-labels',
    async (_event: any, owner: string, repo: string) => {
      if (!db) throw new Error('Database not initialized');
      const settings = await db.getSettings();
      const ghService = new GitHubService(settings.githubToken);
      return await ghService.getRepoLabels(owner, repo);
    }
  );

  ipcMain.handle(
    'github:get-repo-assignees',
    async (_event: any, owner: string, repo: string) => {
      if (!db) throw new Error('Database not initialized');
      const settings = await db.getSettings();
      const ghService = new GitHubService(settings.githubToken);
      return await ghService.getRepoAssignees(owner, repo);
    }
  );

  // Shell actions
  ipcMain.handle('util:open-external', async (_event: any, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('util:open-folder', async (_event: any, localPath: string) => {
    await shell.openPath(localPath);
  });

  ipcMain.handle('util:play-beep', async () => {
    shell.beep();
  });
}

// -------------------------------------------------------------
// App Lifecycle
// -------------------------------------------------------------
app.whenReady().then(async () => {
  await initializeApp();
  setupIpcHandlers();
  createWindow();

  // Trigger initial sync in background shortly after startup
  setTimeout(() => {
    syncPendingReviews(false).catch(() => {});
  }, 3000);

  // Set up background sync every 30 minutes
  setInterval(() => {
    syncPendingReviews(false).catch(() => {});
  }, 30 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
