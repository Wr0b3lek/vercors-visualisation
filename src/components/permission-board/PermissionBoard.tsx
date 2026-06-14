// Author: Szymon Wróbel
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  type EngineState,
  type ColId,
  type FlowMessage,
  type RaceState,
  type RowId,
  type ScenarioId,
  type StepDef,
  type Tid,
  COL_IDS,
  COLUMNS,
  EXPECTED_FINAL_BALANCES,
  FULL,
  HALF,
  ROWS,
  ROW_COLOR,
  SCENARIOS,
  SEQ_LANES,
  SEQ_LAYOUT,
  THREAD_IDS,
  applyMove,
  buildPendingMessage,
  clearFlowMessages as engineClearFlow,
  escHtml,
  getCurrentStep,
  getRows,
  getThreads,
  goBack as engineGoBack,
  gu,
  handleCellClick as engineCellClick,
  handleTokenClick as engineTokenClick,
  handleTokenDragStart as engineTokenDragStart,
  isBlocked,
  isComplete,
  isTokenInTray,
  allTokensPlaced,
  laneCenterX,
  lockStatus,
  makePieTokenSVG,
  mkRaceState,
  mkState,
  placeInitialToken as enginePlaceInitial,
  placeHalfToken as enginePlaceHalf,
  pickUpInitialToken as enginePickUpInitial,
  moveHalfFromCell as engineMoveHalfFromCell,
  halvesInTray,
  placementRationale,
  raceAllDone,
  raceOutcomeSummary,
  resetAll as engineReset,
  resetPlacement as engineResetPlacement,
  revealHint as engineHint,
  selectThread as engineSelectThread,
  setupTokenAt,
  setupUnitsAt,
  startRun as engineStartRun,
  stepAnnotation,
  stepRandomRaceThread,
  verifyStep as engineVerify,
} from "./engine";

const C: Record<string, string> = {
  bg: "#fff",
  surface: "#fff",
  paper: "#fff",
  ink: "#000",
  border: "#000",
  borderStrong: "#000",
  tx: "#000",
  txs: "#222",
  txm: "#666",

  t0: "#000", t0l: "#fff", t0b: "#000",
  t1: "#000", t1l: "#fff", t1b: "#000",
  t2: "#000", t2l: "#fff", t2b: "#000",
  t3: "#000", t3l: "#fff", t3b: "#000",
  lock: "#000", lockL: "#fff", lockB: "#000",
  codeBg: "#fff",
  codeHeaderBg: "#fff",
  codeBorder: "#000",
};

const THREAD_STRIPE: Record<Tid, string> = {
  T1: "#0d9488",
  T2: "#d97706",
  T3: "#4f46e5",
  T4: "#dc2626",
};

type ActionKind = "primary" | "secondary" | "destructive";
function actionButton(kind: ActionKind, disabled = false): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "6px 12px", fontSize: 12, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    fontFamily: "inherit",
    transition: "background 0.12s, box-shadow 0.12s",
  };
  if (kind === "primary") {
    return { ...base,
      border: "2px solid #1a1a1a", background: "#ffd966", color: "#1a1a1a",
      boxShadow: disabled ? "none" : "2px 2px 0 #1a1a1a",
    };
  }
  if (kind === "destructive") {
    return { ...base,
      border: "2px dashed #b91c1c", background: "#fff", color: "#b91c1c",
      boxShadow: "none",
    };
  }
  return { ...base,
    border: "2px solid #1a1a1a", background: "#fff", color: "#1a1a1a",
    boxShadow: "none",
  };
}

const TOKEN_LABEL_DISPLAY: Record<string, string> = { M1: "Pa", M2: "Pb", M3: "Pc" };

function handleKeyboardActivate(event: React.KeyboardEvent, action: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
}

type HintCategoryId = "vercors" | "placement" | "visual";
interface HintCategory { id: HintCategoryId; enabled: boolean }
type HintSettings = HintCategory[];

const HINT_CATEGORY_LABELS: Record<HintCategoryId, string> = {
  vercors: "VerCors annotation",
  placement: "Why this matters",
  visual: "Visual hint",
};

const DEFAULT_HINT_SETTINGS: HintSettings = [
  { id: "vercors", enabled: true },
  { id: "placement", enabled: true },
  { id: "visual", enabled: true },
];

const HINT_SETTINGS_STORAGE_KEY = "hint-settings-v1";
const TOUR_STORAGE_KEY = "guided-tour-v1";

function loadHintSettings(): HintSettings {
  if (typeof window === "undefined") return DEFAULT_HINT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(HINT_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_HINT_SETTINGS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_HINT_SETTINGS;
    const validIds = new Set<HintCategoryId>(["vercors", "placement", "visual"]);
    const seen = new Set<HintCategoryId>();
    const result: HintSettings = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const id = entry.id;
      if (!validIds.has(id) || seen.has(id)) continue;
      seen.add(id);
      result.push({ id, enabled: entry.enabled !== false });
    }

    for (const def of DEFAULT_HINT_SETTINGS) {
      if (!seen.has(def.id)) result.push({ ...def });
    }
    return result.length > 0 ? result : DEFAULT_HINT_SETTINGS;
  } catch {
    return DEFAULT_HINT_SETTINGS;
  }
}

