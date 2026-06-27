import { GitService } from '@cabin/git';
import { GitHubService } from '@cabin/github';
import { CheckStatus, DiscussionSummary, RepositoryContext, WorkerLog } from '@cabin/shared';

// Base Worker Interface
export interface WorkerResult<T> {
  status: 'success' | 'failed';
  durationMs: number;
  data?: T;
  error?: string;
}

// 1. Git Worker
export class GitWorker {
  constructor(private gitService: GitService) {}

  async run(
    owner: string,
    repoName: string,
    localPath: string,
    branchName: string,
    prNumber?: number,
    targetBranch: string = 'main'
  ): Promise<WorkerResult<{ localPath: string }>> {
    const startTime = Date.now();
    try {
      const fs = require('fs');
      const repoExists = fs.existsSync(localPath) && fs.existsSync(require('path').join(localPath, '.git'));
      
      if (!repoExists) {
        await this.gitService.cloneRepository(owner, repoName, localPath);
      } else {
        await this.gitService.fetchLatest(localPath);
      }

      await this.gitService.checkoutPRBranch(localPath, branchName, prNumber, targetBranch);

      return {
        status: 'success',
        durationMs: Date.now() - startTime,
        data: { localPath },
      };
    } catch (err: any) {
      return {
        status: 'failed',
        durationMs: Date.now() - startTime,
        error: `GitWorker failed: ${err.message}`,
      };
    }
  }
}

// 2. GitHub Worker
export class GitHubWorker {
  constructor(private githubService: GitHubService) {}

  async run(owner: string, repo: string, prNumber: number): Promise<WorkerResult<any>> {
    const startTime = Date.now();
    try {
      const details = await this.githubService.fetchPRDetails(owner, repo, prNumber);
      const commits = await this.githubService.fetchPRCommits(owner, repo, prNumber);
      const files = await this.githubService.fetchChangedFiles(owner, repo, prNumber);

      return {
        status: 'success',
        durationMs: Date.now() - startTime,
        data: { details, commits, files },
      };
    } catch (err: any) {
      return {
        status: 'failed',
        durationMs: Date.now() - startTime,
        error: `GitHubWorker failed: ${err.message}`,
      };
    }
  }
}

// 3. CI Worker
export class CIWorker {
  constructor(private githubService: GitHubService) {}

  async run(owner: string, repo: string, sha: string): Promise<WorkerResult<{ status: CheckStatus; details: string[] }>> {
    const startTime = Date.now();
    try {
      const { checks, status } = await this.githubService.fetchPRChecks(owner, repo, sha);
      const details: string[] = [];

      let finalStatus: CheckStatus = 'passed';

      // 1. Evaluate check runs
      if (checks.check_runs && checks.check_runs.length > 0) {
        for (const run of checks.check_runs) {
          details.push(`Check Run: ${run.name} - ${run.status} (${run.conclusion || 'no conclusion'})`);
          if (run.conclusion === 'failure' || run.conclusion === 'timed_out' || run.conclusion === 'action_required') {
            finalStatus = 'failed';
          } else if (run.status === 'in_progress' || run.status === 'queued') {
            if (finalStatus !== 'failed') finalStatus = 'pending';
          }
        }
      }

      // 2. Evaluate combined status
      if (status.statuses && status.statuses.length > 0) {
        for (const st of status.statuses) {
          details.push(`Commit Status: ${st.context} - ${st.state}`);
          if (st.state === 'failure' || st.state === 'error') {
            finalStatus = 'failed';
          } else if (st.state === 'pending') {
            if (finalStatus !== 'failed') finalStatus = 'pending';
          }
        }
      }

      if (details.length === 0) {
        finalStatus = 'unknown';
        details.push('No CI workflows or commit statuses reported.');
      }

      return {
        status: 'success',
        durationMs: Date.now() - startTime,
        data: { status: finalStatus, details },
      };
    } catch (err: any) {
      return {
        status: 'failed',
        durationMs: Date.now() - startTime,
        error: `CIWorker failed: ${err.message}`,
      };
    }
  }
}

// 4. Merge Worker
export class MergeWorker {
  constructor() {}

  async run(prDetail: any): Promise<WorkerResult<{ mergeable: CheckStatus; reason?: string }>> {
    const startTime = Date.now();
    try {
      const mergeable = prDetail.mergeable;
      const mergeableState = prDetail.mergeable_state;

      let status: CheckStatus = 'unknown';
      let reason = '';

      if (mergeable === true) {
        status = 'passed';
      } else if (mergeable === false) {
        status = 'failed';
        reason = `PR is currently in state '${mergeableState}' (possible conflicts).`;
      } else {
        status = 'pending';
        reason = 'GitHub is calculating mergeability.';
      }

      return {
        status: 'success',
        durationMs: Date.now() - startTime,
        data: { mergeable: status, reason },
      };
    } catch (err: any) {
      return {
        status: 'failed',
        durationMs: Date.now() - startTime,
        error: `MergeWorker failed: ${err.message}`,
      };
    }
  }
}

// 5. DCO Worker
export class DCOWorker {
  constructor(private gitService: GitService) {}

