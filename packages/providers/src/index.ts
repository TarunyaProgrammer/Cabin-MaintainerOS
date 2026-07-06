import { spawn } from 'child_process';
import { ReviewResult, Finding } from '@cabin/shared';

export interface AIProvider {
  review(repoPath: string, prNumber: number, token: string, executablePath: string, onLog: (data: string) => void): Promise<ReviewResult>;
  chat(repoPath: string, prNumber: number, token: string, executablePath: string, question: string, context: string, onLog: (data: string) => void): Promise<string>;
}

export class AntigravityProvider implements AIProvider {
  async chat(
    repoPath: string,
    prNumber: number,
    token: string,
    executablePath: string,
    question: string,
    context: string,
    onLog: (data: string) => void
  ): Promise<string> {
    if (!executablePath || executablePath.toLowerCase() === 'mock' || executablePath.toLowerCase() === 'demo') {
      onLog(`[Cabin Chat Simulation] Thinking...\n`);
      await new Promise(r => setTimeout(r, 800));
      onLog(`[Cabin Chat Simulation] Generating response...\n`);
      await new Promise(r => setTimeout(r, 600));
      const simulatedResponse = `This is a simulated response to your question: "${question}" about PR #${prNumber}.\n\nBased on the PR context (findings and diff), the code looks fine, but make sure to check for accessibility and security standard patterns.`;
      onLog(simulatedResponse);
      return simulatedResponse;
    }

    return new Promise((resolve, reject) => {
      onLog(`[Cabin Chat] Preparing chat prompt...\n`);
      const prompt = `You are Antigravity, an AI assistant. Answer the user's question about Pull Request #${prNumber}.
Here is the PR Context (Diff/Findings/Summary):
${context}

User Question: ${question}`;

      const cmd = executablePath;
      const args = ['--print', prompt, '--dangerously-skip-permissions'];
      
      const cleanEnv: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) {
        if (k !== 'ANTIGRAVITY_LS_ADDRESS' && k !== 'ANTIGRAVITY_CSRF_TOKEN' && v !== undefined) {
          cleanEnv[k] = v;
        }
      }
      cleanEnv['GITHUB_TOKEN'] = token;

      const child = spawn(cmd, args, {
        cwd: repoPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: cleanEnv,
      });

      let stdoutData = '';
      let stderrData = '';

      child.stdout.on('data', (data: any) => {
        const chunk = data.toString();
        stdoutData += chunk;
        onLog(chunk);
      });

      child.stderr.on('data', (data: any) => {
        const chunk = data.toString();
        stderrData += chunk;
        onLog(`[CLI Error] ${chunk}`);
      });

      child.on('close', (code: any) => {
        if (code !== 0) {
          onLog(`[Cabin Chat] Process exited with code ${code}\n`);
          reject(new Error(`Antigravity chat failed with code ${code}. Error: ${stderrData}`));
          return;
        }
        resolve(stdoutData);
      });

      child.on('error', (err: any) => {
        onLog(`[Cabin Chat] Failed to start process: ${err.message}\n`);
        reject(err);
      });
    });
  }

  async review(
    repoPath: string,
    prNumber: number,
    token: string,
    executablePath: string,
    onLog: (data: string) => void
  ): Promise<ReviewResult> {
    // If no path is specified or CLI doesn't exist, run in demo simulation mode
    if (!executablePath || executablePath.toLowerCase() === 'mock' || executablePath.toLowerCase() === 'demo') {
      return this.runSimulation(onLog);
    }

    return new Promise((resolve, reject) => {
      onLog(`[Cabin AI] Fetching git diff for PR #${prNumber}...\n`);
      
      let diff = '';
      try {
        const { execSync } = require('child_process');
        diff = execSync('git diff origin/main...HEAD', { cwd: repoPath, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      } catch {
        try {
          const { execSync } = require('child_process');
          diff = execSync('git diff origin/master...HEAD', { cwd: repoPath, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        } catch {
          try {
            const { execSync } = require('child_process');
            diff = execSync('git diff HEAD~1', { cwd: repoPath, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
          } catch (e: any) {
            diff = 'Could not retrieve git diff automatically.';
          }
        }
      }

      onLog(`[Cabin AI] Spawning Antigravity CLI from ${executablePath} in print mode on PR #${prNumber}...\n`);

      const prompt = `Review the following git diff. Identify any bugs, security warnings, performance issues, accessibility problems, or code quality style violations. You MUST return your output strictly in JSON format matching this schema:
{
  "summary": "High-level summary of the findings",
  "overallRisk": "high" | "medium" | "low",
  "confidence": 95,
  "highSeverityFindings": [{"file": "path/to/file.ts", "line": 12, "description": "...", "severity": "high", "suggestion": "..."}],
  "mediumSeverityFindings": [{"file": "path/to/file.ts", "line": 12, "description": "...", "severity": "medium", "suggestion": "..."}],
  "lowSeverityFindings": [{"file": "path/to/file.ts", "line": 12, "description": "...", "severity": "low", "suggestion": "..."}],
  "filesMentioned": ["file1.ts", "file2.ts"],
  "suggestions": ["suggestion1", "suggestion2"],
  "estimatedApprovalRecommendation": "approve" | "request_changes"
}

Here is the git diff:
${diff}`;

      const cmd = executablePath;
      const args = ['--print', prompt, '--dangerously-skip-permissions'];
      
      // Clean environment: omit language server hooks that cause agy to lock
      const cleanEnv: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) {
        if (k !== 'ANTIGRAVITY_LS_ADDRESS' && k !== 'ANTIGRAVITY_CSRF_TOKEN' && v !== undefined) {
          cleanEnv[k] = v;
        }
      }
      cleanEnv['GITHUB_TOKEN'] = token;

      const child = spawn(cmd, args, {
        cwd: repoPath,
        stdio: ['ignore', 'pipe', 'pipe'], // Ignore stdin to prevent TTY block
        env: cleanEnv,
      });

      let stdoutData = '';
      let stderrData = '';

      child.stdout.on('data', (data: any) => {
        const chunk = data.toString();
        stdoutData += chunk;
        onLog(chunk);
      });

      child.stderr.on('data', (data: any) => {
        const chunk = data.toString();
        stderrData += chunk;
        onLog(`[CLI Error] ${chunk}`);
      });

      child.on('close', (code: any) => {
        if (code !== 0) {
          onLog(`[Cabin AI] Process exited with code ${code}\n`);
          reject(new Error(`Antigravity review failed with code ${code}. Error: ${stderrData}`));
          return;
        }

        onLog(`\n[Cabin AI] Process completed. Parsing results...\n`);
        try {
          const result = this.parseOutput(stdoutData);
          resolve(result);
        } catch (err: any) {
          reject(new Error(`Failed to parse Antigravity output: ${err.message}. Raw output: ${stdoutData}`));
        }
      });

      child.on('error', (err: any) => {
        onLog(`[Cabin AI] Failed to start process: ${err.message}\n`);
        reject(err);
      });
    });
  }

  private parseOutput(stdout: string): ReviewResult {
    // Try to find JSON inside the stdout (if wrapped in other text logs)
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        // Validate / map the properties to match ReviewResult
        return {
          summary: parsed.summary || 'AI Review completed successfully.',
          overallRisk: (parsed.overallRisk || parsed.risk || 'low').toLowerCase() as 'high' | 'medium' | 'low',
          confidence: Number(parsed.confidence) || 85,
          highSeverityFindings: Array.isArray(parsed.highSeverityFindings) ? parsed.highSeverityFindings : [],
          mediumSeverityFindings: Array.isArray(parsed.mediumSeverityFindings) ? parsed.mediumSeverityFindings : [],
          lowSeverityFindings: Array.isArray(parsed.lowSeverityFindings) ? parsed.lowSeverityFindings : [],
          filesMentioned: Array.isArray(parsed.filesMentioned) ? parsed.filesMentioned : [],
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
          estimatedApprovalRecommendation: parsed.estimatedApprovalRecommendation || 'needs_manual_review',
        };
      } catch {}
    }

    // Fallback: Parse markdown or text output
    return this.parseTextFallback(stdout);
  }

  private parseTextFallback(text: string): ReviewResult {
    const lines = text.split('\n');
    const summaryLines: string[] = [];
    const high: Finding[] = [];
    const medium: Finding[] = [];
    const low: Finding[] = [];
    const files = new Set<string>();
    const suggestions: string[] = [];

    let currentSection = 'summary';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.toLowerCase().includes('high severity') || trimmed.startsWith('## High')) {
        currentSection = 'high';
        continue;
      } else if (trimmed.toLowerCase().includes('medium severity') || trimmed.startsWith('## Medium')) {
        currentSection = 'medium';
        continue;
      } else if (trimmed.toLowerCase().includes('low severity') || trimmed.startsWith('## Low')) {
        currentSection = 'low';
        continue;
      } else if (trimmed.toLowerCase().includes('suggestions') || trimmed.startsWith('## Suggestions')) {
        currentSection = 'suggestions';
        continue;
      }

      if (currentSection === 'summary') {
        summaryLines.push(trimmed);
      } else if (currentSection === 'high' || currentSection === 'medium' || currentSection === 'low') {
        // Try parsing finding pattern like "- [file.ts:12] description"
        const match = trimmed.match(/^-\s*\[?([^:]+)(?::(\d+))?\]?\s*(.*)$/);
        if (match) {
          const file = match[1].trim();
          const lineNum = match[2] ? parseInt(match[2], 10) : undefined;
          const desc = match[3].trim();
          files.add(file);

          const finding: Finding = {
            file,
            line: lineNum,
            description: desc,
            severity: currentSection as 'high' | 'medium' | 'low',
          };

          if (currentSection === 'high') high.push(finding);
          else if (currentSection === 'medium') medium.push(finding);
          else low.push(finding);
        } else if (trimmed.startsWith('-')) {
          const finding: Finding = {
            file: 'unknown',
            description: trimmed.substring(1).trim(),
            severity: currentSection as 'high' | 'medium' | 'low',
          };
          if (currentSection === 'high') high.push(finding);
          else if (currentSection === 'medium') medium.push(finding);
          else low.push(finding);
        }
      } else if (currentSection === 'suggestions') {
        if (trimmed.startsWith('-')) {
          suggestions.push(trimmed.substring(1).trim());
        } else {
          suggestions.push(trimmed);
        }
      }
    }

    return {
      summary: summaryLines.join(' ') || 'AI Review completed. No structured JSON detected in stdout.',
      overallRisk: high.length > 0 ? 'high' : medium.length > 0 ? 'medium' : 'low',
      confidence: 90 - high.length * 5,
      highSeverityFindings: high,
      mediumSeverityFindings: medium,
      lowSeverityFindings: low,
      filesMentioned: Array.from(files),
      suggestions: suggestions,
      estimatedApprovalRecommendation: high.length > 0 ? 'request_changes' : 'approve',
    };
  }

  private async runSimulation(onLog: (data: string) => void): Promise<ReviewResult> {
    onLog('[Cabin Simulation] Connecting to Antigravity CLI mock channel...\n');
    await new Promise(r => setTimeout(r, 600));
    onLog('[Cabin Simulation] Fetching PR diff and files from GitHub...\n');
    await new Promise(r => setTimeout(r, 500));
    onLog('[Cabin Simulation] Executing metrics evaluation suite across 8 core areas:\n');
    
    const areas = [
      'Functionality (does it work correctly?)',
      'Code Quality (is code readable & maintainable?)',
      'Repository Consistency (matches existing architecture)',
      'Dependencies (no unnecessary additions)',
      'Performance (no regressions)',
      'Accessibility (UI remains accessible)',
      'Responsiveness (mobile compatibility)',
      'Security (no obvious vulnerabilities)'
    ];

    for (const area of areas) {
      onLog(`[Cabin Simulation] Evaluating: ${area} ... OK\n`);
      await new Promise(r => setTimeout(r, 300));
    }

    onLog('[Cabin Simulation] Building review report...\n');
    await new Promise(r => setTimeout(r, 400));
    onLog('[Cabin Simulation] Review pipeline completed.\n');

    return {
      summary: 'Cabin analyzed the repository against the 8 review metrics. The overall code structure is solid and aligns with existing conventions. We found a few minor points regarding performance optimizations and accessibility guidelines that can be improved.',
      overallRisk: 'low',
      confidence: 96,
      highSeverityFindings: [],
      mediumSeverityFindings: [
        {
          file: 'src/components/ReviewPage.tsx',
          line: 145,
          codeSnippet: '<button onClick={() => navigate("/queue")}>',
          description: '[Accessibility] Interactive button element is missing a descriptive aria-label or accessible text helper.',
          severity: 'medium',
          suggestion: 'Add aria-label="Back to queue" to the button element.',
        },
      ],
      lowSeverityFindings: [
        {
          file: 'packages/ui/tailwind.config.js',
          line: 14,
          codeSnippet: "brandGreen: '#0f766e'",
          description: '[Repository Consistency] Color palette utilizes slate gray and forest green. Ensure consistency with standard theme documentation.',
          severity: 'low',
          suggestion: 'Double check with global design tokens.',
        },
      ],
      filesMentioned: ['src/components/ReviewPage.tsx', 'packages/ui/tailwind.config.js'],
      suggestions: [
        'Add accessible labels to back navigation buttons.',
        'Validate responsiveness on mobile breakpoints for the new sidebar controls.',
      ],
      estimatedApprovalRecommendation: 'approve',
    };
  }
}
