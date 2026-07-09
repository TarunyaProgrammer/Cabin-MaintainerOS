// Platform detection
function detectPlatform() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const platformInfo = document.getElementById('platform-info-text');
  const downloadText = document.getElementById('download-text');
  const heroDownloadBtn = document.getElementById('hero-download-btn');
  const navDownloadBtn = document.getElementById('nav-download-btn');

  let os = 'Unknown OS';
  let downloadUrl = 'https://github.com/TarunyaProgrammer/Cabin-MaintainerOS/releases';
  let badgeText = 'View Latest Release';

  if (userAgent.indexOf('mac') !== -1) {
    os = 'macOS';
    badgeText = 'Download for macOS';
  } else if (userAgent.indexOf('win') !== -1) {
    os = 'Windows';
    badgeText = 'Download for Windows';
  } else if (userAgent.indexOf('linux') !== -1) {
    os = 'Linux';
    badgeText = 'Download for Linux';
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

// ----------------------------------------------------
// THREE.JS: Interactive 3D Commits/Network Particle Background
// ----------------------------------------------------
let scene, camera, renderer, particleSystem, linesObject;
const particlesCount = 75;
const particlesData = [];
let positions, colors;
let pointCloud, geom;
const maxDistance = 90;
let mouseX = 0, mouseY = 0;

function initThreeBackground() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xf8fafc, 0.0015);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 4000);
  camera.position.z = 1000;

  // Renderer settings
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const container = new THREE.Group();
  scene.add(container);

  // Particles Setup
  const segments = particlesCount;
  geom = new THREE.BufferGeometry();
  positions = new Float32Array(segments * 3);
  colors = new Float32Array(segments * 3);

  const r = 400;

  for (let i = 0; i < segments; i++) {
    const x = Math.random() * r - r / 2;
    const y = Math.random() * r - r / 2;
    const z = Math.random() * r - r / 2;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Movement velocity speeds
    particlesData.push({
      velocity: new THREE.Vector3(-1 + Math.random() * 2, -1 + Math.random() * 2, -1 + Math.random() * 2),
      numConnections: 0
    });
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));

  // Custom soft circular point canvas texture for cleaner points
  const pMaterial = new THREE.PointsMaterial({
    color: 0x10b981,
    size: 5,
    blending: THREE.NormalBlending,
    transparent: true,
    opacity: 0.8
  });

  pointCloud = new THREE.Points(geom, pMaterial);
  container.add(pointCloud);

  // Lines setup connecting particle nodes
  const lineGeom = new THREE.BufferGeometry();
  const linePositions = new Float32Array(segments * segments * 3);
  const lineColors = new Float32Array(segments * segments * 3);

  lineGeom.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
  lineGeom.setAttribute('color', new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage));

  const lineMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.15
  });

  linesObject = new THREE.LineSegments(lineGeom, lineMaterial);
  container.add(linesObject);

  // Interaction tracking
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) * 0.4;
    mouseY = (e.clientY - window.innerHeight / 2) * 0.4;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Animation Loop
  function animate() {
    requestAnimationFrame(animate);

    // Camera mouse follow ease
    camera.position.x += (mouseX - camera.position.x) * 0.05;
    camera.position.y += (-mouseY - camera.position.y) * 0.05;
    camera.lookAt(scene.position);

    let vertexpos = 0;
    let colorpos = 0;
    let numConnected = 0;

    for (let i = 0; i < segments; i++) {
      particlesData[i].numConnections = 0;
    }

    const posAttr = geom.getAttribute('position');
    const pArray = posAttr.array;

    for (let i = 0; i < segments; i++) {
      // Apply velocity drift
      pArray[i * 3] += particlesData[i].velocity.x * 0.4;
      pArray[i * 3 + 1] += particlesData[i].velocity.y * 0.4;
      pArray[i * 3 + 2] += particlesData[i].velocity.z * 0.4;

      // Bounce boundaries
      const limit = r / 2;
      if (pArray[i * 3] < -limit || pArray[i * 3] > limit) particlesData[i].velocity.x *= -1;
      if (pArray[i * 3 + 1] < -limit || pArray[i * 3 + 1] > limit) particlesData[i].velocity.y *= -1;
      if (pArray[i * 3 + 2] < -limit || pArray[i * 3 + 2] > limit) particlesData[i].velocity.z *= -1;

      // Distance checking to draw links
      for (let j = i + 1; j < segments; j++) {
        const dx = pArray[i * 3] - pArray[j * 3];
        const dy = pArray[i * 3 + 1] - pArray[j * 3 + 1];
        const dz = pArray[i * 3 + 2] - pArray[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < maxDistance) {
          particlesData[i].numConnections++;
          particlesData[j].numConnections++;

          const alpha = 1.0 - dist / maxDistance;

          const lPos = linesObject.geometry.getAttribute('position').array;
          const lCol = linesObject.geometry.getAttribute('color').array;

          lPos[vertexpos++] = pArray[i * 3];
          lPos[vertexpos++] = pArray[i * 3 + 1];
          lPos[vertexpos++] = pArray[i * 3 + 2];

          lPos[vertexpos++] = pArray[j * 3];
          lPos[vertexpos++] = pArray[j * 3 + 1];
          lPos[vertexpos++] = pArray[j * 3 + 2];

          // Faint soft line colors matching theme
          lCol[colorpos++] = 0.1;
          lCol[colorpos++] = 0.72 * alpha;
          lCol[colorpos++] = 0.5 * alpha;

          lCol[colorpos++] = 0.1;
          lCol[colorpos++] = 0.72 * alpha;
          lCol[colorpos++] = 0.5 * alpha;

          numConnected++;
        }
      }
    }

    posAttr.needsUpdate = true;
    linesObject.geometry.getAttribute('position').needsUpdate = true;
    linesObject.geometry.getAttribute('color').needsUpdate = true;

    linesObject.geometry.setDrawRange(0, numConnected * 2);

    container.rotation.y += 0.001;
    renderer.render(scene, camera);
  }

  animate();
}

// ----------------------------------------------------
// GSAP SCROLLTRIGGER: Smooth entrance animations
// ----------------------------------------------------
function initScrollAnimations() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  
  gsap.registerPlugin(ScrollTrigger);

  // Reveal animations for cards, headers, and hero segments
  document.querySelectorAll('.gsap-reveal').forEach((el) => {
    gsap.fromTo(el, 
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none'
        }
      }
    );
  });
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

  // Update Console Output
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
  initThreeBackground();
  initScrollAnimations();
  runPipelineDemo(0);
  startPipelineAutoPlay();
  initStepListeners();
});