  async run(
    localPath: string,
    prBranch: string,
    targetBranch: string = 'main'
  ): Promise<WorkerResult<{ dcoStatus: CheckStatus; unsignedCommits: string[] }>> {
    const startTime = Date.now();
    try {
      const commits = await this.gitService.getCommitLog(localPath, prBranch, targetBranch);
      const unsignedCommits: string[] = [];

      for (const commit of commits) {
        const message = commit.message || '';
        const body = commit.body || '';
        const fullText = `${message}\n${body}`;

        // Look for: Signed-off-by: Name <email>
        const hasDco = /Signed-off-by:\s+([^<]+)\s+<([^>]+)>/i.test(fullText);
        if (!hasDco) {
          unsignedCommits.push(`${commit.hash.substring(0, 7)}: ${commit.message} (Author: ${commit.author_name})`);
        }
      }

      return {
        status: 'success',
        durationMs: Date.now() - startTime,
        data: {
          dcoStatus: unsignedCommits.length === 0 ? 'passed' : 'failed',
          unsignedCommits,
        },
      };
    } catch (err: any) {
      return {
        status: 'failed',
        durationMs: Date.now() - startTime,
        error: `DCOWorker failed: ${err.message}`,
      };
    }
  }
}

// 6. Discussion Worker
export class DiscussionWorker {
  constructor(private githubService: GitHubService) {}

  async run(owner: string, repo: string, prNumber: number): Promise<WorkerResult<DiscussionSummary>> {
    const startTime = Date.now();
    try {
      const { reviewComments, issueComments, reviews } = await this.githubService.fetchPRComments(owner, repo, prNumber);
      
      const requestedChanges: string[] = [];
      const questions: string[] = [];
      const pendingReplies: string[] = [];
      let resolvedCount = 0;
      let openCount = 0;

      // Group reviews that requested changes
      for (const rev of reviews) {
        if (rev.state === 'CHANGES_REQUESTED') {
          requestedChanges.push(`Review by ${rev.user?.login}: ${rev.body || 'Please make fixes.'}`);
        }
      }

      // Analyze comments for questions or unresolved threads
      // Simple heuristic for phase 1: look for question marks in recent comments
      const allComments = [...reviewComments, ...issueComments];
      for (const comment of allComments) {
        const body = comment.body || '';
        
        // Count comments containing '?' as questions
        if (body.includes('?')) {
          questions.push(`${comment.user?.login}: "${body.substring(0, 80)}..."`);
        }

        // If it's a review comment, check if resolved (Octokit does not give thread-resolution details directly on individual comment object,
        // but we can increment open/resolved counters based on whether it is an orphan or last comment in its diff path)
        if ('path' in comment) {
          // If a comment is newer and contains 'LGTM' or 'Thanks' or 'fixed', count it as tending to resolved
          const isPossiblyFixed = /fixed|resolved|done|lgtm/i.test(body);
          if (isPossiblyFixed) resolvedCount++;
          else openCount++;
        }
      }

      const summary = `The PR has ${allComments.length} total comments across ${reviews.length} reviews. ` +
        (requestedChanges.length > 0 ? `${requestedChanges.length} changes have been requested.` : 'No active changes are currently requested in reviews.');

      return {
        status: 'success',
        durationMs: Date.now() - startTime,
        data: {
          summary,
          requestedChanges,
          questions,
          pendingReplies,
          resolvedDiscussions: resolvedCount,
          openConversations: openCount,
        },
      };
    } catch (err: any) {
      return {
        status: 'failed',
        durationMs: Date.now() - startTime,
        error: `DiscussionWorker failed: ${err.message}`,
      };
    }
  }
}

// 7. Repository Context Worker
export class RepositoryContextWorker {
  constructor(private gitService: GitService) {}

  async run(localPath: string): Promise<WorkerResult<RepositoryContext>> {
    const startTime = Date.now();
    try {
      const readme = await this.gitService.readFileContent(localPath, 'README.md') || undefined;
      const contributing = await this.gitService.readFileContent(localPath, 'CONTRIBUTING.md') || undefined;
      
      // Look for PR template in standard folders
      let prTemplate = await this.gitService.readFileContent(localPath, '.github/pull_request_template.md') ||
                       await this.gitService.readFileContent(localPath, 'pull_request_template.md') || undefined;

      let issueTemplate = await this.gitService.readFileContent(localPath, '.github/issue_template.md') || undefined;

      const repoRules: string[] = [];
      const packageJson = await this.gitService.readFileContent(localPath, 'package.json');
      if (packageJson) {
        try {
          const pkg = JSON.parse(packageJson);
          if (pkg.scripts) {
            repoRules.push(`npm scripts found: ${Object.keys(pkg.scripts).join(', ')}`);
          }
        } catch {}
      }

      return {
        status: 'success',
        durationMs: Date.now() - startTime,
        data: {
          readme: readme ? `${readme.substring(0, 500)}...` : undefined,
          contributing: contributing ? `${contributing.substring(0, 300)}...` : undefined,
          prTemplate,
          issueTemplate,
          repoRules,
        },
      };
    } catch (err: any) {
      return {
        status: 'failed',
        durationMs: Date.now() - startTime,
        error: `RepositoryContextWorker failed: ${err.message}`,
      };
    }
  }
}