export function PermissionBoard() {
  const [state, setState] = useState<EngineState>(() => mkState("standard"));
  const [flashBalance, setFlashBalance] = useState<RowId | null>(null);
  const [boardFlash, setBoardFlash] = useState<"success" | "error" | null>(null);
  const [manualOpen, setManualOpen] = useState(true);
  const [trayHintOpen, setTrayHintOpen] = useState(false);
  const [mode, setMode] = useState<"safe" | "race">("safe");
  const [raceState, setRaceState] = useState<RaceState>(mkRaceState);
  const [isRunningRace, setIsRunningRace] = useState(false);
  const runRaceCancelRef = useRef(false);

  const [isAnimating, setIsAnimating] = useState(false);
  const flyRef = useRef<HTMLDivElement>(null);

  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  const [hintSettings, setHintSettings] = useState<HintSettings>(DEFAULT_HINT_SETTINGS);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHintSettings(loadHintSettings()); }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(HINT_SETTINGS_STORAGE_KEY, JSON.stringify(hintSettings)); } catch {}
  }, [hintSettings]);

  const [tourStep, setTourStep] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let dismissed = false;
    try { dismissed = window.localStorage.getItem(TOUR_STORAGE_KEY) === "dismissed"; } catch {}
    if (!dismissed) {

      const t = setTimeout(() => setTourStep(1), 80);
      return () => clearTimeout(t);
    }
  }, []);
  const dismissTour = useCallback(() => {
    setTourStep(0);
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(TOUR_STORAGE_KEY, "dismissed"); } catch {}
    }
  }, []);
  const startTour = useCallback(() => setTourStep(1), []);
  const advanceTour = useCallback(() => {
    setTourStep(s => {
      if (s >= 4) {
        if (typeof window !== "undefined") {
          try { window.localStorage.setItem(TOUR_STORAGE_KEY, "dismissed"); } catch {}
        }
        return 0;
      }
      return s + 1;
    });
  }, []);
  const retreatTour = useCallback(() => setTourStep(s => (s > 1 ? s - 1 : s)), []);
  const enabledHintCount = hintSettings.filter(c => c.enabled).length;

  const visualHintActive = (() => {
    const enabled = hintSettings.filter(c => c.enabled);
    const idx = enabled.findIndex(c => c.id === "visual");
    return idx >= 0 && state.hintLevel >= idx + 1;
  })();

  const updateHintSettings = useCallback((next: HintSettings) => {
    setHintSettings(next);
    const nextEnabled = next.filter(c => c.enabled).length;
    setState(s => (s.hintLevel > nextEnabled ? { ...s, hintLevel: nextEnabled } : s));
  }, []);

  useEffect(() => { if (flashBalance) { const t = setTimeout(() => setFlashBalance(null), 800); return () => clearTimeout(t); } }, [flashBalance]);
  useEffect(() => { if (boardFlash) { const t = setTimeout(() => setBoardFlash(null), 500); return () => clearTimeout(t); } }, [boardFlash]);

  const doSelectThread = useCallback((tid: Tid) => { setVerifyMessage(null); setState(s => engineSelectThread(s, tid)); }, []);
  const doTokenClick = useCallback((rowId: RowId, colId: ColId) => { setState(s => engineTokenClick(s, rowId, colId)); }, []);
  const doPlaceInitial = useCallback((draggedRow: RowId, targetRow: RowId, targetCol: ColId) => { setState(s => enginePlaceInitial(s, draggedRow, targetRow, targetCol)); }, []);
  const doPlaceHalf = useCallback((rowId: RowId, halfIndex: 0 | 1, targetCol: ColId) => { setState(s => enginePlaceHalf(s, rowId, halfIndex, targetCol)); }, []);
  const doPickUpInitial = useCallback((rowId: RowId) => { setState(s => enginePickUpInitial(s, rowId)); }, []);
  const doMoveHalfFromCell = useCallback((rowId: RowId, fromCol: ColId, dest: ColId | "tray") => { setState(s => engineMoveHalfFromCell(s, rowId, fromCol, dest)); }, []);
  const doStartRun = useCallback(() => { setState(s => engineStartRun(s)); }, []);
  const doResetPlacement = useCallback(() => { setVerifyMessage(null); setState(s => engineResetPlacement(s)); }, []);

  const [halfPicker, setHalfPicker] = useState<{ rowId: RowId; col: ColId } | null>(null);
  const closeHalfPicker = useCallback(() => setHalfPicker(null), []);
  const openHalfPicker = useCallback((rowId: RowId, col: ColId) => { setHalfPicker({ rowId, col }); }, []);

  const doCellClick = useCallback((rowId: RowId, colId: ColId) => {
    setState(prev => {
      const result = engineCellClick(prev, rowId, colId);
      if (result.animate) {
        const { fromCol, toCol, legs } = result.animate;
        setIsAnimating(true);

        animateTokens(legs, fromCol, toCol, flyRef, () => {
          setState(s2 => applyMove(s2, fromCol, toCol, legs));
          setIsAnimating(false);
        });
        return prev;
      }
      return result.state;
    });
  }, []);

  const doVerify = useCallback(() => {
    setState(prev => {
      const result = engineVerify(prev);
      if (result.flashType) setBoardFlash(result.flashType);
      if (result.balanceFlash) setFlashBalance(result.balanceFlash);

      setVerifyMessage(result.success ? null : (result.message ?? null));
      return result.state;
    });
  }, []);

  const doHint = useCallback(() => { setState(s => engineHint(s, enabledHintCount)); }, [enabledHintCount]);
  const doBack = useCallback(() => { setVerifyMessage(null); setState(s => engineGoBack(s)); }, []);
  const doReset = useCallback(() => { setVerifyMessage(null); setState(s => engineReset(s.scenarioId)); }, []);
  const doClearFlow = useCallback(() => { setState(s => engineClearFlow(s)); }, []);
  const doTokenDragStart = useCallback((rowId: RowId, colId: ColId) => { setState(s => engineTokenDragStart(s, rowId, colId)); }, []);

  const doSetScenario = useCallback((nextId: ScenarioId) => {
    setState(s => (s.scenarioId === nextId ? s : mkState(nextId)));
  }, []);
  const doRaceReset = useCallback(() => {
    runRaceCancelRef.current = true;
    setRaceState(mkRaceState());
  }, []);

  const doRunRace = useCallback(async () => {
    if (isRunningRace) return;
    runRaceCancelRef.current = false;
    setIsRunningRace(true);
    const STEP_DELAY_MS = 450;
    for (let i = 0; i < 64; i++) {
      if (runRaceCancelRef.current) break;
      let alreadyDone = false;
      setRaceState(prev => {
        if (raceAllDone(prev)) { alreadyDone = true; return prev; }
        return stepRandomRaceThread(prev);
      });
      if (alreadyDone) break;
      await new Promise(r => setTimeout(r, STEP_DELAY_MS));
    }
    setIsRunningRace(false);
  }, [isRunningRace]);
  const doSetMode = useCallback((next: "safe" | "race") => {

    setMode(prev => {
      if (prev !== next) {
        runRaceCancelRef.current = true;
        if (next === "race") {
          setRaceState(mkRaceState());

          setTourStep(0);
        }
      }
      return next;
    });
  }, []);

  const raceAsEngineState: EngineState = {
    scenarioId: "standard",
    phase: "run",
    dist: { M1: { L1: 0, L2: 0, T1: 0, T2: 0, T3: 0, T4: 0 }, M2: { L1: 0, L2: 0, T1: 0, T2: 0, T3: 0, T4: 0 }, M3: { L1: 0, L2: 0, T1: 0, T2: 0, T3: 0, T4: 0 } },
    setupPositions: { M1: null, M2: null, M3: null },
    lockInvariants: { L1: {}, L2: {} },
    lockHolder: { L1: null, L2: null },
    memory: raceState.memory,
    stepIdx: raceState.stepIdx,
    selectedThread: null,
    selectedMove: null,
    hintLevel: 0,
    history: [],
    consoleEntries: [],
    flowMessages: [],
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "sans-serif", color: "#1a1a1a", background: "#fbf8f1" }}>
      <Header mode={mode} />
      <main style={{ flex: 1, padding: "16px", maxWidth: 1900, margin: "0 auto", width: "100%" }}>
        <HowItWorksPanel open={manualOpen} onToggle={() => setManualOpen(o => !o)} onStartTour={mode === "safe" ? startTour : undefined} />
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, marginTop: 20 }}>
          <ModeToggle mode={mode} onChange={doSetMode} />
          {mode === "safe" && (
            <>
              <span aria-hidden="true" style={{ width: 1, height: 24, background: "#bbb" }} />
              <ScenarioToggle scenarioId={state.scenarioId} onChange={doSetScenario} />
            </>
          )}
        </div>
        {mode === "safe" ? (
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start", marginTop: 20 }}>
            <div style={{ flex: "1.1 1 720px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
              <CodePanel state={state} onSelectThread={doSelectThread} hintSettings={hintSettings} />
              <BoardSection
                state={state} boardFlash={boardFlash}
                onTokenClick={doTokenClick} onCellClick={doCellClick}
                onTokenDragStart={doTokenDragStart}
                onVerify={doVerify} onHint={doHint} onBack={doBack} onReset={doReset}
                maxHintLevel={enabledHintCount}
                visualHintActive={visualHintActive}
                verifyMessage={verifyMessage}
                onPlaceInitial={doPlaceInitial} onPickUpInitial={doPickUpInitial}
                onPlaceHalf={doPlaceHalf} onOpenHalfPicker={openHalfPicker} onMoveHalfFromCell={doMoveHalfFromCell}
                onStartRun={doStartRun} onResetPlacement={doResetPlacement}
                trayHintOpen={trayHintOpen} onTrayHintToggle={() => setTrayHintOpen(v => !v)}
                isAnimating={isAnimating}
              />
              {halfPicker && (
                <HalfPicker
                  state={state}
                  rowId={halfPicker.rowId}
                  fromCol={halfPicker.col}
                  onPick={(dest) => { doMoveHalfFromCell(halfPicker.rowId, halfPicker.col, dest); closeHalfPicker(); }}
                  onPickBoth={() => { doPickUpInitial(halfPicker.rowId); closeHalfPicker(); }}
                  onClose={closeHalfPicker}
                />
              )}
            </div>
            <div style={{ flex: "1 1 480px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
              <BalancesPanel state={state} flashBalance={flashBalance} sectionNumber={3} tourId="section-3" />
              <FlowPanel state={state} onClear={doClearFlow} />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>
            <RaceOutcomeBanner raceState={raceState} />
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ flex: "0.4 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
                <BalancesPanel state={raceAsEngineState} flashBalance={null} expectedBalances={EXPECTED_FINAL_BALANCES} sectionNumber={1} showDivergence={raceAllDone(raceState)} />
              </div>
              <div style={{ flex: "1.6 1 600px", minWidth: 0 }}>
                <RaceTimeline raceState={raceState} sectionNumber={2} onRunAll={doRunRace} onReset={doRaceReset} isRunning={isRunningRace} />
              </div>
            </div>
            <RaceExplainer />
          </div>
        )}
      </main>
      <div ref={flyRef} style={{ position: "fixed", pointerEvents: "none", zIndex: 999, opacity: 0 }} />
      {mode === "safe" && (
        <HintSettingsConsole settings={hintSettings} onChange={updateHintSettings} />
      )}
      {mode === "safe" && tourStep >= 1 && tourStep <= 4 && (
        <GuidedTour
          step={tourStep as 1 | 2 | 3 | 4}
          onNext={advanceTour}
          onPrev={retreatTour}
          onClose={dismissTour}
        />
      )}
      <Footer />
    </div>
  );
}

function Header({ mode }: { mode: "safe" | "race" }) {
  const subtitle = mode === "safe" ? "With permissions" : "Without permissions (race demo)";
  return (
    <header style={{ padding: "18px 16px 14px", borderBottom: "3px solid #1a1a1a", display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Permission board</h1>
      <span style={{ fontSize: 14, fontWeight: 600, color: "#555" }}>· {subtitle}</span>
    </header>
  );
}

function SectionNumber({ n }: { n: number | string }) {
  return (
    <span aria-hidden style={{
      position: "absolute", top: -14, left: -14, zIndex: 2,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 40, height: 40, border: "2px solid #1a1a1a", background: "#ffd966",
      fontSize: 20, fontWeight: 800, boxShadow: "3px 3px 0 #1a1a1a", flexShrink: 0,
      lineHeight: 1,
    }}>{n}</span>
  );
}

function HowItWorksPanel({ open, onToggle, onStartTour }: { open: boolean; onToggle: () => void; onStartTour?: () => void }) {
  return (
    <section style={{ position: "relative", background: "#fff", border: "2px solid #1a1a1a", padding: "10px 14px 14px", boxShadow: "4px 4px 0 #1a1a1a" }}>
      <SectionNumber n="?" />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: "bold", margin: 0, paddingLeft: 32 }}>How it works</h3>
        <div style={{ display: "flex", gap: 8 }}>
          {onStartTour && (
            <button onClick={onStartTour} title="Replay the four-step intro tour">▶ Take the tour</button>
          )}
          <button onClick={onToggle}>{open ? "▴ Hide" : "▾ Show"}</button>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55, color: "#000" }}>
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Setup first, then Run.</p>
          <p style={{ margin: "0 0 8px", color: "#7f1d1d" }}>
            Curious what happens <em>without</em> locks? Flip the <strong>Race mode</strong> toggle below. Same code, no permissions, step the threads in any order and watch balances corrupt.
          </p>
          <ol style={{ margin: 0, paddingLeft: 24, display: "flex", flexDirection: "column", gap: 6, listStyleType: "decimal", listStylePosition: "outside" }}>
            <li>
              <strong>What each thread is doing:</strong> Read the PVL code for the four threads. Click a column to make that thread the active one.
            </li>
            <li>
              <strong>Permission board:</strong> Where permission tokens currently sit.
              <ul style={{ margin: "4px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3, listStyleType: "disc", listStylePosition: "outside" }}>
                <li><em>Setup — you choose each lock&apos;s contents:</em> drag Pa, Pb, Pc from the tray into the locks. Whatever you put in a lock becomes its invariant. The intended layout is Pa in Lock 1, Pb and Pc in Lock 2 — but try a different one: a thread only gets stuck when it later reads or writes a variable it never acquired, not at the lock itself.</li>
                <li>A <strong>lock column</strong> header shows whether the lock is <strong>🔓 Free</strong> or <strong>🔒</strong> held by a thread. A lock is a mutex: <strong>lock(L)</strong> hands its <em>entire</em> contents to the thread in one move, and <strong>unlock(L)</strong> returns all of it. Only one thread can hold a lock at a time.</li>
                <li>Click <strong>Start ▶</strong> to begin the run.</li>
                <li><em>Run:</em> click a lock&apos;s token (or drag it), then click the thread cell to acquire the whole lock at once. Press <strong>Verify step</strong> to apply the active thread&apos;s next step.</li>
              </ul>
            </li>
            <li>
              <strong>Variables:</strong> The live values. They tick down or up as you verify write steps.
            </li>
            <li>
              <strong>Permission transfer log:</strong> Every permission token move shows up as an animated arrow between lanes. The permission tokens at the bottom of each lane show where each permission is resting right now.
            </li>
          </ol>
        </div>
      )}
    </section>
  );
}

