
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MissionState, MissionStatus, StepStatus, LogType, LogEntry, Step, Artifact 
} from './types';
import { MemoryService } from './services/memory';
import { GeminiService } from './services/geminiService';

const initialState: MissionState = {
  id: '',
  goal: '',
  status: MissionStatus.IDLE,
  currentStepIndex: -1,
  steps: [],
  logs: [],
  artifacts: [],
  memory: {
    decisionLog: [],
    learnedContext: ''
  }
};

// UI Components
const Sidebar: React.FC<{ mission: MissionState }> = ({ mission }) => {
  return (
    <div className="w-1/4 h-full border-r border-slate-800 bg-slate-900/50 p-4 flex flex-col overflow-y-auto">
      <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Mission Timeline</h2>
      
      <div className="space-y-4">
        {mission.steps.map((step, idx) => (
          <div key={step.id} className={`p-3 rounded-lg border ${
            step.status === StepStatus.ACTIVE ? 'border-blue-500 bg-blue-500/10' : 
            step.status === StepStatus.COMPLETED ? 'border-emerald-500/30 bg-emerald-500/5' : 
            step.status === StepStatus.FAILED ? 'border-rose-500/30 bg-rose-500/5' :
            'border-slate-800 bg-slate-800/20'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-slate-400">Step {idx + 1}</span>
              {step.status === StepStatus.COMPLETED && <span className="text-emerald-400 text-xs font-medium">✓ Done</span>}
              {step.status === StepStatus.ACTIVE && <span className="text-blue-400 text-xs font-medium animate-pulse">● Active</span>}
              {step.status === StepStatus.FIXING && <span className="text-amber-400 text-xs font-medium animate-pulse">⚠ Fixing</span>}
            </div>
            <h3 className={`text-sm font-semibold ${step.status === StepStatus.ACTIVE ? 'text-blue-200' : 'text-slate-200'}`}>
              {step.title}
            </h3>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{step.description}</p>
          </div>
        ))}

        {mission.steps.length === 0 && (
          <div className="text-center py-10 text-slate-600 italic">
            No active plan.
          </div>
        )}
      </div>

      <div className="mt-auto pt-6">
        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
          <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Memory Metrics</h4>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400">Artifacts</span>
            <span className="text-blue-400 font-mono">{mission.artifacts.length}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Decisions</span>
            <span className="text-blue-400 font-mono">{mission.memory.decisionLog.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Console: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-2/4 h-full flex flex-col border-r border-slate-800">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Agent Console</h2>
        <div className="flex gap-2">
          <div className="h-2 w-2 rounded-full bg-slate-700"></div>
          <div className="h-2 w-2 rounded-full bg-slate-700"></div>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-2 bg-slate-950"
      >
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 border-l-2 border-slate-800/50 pl-3 py-1 hover:bg-slate-900/40 transition-colors">
            <span className="text-slate-600 shrink-0 font-mono">[{log.timestamp.toLocaleTimeString()}]</span>
            <span className={`
              ${log.type === LogType.ERROR ? 'text-rose-400' : ''}
              ${log.type === LogType.SUCCESS ? 'text-emerald-400' : ''}
              ${log.type === LogType.PLAN ? 'text-blue-400 font-bold' : ''}
              ${log.type === LogType.ACTION ? 'text-indigo-300' : ''}
              ${log.type === LogType.SYSTEM ? 'text-slate-500 italic' : ''}
              text-slate-300 leading-relaxed break-words
            `}>
              {log.message}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-slate-600 opacity-50 font-mono">Awaiting instructions...</div>
        )}
      </div>
    </div>
  );
};

const Preview: React.FC<{ artifacts: Artifact[] }> = ({ artifacts }) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const activeArtifact = artifacts[selectedIdx];

  useEffect(() => {
    if (selectedIdx >= artifacts.length && artifacts.length > 0) {
      setSelectedIdx(artifacts.length - 1);
    }
  }, [artifacts.length]);

  const handleCopy = () => {
    if (activeArtifact) {
      navigator.clipboard.writeText(activeArtifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getFormatIcon = (type: string) => {
    switch(type) {
      case 'code': return '⌨️';
      case 'markdown': return '📝';
      case 'json': return '🔢';
      default: return '📄';
    }
  };

  return (
    <div className="w-1/4 h-full bg-slate-900/20 flex flex-col">
      <div className="p-4 border-b border-slate-800 bg-slate-900/30 flex justify-between items-center">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Artifact Registry</h2>
        <span className="text-[10px] text-slate-600 font-mono">COUNT: {artifacts.length}</span>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {artifacts.length > 0 ? (
          <>
            <div className="flex gap-2 p-2 bg-slate-950/80 overflow-x-auto shrink-0 border-b border-slate-800 scrollbar-hide">
              {artifacts.map((art, idx) => (
                <button
                  key={art.id}
                  onClick={() => setSelectedIdx(idx)}
                  className={`px-3 py-2 rounded-md text-[10px] whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                    selectedIdx === idx 
                      ? 'bg-blue-600/90 text-white border-blue-500 shadow-lg shadow-blue-900/30 font-medium' 
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  <span className="opacity-70">{getFormatIcon(art.type)}</span>
                  {art.name}
                </button>
              ))}
            </div>
            
            <div className="flex flex-col flex-1 overflow-hidden bg-slate-950">
               {/* Metadata Header */}
               <div className="px-4 py-2 bg-slate-900/40 border-b border-slate-800 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-300 font-bold truncate max-w-[150px]">{activeArtifact.name}</span>
                    <span className="text-[9px] text-slate-500 font-mono uppercase tracking-tighter">
                      {activeArtifact.type} • {(activeArtifact.content.length / 1024).toFixed(2)} KB
                    </span>
                  </div>
                  <button 
                    onClick={handleCopy}
                    className="p-1.5 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <span className="text-[10px] text-emerald-400 px-1 font-bold italic">Copied!</span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    )}
                  </button>
               </div>

               {/* Content Area */}
               <div className="flex-1 p-0 overflow-hidden relative">
                  <div className="absolute inset-0 overflow-y-auto p-4 custom-scrollbar">
                    <pre className={`font-mono text-[11px] leading-relaxed selection:bg-blue-500/30 whitespace-pre-wrap ${
                      activeArtifact.type === 'code' ? 'text-indigo-200' : 'text-slate-300'
                    }`}>
                      <code>
                        {activeArtifact.content}
                      </code>
                    </pre>
                  </div>
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-700 opacity-50 px-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-xs italic">Awaiting artifact generation...</p>
          </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [mission, setMission] = useState<MissionState>(() => {
    const saved = MemoryService.loadMission();
    return saved || { ...initialState, id: Math.random().toString(36).substring(7) };
  });

  const [inputGoal, setInputGoal] = useState('');
  const missionRef = useRef<MissionState>(mission);
  const isLoopRunning = useRef(false);

  useEffect(() => {
    missionRef.current = mission;
    if (mission.status !== MissionStatus.IDLE) {
      MemoryService.saveMission(mission);
    }
  }, [mission]);

  const addLog = useCallback((message: string, type: LogType = LogType.INFO) => {
    setMission(prev => ({
      ...prev,
      logs: [...prev.logs, {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date(),
        message,
        type
      }]
    }));
  }, []);

  const addArtifact = useCallback((name: string, content: string, type: Artifact['type']) => {
    setMission(prev => ({
      ...prev,
      artifacts: [...prev.artifacts, {
        id: Math.random().toString(36).substring(7),
        name,
        content,
        type,
        timestamp: new Date()
      }]
    }));
  }, []);

  const resetMission = () => {
    MemoryService.clearMission();
    const newEmptyState = { ...initialState, id: Math.random().toString(36).substring(7) };
    missionRef.current = newEmptyState;
    isLoopRunning.current = false;
    setMission(newEmptyState);
    setInputGoal('');
  };

  const executeLoop = async () => {
    if (isLoopRunning.current) return;
    isLoopRunning.current = true;

    if (missionRef.current.status === MissionStatus.PLANNING) {
      addLog(`Initiating planning phase...`, LogType.SYSTEM);
      try {
        const plan = await GeminiService.planMission(missionRef.current.goal);
        
        if ((missionRef.current.status as MissionStatus) === MissionStatus.IDLE) {
          isLoopRunning.current = false;
          return;
        }

        const steps: Step[] = plan.steps.map(s => ({
          id: Math.random().toString(36).substring(7),
          title: s.title,
          description: s.description,
          status: StepStatus.PENDING,
          attempts: 0
        }));
        
        addLog(`Plan generated: ${steps.length} steps identified.`, LogType.PLAN);
        setMission(prev => ({
          ...prev,
          steps,
          status: MissionStatus.EXECUTING,
          currentStepIndex: 0
        }));
      } catch (err: any) {
        addLog(`Fatal Error: ${err.message}`, LogType.ERROR);
        setMission(prev => ({ ...prev, status: MissionStatus.FAILED }));
        isLoopRunning.current = false;
        return;
      }
    }

    while (true) {
      const currentM = missionRef.current;
      
      if ((currentM.status as MissionStatus) === MissionStatus.IDLE) break;
      if (currentM.status === MissionStatus.COMPLETED || currentM.status === MissionStatus.FAILED) break;
      
      if (currentM.currentStepIndex >= currentM.steps.length && currentM.steps.length > 0) {
        addLog("Mission Complete!", LogType.SUCCESS);
        setMission(prev => ({ ...prev, status: MissionStatus.COMPLETED }));
        break;
      }

      const stepIndex = currentM.currentStepIndex;
      if (stepIndex < 0) {
         await new Promise(r => setTimeout(r, 200));
         continue;
      }

      const step = currentM.steps[stepIndex];
      if (!step) break;
      
      addLog(`[Step ${stepIndex + 1}] Executing: ${step.title}`, LogType.ACTION);
      
      setMission(prev => {
        const newSteps = [...prev.steps];
        newSteps[stepIndex] = { ...newSteps[stepIndex], status: StepStatus.ACTIVE };
        return { ...prev, steps: newSteps };
      });

      try {
        const result = await GeminiService.executeStep(step, currentM);
        if ((missionRef.current.status as MissionStatus) === MissionStatus.IDLE) break;

        if (result.artifact) {
          addArtifact(result.artifact.name, result.artifact.content, result.artifact.type);
          addLog(`Artifact registered: ${result.artifact.name}`, LogType.SUCCESS);
        }

        addLog(`[Step ${stepIndex + 1}] Verifying...`, LogType.SYSTEM);
        const verification = await GeminiService.verifyStep(step, result, currentM.goal);
        
        if ((missionRef.current.status as MissionStatus) === MissionStatus.IDLE) break;

        if (verification.passed) {
          addLog(`Success: ${verification.feedback}`, LogType.SUCCESS);
          setMission(prev => {
            const newSteps = [...prev.steps];
            newSteps[stepIndex] = { ...newSteps[stepIndex], status: StepStatus.COMPLETED };
            return { 
              ...prev, 
              steps: newSteps, 
              currentStepIndex: stepIndex + 1,
              memory: {
                ...prev.memory,
                decisionLog: [...prev.memory.decisionLog, `Step ${stepIndex + 1} passed`]
              }
            };
          });
        } else {
          addLog(`Failed: ${verification.feedback}`, LogType.ERROR);
          if (step.attempts >= 2) {
            addLog("Max retries exceeded.", LogType.ERROR);
            setMission(prev => ({ ...prev, status: MissionStatus.FAILED }));
            break;
          }

          addLog(`Fixing errors... (Attempt ${step.attempts + 2})`, LogType.SYSTEM);
          const fixedResult = await GeminiService.fixStep(step, result, verification.feedback);
          
          if ((missionRef.current.status as MissionStatus) === MissionStatus.IDLE) break;

          if (fixedResult.artifact) {
             addArtifact(`Fixed_${fixedResult.artifact.name}`, fixedResult.artifact.content, fixedResult.artifact.type);
          }

          setMission(prev => {
            const newSteps = [...prev.steps];
            newSteps[stepIndex] = { ...newSteps[stepIndex], attempts: step.attempts + 1, status: StepStatus.FIXING };
            return { ...prev, steps: newSteps };
          });
        }
      } catch (err: any) {
        addLog(`Error: ${err.message}`, LogType.ERROR);
        setMission(prev => ({ ...prev, status: MissionStatus.FAILED }));
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    isLoopRunning.current = false;
  };

  const startMission = () => {
    if (!inputGoal.trim()) return;
    setMission({
      ...initialState,
      id: Math.random().toString(36).substring(7),
      goal: inputGoal,
      status: MissionStatus.PLANNING,
    });
    setInputGoal('');
  };

  useEffect(() => {
    const s = mission.status;
    if (s === MissionStatus.PLANNING || s === MissionStatus.EXECUTING) {
       executeLoop();
    }
  }, [mission.status]);

  const demoScenarios = [
    "Learn Git basics and write a cheatsheet",
    "Design a simple CLI Calculator in Python",
    "Create a project README with a technical roadmap"
  ];

  const isMissionActive = (mission.status as MissionStatus) !== MissionStatus.IDLE;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans">
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">A</div>
            <h1 className="font-bold text-lg tracking-tight text-white">AutoLearn <span className="text-blue-500 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Marathon</span></h1>
          </div>
          <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${
            mission.status === MissionStatus.IDLE ? 'bg-slate-800/50 text-slate-500 border-slate-700' :
            mission.status === MissionStatus.COMPLETED ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/30' :
            mission.status === MissionStatus.FAILED ? 'bg-rose-900/20 text-rose-400 border-rose-500/30' :
            'bg-blue-900/20 text-blue-400 border-blue-500/30 animate-pulse'
          }`}>
            {mission.status}
          </div>
        </div>

        <div className="flex-1 max-w-2xl px-8 flex gap-2">
          {!isMissionActive ? (
            <>
              <input 
                type="text" 
                placeholder="Define a long-term goal for the agent..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-slate-100 placeholder:text-slate-600"
                value={inputGoal}
                onChange={(e) => setInputGoal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startMission()}
              />
              <button 
                onClick={startMission}
                disabled={!inputGoal}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
              >
                Launch
              </button>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2">
              <span className="text-sm text-slate-300 font-medium truncate max-w-md flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                Goal: {mission.goal}
              </span>
              <button 
                onClick={resetMission}
                className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-md font-black transition-all shadow-lg shadow-emerald-900/40 uppercase tracking-tighter flex items-center gap-2 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                </svg>
                New Mission
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          {mission.status === MissionStatus.IDLE && (
            <div className="flex gap-2">
              {demoScenarios.map(s => (
                <button 
                  key={s}
                  onClick={() => setInputGoal(s)}
                  className="text-[9px] font-bold uppercase tracking-tight bg-slate-900 hover:bg-slate-800 border border-slate-800 px-2.5 py-1.5 rounded text-slate-500 transition-colors"
                >
                  {s.split(' ').slice(0, 2).join(' ')}...
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <Sidebar mission={mission} />
        <Console logs={mission.logs} />
        <Preview artifacts={mission.artifacts} />
      </main>
      
      {mission.steps.length > 0 && (
        <div className="h-1 bg-slate-900 shrink-0">
          <div 
            className="h-full bg-blue-500 transition-all duration-1000 ease-in-out shadow-[0_0_15px_#3b82f6]"
            style={{ width: `${(Math.max(0, mission.currentStepIndex) / mission.steps.length) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default App;
