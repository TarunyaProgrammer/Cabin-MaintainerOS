import * as path from 'path';
import { GitService } from '@cabin/git';
import { GitHubService } from '@cabin/github';
import { 
  PullRequest, 
  DiscussionSummary, 
  RepositoryContext, 
  WorkerLog, 
  CheckStatus 
} from '@cabin/shared';
import { 
  GitWorker, 
  GitHubWorker, 
  CIWorker, 
  MergeWorker, 
  DCOWorker, 
  DiscussionWorker, 
  RepositoryContextWorker 
} from '@cabin/workers';

export interface PipelineProgress {
  stepName: string;
  progress: number; // 0 to 100
  status: 'running' | 'success' | 'failed';
}

export interface PipelineResult {
  pullRequest: PullRequest;
  discussionSummary: DiscussionSummary;
  repositoryContext: RepositoryContext;
  workerLogs: WorkerLog[];
  localPath: string;
}

export class ReviewPipeline {
  constructor(
    private gitService: GitService,
    private githubService: GitHubService,
    private reposRootDir: string
  ) {}

  async execute(
    owner: string,
    repoName: string,
    prNumber: number,
    branchName: string,
    targetBranch: string = 'main',
    onProgress: (progress: PipelineProgress) => void
  ): Promise<PipelineResult> {
    const workerLogs: WorkerLog[] = [];
    const localPath = path.join(this.reposRootDir, owner, repoName);

    // Initial Progress
    onProgress({ stepName: 'Initializing review pipeline', progress: 5, status: 'running' });

    // Step 1: GitHub Metadata Fetch
    onProgress({ stepName: 'Fetching GitHub Pull Request Metadata', progress: 15, status: 'running' });
    const ghWorker = new GitHubWorker(this.githubService);
    const ghRes = await ghWorker.run(owner, repoName, prNumber);
    
    workerLogs.push({
      workerName: 'GitHubWorker',
      status: ghRes.status,
      durationMs: ghRes.durationMs,
      error: ghRes.error,
    });

    if (ghRes.status === 'failed' || !ghRes.data) {
      onProgress({ stepName: 'Metadata fetch failed', progress: 15, status: 'failed' });
      throw new Error(`Pipeline stopped at GitHubWorker: ${ghRes.error}`);
    }

    const { details: prDetails } = ghRes.data;
    const headSha = prDetails.head.sha;

    // Step 2: Git Repository Manager (Clone/Fetch/Checkout)
    onProgress({ stepName: 'Preparing local git repository', progress: 40, status: 'running' });
    const gitWorker = new GitWorker(this.gitService);
    const gitRes = await gitWorker.run(owner, repoName, localPath, branchName, prNumber, targetBranch);
    
    workerLogs.push({
      workerName: 'GitWorker',
      status: gitRes.status,
      durationMs: gitRes.durationMs,
      error: gitRes.error,
      output: gitRes.data,
    });

    if (gitRes.status === 'failed') {
      onProgress({ stepName: 'Git operation failed', progress: 40, status: 'failed' });
      throw new Error(`Pipeline stopped at GitWorker: ${gitRes.error}`);
    }

    // Step 3: CI Worker
    onProgress({ stepName: 'Evaluating CI test suite status', progress: 55, status: 'running' });
    const ciWorker = new CIWorker(this.githubService);
    const ciRes = await ciWorker.run(owner, repoName, headSha);
    
    workerLogs.push({
      workerName: 'CIWorker',
      status: ciRes.status,
      durationMs: ciRes.durationMs,
      error: ciRes.error,
      output: ciRes.data,
    });

    const ciStatus = ciRes.data?.status || 'unknown';

    // Step 4: Merge Conflict Worker
    onProgress({ stepName: 'Checking merge conflicts and rebases', progress: 70, status: 'running' });
    const mergeWorker = new MergeWorker();
    const mergeRes = await mergeWorker.run(prDetails);
    
    workerLogs.push({
      workerName: 'MergeWorker',
      status: mergeRes.status,
      durationMs: mergeRes.durationMs,
      error: mergeRes.error,
      output: mergeRes.data,
    });

    const mergeStatus = mergeRes.data?.mergeable || 'unknown';

    // Step 5: DCO Worker
    onProgress({ stepName: 'Verifying Developer Certificate of Origin (DCO)', progress: 80, status: 'running' });
    const dcoWorker = new DCOWorker(this.gitService);
    const dcoRes = await dcoWorker.run(localPath, branchName, targetBranch);
    
    workerLogs.push({
      workerName: 'DCOWorker',
      status: dcoRes.status,
      durationMs: dcoRes.durationMs,
      error: dcoRes.error,
      output: dcoRes.data,
    });

    const dcoStatus = dcoRes.data?.dcoStatus || 'unknown';

    // Step 6: Discussion Summary Worker
    onProgress({ stepName: 'Synthesizing comment threads and open questions', progress: 90, status: 'running' });
    const discWorker = new DiscussionWorker(this.githubService);
    const discRes = await discWorker.run(owner, repoName, prNumber);
    
    workerLogs.push({
      workerName: 'DiscussionWorker',
      status: discRes.status,
      durationMs: discRes.durationMs,
      error: discRes.error,
      output: discRes.data,
    });

    const discussionSummary: DiscussionSummary = discRes.data || {
      summary: 'Could not summarize discussions.',
      requestedChanges: [],
      questions: [],
      pendingReplies: [],
      resolvedDiscussions: 0,
      openConversations: 0,
    };

    // Step 7: Repository Context Worker
    onProgress({ stepName: 'Analyzing repository guides and templates', progress: 95, status: 'running' });
    const ctxWorker = new RepositoryContextWorker(this.gitService);
    const ctxRes = await ctxWorker.run(localPath);
    
    workerLogs.push({
      workerName: 'RepositoryContextWorker',
      status: ctxRes.status,
      durationMs: ctxRes.durationMs,
      error: ctxRes.error,
      output: ctxRes.data,
    });

    const repositoryContext: RepositoryContext = ctxRes.data || {
      readme: '',
      contributing: '',
      prTemplate: '',
      issueTemplate: '',
      repoRules: [],
    };

    // Construct the fully hydrated PullRequest object
    const pullRequest: PullRequest = {
      id: `${owner}/${repoName}/${prNumber}`,
      prNumber,
      repositoryId: `${owner}/${repoName}`,
      repoName,
      repoOwner: owner,
      title: prDetails.title,
      author: prDetails.user?.login || 'unknown',
      authorAvatarUrl: prDetails.user?.avatar_url || undefined,
      requestedDate: prDetails.created_at,
      labels: prDetails.labels?.map((l: any) => l.name) || [],
      ciStatus: ciStatus as CheckStatus,
      mergeConflictStatus: mergeStatus as CheckStatus,
      dcoStatus: dcoStatus as CheckStatus,
      lastUpdated: prDetails.updated_at,
      aiStatus: 'pending', // Will be run in next step
      reviewStatus: 'pending',
      branchName,
      targetBranch: prDetails.base.ref || 'main',
    };

    onProgress({ stepName: 'Review Pipeline Complete', progress: 100, status: 'success' });

    return {
      pullRequest,
      discussionSummary,
      repositoryContext,
      workerLogs,
      localPath,
    };
  }
}
