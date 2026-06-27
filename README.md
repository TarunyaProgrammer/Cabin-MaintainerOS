# Cabin — Where Maintainers Work

> **Cabin** is a local-first development workspace and workflow orchestration platform for code maintainers. 
> 
> *It is not "yet another AI PR reviewer." It is the operating system for code review.*

---

## 💡 The Philosophy: Workflow Orchestration > AI Reviewers

The market for AI code reviewers is heavily commoditized. Modern developers already have GitHub Copilot, Claude Code, Cursor, Antigravity, and Gemini CLI embedded directly into their editors. Building a generic AI code reviewer is a race to the bottom.

**The real bottleneck for code maintainers is not the review intelligence itself—it's the workflow orchestration and context gathering.**

### The Problem
Before a maintainer can even begin assessing code, they must manually coordinate a multi-step context collection ritual:
1. Open GitHub and navigate notifications.
2. Read the issue and the surrounding discussion.
3. Understand previous review comments.
4. Verify CI status, test results, and merge conflicts.
5. Fetch the branch locally to run test suites or manually inspect suspicious code blocks.
6. Run local scripts, linters, or AI tools.

Currently, **90% of a maintainer's time is spent gathering context, and only 10% is spent applying human judgment.**

### The Solution: Cabin
Cabin reverses this ratio. It treats GitHub as a database and provides a dedicated, high-performance local workspace where the entire pipeline is automated in the background. 

```
[ GitHub Event ] ──> [ Cabin Local Engine ] ──> [ Gathers Context, Runs Git, Spawns AI ] ──> [ Decision Dashboard ] ──> [ One-Click Approve ]
```

When a notification arrives, Cabin has already prepared the context in **10 seconds**:
* **CI & Checks**: CI passed, DCO signed, no merge conflicts.
* **Aggregated History**: "Contributor addressed accessibility requests and inline styles."
* **Local Run Results**: AI analysis generated, code rules verified.
* **Pre-Drafted Comments**: Smart suggestions ready to post.

You read, decide, and click.

---

## 🏗️ Architecture: Local-First Workspace

Cabin is designed as a **local-first web application** (React frontend + Express.js backend running on `localhost`). This architecture offers the power of a desktop application (unrestricted filesystem access, executing local CLI commands) with the ease of development of modern web technologies.

```
                    ┌──────────────────────────────────┐
                    │       Browser / Localhost        │
                    │   React UI + Tailwind + Framer   │
                    └─────────────────┬────────────────┘
                                      │ HTTP / SSE / WebSockets
                    ┌─────────────────▼────────────────┐
                    │      Local Express Server        │
                    │   (Process Layer & Git Engine)   │
                    └──────┬──────────┬──────────┬─────┘
                           │          │          │
         ┌─────────────────▼──┐ ┌─────▼──────┐ ┌─▼──────────────────┐
         │ Local Filesystem   │ │ SQLite DB  │ │ CLI Runner         │
         │ (Repo Clones)      │ │ (Settings, │ │ (Spawn git, ag,   │
         │ ~/Cabin/repos/     │ │ Cache, etc)│ │ other local tools)│
         └────────────────────┘ └────────────┘ └────────────────────┘
```

### Why a Local Server + React UI?
* **Zero Browser Sandboxing Limits**: The browser cannot execute terminal commands or clone repositories. The local Express server handles all high-privilege tasks.
* **Private and Secure**: Your source code, credentials, and API tokens never leave your machine.
* **No Server Costs or Complex Deployments**: Database operations use SQLite locally, meaning zero cloud infrastructure is required for Phase 1.
* **Flexible CLI Integration**: Spawning the Antigravity CLI, `git`, or other linters uses Node.js `child_process.spawn()`.

---

## 🚀 Key Modules (Phase 1)

### 1. Unified Review Inbox
Instead of the noisy GitHub notification feed, Cabin provides a focused queue representing the state of every pending PR:
* **Ready for Review**: CI passed, mergeable, AI checks complete.
* **Blocked / Attention Needed**: CI failing, merge conflicts detected.
* **Awaiting Contributor**: Feedback requested, waiting on fixes.

