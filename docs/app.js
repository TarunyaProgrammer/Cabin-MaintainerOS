// Platform detection
function detectPlatform() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const platformInfo = document.getElementById('platform-info-text');
  const downloadText = document.getElementById('download-text');
  const heroDownloadBtn = document.getElementById('hero-download-btn');
  const navDownloadBtn = document.getElementById('nav-download-btn');

  let os = 'Unknown OS';
  let downloadUrl = 'https://github.com/TarunyaProgrammer/Cabin-MaintainerOS/releases/latest';
  let badgeText = 'Download Latest Release';

  if (userAgent.indexOf('mac') !== -1) {
    os = 'macOS';
    // Check for Apple Silicon vs Intel
    if (navigator.userAgentData && navigator.userAgentData.brands) {
      // Modern high-level API check if available
      badgeText = 'Download for macOS (Apple Silicon)';
    } else {
      badgeText = 'Download for macOS (.dmg)';
    }
    downloadUrl = 'https://github.com/TarunyaProgrammer/Cabin-MaintainerOS/releases/latest/download/Cabin-macOS.dmg';
  } else if (userAgent.indexOf('win') !== -1) {
    os = 'Windows';
    badgeText = 'Download for Windows (.exe)';
    downloadUrl = 'https://github.com/TarunyaProgrammer/Cabin-MaintainerOS/releases/latest/download/Cabin-Setup.exe';
  } else if (userAgent.indexOf('linux') !== -1) {
    os = 'Linux';
    badgeText = 'Download for Linux (.AppImage)';
    downloadUrl = 'https://github.com/TarunyaProgrammer/Cabin-MaintainerOS/releases/latest/download/Cabin.AppImage';
  }

  if (platformInfo) {
    platformInfo.textContent = `Supported on macOS, Windows, and Linux. Automatically detected: ${os}.`;
  }
  if (downloadText) {
    downloadText.textContent = badgeText;
  }
  if (heroDownloadBtn) {
    heroDownloadBtn.href = downloadUrl;
  }
  if (navDownloadBtn) {
    navDownloadBtn.href = downloadUrl;
  }
}

// Simulated Pipeline Log Data
const pipelineStepsLogs = [
  // Step 1: GitHubWorker
  `[GitHubWorker] <span class="cyan">fetching</span> metadata for Pull Request #42...
[GitHubWorker] retrieved PR title: "feat: add localized caching to review pipeline"
[GitHubWorker] author: octocat
[GitHubWorker] file changes detected:
  - <span class="green">packages/review-engine/src/index.ts</span> (+45, -12)
  - <span class="green">packages/database/src/index.ts</span> (+12, -2)
[GitHubWorker] payload successfully resolved.`,

  // Step 2: GitWorker
  `[GitWorker] initializing simple-git pipeline...
[GitWorker] executing: <span class="gray">git fetch origin +refs/pull/42/head:refs/heads/pr-42</span>
[GitWorker] checkout target branch: pr-42
[GitWorker] local branch updated successfully to commit 9f8a2c1`,

  // Step 3: CIWorker
  `[CIWorker] checking combined status for commit 9f8a2c1...
[CIWorker] <span class="yellow">checking</span> suite: Build & Test (GitHub Actions)
[CIWorker] status: <span class="green">PASSED</span>
[CIWorker] suite: E2E Playwright Tests
[CIWorker] status: <span class="green">PASSED</span>
[CIWorker] suite: Security Scanner (Snyk)
[CIWorker] status: <span class="green">PASSED</span>`,

  // Step 4: MergeWorker
  `[MergeWorker] evaluating mergeability status...
[MergeWorker] branch is mergeable: <span class="green">TRUE</span>
[MergeWorker] mergeable state: clean
[MergeWorker] no merge conflicts detected on target branch 'main'`,

  // Step 5: DCOWorker
  `[DCOWorker] analyzing git logs for origin/main..pr-42...
[DCOWorker] checking commit: "feat: add localized caching to review pipeline"
[DCOWorker] signoff parsed: <span class="cyan">Signed-off-by: Tarunya &lt;tarunya@example.com&gt;</span>
[DCOWorker] DCO compliance status: <span class="green">PASSED</span>`,

  // Step 6: DiscussionWorker
  `[DiscussionWorker] pulling conversation comments...
[DiscussionWorker] active threads: 2
[DiscussionWorker] thread #1: "Use try-catch block for ALTER TABLE migration" -> <span class="green">RESOLVED</span>
[DiscussionWorker] thread #2: "What is the cache throttle window?" -> <span class="green">RESOLVED</span>
[DiscussionWorker] pending comments check: <span class="green">0 unresolved conversations</span>`,

  // Step 7: RepositoryContextWorker
  `[RepositoryContextWorker] extracting templates...
[RepositoryContextWorker] parsed README.md & CONTRIBUTING.md
[RepositoryContextWorker] payload prepared for local AI provider.
[ReviewPipeline] <span class="green">Pipeline execute successfully!</span> Output: Unified payload ready.`
];

let currentStep = 0;
let pipelineInterval;

function runPipelineDemo(stepIndex) {
  // Update Active step classes
  const cards = document.querySelectorAll('.step-card');
  cards.forEach((card, idx) => {
    if (idx === stepIndex) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  // Update Console Output with simulated typewriting/rendering
  const outputEl = document.getElementById('console-output-text');
  const percentageEl = document.getElementById('pipeline-progress-percentage');
  
  if (outputEl) {
    outputEl.innerHTML = pipelineStepsLogs[stepIndex];
  }
  
  if (percentageEl) {
    const progressPercent = Math.round(((stepIndex + 1) / 7) * 100);
    percentageEl.textContent = `${progressPercent}%`;
  }
}

function startPipelineAutoPlay() {
  pipelineInterval = setInterval(() => {
    currentStep = (currentStep + 1) % 7;
    runPipelineDemo(currentStep);
  }, 4000);
}

// Add event listeners to step cards for manual control
function initStepListeners() {
  const cards = document.querySelectorAll('.step-card');
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      clearInterval(pipelineInterval);
      const stepIdx = parseInt(card.getAttribute('data-step'));
      currentStep = stepIdx;
      runPipelineDemo(stepIdx);
      // Resume autoplay after manual click
      startPipelineAutoPlay();
    });
  });
}

// Accordion Toggle
function toggleAccordion(id) {
  const item = document.getElementById(id);
  if (!item) return;

  const isOpen = item.classList.contains('open');
  
  // Close all accordions first
  document.querySelectorAll('.accordion-item').forEach(acc => {
    acc.classList.remove('open');
  });

  // Open the target one if it wasn't open
  if (!isOpen) {
    item.classList.add('open');
  }
}

// Init everything
window.addEventListener('DOMContentLoaded', () => {
  detectPlatform();
  runPipelineDemo(0);
  startPipelineAutoPlay();
  initStepListeners();
});