function ModeToggle({ mode, onChange }: { mode: "safe" | "race"; onChange: (m: "safe" | "race") => void }) {
  const pill = (active: boolean, danger: boolean): React.CSSProperties => ({
    padding: "8px 14px", border: `2px solid #1a1a1a`,
    background: active ? (danger ? "#dc2626" : "#ffd966") : "#fff",
    color: active && danger ? "#fff" : "#000",
    fontWeight: 700, fontSize: 13, cursor: "pointer",
    boxShadow: active ? "2px 2px 0 #1a1a1a" : "none",
    transition: "background 0.15s",
  });
  return (
    <section style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#000" }}>Mode:</span>
      <button onClick={() => onChange("safe")} style={pill(mode === "safe", false)}>✓ With permissions</button>
      <button onClick={() => onChange("race")} style={pill(mode === "race", true)}>⚠ Without permissions</button>
      <span style={{ fontSize: 11, color: "#7a7259", fontStyle: "italic" }}>
        {mode === "safe"
          ? "Permissions and locks enforced. VerCors’ view of the program."
          : "Locks and permissions are ignored. Step threads in any order to see what could go wrong."}
      </span>
    </section>
  );
}

function ScenarioToggle({ scenarioId, onChange }: { scenarioId: ScenarioId; onChange: (id: ScenarioId) => void }) {
  const pill = (active: boolean): React.CSSProperties => ({
    padding: "5px 12px", border: `2px solid #1a1a1a`,
    background: active ? "#fff7d6" : "#fff",
    color: "#000",
    fontWeight: 700, fontSize: 12, cursor: "pointer",
    boxShadow: active ? "2px 2px 0 #1a1a1a" : "none",
    transition: "background 0.15s",
  });
  return (
    <section style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#000" }}>Scenario:</span>
      <button onClick={() => onChange("standard")} style={pill(scenarioId === "standard")}>🔒 Exclusive locking</button>
      <button onClick={() => onChange("fractional")} style={pill(scenarioId === "fractional")}>½ Shared reading</button>
    </section>
  );
}

const TIMELINE_LANES: Array<{ kind: "thread" | "account"; id: Tid | RowId; label: string; stripe?: string }> = [
  { kind: "thread", id: "T1", label: "Thread 0", stripe: "#0d9488" },
  { kind: "thread", id: "T2", label: "Thread 1", stripe: "#d97706" },
  { kind: "thread", id: "T3", label: "Thread 2", stripe: "#4f46e5" },
  { kind: "thread", id: "T4", label: "Thread 3", stripe: "#dc2626" },
  { kind: "account", id: "M1", label: "Variable a" },
  { kind: "account", id: "M2", label: "Variable b" },
  { kind: "account", id: "M3", label: "Variable c" },
];

function RaceTimeline({ raceState, sectionNumber, onRunAll, onReset, isRunning }: {
  raceState: RaceState;
  sectionNumber?: number;
  onRunAll: () => void;
  onReset: () => void;
  isRunning: boolean;
}) {

  const W = 920;
  const HEADER_Y = 18;
  const HEADER_H = 56;
  const LANE_TOP = 90;
  const ROW_H = 38;
  const MARKERS_ZONE = 56;
  const SIDE_PAD = 18;
  const NODE_W = 116;

  const entries = raceState.trace;
  const rowsCount = Math.max(entries.length, 1);
  const baseH = LANE_TOP + rowsCount * ROW_H + 12;
  const H = baseH + MARKERS_ZONE;

  const slot = (W - SIDE_PAD * 2) / TIMELINE_LANES.length;
  const laneX = (i: number) => SIDE_PAD + slot * i + slot / 2;
  const tidLaneX = (tid: Tid) => laneX(TIMELINE_LANES.findIndex(l => l.kind === "thread" && l.id === tid));
  const rowLaneX = (rowId: RowId) => laneX(TIMELINE_LANES.findIndex(l => l.kind === "account" && l.id === rowId));

  const svgParts: string[] = [];

  TIMELINE_LANES.forEach((lane, i) => {
    const cx = laneX(i);
    const x = cx - NODE_W / 2;
    const isThread = lane.kind === "thread";
    const fill = isThread ? "#fff" : "#fff7d6";
    svgParts.push(`<rect x="${x}" y="${HEADER_Y}" width="${NODE_W}" height="${HEADER_H}" fill="${fill}" stroke="#000" stroke-width="1"/>`);
    if (isThread && lane.stripe) {
      svgParts.push(`<rect x="${x}" y="${HEADER_Y}" width="3" height="${HEADER_H}" fill="${lane.stripe}"/>`);
    }
    svgParts.push(`<text x="${cx}" y="${HEADER_Y + 32}" text-anchor="middle" style="font-family:sans-serif;font-size:10px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;fill:#000;">${escHtml(lane.label)}</text>`);
  });

  const dividerX = (laneX(3) + laneX(4)) / 2;
  svgParts.push(`<line x1="${dividerX}" y1="${HEADER_Y}" x2="${dividerX}" y2="${H - 10}" stroke="#bbb" stroke-width="1" stroke-dasharray="6 4"/>`);

  const lifelineTop = HEADER_Y + HEADER_H;
  const lifelineBottom = H - 10;
  TIMELINE_LANES.forEach((lane, i) => {
    const cx = laneX(i);
    svgParts.push(`<line x1="${cx}" y1="${lifelineTop}" x2="${cx}" y2="${lifelineBottom}" stroke="#000" stroke-width="1" stroke-dasharray="2 4"/>`);
  });

  entries.forEach((entry, idx) => {
    const y = LANE_TOP + idx * ROW_H + ROW_H * 0.55;
    const threadX = tidLaneX(entry.tid);
    const accountX = rowLaneX(entry.rowId);
    const isRead = entry.action === "read";

    const x1 = isRead ? accountX : threadX;
    const x2 = isRead ? threadX : accountX;
    const dir = x2 > x1 ? 1 : -1;
    const color = entry.isStale ? "#dc2626" : "#000";
    const arrowEndX = x2 - dir * 9;
    const midX = (x1 + x2) / 2;
    const actorX = 6;

    let label: string;
    if (isRead) {
      label = `read ${entry.value}`;
    } else {
      const d = entry.delta ?? 0;
      const sign = d >= 0 ? "+" : "−";
      const mag = Math.abs(d);
      label = `${sign}${mag}${entry.isStale ? "  lost" : ""}`;
    }
    const seqLabel = `#${entry.seq}`;
    svgParts.push(`<g>`);
    svgParts.push(`<text x="${actorX}" y="${y + 4}" text-anchor="start" style="font-family:monospace;font-size:9px;font-weight:600;fill:#888;">${escHtml(seqLabel)}</text>`);
    svgParts.push(`<circle cx="${x1}" cy="${y}" r="3" fill="${color}"/>`);
    svgParts.push(`<line x1="${x1}" y1="${y}" x2="${arrowEndX}" y2="${y}" stroke="${color}" stroke-width="1.5"/>`);
    svgParts.push(`<polygon points="${x2},${y} ${x2 - dir * 8},${y - 4} ${x2 - dir * 8},${y + 4}" fill="${color}"/>`);
    svgParts.push(`<text x="${midX}" y="${y - 6}" text-anchor="middle" style="font-family:monospace;font-size:11px;font-weight:700;fill:${color};">${escHtml(label)}</text>`);
    svgParts.push(`</g>`);
  });

  const markerY = lifelineBottom - 28;
  TIMELINE_LANES.forEach((lane, i) => {
    if (lane.kind !== "account") return;
    const cx = laneX(i);
    const v = raceState.memory[lane.id as RowId];
    svgParts.push(`<rect x="${cx - 34}" y="${markerY - 14}" width="68" height="28" fill="#fff" stroke="#000" stroke-width="1.5"/>`);
    svgParts.push(`<text x="${cx}" y="${markerY + 5}" text-anchor="middle" style="font-family:monospace;font-size:12px;font-weight:700;fill:#000;">${v}</text>`);
  });

  return (
    <section style={{ position: "relative", background: "#fff", border: "2px solid #1a1a1a", padding: "10px 14px 14px", boxShadow: "4px 4px 0 #1a1a1a" }}>
      <SectionNumber n={sectionNumber ?? 3} />
      <div style={{ marginBottom: 10, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 15, fontWeight: "bold", margin: 0, paddingLeft: 32 }}>Race timeline</h3>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {(() => { const d = isRunning || raceAllDone(raceState); return <button onClick={onRunAll} disabled={d} style={actionButton("primary", d)}>{isRunning ? "▶ Running…" : "▶ Run all"}</button>; })()}
          <button onClick={onReset} disabled={isRunning} style={actionButton("destructive", isRunning)}>↻ Reset race</button>
        </div>
      </div>
      <div style={{ position: "relative", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMin meet" style={{ display: "block", width: "100%", height: "auto", minHeight: 220 }} dangerouslySetInnerHTML={{ __html: svgParts.join("\n") }} />
        {entries.length === 0 && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", fontSize: 13, color: "#888", fontStyle: "italic" }}>
            Click ▶ Run all to interleave the threads randomly and watch what happens.
          </div>
        )}
      </div>
    </section>
  );
}

function RaceExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ background: "#fff", border: "2px solid #1a1a1a", padding: "10px 14px 14px", boxShadow: "4px 4px 0 #1a1a1a" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          padding: 0, background: "transparent", border: "none",
          color: "#7c5320", textDecoration: "underline", cursor: "pointer",
          fontSize: 13, fontWeight: 700, fontFamily: "sans-serif",
        }}
      >{open ? "− Hide explanation" : "+ Why does this happen?"}</button>
      {open && (
        <div style={{ marginTop: 8, fontSize: 13, color: "#3a3a3a", lineHeight: 1.55, maxWidth: 920 }}>
          <p style={{ margin: "0 0 8px" }}>
            Without locks, each `a := a + k` is not atomic. The thread first <strong>reads</strong> the current value of <code>a</code> into a private register, then computes the new value, then <strong>writes</strong> it back.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            If two threads read <code>a = 100</code> before either writes, both will compute their result from the same starting snapshot. The thread that stores last overwrites the other&apos;s update — one of the two changes is <strong>lost</strong>.
          </p>
          <p style={{ margin: 0 }}>
            VerCors&apos; permission system prevents this: writing requires the full <code>Perm(x, write)</code> token, and two threads cannot both hold it. The Safe-mode view shows what the verified program guarantees.
          </p>
        </div>
      )}
    </section>
  );
}

