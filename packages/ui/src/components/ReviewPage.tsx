import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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

const renderMarkdown = (text: string) => {
  if (!text) return null;
  
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Restore details and summary tags
  html = html
    .replace(/&lt;details&gt;/g, '<details class="mt-2 bg-zinc-150/40 p-3 rounded-xl border border-zinc-200/50 block">')
    .replace(/&lt;\/details&gt;/g, '</details>')
    .replace(/&lt;summary&gt;/g, '<summary class="font-bold cursor-pointer outline-none text-zinc-800 list-none flex items-center gap-1">')
    .replace(/&lt;\/summary&gt;/g, '</summary>');

  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-zinc-50 border border-zinc-200 p-3 rounded-lg overflow-x-auto font-mono text-[10px] my-2 select-text">$1</pre>');
  html = html.replace(/`([^`]+)`/g, '<code class="bg-zinc-150 px-1 py-0.5 rounded font-mono text-[10px] text-rose-600 select-text">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^###\s+(.+)$/gm, '<h4 class="text-xs font-bold text-zinc-850 mt-3 mb-1 pl-0.5">$1</h4>');
  html = html.replace(/^##\s+(.+)$/gm, '<h3 class="text-sm font-bold text-zinc-900 mt-4 mb-2 pl-0.5">$1</h3>');
  html = html.replace(/^#\s+(.+)$/gm, '<h2 class="text-base font-bold text-zinc-900 mt-5 mb-2 pl-0.5">$1</h2>');
  html = html.replace(/^\s*-\s+(.+)$/gm, '<li class="ml-4 list-disc pl-1">$1</li>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-brandGreen hover:underline">$1</a>');

  const lines = html.split('\n\n').map(p => {
    const trimmed = p.trim();
    if (trimmed.startsWith('<li') || trimmed.startsWith('<pre') || trimmed.startsWith('<h') || trimmed.startsWith('<details') || trimmed.startsWith('</details>')) {
      return p;
    }
    return `<p class="mb-2 leading-relaxed">${p}</p>`;
  }).join('\n');

  return <div className="markdown-content select-text leading-relaxed text-zinc-700 text-xs" dangerouslySetInnerHTML={{ __html: lines }} />;
};

export const ReviewPage: React.FC = () => {
  const { prNumber } = useParams<{ prNumber: string }>();
  const navigate = useNavigate();
  
  const { 
    reviews, 
    activeReview, 
    setActiveReviewPR, 
    fetchAndSetActivePR,
    prepareActiveReview, 
    runAIReview, 
    submitReviewDecision,
    addLabels,
    removeLabel,
    addAssignees,
    removeAssignees,
    resetActiveReview 
  } = useCabinStore();

  const [activeLeftTab, setActiveLeftTab] = useState<'checks' | 'discussion' | 'context'>('checks');
  const [commentDraft, setCommentDraft] = useState('');
  const [showDecisionModal, setShowDecisionModal] = useState<'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [repoLabels, setRepoLabels] = useState<string[]>([]);
  const [repoAssignees, setRepoAssignees] = useState<string[]>([]);

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

  const defaultLabels = [
    'bug', 'enhancement', 'documentation', 'duplicate', 'wontfix', 
    'good first issue', 'help wanted', 'invalid', 'dependencies', 'question'
  ];
  
  const defaultAssignees = [
    pullRequest?.author,
    pullRequest?.repoOwner
  ].filter(Boolean) as string[];

  const allLabels = Array.from(new Set([...repoLabels, ...defaultLabels]));
  const allAssignees = Array.from(new Set([...repoAssignees, ...defaultAssignees]));

  const prNum = parseInt(prNumber || '', 10);

  const [searchParams] = useSearchParams();

  // Load active PR on mount
  useEffect(() => {
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (owner && repo) {
      fetchAndSetActivePR(owner, repo, prNum);
    } else {
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
          description: '',
          assignees: [],
        };
        setActiveReviewPR(mockPr);
      }
    }

    return () => {
      resetActiveReview();
    };
  }, [prNum]);

  useEffect(() => {
    if (pullRequest && pullRequest.repoOwner && pullRequest.repoName && pullRequest.repoOwner !== 'demo') {
      window.electronAPI.getRepoLabels(pullRequest.repoOwner, pullRequest.repoName)
        .then(setRepoLabels)
        .catch(console.error);
      window.electronAPI.getRepoAssignees(pullRequest.repoOwner, pullRequest.repoName)
        .then(setRepoAssignees)
        .catch(console.error);
    }
  }, [pullRequest?.repoOwner, pullRequest?.repoName]);



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
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading workspace...
      </div>
    );
  }

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-rose-600 shrink-0" />;
      case 'pending':
        return <RefreshCw className="h-4 w-4 text-amber-500 animate-spin shrink-0" />;
      default:
        return <HelpCircle className="h-4 w-4 text-zinc-400 shrink-0" />;
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
      <div className="flex justify-between items-center border-b border-appBorder pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/queue')}
            className="p-1.5 hover:text-slate-800 text-slate-500 rounded hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="font-semibold">{pullRequest.repositoryId}</span>
              <span>•</span>
              <span className="font-mono">#{pullRequest.prNumber}</span>
              <span>•</span>
              <span className="bg-white px-1.5 py-0.5 rounded text-[10px] text-zinc-650 border border-appBorder">
                {pullRequest.branchName} ──&gt; {pullRequest.targetBranch}
              </span>
              <span>•</span>
              <div className="flex items-center gap-1 bg-zinc-50 px-2 py-0.5 rounded-lg border border-zinc-200">
                {pullRequest.authorAvatarUrl ? (
                  <img src={pullRequest.authorAvatarUrl} alt="" className="h-4 w-4 rounded-full border border-zinc-200" />
                ) : (
                  <div className="h-4 w-4 rounded-full bg-zinc-200" />
                )}
                <span className="font-bold text-zinc-600">@{pullRequest.author}</span>
              </div>
            </div>
            <h1 className="text-base font-semibold text-zinc-800 mt-1">{pullRequest.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => window.electronAPI.openExternal(`https://github.com/${pullRequest.repoOwner}/${pullRequest.repoName}/pull/${pullRequest.prNumber}`)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold bg-white border border-appBorder hover:bg-zinc-50 transition-colors text-zinc-600 shadow-sm"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>GitHub</span>
          </button>
          
          {localPath && (
            <button 
              onClick={() => window.electronAPI.openLocalFolder(localPath)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold bg-white border border-appBorder hover:bg-zinc-50 transition-colors text-zinc-600 shadow-sm"
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
        <div className="col-span-4 flex flex-col ui-card p-4 min-h-0">
          <div className="flex bg-zinc-100 p-1 rounded-xl text-xs font-semibold select-none border border-zinc-200/50 mb-4">
            {(['checks', 'discussion', 'context'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveLeftTab(tab)}
                className={`flex-1 py-2 text-center rounded-lg hover:text-zinc-900 transition-all ${
                  activeLeftTab === tab 
                    ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/80' 
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
                <div className="space-y-3 bg-zinc-50 border border-zinc-200/50 p-4 rounded-2xl">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">CI Suite Status</span>
                    <span className="flex items-center gap-1.5 text-zinc-700 uppercase font-semibold">
                      {renderStatusIcon(pullRequest.ciStatus)}
                      {pullRequest.ciStatus}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Mergeability (Conflicts)</span>
                    <span className="flex items-center gap-1.5 text-zinc-700 uppercase font-semibold">
                      {renderStatusIcon(pullRequest.mergeConflictStatus)}
                      {pullRequest.mergeConflictStatus === 'passed' ? 'Mergeable' : 'Conflict'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">DCO Sign-off Status</span>
                    <span className="flex items-center gap-1.5 text-zinc-700 uppercase font-semibold">
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
                    <div className="mt-4 pt-4 border-t border-zinc-200 space-y-2 select-none animate-fadeIn">
                      <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider pl-1">CI Check Details</h4>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {ciDetails.map((detail: any, index: number) => {
                          const isFailed = detail.conclusion === 'failure' || detail.conclusion === 'timed_out' || detail.conclusion === 'action_required' || detail.status === 'failure' || detail.status === 'error';
                          const isPending = detail.status === 'in_progress' || detail.status === 'queued' || detail.status === 'pending';
                          
                          return (
                            <div key={index} className="flex items-center justify-between bg-zinc-50 border border-zinc-200/50 p-2.5 rounded-xl text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                {isFailed ? (
                                  <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                                ) : isPending ? (
                                  <Clock className="h-4 w-4 text-amber-500 shrink-0 animate-pulse" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                )}
                                <span className="font-mono text-[11px] text-zinc-700 truncate" title={detail.name}>
                                  {detail.name}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-3 shrink-0">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${
                                  isFailed ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                  isPending ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                  'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                }`}>
                                  {detail.conclusion !== 'no conclusion' ? detail.conclusion : detail.status}
                                </span>
                                
                                {detail.url && (
                                  <button 
                                    onClick={() => window.electronAPI.openExternal(detail.url)}
                                    className="text-zinc-400 hover:text-zinc-700 transition-colors p-1"
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
                    <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider pl-1">Executed Pipeline Logs</h4>
                    <div className="space-y-2 font-mono text-[10px] text-slate-600 bg-slate-50 p-3.5 border border-slate-200 rounded-xl">
                      {workerLogs.map((log) => (
                        <div key={log.workerName} className="flex justify-between border-b border-zinc-150 pb-1 last:border-0 last:pb-0">
                          <span>{log.workerName}</span>
                          <span className={log.status === 'success' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
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
                  <div className="space-y-4 text-xs text-zinc-700 select-text">
                    <div className="bg-zinc-50 border border-zinc-200/50 p-4 rounded-2xl">
                      {renderMarkdown(discussionSummary.summary)}
                    </div>
                    
                    {discussionSummary.requestedChanges.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider pl-1">Changes Requested:</span>
                        <ul className="space-y-3">
                          {discussionSummary.requestedChanges.map((change, i) => (
                            <li key={i} className="bg-zinc-50/50 border border-zinc-200/40 p-3 rounded-xl">
                              {renderMarkdown(change)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {discussionSummary.questions.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider pl-1">Questions in Threads:</span>
                        <ul className="space-y-3">
                          {discussionSummary.questions.map((q, i) => (
                            <li key={i} className="bg-zinc-50/50 border border-zinc-200/40 p-3 rounded-xl">
                              {renderMarkdown(q)}
                            </li>
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
              <div className="space-y-5">
                {/* PR Title & Description Scope */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">PR Scope & Details</h3>
                  <div className="bg-slate-50 border border-slate-200/50 p-5 rounded-2xl space-y-3">
                    <div className="text-xs font-bold text-zinc-800">
                      <span className="text-slate-400 uppercase font-mono tracking-wide">PR Title:</span>
                      <p className="mt-1 text-sm font-bold text-slate-700">{pullRequest.title}</p>
                    </div>
                    <div className="text-xs font-bold text-zinc-800 border-t border-zinc-200/60 pt-3">
                      <span className="text-slate-400 uppercase font-mono tracking-wide">PR Description:</span>
                      {pullRequest.description ? (
                        <div className="mt-2 bg-white p-3.5 border border-zinc-200 rounded-xl max-h-[350px] overflow-y-auto">
                          {renderMarkdown(pullRequest.description)}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-zinc-400 italic font-medium">No description provided for this pull request.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-200/60 pt-4 space-y-3">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">Onboarding Context</h3>
                  {repositoryContext ? (
                    <div className="space-y-3 text-xs text-zinc-700">
                      {repositoryContext.repoRules.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200/50 p-4 rounded-2xl space-y-1.5">
                          <span className="font-bold text-slate-500">Parsed Rules:</span>
                          <ul className="list-disc pl-5 space-y-1">
                            {repositoryContext.repoRules.map((rule, i) => (
                              <li key={i}>{rule}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    {repositoryContext.prTemplate && (
                      <div className="space-y-1.5">
                        <span className="font-bold text-slate-500 pl-1">PR Template:</span>
                        <pre className="text-[10px] bg-zinc-50 p-3 rounded-xl border border-zinc-200 overflow-x-auto text-zinc-500 font-mono">
                           {repositoryContext.prTemplate}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic pl-1">Run preparation to gather workspace guidelines.</p>
                )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN: AI findings / logs console (5 cols) */}
        <div className="col-span-5 flex flex-col ui-card p-4 min-h-0">
          <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200/60 px-4 py-3 rounded-xl mb-4 select-none">
            <span className="text-xs font-bold text-zinc-700">Review Findings Report</span>
            {aiReviewResult && (
              <div className="flex items-center gap-3 text-xs font-mono">
                <span>Confidence: <strong className="text-zinc-800">{aiReviewResult.confidence}%</strong></span>
                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                  aiReviewResult.overallRisk === 'high' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                  aiReviewResult.overallRisk === 'medium' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
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
                <p className="text-xs font-bold text-zinc-700">{pipelineProgress.stepName}</p>
                <div className="w-48 bg-zinc-200 h-2 rounded-full overflow-hidden border border-zinc-300">
                  <div className="bg-zinc-800 h-full transition-all duration-300" style={{ width: `${pipelineProgress.progress}%` }} />
                </div>
              </div>
            )}

            {/* If AI is running / showing logs */}
            {aiRunning && (
              <div className="flex flex-col h-full space-y-3">
                <div className="flex items-center gap-2 text-xs text-zinc-500 pl-1">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                  <span>Streaming Antigravity CLI Logs...</span>
                </div>
                <pre className="flex-1 bg-slate-50 p-4 border border-slate-200 rounded-2xl text-[11px] font-mono text-slate-600 overflow-y-auto leading-relaxed select-text whitespace-pre-wrap">
                  {aiLogs}
                </pre>
              </div>
            )}

            {/* If pipeline hasn't run yet */}
            {!localPath && !pipelineRunning && (
              <div className="h-full flex flex-col justify-center items-center space-y-4 max-w-sm mx-auto text-center py-12">
                <AlertTriangle className="h-10 w-10 text-amber-500" />
                <p className="text-xs font-bold text-zinc-800">Local workspace not prepared</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Before we can analyze the code, we must fetch the branch and run our diagnostic checks.
                </p>
                <div className="flex flex-col items-center">
                  <button 
                    onClick={prepareActiveReview}
                    className="ui-button-primary flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Prepare Review Workspace</span>
                  </button>
                  <p className="text-[9px] text-zinc-400 mt-2 text-center max-w-[260px] leading-normal">
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
                    <Cpu className="h-10 w-10 text-indigo-500" />
                    <p className="text-xs font-bold text-zinc-800">AI review pending</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Run the Antigravity CLI to scan files and generate structured findings.
                    </p>
                    <div className="flex flex-col items-center">
                      <button 
                        onClick={runAIReview}
                        className="ui-button-primary flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold"
                      >
                        <Cpu className="h-3.5 w-3.5" />
                        <span>Run Antigravity AI Review</span>
                      </button>
                      <p className="text-[9px] text-zinc-400 mt-2 text-center max-w-[260px] leading-normal">
                        Spawns a local instance of the Antigravity CLI to scan code files for style violations, bugs, and security risks.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Summary */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">Analysis Summary</h4>
                      <div className="bg-zinc-50 border border-zinc-200/50 p-4 rounded-2xl">
                        {renderMarkdown(aiReviewResult.summary)}
                      </div>
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
                            <div key={`h-${i}`} className="bg-rose-50/50 border border-rose-250 p-4 rounded-2xl space-y-2">
                              <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-rose-700">
                                <span>High Severity</span>
                                <span className="bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md font-mono text-[9px]">{f.file}{f.line ? `:${f.line}` : ''}</span>
                              </div>
                              <div className="text-xs text-zinc-800 leading-relaxed">
                                {renderMarkdown(f.description)}
                              </div>
                              {f.codeSnippet && (
                                <pre className="text-[10px] bg-zinc-50 p-3 border border-zinc-200 rounded-xl font-mono text-zinc-600 overflow-x-auto">
                                  {f.codeSnippet}
                                </pre>
                              )}
                            </div>
                          ))}

                          {/* Medium Findings */}
                          {aiReviewResult.mediumSeverityFindings.map((f, i) => (
                            <div key={`m-${i}`} className="bg-amber-50/50 border border-amber-250 p-4 rounded-2xl space-y-2">
                              <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-amber-700">
                                <span>Medium Severity</span>
                                <span className="bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-mono text-[9px]">{f.file}{f.line ? `:${f.line}` : ''}</span>
                              </div>
                              <div className="text-xs text-zinc-800 leading-relaxed">
                                {renderMarkdown(f.description)}
                              </div>
                            </div>
                          ))}

                          {/* Low Findings */}
                          {aiReviewResult.lowSeverityFindings.map((f, i) => (
                            <div key={`l-${i}`} className="bg-zinc-50 border border-zinc-200/50 p-4 rounded-2xl space-y-2">
                              <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                                <span>Low Severity</span>
                                <span className="bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-md font-mono text-[9px]">{f.file}{f.line ? `:${f.line}` : ''}</span>
                              </div>
                              <div className="text-xs text-zinc-800 leading-relaxed">
                                {renderMarkdown(f.description)}
                              </div>
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
        <div className="col-span-3 flex flex-col justify-between ui-card p-5 select-none">
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
                    className="w-full text-left bg-zinc-50 border border-zinc-200 hover:border-zinc-300 p-4 rounded-2xl text-xs transition-all duration-200 disabled:opacity-40"
                  >
                    <div className="font-bold text-zinc-700">Request DCO Signature</div>
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
                    className="w-full text-left bg-zinc-50 border border-zinc-200 hover:border-zinc-300 p-4 rounded-2xl text-xs transition-all duration-200 disabled:opacity-40"
                  >
                    <div className="font-bold text-zinc-700">Request Rebase / Conflicts</div>
                    <p className="text-[10px] text-zinc-500 mt-1.5 leading-normal">
                      Notify the developer about branch conflicts and request a clean rebase onto the target branch.
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Labels & Assignees Widget */}
          <div className="space-y-4 border-t border-zinc-200 pt-4 mt-5">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">Labels & Assignees</h3>
            
            {/* Labels */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-semibold pl-1">
                <span>LABELS</span>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addLabels([e.target.value]);
                    }
                  }}
                  className="text-[10px] text-brandGreen font-bold bg-transparent outline-none border-none cursor-pointer max-w-[120px]"
                >
                  <option value="" disabled>+ Add Label</option>
                  {allLabels
                    .filter(l => !pullRequest.labels.includes(l))
                    .map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))
                  }
                </select>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                {pullRequest.labels.length === 0 ? (
                  <span className="text-[10px] text-zinc-400 italic pl-1">No labels assigned</span>
                ) : (
                  pullRequest.labels.map(label => (
                    <span 
                      key={label}
                      className="inline-flex items-center gap-1 bg-slate-50 text-slate-650 px-2 py-0.5 rounded-full text-[9px] font-semibold border border-slate-200"
                    >
                      {label}
                      <button 
                        onClick={() => removeLabel(label)}
                        className="text-[10px] text-slate-400 hover:text-slate-600 font-bold ml-0.5"
                        title="Remove label"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Assignees */}
            <div className="space-y-2 mt-3">
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-semibold pl-1">
                <span>ASSIGNEES</span>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addAssignees([e.target.value]);
                    }
                  }}
                  className="text-[10px] text-brandGreen font-bold bg-transparent outline-none border-none cursor-pointer max-w-[120px]"
                >
                  <option value="" disabled>+ Assign User</option>
                  {pullRequest.author && !pullRequest.assignees?.includes(pullRequest.author) && (
                    <option value={pullRequest.author}>PR Author (@{pullRequest.author})</option>
                  )}
                  {allAssignees
                    .filter(a => a !== pullRequest.author && !pullRequest.assignees?.includes(a))
                    .map(a => (
                      <option key={a} value={a}>@{a}</option>
                    ))
                  }
                </select>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                {(!pullRequest.assignees || pullRequest.assignees.length === 0) ? (
                  <span className="text-[10px] text-zinc-400 italic pl-1">No assignees</span>
                ) : (
                  pullRequest.assignees.map(user => (
                    <span 
                      key={user}
                      className="inline-flex items-center gap-1 bg-brandGreenLight text-brandGreen px-2.5 py-0.5 rounded-full text-[9px] font-bold border border-emerald-100"
                    >
                      @{user}
                      <button 
                        onClick={() => removeAssignees([user])}
                        className="text-[10px] text-brandGreen hover:text-brandGreenHover font-bold ml-0.5"
                        title="Remove assignee"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t border-zinc-200 pt-4 mt-5">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">Review Decision</h3>
            
            <div className="space-y-1">
              <button
                disabled={!localPath || pipelineRunning}
                onClick={() => setShowDecisionModal('APPROVE')}
                className="ui-button-emerald w-full py-2.5 text-xs font-bold disabled:opacity-30"
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
                className="ui-button-rose w-full py-2.5 text-xs font-bold disabled:opacity-30"
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
                className="ui-button-secondary w-full py-2.5 text-xs font-bold disabled:opacity-30"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.93, opacity: 0 }}
              className="ui-card w-[550px] p-6 flex flex-col space-y-4"
            >
              <div className="flex justify-between items-center select-none pb-2 border-b border-zinc-200">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-indigo-500" />
                  {showDecisionModal === 'APPROVE' ? 'Confirm Approval' :
                   showDecisionModal === 'REQUEST_CHANGES' ? 'Confirm Request Changes' : 'Confirm Comment'}
                </span>
                <button 
                  onClick={() => setShowDecisionModal(null)}
                  className="text-slate-400 hover:text-slate-700 text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-2 flex-1 select-none">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-1">Comment Draft (Markdown)</label>
                <textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  rows={8}
                  className="ui-input w-full p-4 text-xs font-mono text-zinc-700 focus:outline-none leading-relaxed select-text"
                  placeholder="Draft your comment here..."
                />
              </div>

              <div className="flex items-center gap-3 border-t border-zinc-200 pt-3 justify-end select-none">
                <button
                  onClick={() => setShowDecisionModal(null)}
                  className="ui-button-secondary px-4 py-2.5 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  onClick={handleDecisionSubmit}
                  className="ui-button-primary px-5 py-2.5 text-xs font-bold flex items-center gap-1.5"
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