### 2. Git & Workspace Manager
When you click a PR in the dashboard, the local Git Engine performs the heavy lifting:
* Clones the repository to `~/Cabin/repositories/` if it doesn't exist.
* Automatically fetches the branch and checks out the PR commits.
* Prepares the workspace for inspection or local testing.

### 3. AI & CLI Runner (The child_process Bridge)
Cabin connects directly to your local command-line tools. When a review is triggered, the Express backend spawns the Antigravity CLI process:
```javascript
const { spawn } = require('child_process');

function runAntigravityReview(repoPath, prNumber) {
  return new Promise((resolve, reject) => {
    // Spawns: ag review --pr 218
    const process = spawn('ag', ['review', '--pr', prNumber], { cwd: repoPath });
    let output = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) resolve(JSON.parse(output));
      else reject(new Error(`CLI exited with code ${code}`));
    });
  });
}
```
*Outputs are streamed to the React UI in real-time using Server-Sent Events (SSE) or WebSockets.*

### 4. Repository Review Profiles
Onboard a repository once and define its rules:
* Require DCO / Commits Signed.
* Enforce lint standards (e.g., reject `console.log`, verify Conventional Commits).
* Require accessibility compliance.
* Check bundle size thresholds.

### 5. Automated Chores & Comment Generator
Review findings (e.g., "Missing DCO signature" or "Unused imports") are mapped to editable markdown templates. You can click a button, preview the generated comment (optionally humanized by an LLM), and post it directly to GitHub in a single action.

---

## 🗺️ Phase 1 Roadmap

### 🏁 Milestone 1: Foundation (Client-Server Setup)
- [ ] Bootstrap React app using **Vite** (Tailwind CSS, Framer Motion, TanStack Query).
- [ ] Set up the Express.js backend with local routing.
- [ ] Initialize the **SQLite** database locally for settings and token storage.
- [ ] Implement the GitHub personal access token (PAT) onboarding screen.
- [ ] Build the Review Queue UI displaying pending reviews fetched from the GitHub API.

### 🏁 Milestone 2: Git Engine
- [ ] Implement repository cloning middleware on the Express backend.
- [ ] Orchestrate local workspace directory structure at `~/Cabin/repositories/`.
- [ ] Build auto-fetching and check-out capabilities for PR branches.
- [ ] Add status checks for merge conflicts and local build setup.

### 🏁 Milestone 3: AI CLI Runner & Adapter
- [ ] Create the abstract `AIProvider` process-spawning interface.
- [ ] Implement the Antigravity CLI adapter executing via `child_process.spawn()`.
- [ ] Add real-time stdout streaming to the UI.
- [ ] Build the parser to display code findings categorized by severity (High, Medium, Low).

### 🏁 Milestone 4: Review Workspace & Actions
- [ ] Design the PR Timeline and Discussion summary UI.
- [ ] Add the action panel containing single-click operations (Approve, Request Changes, Comment).
- [ ] Implement GitHub API comment-posting hooks.
- [ ] Validate end-to-end local review cycle on a sample repository.

---

## 🛠️ Development Setup (Proposed)

### Prerequisites
* Node.js (v18+)
* Git CLI installed and configured
* GitHub Personal Access Token (with `repo` permissions)

### Quick Start
1. **Install dependencies in root:**
   ```bash
   npm install
   ```
2. **Start the development servers (Vite + Express):**
   ```bash
   npm run dev
   ```
3. **Open in browser:**
   Navigate to [http://localhost:3000](http://localhost:3000) (React Client) interacting with the backend API on [http://localhost:5000](http://localhost:5000).

---

## 🔮 Future Vision
* **Decision Confidence**: The system calculates the probability of PR approval based on the footprint of changed files and historical review patterns.
* **Maintainer Habits Mapping**: Learns individual maintainer style rules over time (e.g., "Arin always rejects inline CSS").
* **Multi-Reviewer Consensus Engine**: Runs multiple AI agents (Claude, Codex, Antigravity) concurrently and generates a unified confidence consensus.