function RaceOutcomeBanner({ raceState }: { raceState: RaceState }) {
  if (!raceAllDone(raceState)) return null;
  const summary = raceOutcomeSummary(raceState);
  const ok = summary.matches;
  return (
    <section style={{
      background: ok ? "#dcfce7" : "#fee2e2",
      border: `2px solid ${ok ? "#16a34a" : "#dc2626"}`,
      padding: "10px 14px 12px", boxShadow: "4px 4px 0 #1a1a1a",
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ok ? "#14532d" : "#7f1d1d", marginBottom: ok ? 0 : 6 }}>
        {ok ? "✓ All threads done. Final balances match the expected outcome." : "⚠ All threads done. Balances are wrong."}
      </div>
      {!ok && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {summary.diffs.map(d => {
            const name = ROWS.find(r => r.id === d.rowId)?.semanticName ?? d.rowId;
            return (
              <div key={d.rowId} style={{ fontSize: 12, color: "#7f1d1d", fontFamily: "monospace" }}>
                {name}: got <strong>{d.actual}</strong>, expected <strong>{d.expected}</strong> ({d.delta > 0 ? "+" : ""}{d.delta})
              </div>
            );
          })}
          <div style={{ marginTop: 4, fontSize: 11.5, fontStyle: "italic", color: "#7f1d1d" }}>
            Without locks, two threads can read the same value and overwrite each other&apos;s updates. Switch back to Safe mode to see how permissions make this impossible.
          </div>
        </div>
      )}
      {ok && (
        <div style={{ fontSize: 11.5, color: "#14532d", fontStyle: "italic", marginTop: 4 }}>
          Lucky interleaving. Try Reset race and step in a different order to provoke a lost update.
        </div>
      )}
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ padding: "16px", borderTop: "3px solid #1a1a1a", marginTop: 24, fontSize: 12, color: "#7a7259" }}>
      Szymon Wróbel · Creative Technology BSc thesis · University of Twente
    </footer>
  );
}

