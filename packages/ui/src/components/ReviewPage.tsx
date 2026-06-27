import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GitPullRequest, 
  Play, 
  RefreshCw, 
  ExternalLink,
  FolderOpen,
  CheckCircle,
  XCircle,
  HelpCircle,
  Cpu,
  AlertTriangle,
  ArrowLeft,
  MessageSquare,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useCabinStore } from '../store';

export const ReviewPage: React.FC = () => {
  const { prNumber } = useParams<{ prNumber: string }>();
  const navigate = useNavigate();
  
  const { 
    reviews, 
    activeReview, 
    setActiveReviewPR, 
    prepareActiveReview, 
    runAIReview, 
    submitReviewDecision,
    resetActiveReview 
  } = useCabinStore();

  const [activeLeftTab, setActiveLeftTab] = useState<'checks' | 'discussion' | 'context'>('checks');
  const [commentDraft, setCommentDraft] = useState('');
  const [showDecisionModal, setShowDecisionModal] = useState<'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const prNum = parseInt(prNumber || '', 10);

  // Load active PR on mount
  useEffect(() => {
    const pr = reviews.find(r => r.prNumber === prNum);
    if (pr) {
      setActiveReviewPR(pr);
    } else {
      // Fallback if accessed directly (demo)
      const mockPr = {
        id: `mock-repo/${prNum}`,
        prNumber: prNum,
        repositoryId: 'demo/repo',
        repoName: 'repo',
        repoOwner: 'demo',
        title: 'Loading Pull Request details...',
        author: 'developer',
        requestedDate: new Date().toISOString(),
        labels: [],
        ciStatus: 'unknown' as const,
        mergeConflictStatus: 'unknown' as const,
        dcoStatus: 'unknown' as const,
        lastUpdated: new Date().toISOString(),
        aiStatus: 'pending' as const,
        reviewStatus: 'pending' as const,
        branchName: 'feature',
        targetBranch: 'main',
      };
      setActiveReviewPR(mockPr);
    }

    return () => {
      resetActiveReview();
    };
  }, [prNum]);

  const {
    pullRequest,
    discussionSummary,
    repositoryContext,
    workerLogs,
    localPath,
    aiReviewResult,
    pipelineRunning,
    pipelineProgress,
    aiRunning,
    aiLogs
  } = activeReview;

  // Auto-draft comments based on findings
  useEffect(() => {
    if (aiReviewResult) {
      let draft = `### Review Findings Summary\n\n${aiReviewResult.summary}\n\n`;
      if (aiReviewResult.highSeverityFindings.length > 0) {
        draft += `#### 🚨 High Priority:\n`;
        aiReviewResult.highSeverityFindings.forEach((f: any) => {
          draft += `- **${f.file}${f.line ? `:${f.line}` : ''}**: ${f.description}\n`;
          if (f.suggestion) draft += `  _Suggestion_: \`${f.suggestion}\`\n`;
        });
        draft += `\n`;
      }
      if (aiReviewResult.mediumSeverityFindings.length > 0) {
        draft += `#### ⚠️ Medium Priority:\n`;
        aiReviewResult.mediumSeverityFindings.forEach((f: any) => {
          draft += `- **${f.file}${f.line ? `:${f.line}` : ''}**: ${f.description}\n`;
        });
      }
      setCommentDraft(draft);
    }
  }, [aiReviewResult]);

  if (!pullRequest) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
        Loading workspace...
      </div>
    );
  }

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-rose-400 shrink-0" />;
      case 'pending':
        return <RefreshCw className="h-4 w-4 text-amber-400 animate-spin shrink-0" />;
      default:
        return <HelpCircle className="h-4 w-4 text-zinc-600 shrink-0" />;
    }
  };

  const handleDecisionSubmit = async () => {
    if (!showDecisionModal) return;
    setSubmitting(true);
    try {
      await submitReviewDecision(showDecisionModal, commentDraft);
      setShowDecisionModal(null);
    } catch {}
    setSubmitting(false);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Back & Title Header */}
      <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/queue')}
            className="p-1.5 hover:text-zinc-200 text-zinc-500 rounded hover:bg-zinc-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="font-semibold">{pullRequest.repositoryId}</span>
              <span>•</span>
              <span className="font-mono">#{pullRequest.prNumber}</span>
              <span>•</span>
              <span className="bg-zinc-900 px-1.5 py-0.5 rounded text-[10px] text-zinc-400 border border-zinc-800">
                {pullRequest.branchName} ──&gt; {pullRequest.targetBranch}
              </span>
            </div>
            <h1 className="text-base font-semibold text-zinc-200 mt-1">{pullRequest.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => window.electronAPI.openExternal(`https://github.com/${pullRequest.repoOwner}/${pullRequest.repoName}/pull/${pullRequest.prNumber}`)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors text-zinc-300"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>GitHub</span>
          </button>
          
          {localPath && (
            <button 
              onClick={() => window.electronAPI.openLocalFolder(localPath)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors text-zinc-300"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Open Folder</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Review Workspace Layout: Left (Context), Center (Findings/Logs), Right (Actions) */}
      <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden min-h-0">
        
        {/* LEFT COLUMN: Check & Context Panels (4 cols) */}
        <div className="col-span-4 flex flex-col clay-card p-4 min-h-0">
          <div className="flex bg-zinc-900/60 p-1 rounded-xl text-xs font-semibold select-none shadow-inner border border-zinc-800/30 mb-4">
            {(['checks', 'discussion', 'context'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveLeftTab(tab)}
                className={`flex-1 py-2 text-center rounded-lg hover:text-zinc-200 transition-all ${
                  activeLeftTab === tab 
                    ? 'bg-zinc-800/80 text-zinc-100 shadow-sm border border-zinc-700/30' 
                    : 'text-zinc-500'
                }`}
              >
                {tab === 'checks' ? 'CI & Checks' : tab === 'discussion' ? 'Discussions' : 'Repo Context'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {activeLeftTab === 'checks' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">Status Verification</h3>
                <div className="space-y-3 bg-zinc-900/50 border border-zinc-800/40 p-4 rounded-2xl shadow-inner">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400">CI Suite Status</span>
                    <span className="flex items-center gap-1.5 text-zinc-300 uppercase font-semibold">
                      {renderStatusIcon(pullRequest.ciStatus)}
                      {pullRequest.ciStatus}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400">Mergeability (Conflicts)</span>
                    <span className="flex items-center gap-1.5 text-zinc-300 uppercase font-semibold">
                      {renderStatusIcon(pullRequest.mergeConflictStatus)}
                      {pullRequest.mergeConflictStatus === 'passed' ? 'Mergeable' : 'Conflict'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400">DCO Sign-off Status</span>
                    <span className="flex items-center gap-1.5 text-zinc-300 uppercase font-semibold">
                      {renderStatusIcon(pullRequest.dcoStatus)}
                      {pullRequest.dcoStatus}
                    </span>
                  </div>
                </div>

                {(() => {
                  const ciLog = workerLogs.find((l) => l.workerName === 'CIWorker');
                  const ciDetails = ciLog?.output?.details || [];
                  if (ciDetails.length === 0) return null;

                  return (
                    <div className="mt-4 pt-4 border-t border-zinc-900/60 space-y-2 select-none animate-fadeIn">
                      <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider pl-1">CI Check Details</h4>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {ciDetails.map((detail: any, index: number) => {
                          const isFailed = detail.conclusion === 'failure' || detail.conclusion === 'timed_out' || detail.conclusion === 'action_required' || detail.status === 'failure' || detail.status === 'error';
                          const isPending = detail.status === 'in_progress' || detail.status === 'queued' || detail.status === 'pending';
                          
                          return (
                            <div key={index} className="flex items-center justify-between bg-zinc-950/60 border border-zinc-900/40 p-2.5 rounded-xl text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                {isFailed ? (
                                  <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                                ) : isPending ? (
                                  <Clock className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                )}
                                <span className="font-mono text-[11px] text-zinc-300 truncate" title={detail.name}>
                                  {detail.name}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-3 shrink-0">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${
                                  isFailed ? 'bg-rose-950/40 text-rose-400 border border-rose-900/30' :
                                  isPending ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30' :
                                  'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30'
                                }`}>
                                  {detail.conclusion !== 'no conclusion' ? detail.conclusion : detail.status}
                                </span>
                                
                                {detail.url && (
                                  <button 
                                    onClick={() => window.electronAPI.openExternal(detail.url)}
                                    className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                                    title="View Log Details"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {workerLogs.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider pl-1">Executed Pipeline Logs</h4>
                    <div className="space-y-2 font-mono text-[10px] text-zinc-400 bg-zinc-950 p-3.5 border border-zinc-900/60 rounded-xl shadow-inner">
                      {workerLogs.map((log) => (
                        <div key={log.workerName} className="flex justify-between border-b border-zinc-900/40 pb-1 last:border-0 last:pb-0">
                          <span>{log.workerName}</span>
                          <span className={log.status === 'success' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {log.status === 'success' ? `success (${log.durationMs}ms)` : 'failed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeLeftTab === 'discussion' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">Comment Thread Synthesis</h3>
                {discussionSummary ? (
                  <div className="space-y-4 text-xs text-zinc-300">
                    <p className="bg-zinc-900/50 border border-zinc-800/40 p-4 rounded-2xl shadow-inner leading-relaxed">{discussionSummary.summary}</p>
                    
                    {discussionSummary.requestedChanges.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider pl-1">Changes Requested:</span>
                        <ul className="list-disc pl-5 space-y-1.5">
                          {discussionSummary.requestedChanges.map((change, i) => (
                            <li key={i}>{change}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {discussionSummary.questions.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider pl-1">Questions in Threads:</span>
                        <ul className="list-disc pl-5 space-y-1.5">
                          {discussionSummary.questions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic pl-1">Run preparation to summarize discussions.</p>
                )}
              </div>
            )}

            {activeLeftTab === 'context' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">Onboarding Context</h3>
                {repositoryContext ? (
                  <div className="space-y-3 text-xs text-zinc-300">
                    {repositoryContext.repoRules.length > 0 && (
                      <div className="bg-zinc-900/50 border border-zinc-800/40 p-4 rounded-2xl shadow-inner space-y-1.5">
                        <span className="font-bold text-zinc-400">Parsed Rules:</span>
                        <ul className="list-disc pl-5 space-y-1">
                          {repositoryContext.repoRules.map((rule, i) => (
                            <li key={i}>{rule}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {repositoryContext.prTemplate && (
                      <div className="space-y-1.5">
                        <span className="font-bold text-zinc-400 pl-1">PR Template:</span>
                        <pre className="text-[10px] bg-zinc-950 p-3 rounded-xl border border-zinc-900 overflow-x-auto text-zinc-500 font-mono shadow-inner">
                          {repositoryContext.prTemplate}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic pl-1">Run preparation to gather workspace guidelines.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN: AI findings / logs console (5 cols) */}
        <div className="col-span-5 flex flex-col clay-card p-4 min-h-0">
          <div className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800/30 px-4 py-3 rounded-xl mb-4 select-none">
            <span className="text-xs font-bold text-zinc-300">Review Findings Report</span>
            {aiReviewResult && (
              <div className="flex items-center gap-3 text-xs font-mono">
                <span>Confidence: <strong className="text-zinc-200">{aiReviewResult.confidence}%</strong></span>
                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase shadow-inner ${
                  aiReviewResult.overallRisk === 'high' ? 'bg-rose-950/40 text-rose-400 border border-rose-900/30' :
                  aiReviewResult.overallRisk === 'medium' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30'
                }`}>
                  Risk: {aiReviewResult.overallRisk}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* If pipeline is running */}
            {pipelineRunning && pipelineProgress && (
              <div className="h-full flex flex-col justify-center items-center space-y-4">
                <RefreshCw className="h-8 w-8 text-zinc-400 animate-spin" />
                <p className="text-xs font-bold text-zinc-300">{pipelineProgress.stepName}</p>
                <div className="w-48 bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800/60 shadow-inner">
                  <div className="bg-zinc-200 h-full transition-all duration-300" style={{ width: `${pipelineProgress.progress}%` }} />
                </div>
              </div>
            )}

            {/* If AI is running / showing logs */}
            {aiRunning && (
              <div className="flex flex-col h-full space-y-3">
                <div className="flex items-center gap-2 text-xs text-zinc-400 pl-1">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-300" />
                  <span>Streaming Antigravity CLI Logs...</span>
                </div>
                <pre className="flex-1 bg-zinc-950 p-4 border border-zinc-900/80 rounded-2xl text-[11px] font-mono text-zinc-400 overflow-y-auto leading-relaxed select-text whitespace-pre-wrap shadow-inner">
                  {aiLogs}
                </pre>
              </div>
            )}

            {/* If pipeline hasn't run yet */}
            {!localPath && !pipelineRunning && (
              <div className="h-full flex flex-col justify-center items-center space-y-4 max-w-sm mx-auto text-center py-12">
                <AlertTriangle className="h-10 w-10 text-amber-500/80 filter drop-shadow-[0_0_10px_rgba(245,158,11,0.2)]" />
                <p className="text-xs font-bold text-zinc-200">Local workspace not prepared</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Before we can analyze the code, we must fetch the branch and run our diagnostic checks.
                </p>
                <div className="flex flex-col items-center">
                  <button 
                    onClick={prepareActiveReview}
                    className="clay-button-primary flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Prepare Review Workspace</span>
                  </button>
                  <p className="text-[9px] text-zinc-600 mt-2 text-center max-w-[260px] leading-normal">
                    Clones the repository locally (if not cached), fetches latest commits, and checks out the specific PR branch for inspection.
                  </p>
                </div>
              </div>
            )}

            {/* Show AI Review Results */}
            {localPath && !pipelineRunning && !aiRunning && (
              <div className="space-y-6">
                {!aiReviewResult ? (
                  <div className="h-full flex flex-col justify-center items-center py-16 space-y-4 text-center">
                    <Cpu className="h-10 w-10 text-indigo-400/80 filter drop-shadow-[0_0_10px_rgba(129,140,248,0.2)]" />
                    <p className="text-xs font-bold text-zinc-200">AI review pending</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Run the Antigravity CLI to scan files and generate structured findings.
                    </p>
                    <div className="flex flex-col items-center">
                      <button 
                        onClick={runAIReview}
                        className="clay-button-primary flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold"
                      >
                        <Cpu className="h-3.5 w-3.5" />
                        <span>Run Antigravity AI Review</span>
                      </button>
                      <p className="text-[9px] text-zinc-600 mt-2 text-center max-w-[260px] leading-normal">
                        Spawns a local instance of the Antigravity CLI to scan code files for style violations, bugs, and security risks.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Summary */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">Analysis Summary</h4>
                      <p className="text-xs text-zinc-300 bg-zinc-900/50 border border-zinc-800/40 p-4 rounded-2xl leading-relaxed select-text shadow-inner">
                        {aiReviewResult.summary}
                      </p>
                    </div>

                    {/* Findings list */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">Violations & Findings</h4>
                      
                      {aiReviewResult.highSeverityFindings.length === 0 && 
                       aiReviewResult.mediumSeverityFindings.length === 0 && 
                       aiReviewResult.lowSeverityFindings.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic pl-1">No code violations identified.</p>
                       ) : (
                        <div className="space-y-4 select-text">
                          {/* High Findings */}
                          {aiReviewResult.highSeverityFindings.map((f, i) => (
                            <div key={`h-${i}`} className="bg-rose-950/20 border border-rose-900/40 p-4 rounded-2xl shadow-inner space-y-2">
                              <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-rose-400">
                                <span>High Severity</span>
                                <span className="bg-rose-950/50 border border-rose-900/30 px-2 py-0.5 rounded-md font-mono">{f.file}{f.line ? `:${f.line}` : ''}</span>
                              </div>
                              <p className="text-xs text-zinc-200 leading-relaxed">{f.description}</p>
                              {f.codeSnippet && (
                                <pre className="text-[10px] bg-zinc-950 p-3 border border-zinc-900 rounded-xl font-mono text-zinc-400 overflow-x-auto shadow-inner">
                                  {f.codeSnippet}
                                </pre>
                              )}
                            </div>
                          ))}

                          {/* Medium Findings */}
                          {aiReviewResult.mediumSeverityFindings.map((f, i) => (
                            <div key={`m-${i}`} className="bg-amber-950/20 border border-amber-900/40 p-4 rounded-2xl shadow-inner space-y-2">
                              <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-amber-400">
                                <span>Medium Severity</span>
                                <span className="bg-amber-950/50 border border-amber-900/30 px-2 py-0.5 rounded-md font-mono">{f.file}{f.line ? `:${f.line}` : ''}</span>
                              </div>
                              <p className="text-xs text-zinc-200 leading-relaxed">{f.description}</p>
                            </div>
                          ))}

                          {/* Low Findings */}
                          {aiReviewResult.lowSeverityFindings.map((f, i) => (
                            <div key={`l-${i}`} className="bg-zinc-900/50 border border-zinc-800/40 p-4 rounded-2xl shadow-inner space-y-2">
                              <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                                <span>Low Severity</span>
                                <span className="bg-zinc-950/50 border border-zinc-900/30 px-2 py-0.5 rounded-md font-mono">{f.file}{f.line ? `:${f.line}` : ''}</span>
                              </div>
                              <p className="text-xs text-zinc-200 leading-relaxed">{f.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Review Chores & Actions Sidebar (3 cols) */}
        <div className="col-span-3 flex flex-col justify-between clay-card p-5 select-none">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">Maintainer Chores</h3>
            
            {localPath && (
              <div className="space-y-3">
                <div>
                  <button
                    disabled={pullRequest.dcoStatus === 'passed'}
                    onClick={() => {
                      setCommentDraft('Please sign off your commits using standard developer certificate of origin format (DCO).\n\nUse: `git commit -s --amend` to sign your commits.');
                      setShowDecisionModal('COMMENT');
                    }}
                    className="w-full text-left bg-zinc-900/60 border border-zinc-800/40 hover:border-zinc-700/50 p-4 rounded-2xl text-xs transition-all duration-200 shadow-inner disabled:opacity-40"
                  >
                    <div className="font-bold text-zinc-200">Request DCO Signature</div>
                    <p className="text-[10px] text-zinc-500 mt-1.5 leading-normal">
                      Ask the author to sign commits using standard Developer Certificate of Origin (DCO) format (`git commit -s`).
                    </p>
                  </button>
                </div>

                <div>
                  <button
                    disabled={pullRequest.mergeConflictStatus === 'passed'}
                    onClick={() => {
                      setCommentDraft('This branch has merge conflicts. Please rebase onto the latest main branch and push.');
                      setShowDecisionModal('COMMENT');
                    }}
                    className="w-full text-left bg-zinc-900/60 border border-zinc-800/40 hover:border-zinc-700/50 p-4 rounded-2xl text-xs transition-all duration-200 shadow-inner disabled:opacity-40"
                  >
                    <div className="font-bold text-zinc-200">Request Rebase / Conflicts</div>
                    <p className="text-[10px] text-zinc-500 mt-1.5 leading-normal">
                      Notify the developer about branch conflicts and request a clean rebase onto the target branch.
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-zinc-900/60 pt-4 mt-6">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">Review Decision</h3>
            
            <div className="space-y-1">
              <button
                disabled={!localPath || pipelineRunning}
                onClick={() => setShowDecisionModal('APPROVE')}
                className="clay-button-emerald w-full py-2.5 text-xs font-bold disabled:opacity-30"
              >
                Approve PR
              </button>
              <p className="text-[9px] text-zinc-500 px-1 leading-normal">
                Submits an official LGTM review approval. This signals to GitHub that the PR is ready to merge.
              </p>
            </div>
            
            <div className="space-y-1 mt-3">
              <button
                disabled={!localPath || pipelineRunning}
                onClick={() => setShowDecisionModal('REQUEST_CHANGES')}
                className="clay-button-rose w-full py-2.5 text-xs font-bold disabled:opacity-30"
              >
                Request Changes
              </button>
              <p className="text-[9px] text-zinc-500 px-1 leading-normal">
                Blocks the PR from being merged and submits specific modification request feedback.
              </p>
            </div>
            
            <div className="space-y-1 mt-3">
              <button
                disabled={!localPath || pipelineRunning}
                onClick={() => setShowDecisionModal('COMMENT')}
                className="clay-button-secondary w-full py-2.5 text-xs font-bold disabled:opacity-30"
              >
                Submit Comment
              </button>
              <p className="text-[9px] text-zinc-500 px-1 leading-normal">
                Submits general observations/questions without blocking or approving the PR.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* DECISION ACTION DIALOG MODAL */}
      <AnimatePresence>
        {showDecisionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.93, opacity: 0 }}
              className="clay-card w-[550px] p-6 flex flex-col space-y-4"
            >
              <div className="flex justify-between items-center select-none pb-2 border-b border-zinc-900/60">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-indigo-400" />
                  {showDecisionModal === 'APPROVE' ? 'Confirm Approval' :
                   showDecisionModal === 'REQUEST_CHANGES' ? 'Confirm Request Changes' : 'Confirm Comment'}
                </span>
                <button 
                  onClick={() => setShowDecisionModal(null)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-2 flex-1 select-none">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">Comment Draft (Markdown)</label>
                <textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  rows={8}
                  className="clay-input w-full p-4 text-xs font-mono text-zinc-200 focus:outline-none leading-relaxed select-text"
                  placeholder="Draft your comment here..."
                />
              </div>

              <div className="flex items-center gap-3 border-t border-zinc-900/60 pt-3 justify-end select-none">
                <button
                  onClick={() => setShowDecisionModal(null)}
                  className="clay-button-secondary px-4 py-2.5 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  onClick={handleDecisionSubmit}
                  className="clay-button-primary px-5 py-2.5 text-xs font-bold flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Submit to GitHub</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
