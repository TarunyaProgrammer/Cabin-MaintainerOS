import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

export class GitService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private getGitClient(repoPath?: string): SimpleGit {
    return simpleGit(repoPath);
  }

  /**
   * Clones a repository to a local path. Injects authentication token.
   */
  async cloneRepository(owner: string, repoName: string, localPath: string): Promise<void> {
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Prepare authenticated URL
    const authUrl = this.token
      ? `https://x-access-token:${this.token}@github.com/${owner}/${repoName}.git`
      : `https://github.com/${owner}/${repoName}.git`;

    const git = this.getGitClient();
    await git.clone(authUrl, localPath);
  }

  /**
   * Fetches latest changes from origin
   */
  async fetchLatest(localPath: string): Promise<void> {
    const git = this.getGitClient(localPath);
    await git.fetch('origin');
  }

  /**
   * Checks out the PR branch. If it's a remote branch, tracks it.
   */
  async checkoutPRBranch(localPath: string, branchName: string, prNumber?: number, targetBranch: string = 'main'): Promise<void> {
    const git = this.getGitClient(localPath);

    if (prNumber) {
      try {
        // Fetch PR head ref spec to local branch (forcing update).
        // This works for forks because GitHub exposes refs/pull/PR_NUMBER/head.
        await git.fetch(['origin', `+refs/pull/${prNumber}/head:refs/heads/${branchName}`]);
        await git.checkout(branchName);
        return; // Success!
      } catch (err: any) {
        console.warn(`Failed to fetch PR ref spec +refs/pull/${prNumber}/head:refs/heads/${branchName}: ${err.message}. Falling back to standard flow.`);
      }
    }

    // Make sure we have the latest branches from origin
    await git.fetch(['origin', `refs/heads/${branchName}:refs/remotes/origin/${branchName}`]).catch(() => {
      // Fallback to general fetch if refspec fetch fails
      return git.fetch('origin');
    });

    // Check if the branch exists locally
    const localBranches = await git.branchLocal();
    const branchExists = localBranches.all.includes(branchName);

    if (branchExists) {
      await git.checkout(branchName);
      await git.pull('origin', branchName).catch(() => {
        // Ignore pull errors if PR branch is force pushed or tracking isn't matching
      });
    } else {
      // Create local branch tracking origin
      await git.checkout(['-b', branchName, `origin/${branchName}`]).catch(async () => {
        // Fallback to checking out raw branch name
        await git.checkout(branchName);
      });
    }
  }

  /**
   * Returns list of commits unique to the PR branch compared to target (e.g. main)
   */
  async getCommitLog(localPath: string, prBranch: string, targetBranch: string = 'main'): Promise<any[]> {
    const git = this.getGitClient(localPath);
    
    // We want the equivalent of: git log origin/main..prBranch
    try {
      const logResult = await git.log({
        from: `origin/${targetBranch}`,
        to: prBranch,
      });
      return [...logResult.all];
    } catch {
      // Fallback: try relative log of targetBranch..prBranch
      try {
        const logResult = await git.log({
          from: targetBranch,
          to: prBranch,
        });
        return [...logResult.all];
      } catch {
        // Fallback: return last 20 commits if we cannot diff
        const logResult = await git.log({ maxCount: 20 });
        return [...logResult.all];
      }
    }
  }

  /**
   * Reads the content of a file from the repository
   */
  async readFileContent(localPath: string, relativeFilePath: string): Promise<string | null> {
    const fullPath = path.join(localPath, relativeFilePath);
    try {
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        return fs.readFileSync(fullPath, 'utf8');
      }
    } catch {}
    return null;
  }
}
