import { spawn } from 'child_process';
import { ReviewResult, Finding } from '@cabin/shared';

export interface AIProvider {
  review(repoPath: string, prNumber: number, token: string, executablePath: string, onLog: (data: string) => void): Promise<ReviewResult>;
}

export class AntigravityProvider implements AIProvider {
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
      onLog(`[Cabin AI] Spawning Antigravity CLI from ${executablePath} on PR #${prNumber}...\n`);

      const cmd = executablePath;
      const args = ['review', '--pr', prNumber.toString()];
      
      const child = spawn(cmd, args, {
        cwd: repoPath,
        shell: true,
        env: {
          ...process.env,
          GITHUB_TOKEN: token,
        },
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
    await new Promise(r => setTimeout(r, 800));
    onLog('[Cabin Simulation] Fetching PR diff from GitHub...\n');
    await new Promise(r => setTimeout(r, 600));
    onLog('[Cabin Simulation] Scanning 4 files: src/auth.ts, src/components/Login.tsx, package.json\n');
    await new Promise(r => setTimeout(r, 1000));
    onLog('[Cabin Simulation] Found potential duplicate hook in src/components/Login.tsx:42\n');
    await new Promise(r => setTimeout(r, 600));
    onLog('[Cabin Simulation] Building review report...\n');
    await new Promise(r => setTimeout(r, 400));
    onLog('[Cabin Simulation] Completed successfully.\n');

    return {
      summary: 'Adds a custom authorization hook and cleans up unused imports in the Login flow. The changes are largely safe, but we identified a duplicate helper in Login.tsx that should be extracted.',
      overallRisk: 'medium',
      confidence: 92,
      highSeverityFindings: [],
      mediumSeverityFindings: [
        {
          file: 'src/components/Login.tsx',
          line: 42,
          codeSnippet: 'const useAuthStatus = () => { ... }',
          description: 'Duplicate hook detected. A identical useAuthStatus hook is already defined in hooks/useAuth.ts. Import that instead to avoid redundancy.',
          severity: 'medium',
          suggestion: "import { useAuthStatus } from '../hooks/useAuth';",
        },
      ],
      lowSeverityFindings: [
        {
          file: 'src/auth.ts',
          line: 5,
          codeSnippet: "import { getApp } from 'firebase/app';",
          description: 'Unused import statement. Clean up imports to maintain code clarity.',
          severity: 'low',
          suggestion: 'Remove line 5.',
        },
      ],
      filesMentioned: ['src/components/Login.tsx', 'src/auth.ts'],
      suggestions: [
        'Reuse the custom hook in hooks/useAuth.ts.',
        'Delete unused imports.',
      ],
      estimatedApprovalRecommendation: 'approve',
    };
  }
}