function FlowPanel({ state, onClear }: { state: EngineState; onClear: () => void }) {
  const fired = state.flowMessages;
  const pending = buildPendingMessage(state);
  const messages: FlowMessage[] = [...fired, ...(pending ? [pending] : [])];
  const rowsCount = Math.max(messages.length, 1);
  const W = SEQ_LAYOUT.width;
  const H = SEQ_LAYOUT.laneTop + rowsCount * SEQ_LAYOUT.rowH + SEQ_LAYOUT.bottomPad;
  const tid = state.selectedThread;
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const prevFiredLenRef = useRef(fired.length);

  useEffect(() => {
    const prevLen = prevFiredLenRef.current;
    prevFiredLenRef.current = fired.length;
    if (fired.length <= prevLen) return;
    const m = fired[fired.length - 1];
    if (!m || m.fromLane === m.toLane) return;
    const container = containerRef.current;
    const svg = svgRef.current;
    const fly = flyRef.current;
    if (!container || !svg || !fly) return;
    const svgRect = svg.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const scale = svgRect.width / SEQ_LAYOUT.width;
    const offsetX = svgRect.left - containerRect.left;
    const offsetY = svgRect.top - containerRect.top;
    const idx = fired.length - 1;
    const svgY = SEQ_LAYOUT.laneTop + idx * SEQ_LAYOUT.rowH + SEQ_LAYOUT.rowH * 0.55;
    const fromXsvg = laneCenterX(m.fromLane);
    const toXsvg = laneCenterX(m.toLane);
    const pxFromX = offsetX + fromXsvg * scale;
    const pxToX = offsetX + toXsvg * scale;
    const pxY = offsetY + svgY * scale;
    const sz = 28;
    fly.innerHTML = makePieTokenSVG(m.rowId, m.units, m.fromLane, sz);
    fly.style.cssText = `position:absolute;pointer-events:none;z-index:5;width:${sz}px;height:${sz}px;left:${pxFromX - sz / 2}px;top:${pxY - sz / 2}px;opacity:1;transition:none;`;
    requestAnimationFrame(() => {
      fly.style.transition = "left 0.32s cubic-bezier(0.4,0,0.2,1)";
      fly.style.left = (pxToX - sz / 2) + "px";
      setTimeout(() => {
        if (!fly) return;
        fly.style.opacity = "0";
        fly.innerHTML = "";
      }, 340);
    });
  }, [fired]);

  const MARKERS_ZONE = 54;
  const Htotal = H + MARKERS_ZONE;

  const svgParts: string[] = [];

  SEQ_LANES.forEach(lane => {
    const cx = laneCenterX(lane.id);
    const x = cx - SEQ_LAYOUT.nodeW / 2;
    const y = SEQ_LAYOUT.headerY;
    const h = SEQ_LAYOUT.headerH;
    const isActiveThread = lane.kind === "thread" && tid === lane.id;
    const fill = isActiveThread ? "#000" : "#fff";
    const textFill = isActiveThread ? "#fff" : "#000";
    svgParts.push(`<rect style="fill:${fill};stroke:#000;stroke-width:1;" x="${x}" y="${y}" width="${SEQ_LAYOUT.nodeW}" height="${h}"/>`);
    if (lane.kind === "thread") {
      const stripe = THREAD_STRIPE[lane.id as Tid];
      svgParts.push(`<rect x="${x}" y="${y}" width="3" height="${h}" fill="${stripe}"/>`);
    }
    svgParts.push(`<text style="font-family:sans-serif;font-size:11px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;fill:${textFill};" x="${cx}" y="${y + 32}" text-anchor="middle">${lane.label}</text>`);
  });

  const lifelineTop = SEQ_LAYOUT.headerY + SEQ_LAYOUT.headerH;
  const lifelineBottom = Htotal - 10;
  SEQ_LANES.forEach(lane => {
    const cx = laneCenterX(lane.id);
    svgParts.push(`<line x1="${cx}" y1="${lifelineTop}" x2="${cx}" y2="${lifelineBottom}" stroke="#000" stroke-width="1" stroke-dasharray="2 4"/>`);
  });

  messages.forEach((m, idx) => {
    if (m.fromLane === m.toLane) return;
    const y = SEQ_LAYOUT.laneTop + idx * SEQ_LAYOUT.rowH + SEQ_LAYOUT.rowH * 0.55;
    const x1 = laneCenterX(m.fromLane);
    const x2 = laneCenterX(m.toLane);
    const dir = x2 > x1 ? 1 : -1;
    const pendingOpacity = m.pending ? 0.4 : 1;
    const dashArr = m.pending ? 'stroke-dasharray="4 3"' : "";
    const arrowEndX = x2 - dir * 9;
    const midX = (x1 + x2) / 2;
    const actorX = SEQ_LAYOUT.sidePad - 4;
    const label = (TOKEN_LABEL_DISPLAY[m.rowId] ?? m.rowId);
    const rc = ROW_COLOR[m.rowId] ?? { fill: "#000", ink: "#fff" };

    svgParts.push(`<g opacity="${pendingOpacity}">`);
    svgParts.push(`<circle cx="${x1}" cy="${y}" r="3" fill="${rc.fill}"/>`);
    svgParts.push(`<line x1="${x1}" y1="${y}" x2="${arrowEndX}" y2="${y}" stroke="${rc.fill}" stroke-width="2" fill="none" ${dashArr}/>`);
    svgParts.push(`<polygon points="${x2},${y} ${x2 - dir * 8},${y - 4} ${x2 - dir * 8},${y + 4}" fill="${rc.fill}"/>`);

    const shortActor = m.threadLabel.replace(/^Thread\s+(\d)/i, "T$1");

    const labelW = 22, labelH = 16;
    svgParts.push(`<rect x="${midX - labelW / 2}" y="${y - 7 - labelH + 4}" width="${labelW}" height="${labelH}" fill="${rc.fill}" stroke="#000" stroke-width="1"/>`);
    svgParts.push(`<text x="${midX}" y="${y - 7 + 1}" text-anchor="middle" style="font-family:monospace;font-size:11px;font-weight:700;fill:${rc.ink};">${label}</text>`);
    svgParts.push(`<text x="${actorX}" y="${y + 5}" text-anchor="start" style="font-family:sans-serif;font-size:14px;font-weight:700;letter-spacing:0.04em;fill:#333;">${shortActor}${m.pending ? " · next" : ""}</text>`);
    svgParts.push(`</g>`);
  });

  const markerSize = 42;
  const markerY = lifelineBottom - markerSize - 4;
  SEQ_LANES.forEach(lane => {
    const cx = laneCenterX(lane.id);
    const tokensHere = getRows(state).map(r => ({ row: r, units: gu(state, r.id, lane.id) })).filter(t => t.units > 0);
    if (tokensHere.length === 0) return;
    const gap = 2;
    const totalW = tokensHere.length * markerSize + (tokensHere.length - 1) * gap;
    let x = cx - totalW / 2;
    tokensHere.forEach(({ row, units }) => {
      const tokenSvg = makePieTokenSVG(row.id, units, lane.id, markerSize);
      svgParts.push(tokenSvg.replace(/^<svg /, `<svg x="${x}" y="${markerY}" `));
      x += markerSize + gap;
    });
  });

  return (
    <section data-tour-id="section-4" style={{ position: "relative", background: "#fff", border: "2px solid #1a1a1a", padding: "10px 14px 14px", boxShadow: "4px 4px 0 #1a1a1a" }}>
      <SectionNumber n={4} />
      <div style={{ marginBottom: 10, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h3 style={{ fontSize: 15, fontWeight: "bold", margin: 0, paddingLeft: 32 }}>Permission transfer log</h3>
        <button onClick={onClear}>↻ Clear</button>
      </div>
      {fired.length === 0 && (
        <p style={{ fontSize: 12, color: "#666", fontStyle: "italic", margin: "0 0 8px" }}>
          Permission moves will appear here as you verify each step.
        </p>
      )}
      <div ref={containerRef} style={{ position: "relative", minHeight: 170, overflowX: "auto" }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${Htotal}`} preserveAspectRatio="xMidYMin meet" style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }} dangerouslySetInnerHTML={{ __html: svgParts.join("\n") }} />
        <div ref={flyRef} aria-hidden style={{ position: "absolute", pointerEvents: "none", zIndex: 5, opacity: 0 }} />
      </div>
    </section>
  );
}

function BalancesPanel({ state, flashBalance, expectedBalances, sectionNumber, showDivergence, tourId }: { state: EngineState; flashBalance: RowId | null; expectedBalances?: Record<RowId, number>; sectionNumber?: number; showDivergence?: boolean; tourId?: string }) {
  return (
    <section data-tour-id={tourId} style={{ position: "relative", background: "#fff", border: "2px solid #1a1a1a", padding: "10px 14px 14px", boxShadow: "4px 4px 0 #1a1a1a" }}>
      <SectionNumber n={sectionNumber ?? 3} />
      <div style={{ marginBottom: 10, display: "flex", alignItems: "baseline", gap: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: "bold", margin: 0, paddingLeft: 32 }}>Variables</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {getRows(state).map(row => {
          const isFlash = row.id === flashBalance;
          const actual = state.memory[row.id];
          const expected = expectedBalances?.[row.id];

          const wrong = !!showDivergence && expected !== undefined && expected !== actual;
          return (
            <div key={row.id} style={{
              display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 12,
              padding: "10px 14px", border: `1px solid #000`,
              background: isFlash ? "#fffacd" : "#fff",
              transition: "background 0.2s",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#000" }}>{row.semanticName}</span>
                {expected !== undefined && (
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "#888" }}>VerCors result: {expected}</span>
                )}
              </div>
              <span style={{
                fontFamily: "monospace", fontSize: 22, fontWeight: 700,
                color: wrong ? "#dc2626" : "#000",
                textDecoration: isFlash ? "underline" : "none", textDecorationThickness: 2,
                minWidth: 64, textAlign: "right",
              }}>{actual}</span>
              <span style={{ fontSize: 11, color: "#000", background: "#eee", border: "1px solid #999", padding: "1px 6px", fontWeight: 600 }}>{row.protectedBy}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CodePanel({ state, onSelectThread, hintSettings }: { state: EngineState; onSelectThread: (t: Tid) => void; hintSettings: HintSettings }) {

  const sectionRef = useRef<HTMLElement>(null);
  const [codeScale, setCodeScale] = useState(1);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const NATURAL = 920;
    const MIN_SCALE = 0.78;
    const update = () => {
      const w = el.clientWidth;
      const scale = Math.min(1, Math.max(MIN_SCALE, (w - 32) / NATURAL));
      setCodeScale(scale);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fs = (base: number) => Math.round(base * codeScale * 10) / 10;

  return (
    <section ref={sectionRef} data-tour-id="section-1" style={{ position: "relative", background: "#fff", border: "2px solid #1a1a1a", padding: "10px 14px 14px", boxShadow: "4px 4px 0 #1a1a1a" }}>
      <SectionNumber n={1} />
      <div style={{ marginBottom: 10, display: "flex", alignItems: "baseline", gap: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: "bold", margin: 0, paddingLeft: 32 }}>What each thread is doing</h3>
      </div>
      <div style={{ border: "1px solid #1a1a1a" }}>
        <div>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #1a1a1a", background: "#fff", fontFamily: "monospace", fontSize: fs(11.5), lineHeight: 1.55, color: "#000" }}>
        {SCENARIOS[state.scenarioId].preamble.map((line, i) => {
          if (line === "") return <div key={i}>&nbsp;</div>;
          return <div key={i}>{line || " "}</div>;
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", background: C.codeHeaderBg, borderBottom: `1px solid ${C.codeBorder}` }}>
        {THREAD_IDS.map(tid => {
          const thread = getThreads(state)[tid];
          const isSel = state.selectedThread === tid;
          const isDone = isComplete(state, tid);
          const blocked = isBlocked(state, tid);
          const statusText = isDone ? "✓ Done" : (blocked ? "⏸ Waiting" : (isSel ? "● Active" : "▶ Focus"));
          const statusColor = blocked ? "#dc2626" : "#666";
          return (
            <div key={tid} role={isDone ? undefined : "button"} tabIndex={isDone ? undefined : 0} onClick={() => { if (!isDone) onSelectThread(tid); }} onKeyDown={e => { if (!isDone) handleKeyboardActivate(e, () => onSelectThread(tid)); }}
              title={isDone ? undefined : (isSel ? "Currently selected" : `Click to focus ${thread.label}`)}
              style={{
                padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                cursor: isDone ? "default" : "pointer", borderRight: tid !== "T4" ? `1px solid #000` : "none",
                background: isSel ? THREAD_STRIPE[tid] : "#fff",
                color: isSel ? "#fff" : "#000",
                transition: "background 0.12s",
              }}>
              <span style={{ fontSize: fs(12), fontWeight: "bold", padding: "2px 6px", background: isSel ? "#fff" : "#fff", color: isSel ? THREAD_STRIPE[tid] : "#000", border: `1px solid #000`, borderLeft: `4px solid ${THREAD_STRIPE[tid]}` }}>{thread.label}</span>
              <span style={{ fontSize: fs(11), color: isSel ? "#fff" : statusColor, fontWeight: isSel || (!isDone && !blocked) ? 700 : 400 }}>{statusText}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {THREAD_IDS.map(tid => {
          const thread = getThreads(state)[tid];
          const curStep = getCurrentStep(state, tid);

          return (
            <div key={tid} style={{
              borderRight: tid !== "T4" ? `1px solid #000` : "none", padding: "8px 4px", minHeight: "100%",
              background: "#fff",
            }}>
              <div style={{ padding: "0 4px", fontFamily: "monospace", fontSize: fs(11), lineHeight: 1.55 }}>
                {thread.codeLines.map(line => {
                  const isCurrent = !!(curStep && line.stepIds.includes(curStep.id) && state.selectedThread === tid);
                  const textColor = "#000";

                  const currentShadow = isCurrent ? `inset 5px 0 0 ${THREAD_STRIPE[tid]}` : "none";
                  const currentDeco = isCurrent ? "underline" : "none";

                  return (
                    <React.Fragment key={line.num}>
                      <div style={{ padding: "1px 5px", borderRadius: 0, boxShadow: currentShadow, background: isCurrent ? "#fff7d6" : "transparent", transition: "background 0.15s" }}>
                        <span style={{ color: textColor, whiteSpace: "pre", textDecoration: currentDeco, textDecorationThickness: 1 }}>{escHtml(line.text || " ")}</span>
                      </div>
                      {isCurrent && curStep && state.phase === "run" && (
                        <HintCategoryStack
                          key={curStep.id}
                          state={state}
                          step={curStep}
                          hintSettings={hintSettings}
                          fs={fs}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
        </div>
      </div>
    </section>
  );
}

function HintCategoryStack({ state, step, hintSettings, fs }: {
  state: EngineState; step: StepDef; hintSettings: HintSettings;
  fs: (base: number) => number;
}) {

  const [whyOpen, setWhyOpen] = useState(false);

  const enabled = hintSettings.filter(c => c.enabled);
  return (
    <>
      {enabled.map((cat, i) => {
        if (state.hintLevel < i + 1) return null;
        if (cat.id === "vercors") {
          return (
            <div key={cat.id} style={{
              margin: "1px 0 2px 8px", fontFamily: "monospace", fontSize: fs(10.5),
              lineHeight: 1.4, color: "#15803d", whiteSpace: "pre-wrap",
            }}>{stepAnnotation(state, step)}</div>
          );
        }
        if (cat.id === "visual") {

          return null;
        }

        const rationale = placementRationale(state, step);
        return (
          <div key={cat.id} style={{
            margin: "2px 0 6px 6px", padding: "5px 8px 5px 10px",
            borderLeft: "3px solid #a16207",
            fontFamily: "sans-serif", fontSize: fs(11.5), lineHeight: 1.5,
            color: "#5b4014",
          }}>
            <div>{rationale.short}</div>
            <button
              onClick={() => setWhyOpen(v => !v)}
              style={{
                marginTop: 4, padding: 0, background: "transparent", border: "none",
                color: "#7c5320", textDecoration: "underline", cursor: "pointer",
                fontSize: fs(11), fontFamily: "sans-serif",
              }}
            >{whyOpen ? "− Hide explanation" : "+ Why this matters"}</button>
            {whyOpen && (
              <div style={{ marginTop: 4, color: "#5b4014", fontSize: fs(11), lineHeight: 1.5 }}>
                {rationale.long}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function HintSettingsConsole({ settings, onChange }: { settings: HintSettings; onChange: (next: HintSettings) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const toggle = (id: HintCategoryId) => {
    onChange(settings.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  };
  const move = (id: HintCategoryId, dir: -1 | 1) => {
    const idx = settings.findIndex(c => c.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= settings.length) return;
    const next = settings.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };
  const reset = () => onChange(DEFAULT_HINT_SETTINGS.map(c => ({ ...c })));

  return (
    <div ref={rootRef} style={{ position: "fixed", bottom: 16, right: 16, zIndex: 50 }}>
      {open && (
        <div style={{
          position: "absolute", bottom: 48, right: 0, width: 290,
          background: "#fff", border: "2px solid #1a1a1a", boxShadow: "4px 4px 0 #1a1a1a",
          padding: 12, fontFamily: "sans-serif", fontSize: 12, color: "#1a1a1a",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Hint visibility (testing)</strong>
            <button onClick={() => setOpen(false)} aria-label="Close hint settings" style={{ padding: "1px 6px" }}>✕</button>
          </div>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 8, lineHeight: 1.4 }}>
            Reorder & toggle the Hint button cycle.
          </div>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
            {settings.map((cat, idx) => (
              <li key={cat.id} style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 6,
                alignItems: "center", padding: "4px 6px",
                border: "1px solid #d4d4d4", background: cat.enabled ? "#fff" : "#f5f5f5",
              }}>
                <input
                  type="checkbox"
                  checked={cat.enabled}
                  onChange={() => toggle(cat.id)}
                  aria-label={`Toggle ${HINT_CATEGORY_LABELS[cat.id]}`}
                />
                <span style={{ fontSize: 12, color: cat.enabled ? "#1a1a1a" : "#888" }}>
                  {idx + 1}. {HINT_CATEGORY_LABELS[cat.id]}
                </span>
                <button onClick={() => move(cat.id, -1)} disabled={idx === 0} aria-label={`Move ${HINT_CATEGORY_LABELS[cat.id]} up`} style={{ padding: "0 6px" }}>↑</button>
                <button onClick={() => move(cat.id, 1)} disabled={idx === settings.length - 1} aria-label={`Move ${HINT_CATEGORY_LABELS[cat.id]} down`} style={{ padding: "0 6px" }}>↓</button>
              </li>
            ))}
          </ol>
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={reset} style={{ fontSize: 11 }}>Reset to defaults</button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="Hint visibility settings"
          title="Hint visibility"
          style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "2px solid #1a1a1a", background: "#fff",
            boxShadow: "2px 2px 0 #1a1a1a", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}
        >⚙</button>
        <span style={{ fontSize: 10, fontStyle: "italic", color: "#555", lineHeight: 1, marginTop: 2 }}>Hints</span>
      </div>
    </div>
  );
}

function BoardSection({ state, boardFlash, onTokenClick, onCellClick, onTokenDragStart, onVerify, onHint, onBack, onReset, onPlaceInitial, onPickUpInitial, onPlaceHalf, onOpenHalfPicker, onMoveHalfFromCell, onStartRun, onResetPlacement, trayHintOpen, onTrayHintToggle, isAnimating, maxHintLevel, visualHintActive, verifyMessage }: {
  state: EngineState; boardFlash: "success" | "error" | null;
  onTokenClick: (r: RowId, c: ColId) => void; onCellClick: (r: RowId, c: ColId) => void;
  onTokenDragStart: (r: RowId, c: ColId) => void;
  onVerify: () => void; onHint: () => void; onBack: () => void; onReset: () => void;
  onPlaceInitial: (draggedRow: RowId, targetRow: RowId, targetCol: ColId) => void; onPickUpInitial: (r: RowId) => void;
  onPlaceHalf: (rowId: RowId, halfIndex: 0 | 1, targetCol: ColId) => void;
  onOpenHalfPicker: (rowId: RowId, col: ColId) => void;
  onMoveHalfFromCell: (rowId: RowId, fromCol: ColId, dest: ColId | "tray") => void;
  onStartRun: () => void; onResetPlacement: () => void;
  trayHintOpen: boolean; onTrayHintToggle: () => void;
  isAnimating: boolean;
  maxHintLevel: number;
  visualHintActive: boolean;
  verifyMessage: string | null;
}) {
  const isSetup = state.phase === "setup";
  const step = getCurrentStep(state);
  const tid = state.selectedThread;

  const visualStepActive = visualHintActive && !!step && (step.action === "lock" || step.action === "unlock") && state.phase === "run";
  const visualSourceCol: ColId | null = visualStepActive && step
    ? (step.action === "lock" ? step.lockId : (tid as ColId | null))
    : null;

  const visualSourceRow: RowId | null = null;

  return (
    <section data-tour-id="section-2" style={{ position: "relative", background: "#fff", border: "2px solid #1a1a1a", padding: 14, boxShadow: "4px 4px 0 #1a1a1a", outline: boardFlash === "error" ? "3px solid #dc2626" : undefined, outlineOffset: -2 }}>
      <SectionNumber n={2} />
      <div style={{ marginBottom: 10, display: "flex", alignItems: "baseline", gap: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: "bold", margin: 0, paddingLeft: 32 }}>Permission board</h3>
      </div>

      <div style={{ overflowX: "auto", paddingBottom: 2 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(7rem,8.5rem) repeat(6,minmax(5.1rem,1fr))", gap: 5, minWidth: 720 }}>
          <div />
          {COL_IDS.map(colId => {
            const col = COLUMNS.find(c => c.id === colId)!;
            const isThread = col.kind === "thread";
            const stripe = isThread ? THREAD_STRIPE[colId as Tid] : null;
            if (col.kind === "lock") {
              const lockId = colId as "L1" | "L2";
              const status = lockStatus(state, lockId);
              const holderLabel = status.holder ? COLUMNS.find(c => c.id === status.holder)!.label : null;
              const statusText = !status.held ? "🔓 Free" : (holderLabel ? `🔒 ${holderLabel}` : "🔒 In use");

              return (
                <div key={colId} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "5px 3px", textAlign: "center", background: "#1a1a1a", color: "#fff", border: `1px solid #000` }}>
                  <span style={{ fontSize: 12, fontWeight: "bold", color: "#fff" }}>{col.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: status.held ? "#ffd966" : "#bbb" }}>{statusText}</span>
                </div>
              );
            }
            return (
              <div key={colId} style={{ padding: "5px 3px", textAlign: "center", fontSize: 12, fontWeight: "bold", background: "#fff", color: "#000", border: `1px solid #000`, borderTop: stripe ? `3px solid ${stripe}` : `1px solid #000` }}>{col.label}</div>
            );
          })}

          {getRows(state).map(row => {
            const rc = ROW_COLOR[row.id];
            return (
              <React.Fragment key={row.id}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 0, border: `1px solid ${C.border}`, background: rc.fill, color: rc.ink }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: rc.ink }}>{row.semanticName}</span>
                  <span style={{ fontSize: 11, color: rc.fill, background: rc.ink, border: `1px solid ${rc.ink}`, padding: "1px 5px", fontWeight: 700 }}>{row.protectedBy}</span>
                </div>
                {COL_IDS.map(colId => (
                  <BoardCell key={colId} state={state} row={row} colId={colId} visualSourceCol={visualSourceCol} visualSourceRow={visualSourceRow} onTokenClick={onTokenClick} onCellClick={onCellClick} onTokenDragStart={onTokenDragStart} onPlaceInitial={onPlaceInitial} onPickUpInitial={onPickUpInitial} onPlaceHalf={onPlaceHalf} onOpenHalfPicker={onOpenHalfPicker} onMoveHalfFromCell={onMoveHalfFromCell} />
                ))}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {isSetup && (
        <TokenTray state={state} hintOpen={trayHintOpen} onHintToggle={onTrayHintToggle} />
      )}

      {!isSetup && verifyMessage && (
        <VerifyMessageStrip key={verifyMessage} message={verifyMessage} onUndo={onBack} canUndo={state.history.length > 0 && !isAnimating} />
      )}

      <fieldset style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", border: "none", padding: 0 }}>
        <legend style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#666", padding: "0 6px 4px 0" }}>Actions</legend>
        {isSetup ? (
          <>
            {(() => { const d = !allTokensPlaced(state); return <button onClick={onStartRun} disabled={d} style={actionButton("primary", d)}>Start ▶</button>; })()}
            {!allTokensPlaced(state) && (
              <span style={{ fontSize: 11, color: "#7a7259", fontStyle: "italic" }}>
                {state.scenarioId === "fractional"
                  ? "Place all 6 half-tokens to start."
                  : "Place all 3 permission tokens to start."}
              </span>
            )}
            {(() => { const d = state.history.length === 0; return <button onClick={onBack} disabled={d} style={actionButton("secondary", d)}>↶ Back</button>; })()}
            <span style={{ marginLeft: "auto" }} />
            <button onClick={onResetPlacement} style={actionButton("destructive")}>↻ Clear placement</button>
          </>
        ) : (
          <>
            {(() => { const d = state.selectedThread === null || isAnimating; return <button onClick={onVerify} disabled={d} style={actionButton("primary", d)}>✓ Verify step</button>; })()}
            {(() => { const d = state.selectedThread === null || maxHintLevel === 0 || state.hintLevel >= maxHintLevel; return <button onClick={onHint} disabled={d} style={actionButton("secondary", d)} title="Reveal the next configured hint">? Hint ({state.hintLevel}/{maxHintLevel})</button>; })()}
            {(() => { const d = state.history.length === 0 || isAnimating; return <button onClick={onBack} disabled={d} style={actionButton("secondary", d)}>↶ Back</button>; })()}
            <span style={{ marginLeft: "auto" }} />
            <button onClick={onResetPlacement} disabled={isAnimating} style={actionButton("destructive", isAnimating)}>↻ Reset placement</button>
            <button onClick={onReset} disabled={isAnimating} style={actionButton("destructive", isAnimating)}>↻ Reset all</button>
          </>
        )}
      </fieldset>
    </section>
  );
}

function TokenTray({ state, hintOpen, onHintToggle }: { state: EngineState; hintOpen: boolean; onHintToggle: () => void }) {
  const isFractional = state.scenarioId === "fractional";

  if (isFractional) {

    const rows = getRows(state);
    const trayEntries = rows
      .map(row => ({ row, halves: halvesInTray(state, row.id) }))
      .filter(e => e.halves.length > 0);
    const empty = trayEntries.length === 0;
    return (
      <div style={{ marginTop: 14, padding: "10px 12px", border: "2px dashed #1a1a1a", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: "bold" }}>Permission token tray — place each half of every permission</span>
          <button onClick={onHintToggle}>{hintOpen ? "▴ Hide hint" : "? Hint"}</button>
        </div>
        <p style={{ fontSize: 11, color: "#555", margin: "0 0 8px", fontStyle: "italic" }}>
          Every permission is split in two. Drag one half into the variable&apos;s lock and the other onto Thread 3 (the writer). A reader borrows the lock&apos;s half; the writer combines its own half with the lock&apos;s to reach the full token it needs to write.
        </p>
        {hintOpen && (
          <p style={{ fontSize: 12, color: "#444", marginTop: 0, marginBottom: 8, fontStyle: "italic" }}>
            The intended layout: ½ Pa in L1 and ½ Pa with Thread 3; ½ Pb in L2 and ½ Pb with Thread 3; ½ Pc in L2 and ½ Pc with Thread 3. Try a different placement and watch where it goes wrong: a thread only gets stuck when it tries to read or write a variable it never fully acquired.
          </p>
        )}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", minHeight: 56 }}>
          {empty ? (
            <span style={{ fontSize: 12, fontStyle: "italic", color: "#666" }}>Every half placed. Press Start ▶ to run.</span>
          ) : (
            trayEntries.map(({ row, halves }) => (
              <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: 4, background: "#fff", border: "1px solid #000" }}>
                {halves.map(halfIdx => (
                  <span
                    key={halfIdx}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData("text/x-token-row", row.id);
                      e.dataTransfer.setData("text/x-half-index", String(halfIdx));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    title={`Drag this half of ${row.semanticName} to a cell`}
                    style={{ display: "flex", alignItems: "center", cursor: "grab" }}
                    dangerouslySetInnerHTML={{ __html: makePieTokenSVG(row.id, HALF, "L1", 36) }}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  const inTray = getRows(state).filter(r => isTokenInTray(state, r.id));
  return (
    <div style={{ marginTop: 14, padding: "10px 12px", border: "2px dashed #1a1a1a", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 13, fontWeight: "bold" }}>Permission token tray — choose each lock&apos;s contents</span>
        <button onClick={onHintToggle}>{hintOpen ? "▴ Hide hint" : "? Hint"}</button>
      </div>
      <p style={{ fontSize: 11, color: "#555", margin: "0 0 8px", fontStyle: "italic" }}>
        Drag each permission token into a lock. Whatever you put in a lock becomes its invariant — that lock will hand exactly those permissions to any thread that locks it.
      </p>
      {hintOpen && (
        <p style={{ fontSize: 12, color: "#444", marginTop: 0, marginBottom: 8, fontStyle: "italic" }}>
          The intended layout puts Pa under L1 and Pb and Pc under L2. Try a different placement and watch where it goes wrong: a thread only gets stuck when it tries to read or write a variable it never acquired.
        </p>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", minHeight: 56 }}>
        {inTray.length === 0 ? (
          <span style={{ fontSize: 12, fontStyle: "italic", color: "#666" }}>Nothing left in the tray.</span>
        ) : (
          inTray.map(row => (
            <div
              key={row.id}
              draggable
              onDragStart={e => { e.dataTransfer.setData("text/x-token-row", row.id); e.dataTransfer.effectAllowed = "move"; }}
              title={`Drag ${row.semanticName} to a cell`}
              style={{ display: "flex", alignItems: "center", padding: 4, background: "#fff", border: "1px solid #000", cursor: "grab" }}
            >
              <span dangerouslySetInnerHTML={{ __html: makePieTokenSVG(row.id, FULL, "L1", 36) }} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function HalfPicker({ state, rowId, fromCol, onPick, onPickBoth, onClose }: {
  state: EngineState;
  rowId: RowId;
  fromCol: ColId;
  onPick: (dest: ColId | "tray") => void;
  onPickBoth: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; placeAbove: boolean }>({ left: 0, top: 0, placeAbove: false });

  useEffect(() => {
    const anchor = document.querySelector(`[data-cell="${rowId}:${fromCol}"]`);
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const popupH = ref.current?.offsetHeight ?? 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < popupH + 16 && rect.top > popupH + 16;
    setPos({
      left: Math.min(window.innerWidth - 280, Math.max(8, rect.left)),
      top: placeAbove ? Math.max(8, rect.top - popupH - 6) : rect.bottom + 6,
      placeAbove,
    });
  }, [rowId, fromCol]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const tokenLabel = TOKEN_LABEL_DISPLAY[rowId];

  const destinations: Array<{ id: ColId; label: string }> = COLUMNS
    .filter(c => c.id !== fromCol)
    .map(c => ({ id: c.id, label: c.label }));
  const fromLabel = COLUMNS.find(c => c.id === fromCol)?.label ?? fromCol;

  return (
    <div
      ref={ref}
      style={{
        position: "fixed", left: pos.left, top: pos.top, zIndex: 1000,
        minWidth: 240, maxWidth: 280,
        background: "#fff", border: "2px solid #1a1a1a", boxShadow: "4px 4px 0 #1a1a1a",
        padding: 10, fontSize: 12,
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Split full {tokenLabel} at {fromLabel}</div>
      <div style={{ color: "#555", marginBottom: 8, lineHeight: 1.4 }}>
        Both halves sit here. Pick where to move one half — the other stays.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
        <button onClick={() => onPick("tray")} style={actionButton("secondary")}>↩ Tray</button>
        {destinations.map(d => (
          <button key={d.id} onClick={() => onPick(d.id)} style={actionButton("secondary")}>→ {d.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <button onClick={onPickBoth} style={actionButton("destructive")}>Send both to tray</button>
        <button onClick={onClose} style={actionButton("secondary")}>Cancel</button>
      </div>
      <div style={{ fontSize: 10, color: "#888", marginTop: 6, fontStyle: "italic" }}>
        Now: {state.dist[rowId][fromCol]}/{FULL} at {fromLabel}.
      </div>
    </div>
  );
}

type TourStep = { title: string; body: string };
const TOUR_STEPS: TourStep[] = [
  { title: "Thread code",
    body: "Each column shows one thread's PVL program. Click a thread's header to focus it; the active line lights up and the VerCors proof obligation appears underneath (once you press Hint)." },
  { title: "Permission board",
    body: "Place permission tokens during setup, then move them at run time to model lock and unlock. Drag the lock's token onto a thread to acquire; back to the lock to release. Press Verify Step to check the active line." },
  { title: "Variables",
    body: "The runtime values of a, b, c. They only change when a thread successfully writes — and writing needs the full permission token." },
  { title: "Permission transfer log",
    body: "A sequence diagram of every move so far, lane by lane. Use it to trace which thread did what and when." },
];

function GuidedTour({ step, onNext, onPrev, onClose }: {
  step: 1 | 2 | 3 | 4;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [callout, setCallout] = useState<{ left: number; top: number; placeAbove: boolean }>({ left: 0, top: 0, placeAbove: false });
  const calloutRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const findTarget = () => document.querySelector(`[data-tour-id="section-${step}"]`);
    const measure = () => {
      const el = findTarget();
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect(prev => {
        if (prev && prev.left === r.left && prev.top === r.top && prev.width === r.width && prev.height === r.height) return prev;
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      });
    };
    const targetForScroll = findTarget();
    if (targetForScroll) targetForScroll.scrollIntoView({ behavior: "smooth", block: "center" });
    measure();

    let cancelled = false;
    let ticks = 0;
    const settle = () => {
      if (cancelled || ticks >= 60) return;
      ticks++;
      measure();
      requestAnimationFrame(settle);
    };
    requestAnimationFrame(settle);

    let pending = 0;
    const onScrollOrResize = () => {
      if (pending) return;
      pending = requestAnimationFrame(() => { pending = 0; measure(); });
    };
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    return () => {
      cancelled = true;
      if (pending) cancelAnimationFrame(pending);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize);
    };
  }, [step]);

  useEffect(() => {
    if (!rect) return;
    const popupH = calloutRef.current?.offsetHeight ?? 180;
    const popupW = calloutRef.current?.offsetWidth ?? 320;
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const placeAbove = spaceBelow < popupH + 24 && rect.top > popupH + 24;
    const left = Math.min(window.innerWidth - popupW - 12, Math.max(12, rect.left + rect.width / 2 - popupW / 2));
    const top = placeAbove ? Math.max(12, rect.top - popupH - 12) : Math.min(window.innerHeight - popupH - 12, rect.top + rect.height + 12);
    setCallout({ left, top, placeAbove });
  }, [rect]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const content = TOUR_STEPS[step - 1];
  if (!rect) return null;

  const ringPad = 6;
  return (
    <>
      <div style={{
        position: "fixed",
        left: rect.left - ringPad,
        top: rect.top - ringPad,
        width: rect.width + ringPad * 2,
        height: rect.height + ringPad * 2,
        border: "3px solid #facc15",
        borderRadius: 4,
        boxShadow: "0 0 0 3px rgba(250, 204, 21, 0.25)",
        pointerEvents: "none",
        zIndex: 998,
        transition: "left 0.18s, top 0.18s, width 0.18s, height 0.18s",
      }} />
      <div
        ref={calloutRef}
        style={{
          position: "fixed",
          left: callout.left,
          top: callout.top,
          width: 320,
          zIndex: 999,
          background: "#fff",
          border: "2px solid #1a1a1a",
          boxShadow: "4px 4px 0 #1a1a1a",
          padding: 12,
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#7a7259", letterSpacing: "0.06em", textTransform: "uppercase" }}>Step {step} / 4</span>
          <button onClick={onClose} title="Close tour" style={{ background: "transparent", border: "none", fontSize: 14, cursor: "pointer", padding: "0 4px", color: "#666" }}>✕</button>
        </div>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{content.title}</div>
        <div style={{ color: "#222", marginBottom: 10 }}>{content.body}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <button onClick={onClose} style={{ fontSize: 12, color: "#666", background: "transparent", border: "none", textDecoration: "underline", cursor: "pointer", padding: 0 }}>Skip</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onPrev} disabled={step === 1} style={{ padding: "4px 10px", border: "1px solid #1a1a1a", background: step === 1 ? "#f4f4f4" : "#fff", cursor: step === 1 ? "default" : "pointer", color: step === 1 ? "#999" : "#000" }}>← Back</button>
            <button onClick={onNext} style={{ padding: "4px 10px", border: "1px solid #1a1a1a", background: "#ffd966", boxShadow: "2px 2px 0 #1a1a1a", fontWeight: 700, cursor: "pointer" }}>
              {step === 4 ? "Got it ✓" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function VerifyMessageStrip({ message, onUndo, canUndo }: { message: string; onUndo: () => void; canUndo: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      marginTop: 10, padding: "6px 10px",
      border: "1px solid #fca5a5", background: "#fef2f2",
      fontSize: 12, color: "#b91c1c", lineHeight: 1.45,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600 }}>Step rejected.</span>
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            padding: 0, background: "transparent", border: "none",
            color: "#b91c1c", textDecoration: "underline", cursor: "pointer",
            fontSize: 12, fontFamily: "sans-serif",
          }}
        >{open ? "▾ Hide" : "▸ Why?"}</button>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          style={{
            marginLeft: "auto",
            padding: "2px 8px",
            border: "1px solid #b91c1c",
            background: canUndo ? "#fff" : "#fef2f2",
            color: canUndo ? "#b91c1c" : "#fca5a5",
            cursor: canUndo ? "pointer" : "default",
            fontSize: 12, fontWeight: 600, fontFamily: "sans-serif",
          }}
          title="Undo the last move (same as the Back button)"
        >↶ Undo last move</button>
      </div>
      {open && (
        <div style={{ marginTop: 4, fontStyle: "italic", color: "#7f1d1d" }}>{message}</div>
      )}
    </div>
  );
}

function BoardCell({ state, row, colId, visualSourceCol, visualSourceRow, onTokenClick, onCellClick, onTokenDragStart, onPlaceInitial, onPickUpInitial, onPlaceHalf, onOpenHalfPicker, onMoveHalfFromCell }: {
  state: EngineState; row: typeof ROWS[number]; colId: ColId;
  visualSourceCol: ColId | null; visualSourceRow: RowId | null;
  onTokenClick: (r: RowId, c: ColId) => void; onCellClick: (r: RowId, c: ColId) => void;
  onTokenDragStart: (r: RowId, c: ColId) => void;
  onPlaceInitial: (draggedRow: RowId, targetRow: RowId, targetCol: ColId) => void; onPickUpInitial: (r: RowId) => void;
  onPlaceHalf: (rowId: RowId, halfIndex: 0 | 1, targetCol: ColId) => void;
  onOpenHalfPicker: (rowId: RowId, col: ColId) => void;
  onMoveHalfFromCell: (rowId: RowId, fromCol: ColId, dest: ColId | "tray") => void;
}) {
  const isSetup = state.phase === "setup";
  const isFractional = state.scenarioId === "fractional";

  const setupTokenRow = isSetup ? setupTokenAt(state, row.id, colId) : null;
  const tokenRow = setupTokenRow ?? row.id;
  const units = isSetup ? setupUnitsAt(state, row.id, colId) : gu(state, row.id, colId);
  const isLock = colId === "L1" || colId === "L2";
  const sel = state.selectedMove;

  const selLeg = !isSetup && sel ? sel.legs.find(l => l.rowId === row.id) : undefined;
  const canPlace = !isSetup && Boolean(sel && selLeg && colId !== sel.sourceCol && (gu(state, row.id, colId) + selLeg.units <= FULL));
  const isSelected = !isSetup && Boolean(sel && selLeg && sel.sourceCol === colId);

  const isVisualSource = !isSetup && visualSourceCol !== null
    && colId === visualSourceCol && (visualSourceRow === null ? units > 0 : row.id === visualSourceRow);
  const isVisualBlocker = !isSetup && visualSourceRow !== null && visualSourceCol !== null
    && row.id === visualSourceRow && colId !== visualSourceCol && units > 0;

  const setupCanDrop = isSetup;
  const [isDragOver, setIsDragOver] = useState(false);

  let bg = isLock ? "#f3f0e7" : "#fff";
  const borderColor = "#000";
  let borderStyle: "solid" | "dashed" = "solid";
  let outline: string | undefined;

  if (canPlace) {
    borderStyle = "dashed";
  }

  if (isVisualSource) {
    outline = "2px solid #15803d";
  } else if (isVisualBlocker) {
    outline = "2px dashed #dc2626";
  }
  if (setupCanDrop && isDragOver) {
    borderStyle = "solid";
    bg = "#000";
  }

  let inner: React.ReactNode;
  if (units > 0) {
    let svgStr: string;
    if (isSetup) {

      svgStr = makePieTokenSVG(tokenRow, units, colId, 44);
    } else {

      svgStr = makePieTokenSVG(row.id, units, colId, 44);
    }

    const fractionalCellFull = isSetup && isFractional && units >= FULL;
    const fractionalCellHalf = isSetup && isFractional && units > 0 && units < FULL;
    const onTokenAct = isSetup
      ? (fractionalCellFull
          ? () => onOpenHalfPicker(tokenRow, colId)
          : (fractionalCellHalf
              ? () => onMoveHalfFromCell(tokenRow, colId, "tray")
              : () => onPickUpInitial(tokenRow)))
      : () => onTokenClick(row.id, colId);
    const tokenTitle = isSetup
      ? (fractionalCellFull ? "Drag to move one half, or click to split" : (isFractional ? "Drag to move this half, or click to return to tray" : "Drag to move, or click to return to tray"))
      : "Drag to move, or click to select";
    inner = (
      <div role="button" tabIndex={0}
        aria-label={isSetup ? `Return ${tokenRow} to the tray` : `Select ${row.semanticName} permission from ${colId}`}
        title={tokenTitle}
        onClick={e => { e.stopPropagation(); onTokenAct(); }}
        onKeyDown={e => { e.stopPropagation(); handleKeyboardActivate(e, onTokenAct); }}
        draggable
        onDragStart={e => {
          if (isSetup) {
            e.dataTransfer.setData("text/x-token-row", tokenRow);
            if (isFractional) {

              const pos = state.setupPositions[tokenRow];
              let halfIdx: 0 | 1 | null = null;
              if (pos && "halves" in pos) {
                if (pos.halves[1] === colId) halfIdx = 1;
                else if (pos.halves[0] === colId) halfIdx = 0;
              }
              if (halfIdx !== null) e.dataTransfer.setData("text/x-half-index", String(halfIdx));
            }
            e.dataTransfer.effectAllowed = "move";
          } else {
            e.dataTransfer.setData("text/x-run-token-source", `${row.id}:${colId}`);
            e.dataTransfer.effectAllowed = "move";

            if (!isSelected) onTokenDragStart(row.id, colId);
          }
        }}
        style={{
          cursor: "grab", display: "flex", alignItems: "center", justifyContent: "center",
          outline: isSelected ? "2px solid #000" : undefined,
          outlineOffset: isSelected ? 2 : undefined,
        }}
        dangerouslySetInnerHTML={{ __html: svgStr }} />
    );
  } else if (canPlace) {
    inner = <span style={{ fontSize: 14, fontWeight: "bold", color: "#666" }}>+</span>;
  } else {
    inner = <div style={{ width: 3, height: 3, background: "#ccc" }} />;
  }

  const setupHandlers = setupCanDrop
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes("text/x-token-row")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (!isDragOver) setIsDragOver(true);
        },
        onDragLeave: () => setIsDragOver(false),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setIsDragOver(false);
          const draggedRow = e.dataTransfer.getData("text/x-token-row") as RowId;
          if (!draggedRow) return;

          const halfIdxStr = e.dataTransfer.getData("text/x-half-index");
          if (isFractional) {
            if (draggedRow !== row.id) return;
            if (halfIdxStr === "") return;
            const halfIdx = Number(halfIdxStr) as 0 | 1;
            if (halfIdx !== 0 && halfIdx !== 1) return;
            onPlaceHalf(draggedRow, halfIdx, colId);
            return;
          }
          onPlaceInitial(draggedRow, row.id, colId);
        },
      }
    : {};

  const runHandlers = canPlace
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes("text/x-run-token-source")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        },
        onDrop: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes("text/x-run-token-source")) return;
          e.preventDefault();
          onCellClick(row.id, colId);
        },
      }
    : {};

  return (
    <div
      role={canPlace ? "button" : undefined}
      tabIndex={canPlace ? 0 : undefined}
      aria-label={canPlace ? `Move selected permission to ${colId}` : undefined}
      data-cell={`${row.id}:${colId}`}
      onClick={canPlace ? () => onCellClick(row.id, colId) : undefined}
      onKeyDown={canPlace ? e => handleKeyboardActivate(e, () => onCellClick(row.id, colId)) : undefined}
      {...setupHandlers}
      {...runHandlers}
      style={{
        minHeight: 54, borderRadius: 0, border: `1px ${borderStyle} ${borderColor}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.4s, border-color 0.12s",
        position: "relative", background: bg, outline, outlineOffset: outline ? -1 : undefined,
        cursor: canPlace ? "pointer" : "default",
      }}>
      {inner}
    </div>
  );
}

function animateTokens(
  legs: Array<{ rowId: RowId; units: number }>,
  fromCol: ColId, toCol: ColId,
  flyRef: React.RefObject<HTMLDivElement | null>,
  cb: () => void,
) {
  if (legs.length === 0) { cb(); return; }
  const sz = 42;
  let pending = 0;
  let finished = false;
  const finishOne = () => { pending -= 1; if (pending <= 0 && !finished) { finished = true; cb(); } };

  legs.forEach((leg, i) => {
    const fromEl = document.querySelector(`[data-cell="${leg.rowId}:${fromCol}"]`);
    const toEl = document.querySelector(`[data-cell="${leg.rowId}:${toCol}"]`);

    const fly = i === 0 ? flyRef.current : document.createElement("div");
    if (!fromEl || !toEl || !fly) return;
    if (i !== 0) document.body.appendChild(fly);
    pending += 1;
    const fr = fromEl.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();
    fly.innerHTML = makePieTokenSVG(leg.rowId, leg.units, fromCol, sz);
    fly.style.cssText = `position:fixed;pointer-events:none;z-index:999;width:${sz}px;height:${sz}px;left:${fr.left + (fr.width - sz) / 2}px;top:${fr.top + (fr.height - sz) / 2}px;opacity:1;transition:none;`;
    requestAnimationFrame(() => {
      fly.style.transition = "left 0.22s cubic-bezier(0.4,0,0.2,1),top 0.22s cubic-bezier(0.4,0,0.2,1)";
      fly.style.left = (tr.left + (tr.width - sz) / 2) + "px";
      fly.style.top = (tr.top + (tr.height - sz) / 2) + "px";
      setTimeout(() => {
        fly.style.opacity = "0";
        fly.innerHTML = "";
        if (i !== 0 && fly.parentNode) fly.parentNode.removeChild(fly);
        finishOne();
      }, 230);
    });
  });

  if (pending === 0 && !finished) { finished = true; cb(); }
}
