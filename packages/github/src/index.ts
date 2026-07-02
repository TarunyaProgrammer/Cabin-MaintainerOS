import { Octokit } from 'octokit';
import { PullRequest, CheckStatus } from '@cabin/shared';

export class GitHubService {
  private octokit: Octokit | null = null;
  private token: string = '';

  constructor(token: string) {
    this.token = token;
    if (token) {
      this.octokit = new Octokit({ auth: token });
    }
  }

  private getOctokit(): Octokit {
    if (!this.octokit) {
      throw new Error('Octokit not initialized. Token is missing.');
    }
    return this.octokit;
  }

  /**
   * Fetches PRs assigned to the user or requesting their review
   */
  async fetchAssignedReviews(): Promise<PullRequest[]> {
    const octokit = this.getOctokit();

    // 1. Get authenticated user login
    const { data: user } = await octokit.rest.users.getAuthenticated();
    const username = user.login;

    // 2. Query search API for PRs involving the user but not authored by the user
    const query = `is:pr state:open involves:${username} -author:${username}`;
    const { data: searchResult } = await octokit.rest.search.issuesAndPullRequests({
      q: query,
    });

    const prs: PullRequest[] = [];

    for (const item of searchResult.items) {
      // Find repo details from URL
      const urlParts = item.repository_url.split('/');
      const repo = urlParts[urlParts.length - 1];
      const owner = urlParts[urlParts.length - 2];

      // Fetch the full PR details to get branch names, etc.
      const { data: prDetail } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: item.number,
      });

      // Gather latest interaction timestamps
      let latestUserActionTime = 0;
      let latestOtherActionTime = 0;

      // PR Creation (check if author is user)
      const prAuthor = prDetail.user?.login || 'unknown';
      const prCreatedAt = new Date(prDetail.created_at).getTime();
      if (prAuthor === username) {
        latestUserActionTime = Math.max(latestUserActionTime, prCreatedAt);
      } else {
        latestOtherActionTime = Math.max(latestOtherActionTime, prCreatedAt);
      }

      // Fetch Reviews
      try {
        const { data: reviews } = await octokit.rest.pulls.listReviews({
          owner,
          repo,
          pull_number: item.number,
        });
        for (const rev of reviews) {
          const revUser = rev.user?.login;
          const revTime = new Date(rev.submitted_at || prDetail.created_at).getTime();
          if (revUser === username) {
            latestUserActionTime = Math.max(latestUserActionTime, revTime);
          } else {
            latestOtherActionTime = Math.max(latestOtherActionTime, revTime);
          }
        }
      } catch {}

      // Fetch Issue Comments
      try {
        const { data: issueComments } = await octokit.rest.issues.listComments({
          owner,
          repo,
          issue_number: item.number,
        });
        for (const c of issueComments) {
          const cUser = c.user?.login;
          const cTime = new Date(c.created_at).getTime();
          if (cUser === username) {
            latestUserActionTime = Math.max(latestUserActionTime, cTime);
          } else {
            latestOtherActionTime = Math.max(latestOtherActionTime, cTime);
          }
        }
      } catch {}

      // Fetch Review (Inline) Comments
      try {
        const { data: reviewComments } = await octokit.rest.pulls.listReviewComments({
          owner,
          repo,
          pull_number: item.number,
        });
        for (const c of reviewComments) {
          const cUser = c.user?.login;
          const cTime = new Date(c.created_at).getTime();
          if (cUser === username) {
            latestUserActionTime = Math.max(latestUserActionTime, cTime);
          } else {
            latestOtherActionTime = Math.max(latestOtherActionTime, cTime);
          }
        }
      } catch {}

      // Fetch Commits
      try {
        const { data: commits } = await octokit.rest.pulls.listCommits({
          owner,
          repo,
          pull_number: item.number,
        });
        for (const c of commits) {
          const cUser = c.author?.login || c.committer?.login || 'unknown';
          const cTime = new Date(c.commit.committer?.date || c.commit.author?.date || prDetail.created_at).getTime();
          if (cUser === username) {
            latestUserActionTime = Math.max(latestUserActionTime, cTime);
          } else {
            latestOtherActionTime = Math.max(latestOtherActionTime, cTime);
          }
        }
      } catch {}

      // Fresh activity rule:
      // Include if:
      // 1. User has never interacted yet (latestUserActionTime === 0).
      // 2. OR someone else submitted a review, comment, or commit after user's latest interaction.
      const hasFreshActivity = latestUserActionTime === 0 || latestOtherActionTime > latestUserActionTime;

      // Exclude stale PRs (inactive for >30 days) to prevent backlog clutter
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const lastActiveTime = Math.max(latestUserActionTime, latestOtherActionTime);
      const isStale = lastActiveTime < thirtyDaysAgo;

