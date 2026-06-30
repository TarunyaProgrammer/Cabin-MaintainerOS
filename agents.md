# CABIN WORKSPACE SYSTEM SPECIFICATION FOR AGENTS

## MONOREPO MAP
```json
{
  "apps/desktop": {
    "entry": "src/main.ts",
    "preload": "src/preload.ts",
    "type": "Electron Main Process",
    "privilege": "Full Node.js API (fs, child_process, sqlite3, simple-git)"
  },
  "packages/ui": {
    "type": "React Frontend",
    "framework": "Vite+React+TS",
    "state": "Zustand (src/store.ts)",
    "query": "React Query"
  },
  "packages/database": {
    "type": "SQLite wrapper",
    "file": "src/index.ts",
    "api": "CabinDatabase (settings, repositories, review_sessions, cached_pull_requests)"
  },
  "packages/shared": {
    "type": "Types & Schemas",
    "file": "src/index.ts",
    "library": "Zod validations & domain types"
  },
  "packages/github": {
    "type": "GitHub API Client",
    "file": "src/index.ts",
    "library": "Octokit"
  },
  "packages/git": {
    "type": "Git CLI Client",
    "file": "src/index.ts",
    "library": "simple-git"
  },
  "packages/workers": {
    "type": "Static Analysis Pipeline Units",
    "file": "src/index.ts",
    "units": ["GitWorker", "GitHubWorker", "CIWorker", "MergeWorker", "DCOWorker", "DiscussionWorker", "RepositoryContextWorker"]
  },
  "packages/review-engine": {
    "type": "Worker pipeline orchestrator",
    "file": "src/index.ts",
    "api": "ReviewPipeline"
  },
  "packages/providers": {
    "type": "AI review process spawner",
    "file": "src/index.ts",
    "api": "AntigravityProvider"
  }
}
```

## LIFECYCLES & FLOWS
### Sync Loop
`apps/desktop/src/main.ts` -> 3s post-boot -> repeat every 30m.
Throttle: minimum 2m window unless `force=true`.
`GitHubService.fetchAssignedReviews()` -> DB write (`cached_pull_requests`) -> Emit `github:pending-updated`.

### Context Pipeline
`ReviewPipeline.execute()` sequence:
1. `GitHubWorker` (15%): Fetches PR details, commits, changed files via `githubService`.
2. `GitWorker` (40%): Clones/Fetches target branch, checkouts branch, handles forks via `+refs/pull/PR_NUMBER/head:refs/heads/branchName`.
3. `CIWorker` (55%): Combined status (Octokit `getCombinedStatusForRef`) and check runs (`listForRef`). Statuses: `passed` | `failed` | `pending` | `unknown`.
4. `MergeWorker` (70%): Validates branch mergeability state (`mergeable`, `mergeable_state`).
5. `DCOWorker` (80%): Runs git diff logs (`origin/main..prBranch`), parses message & body for `/Signed-off-by:\s+([^<]+)\s+<([^>]+)>/i`.
6. `DiscussionWorker` (90%): Parses issue comments, reviews, inline comments. Aggregates unresolved conversations, questions (`?`), change requests.
7. `RepositoryContextWorker` (95%): Extracts `README.md`, `CONTRIBUTING.md`, issue/PR markdown templates.
Output: Unified JSON metadata payload.

### AI CLI Runner
`AntigravityProvider.review()`:
* If `antigravityPath` is `''`, `'mock'`, or `'demo'`: Runs simulation (Functionality, Code Quality, Consistency, Dependencies, Performance, Accessibility, Responsiveness, Security).
* If path exists: Spawns executable CLI command: `[executablePath] review --pr [prNumber]` (shell=true, env GITHUB_TOKEN).
* Streams stdout/stderr to frontend via `review:log-update`.
* Parsing: regex `/\{[\s\S]*\}/` extracts raw JSON. Falls back to markdown line parsing: `- [file:line] description` where severity determines risk level.

## IPC INTERFACE (preload.ts)
`window.electronAPI`:
* `getSettings()` -> `db:get-settings` -> `Promise<Settings>`
* `saveSettings(settings)` -> `db:save-settings` -> `Promise<void>`
* `getRepositories()` -> `db:get-repositories` -> `Promise<Repository[]>`
* `saveRepository(repo)` -> `db:save-repository` -> `Promise<void>`
* `deleteRepository(id)` -> `db:delete-repository` -> `Promise<void>`
* `getReviewSessions()` -> `db:get-review-sessions` -> `Promise<ReviewSession[]>`
* `fetchPendingReviews(force)` -> `github:fetch-pending` -> `Promise<PullRequest[]>` (returns cached instantly, syncs in background)
* `prepareReview(owner, repo, pr, branch, target)` -> `review:prepare` -> `Promise<PipelineResult>`
* `runAIReview(prId, repoPath, prNumber)` -> `review:run-ai` -> `Promise<ReviewResult>`
* `submitDecision(owner, repo, pr, action, comment)` -> `github:submit-review` -> `Promise<void>`
* `addLabels` / `removeLabel` / `addAssignees` / `removeAssignees` -> Direct Octokit bridges.
* `onReviewProgress(callback)` -> Listens to `review:progress-update`.
* `onReviewLog(callback)` -> Listens to `review:log-update`.
* `onPendingReviewsUpdated(callback)` -> Listens to `github:pending-updated`.

## DB SCHEMA (cabin.db)
```sql
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE repositories (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner TEXT NOT NULL, local_path TEXT NOT NULL, last_synced_at TEXT);
CREATE TABLE review_sessions (id TEXT PRIMARY KEY, pr_number INTEGER NOT NULL, repository_id TEXT NOT NULL, repo_name TEXT NOT NULL, repo_owner TEXT NOT NULL, decision TEXT NOT NULL, reviewed_at TEXT NOT NULL, ai_summary TEXT NOT NULL, review_result_json TEXT NOT NULL, discussion_summary_json TEXT NOT NULL, worker_logs_json TEXT NOT NULL, FOREIGN KEY(repository_id) REFERENCES repositories(id));
CREATE TABLE cached_pull_requests (id TEXT PRIMARY KEY, pr_number INTEGER NOT NULL, repository_id TEXT NOT NULL, repo_name TEXT NOT NULL, repo_owner TEXT NOT NULL, title TEXT NOT NULL, author TEXT NOT NULL, author_avatar_url TEXT, requested_date TEXT NOT NULL, labels_json TEXT NOT NULL, ci_status TEXT NOT NULL, merge_conflict_status TEXT NOT NULL, dco_status TEXT NOT NULL, last_updated TEXT NOT NULL, ai_status TEXT NOT NULL, review_status TEXT NOT NULL, branch_name TEXT NOT NULL, target_branch TEXT NOT NULL, description TEXT, assignees_json TEXT);
```

## BUILD & RUN
```bash
npm install
npm run build:all
npm run dev:ui
npm run dev:desktop
```

## STRICT CODING CONSTRAINTS
* No node module/electron imports in React components. Access main process state exclusively via `window.electronAPI`.
* Types first: Write schema additions in `packages/shared/src/index.ts`, rebuild `shared`, then implement elsewhere.
* Fork fallback: Preserve simple-git `+refs/pull/PR_NUMBER/head:refs/heads/branchName` refspec fallback for checkout logic stability.
* Database modifications must utilize try-catch ALTER TABLE wrappers in `CabinDatabase.initialize` for seamless schema migrations.
