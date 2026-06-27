import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { Settings, Repository, ReviewSession, PullRequest } from '@cabin/shared';

export class CabinDatabase {
  private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open database
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });

    // Create tables
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS repositories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner TEXT NOT NULL,
        local_path TEXT NOT NULL,
        last_synced_at TEXT
      );

      CREATE TABLE IF NOT EXISTS review_sessions (
        id TEXT PRIMARY KEY,
        pr_number INTEGER NOT NULL,
        repository_id TEXT NOT NULL,
        repo_name TEXT NOT NULL,
        repo_owner TEXT NOT NULL,
        decision TEXT NOT NULL,
        reviewed_at TEXT NOT NULL,
        ai_summary TEXT NOT NULL,
        review_result_json TEXT NOT NULL,
        discussion_summary_json TEXT NOT NULL,
        worker_logs_json TEXT NOT NULL,
        FOREIGN KEY(repository_id) REFERENCES repositories(id)
      );

      CREATE TABLE IF NOT EXISTS cached_pull_requests (
        id TEXT PRIMARY KEY,
        pr_number INTEGER NOT NULL,
        repository_id TEXT NOT NULL,
        repo_name TEXT NOT NULL,
        repo_owner TEXT NOT NULL,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        author_avatar_url TEXT,
        requested_date TEXT NOT NULL,
        labels_json TEXT NOT NULL,
        ci_status TEXT NOT NULL,
        merge_conflict_status TEXT NOT NULL,
        dco_status TEXT NOT NULL,
        last_updated TEXT NOT NULL,
        ai_status TEXT NOT NULL,
        review_status TEXT NOT NULL,
        branch_name TEXT NOT NULL,
        target_branch TEXT NOT NULL
      );
    `);

    // Seed default settings if empty
    const settingsCount = await this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM settings');
    if (settingsCount && settingsCount.count === 0) {
      await this.saveSettings({
        githubToken: '',
        workspacePath: path.join(process.env.HOME || '', 'Cabin'),
        antigravityPath: '',
        theme: 'dark',
      });
    }
  }

  private getDb(): Database<sqlite3.Database, sqlite3.Statement> {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  async getSettings(): Promise<Settings> {
    const db = this.getDb();
    const rows = await db.all<{ key: string; value: string }[]>('SELECT key, value FROM settings');
    const settingsObj: any = {};
    for (const row of rows) {
      settingsObj[row.key] = row.value;
    }
    return {
      githubToken: settingsObj.githubToken || '',
      workspacePath: settingsObj.workspacePath || path.join(process.env.HOME || '', 'Cabin'),
      antigravityPath: settingsObj.antigravityPath || '',
      theme: (settingsObj.theme as 'light' | 'dark') || 'dark',
    };
  }

  async saveSettings(settings: Partial<Settings>): Promise<void> {
    const db = this.getDb();
    const current = await this.getSettings().catch(() => ({} as Settings));
    const merged = { ...current, ...settings };

    const stmt = await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(merged)) {
      await stmt.run(key, String(value));
    }
    await stmt.finalize();
  }

  async getRepositories(): Promise<Repository[]> {
    const db = this.getDb();
    const rows = await db.all<{ id: string; name: string; owner: string; local_path: string; last_synced_at: string }[]>(
      'SELECT id, name, owner, local_path as localPath, last_synced_at as lastSyncedAt FROM repositories'
    );
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      owner: r.owner,
      localPath: (r as any).localPath,
      lastSyncedAt: (r as any).lastSyncedAt || undefined,
    }));
  }

  async saveRepository(repo: Repository): Promise<void> {
    const db = this.getDb();
    await db.run(
      'INSERT OR REPLACE INTO repositories (id, name, owner, local_path, last_synced_at) VALUES (?, ?, ?, ?, ?)',
      repo.id,
      repo.name,
      repo.owner,
      repo.localPath,
      repo.lastSyncedAt || null
    );
  }

  async deleteRepository(id: string): Promise<void> {
    const db = this.getDb();
    await db.run('DELETE FROM repositories WHERE id = ?', id);
  }

  async getReviewSessions(): Promise<ReviewSession[]> {
    const db = this.getDb();
    const rows = await db.all<any[]>('SELECT * FROM review_sessions ORDER BY reviewed_at DESC');
    return rows.map(row => ({
      id: row.id,
      prNumber: row.pr_number,
      repositoryId: row.repository_id,
      repoName: row.repo_name,
      repoOwner: row.repo_owner,
      decision: row.decision,
      reviewedAt: row.reviewed_at,
      aiSummary: row.ai_summary,
      reviewResult: JSON.parse(row.review_result_json),
      discussionSummary: JSON.parse(row.discussion_summary_json),
      workerLogs: JSON.parse(row.worker_logs_json),
    }));
  }

  async saveReviewSession(session: ReviewSession): Promise<void> {
    const db = this.getDb();
    await db.run(
      `INSERT OR REPLACE INTO review_sessions 
      (id, pr_number, repository_id, repo_name, repo_owner, decision, reviewed_at, ai_summary, review_result_json, discussion_summary_json, worker_logs_json) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      session.id,
      session.prNumber,
      session.repositoryId,
      session.repoName,
      session.repoOwner,
      session.decision,
      session.reviewedAt,
      session.aiSummary,
      JSON.stringify(session.reviewResult),
      JSON.stringify(session.discussionSummary),
      JSON.stringify(session.workerLogs)
    );
  }

  async getCachedPullRequests(): Promise<PullRequest[]> {
    const db = this.getDb();
    const rows = await db.all<any[]>('SELECT * FROM cached_pull_requests');
    return rows.map(row => ({
      id: row.id,
      prNumber: row.pr_number,
      repositoryId: row.repository_id,
      repoName: row.repo_name,
      repoOwner: row.repo_owner,
      title: row.title,
      author: row.author,
      authorAvatarUrl: row.author_avatar_url || undefined,
      requestedDate: row.requested_date,
      labels: JSON.parse(row.labels_json),
      ciStatus: row.ci_status,
      mergeConflictStatus: row.merge_conflict_status,
      dcoStatus: row.dco_status,
      lastUpdated: row.last_updated,
      aiStatus: row.ai_status,
      reviewStatus: row.review_status,
      branchName: row.branch_name,
      targetBranch: row.target_branch,
    }));
  }

  async saveCachedPullRequests(prs: PullRequest[]): Promise<void> {
    const db = this.getDb();
    await db.run('DELETE FROM cached_pull_requests');
    
    if (prs.length === 0) return;

    const stmt = await db.prepare(`
      INSERT INTO cached_pull_requests (
        id, pr_number, repository_id, repo_name, repo_owner, title, author, author_avatar_url, 
        requested_date, labels_json, ci_status, merge_conflict_status, dco_status, last_updated, 
        ai_status, review_status, branch_name, target_branch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const pr of prs) {
      await stmt.run(
        pr.id,
        pr.prNumber,
        pr.repositoryId,
        pr.repoName,
        pr.repoOwner,
        pr.title,
        pr.author,
        pr.authorAvatarUrl || null,
        pr.requestedDate,
        JSON.stringify(pr.labels),
        pr.ciStatus,
        pr.mergeConflictStatus,
        pr.dcoStatus,
        pr.lastUpdated,
        pr.aiStatus,
        pr.reviewStatus,
        pr.branchName,
        pr.targetBranch
      );
    }
    await stmt.finalize();
  }

  async clearCachedPullRequests(): Promise<void> {
    const db = this.getDb();
    await db.run('DELETE FROM cached_pull_requests');
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}