      if (hasFreshActivity && !isStale) {
        const ciStatus = await this.getQuickCIStatus(owner, repo, prDetail.head.sha);

        prs.push({
          id: `${owner}/${repo}/${item.number}`,
          prNumber: item.number,
          repositoryId: `${owner}/${repo}`,
          repoName: repo,
          repoOwner: owner,
          title: item.title,
          author: item.user?.login || 'unknown',
          authorAvatarUrl: item.user?.avatar_url || undefined,
          requestedDate: item.created_at,
          labels: item.labels.map((l: any) => (typeof l === 'string' ? l : l.name || '')).filter(Boolean),
          ciStatus,
          mergeConflictStatus: prDetail.mergeable === true ? 'passed' : prDetail.mergeable === false ? 'failed' : 'pending',
          dcoStatus: 'pending',
          lastUpdated: item.updated_at,
          aiStatus: 'pending',
          reviewStatus: 'pending',
          branchName: prDetail.head.ref,
          targetBranch: prDetail.base.ref,
          description: prDetail.body || '',
          assignees: prDetail.assignees?.map((a: any) => a.login) || [],
        });
      }
    }

    return prs;
  }

  private async getQuickCIStatus(owner: string, repo: string, sha: string): Promise<CheckStatus> {
    try {
      const octokit = this.getOctokit();
      const { data: checks } = await octokit.rest.checks.listForRef({
        owner,
        repo,
        ref: sha,
      });

      if (checks.total_count === 0) {
        // Fallback to combined status API
        const { data: status } = await octokit.rest.repos.getCombinedStatusForRef({
          owner,
          repo,
          ref: sha,
        });
        if (status.state === 'success') return 'passed';
        if (status.state === 'failure' || status.state === 'error') return 'failed';
        if (status.state === 'pending') return 'pending';
        return 'unknown';
      }

      const allRuns = checks.check_runs;
      const failed = allRuns.some((run: any) => run.conclusion === 'failure' || run.conclusion === 'timed_out' || run.conclusion === 'action_required');
      if (failed) return 'failed';

      const pending = allRuns.some((run: any) => run.status === 'in_progress' || run.status === 'queued');
      if (pending) return 'pending';

      const passed = allRuns.every((run: any) => run.conclusion === 'success' || run.conclusion === 'neutral' || run.conclusion === 'skipped');
      if (passed && allRuns.length > 0) return 'passed';

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async fetchPRDetails(owner: string, repo: string, prNumber: number) {
    const octokit = this.getOctokit();
    const { data } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });
    return data;
  }

  async fetchPRComments(owner: string, repo: string, prNumber: number) {
    const octokit = this.getOctokit();
    // Fetch review comments (inline comments on diffs)
    const { data: reviewComments } = await octokit.rest.pulls.listReviewComments({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Fetch issue comments (general PR discussion)
    const { data: issueComments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    // Fetch review reviews (to check who approved/requested changes)
    const { data: reviews } = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
    });

    return { reviewComments, issueComments, reviews };
  }

  async fetchPRChecks(owner: string, repo: string, sha: string) {
    const octokit = this.getOctokit();
    
    // Detailed check runs
    const { data: checks } = await octokit.rest.checks.listForRef({
      owner,
      repo,
      ref: sha,
    });

    // Commit statuses
    const { data: status } = await octokit.rest.repos.getCombinedStatusForRef({
      owner,
      repo,
      ref: sha,
    });

    return { checks, status };
  }

  async fetchPRCommits(owner: string, repo: string, prNumber: number) {
    const octokit = this.getOctokit();
    const { data } = await octokit.rest.pulls.listCommits({
      owner,
      repo,
      pull_number: prNumber,
    });
    return data;
  }

  async fetchChangedFiles(owner: string, repo: string, prNumber: number) {
    const octokit = this.getOctokit();
    const { data } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });
    return data;
  }

  async submitReview(
    owner: string,
    repo: string,
    prNumber: number,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
    body: string
  ): Promise<void> {
    const octokit = this.getOctokit();
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      event,
      body,
    });
  }

  async addLabels(owner: string, repo: string, prNumber: number, labels: string[]): Promise<void> {
    const octokit = this.getOctokit();
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: prNumber,
      labels,
    });
  }

  async removeLabel(owner: string, repo: string, prNumber: number, labelName: string): Promise<void> {
    const octokit = this.getOctokit();
    await octokit.rest.issues.removeLabel({
      owner,
      repo,
      issue_number: prNumber,
      name: labelName,
    });
  }

  async addAssignees(owner: string, repo: string, prNumber: number, assignees: string[]): Promise<void> {
    const octokit = this.getOctokit();
    await octokit.rest.issues.addAssignees({
      owner,
      repo,
      issue_number: prNumber,
      assignees,
    });
  }

  async removeAssignees(owner: string, repo: string, prNumber: number, assignees: string[]): Promise<void> {
    const octokit = this.getOctokit();
    await octokit.rest.issues.removeAssignees({
      owner,
      repo,
      issue_number: prNumber,
      assignees,
    });
  }

  async getRepoLabels(owner: string, repo: string): Promise<string[]> {
    const octokit = this.getOctokit();
    const { data } = await octokit.rest.issues.listLabelsForRepo({
      owner,
      repo,
      per_page: 100,
    });
    return data.map((l: any) => l.name);
  }

  async getRepoAssignees(owner: string, repo: string): Promise<string[]> {
    const octokit = this.getOctokit();
    const { data } = await octokit.rest.issues.listAssignees({
      owner,
      repo,
      per_page: 100,
    });
    return data.map((u: any) => u.login);
  }
}
