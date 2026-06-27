import { z } from 'zod';

// Check & Review Status Enums
export type CheckStatus = 'passed' | 'failed' | 'pending' | 'unknown';
export type ReviewStatus = 'pending' | 'reviewing' | 'ready' | 'error';
export type ApprovalDecision = 'approve' | 'request_changes' | 'comment' | 'pending';

// Settings Schema
export const SettingsSchema = z.object({
  githubToken: z.string().default(''),
  workspacePath: z.string().default(''),
  antigravityPath: z.string().default(''),
  theme: z.enum(['light', 'dark']).default('dark'),
});
export type Settings = z.infer<typeof SettingsSchema>;

// Repository Schema
export const RepositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.string(),
  localPath: z.string(),
  lastSyncedAt: z.string().optional(),
});
export type Repository = z.infer<typeof RepositorySchema>;

// Finding (AI / Lint violation)
export const FindingSchema = z.object({
  file: z.string(),
  line: z.number().optional(),
  codeSnippet: z.string().optional(),
  description: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
  suggestion: z.string().optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

// Review Result Model
export const ReviewResultSchema = z.object({
  summary: z.string(),
  overallRisk: z.enum(['high', 'medium', 'low']),
  confidence: z.number(), // Percentage (0-100)
  highSeverityFindings: z.array(FindingSchema).default([]),
  mediumSeverityFindings: z.array(FindingSchema).default([]),
  lowSeverityFindings: z.array(FindingSchema).default([]),
  filesMentioned: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
  estimatedApprovalRecommendation: z.enum(['approve', 'request_changes', 'comment', 'needs_manual_review']),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

// Discussion Summary Schema
export const DiscussionSummarySchema = z.object({
  summary: z.string(),
  requestedChanges: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
  pendingReplies: z.array(z.string()).default([]),
  resolvedDiscussions: z.number().default(0),
  openConversations: z.number().default(0),
});
export type DiscussionSummary = z.infer<typeof DiscussionSummarySchema>;

// Repository Context Schema
export const RepositoryContextSchema = z.object({
  readme: z.string().optional(),
  contributing: z.string().optional(),
  prTemplate: z.string().optional(),
  issueTemplate: z.string().optional(),
  repoRules: z.array(z.string()).default([]),
});
export type RepositoryContext = z.infer<typeof RepositoryContextSchema>;

// Pull Request Model
export const PullRequestSchema = z.object({
  id: z.string(),
  prNumber: z.number(),
  repositoryId: z.string(),
  repoName: z.string(),
  repoOwner: z.string(),
  title: z.string(),
  author: z.string(),
  authorAvatarUrl: z.string().optional(),
  requestedDate: z.string(),
  labels: z.array(z.string()).default([]),
  ciStatus: z.enum(['passed', 'failed', 'pending', 'unknown']).default('unknown'),
  mergeConflictStatus: z.enum(['passed', 'failed', 'pending', 'unknown']).default('unknown'), // passed = no conflicts
  dcoStatus: z.enum(['passed', 'failed', 'pending', 'unknown']).default('unknown'),
  lastUpdated: z.string(),
  aiStatus: z.enum(['pending', 'reviewing', 'ready', 'error']).default('pending'),
  reviewStatus: z.enum(['approve', 'request_changes', 'comment', 'pending']).default('pending'),
  branchName: z.string(),
  targetBranch: z.string().default('main'),
});
export type PullRequest = z.infer<typeof PullRequestSchema>;

// Worker Execution Logs
export interface WorkerLog {
  workerName: string;
  status: 'success' | 'failed';
  durationMs: number;
  error?: string;
  output?: any;
}

// Review Session Model (Saved in History)
export interface ReviewSession {
  id: string;
  prNumber: number;
  repositoryId: string;
  repoName: string;
  repoOwner: string;
  decision: ApprovalDecision;
  reviewedAt: string;
  aiSummary: string;
  reviewResult: ReviewResult;
  discussionSummary: DiscussionSummary;
  workerLogs: WorkerLog[];
}
