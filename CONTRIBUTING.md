# Contributing to Cabin

Thank you for your interest in contributing to **Cabin**! This document explains how to get started, submit changes, and follow the project's standards.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Pull Request Guidelines](#pull-request-guidelines)
- [DCO Sign-Off](#dco-sign-off)
- [Code Style](#code-style)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/Cabin-MaintainerOS.git
   cd Cabin-MaintainerOS
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Build all packages:**
   ```bash
   npm run build:all
   ```
5. **Start development servers:**
   ```bash
   # Terminal 1 — UI (Vite dev server)
   npm run dev:ui

   # Terminal 2 — Electron main process
   npm run dev:desktop
   ```

---

## Project Structure

```
Cabin-MaintainerOS/
├── apps/
│   └── desktop/          # Electron main process (Node.js, SQLite, git)
├── packages/
│   ├── ui/               # React frontend (Vite + React + TypeScript)
│   ├── database/         # SQLite wrapper (CabinDatabase)
│   ├── shared/           # Types & Zod schemas
│   ├── github/           # GitHub API client (Octokit)
│   ├── git/              # Git CLI client (simple-git)
│   ├── workers/          # 7-stage analysis pipeline workers
│   ├── review-engine/    # Pipeline orchestrator
│   └── providers/        # AI review process spawner
└── website/              # Static landing page
```

---

## Making Changes

- Create a new branch from `main`:
  ```bash
  git checkout -b feat/your-feature-name
  ```
- Keep changes focused — one feature or fix per PR.
- Write clear, descriptive commit messages.
- **No node/electron imports in React components.** Use `window.electronAPI` (IPC) exclusively.
- Add types first in `packages/shared/src/index.ts`, rebuild, then implement elsewhere.

---

## Pull Request Guidelines

- Target the `main` branch.
- Include a clear description of **what** changed and **why**.
- Reference any related issues: `Closes #123`.
- Ensure `npm run build:all` passes before submitting.
- Keep PRs small and reviewable — large PRs take longer to merge.

---

## DCO Sign-Off

Cabin requires a **Developer Certificate of Origin (DCO)** sign-off on every commit. This certifies that you wrote the code or have the right to submit it.

Add `-s` to your commit command:
```bash
git commit -s -m "feat: add new worker stage"
```

This appends the following line to your commit message:
```
Signed-off-by: Your Name <your@email.com>
```

If you forgot to sign off on previous commits, you can amend them:
```bash
# Single commit
git commit --amend -s --no-edit

# Multiple commits (last N)
git rebase --signoff HEAD~N
```

---

## Code Style

- **TypeScript** everywhere — no plain `.js` files in packages.
- Use `async/await` over raw Promises.
- Keep functions small and single-purpose.
- Use existing patterns for IPC — add new channels via `preload.ts` and handle in `main.ts`.
- Database schema changes must use `try/catch ALTER TABLE` wrappers in `CabinDatabase.initialize`.

---

## Reporting Bugs

Open an issue on [GitHub Issues](https://github.com/TarunyaProgrammer/Cabin-MaintainerOS/issues) and include:

- Your OS and version
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs (check DevTools console or Electron main process output)

---

## Feature Requests

Open a GitHub Issue with the label `enhancement`. Describe the problem you're trying to solve, not just the solution — it helps shape the best implementation.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
