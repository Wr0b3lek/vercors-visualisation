// Author: Szymon Wróbel
import { describe, it, expect } from "vitest";

import {
  type EngineState,
  type LockInvariants,
  type RowId,
  type ScenarioId,
  type Tid,
  FULL,
  HALF,
  SCENARIOS,
  applyMove,
  gu,
  handleCellClick,
  handleTokenClick,
  isBlocked,
  lockInvariant,
  lockStatus,
  mkRaceState,
  mkState,
  placeInitialToken,
  placeHalfToken,
  pickUpInitialToken,
  pickUpHalfToken,
  moveHalfFromCell,
  halvesInTray,
  placementRationale,
  revealHint,
  raceThreadDone,
  startRun,
  stepAnnotation,
  stepRaceThread,
  verifyStep,
} from "./engine";

function stageCanonicalFractional(s: EngineState): EngineState {
  let r = s;
  const place = (rowId: RowId, lockCol: "L1" | "L2") => {
    r = placeHalfToken(r, rowId, 0, lockCol);
    r = placeHalfToken(r, rowId, 1, "T4");
  };
  place("M1", "L1");
  place("M2", "L2");
  place("M3", "L2");
  return r;
}

function canonicalInvariants(scenario: ScenarioId): LockInvariants {
  return scenario === "fractional"
    ? { L1: { M1: HALF }, L2: { M2: HALF, M3: HALF } }
    : { L1: { M1: FULL }, L2: { M2: FULL, M3: FULL } };
}

function mkRun(
  scenario: ScenarioId,
  selectedThread: Tid,
  stepIdx: Partial<Record<Tid, number>> = {},
  lockHolder: Partial<Record<"L1" | "L2", Tid | null>> = {},
): EngineState {
  const s = mkState(scenario);
  return {
    ...s,
    phase: "run",
    selectedThread,
    stepIdx: { ...s.stepIdx, ...stepIdx },
    lockInvariants: canonicalInvariants(scenario),
    lockHolder: { L1: null, L2: null, ...lockHolder },
  };
}

describe("mkState", () => {
  it("starts in setup with an empty board and the scenario's initial memory", () => {
    const s = mkState("standard");
    expect(s.phase).toBe("setup");
    expect(s.memory).toEqual({ M1: 100, M2: 50, M3: 20 });
    expect(gu(s, "M1", "L1")).toBe(0);
    expect(s.stepIdx).toEqual({ T1: 0, T2: 0, T3: 0, T4: 0 });
    expect(s.lockInvariants).toEqual({ L1: {}, L2: {} });
  });
});

describe("placeInitialToken + startRun", () => {
  it("places tokens into dist during setup and snapshots each lock's invariant", () => {
    let r = placeInitialToken(mkState("standard"), "M1", "M1", "L1");
    r = placeInitialToken(r, "M2", "M2", "L2");
    r = placeInitialToken(r, "M3", "M3", "L2");
    r = startRun(r);
    expect(r.phase).toBe("run");
    expect(gu(r, "M1", "L1")).toBe(FULL);

    expect(r.lockInvariants).toEqual({ L1: { M1: FULL }, L2: { M2: FULL, M3: FULL } });
  });

  it("captures whatever the student placed, even a mis-placement", () => {

    let r = placeInitialToken(mkState("standard"), "M1", "M1", "L1");
    r = placeInitialToken(r, "M2", "M2", "L2");
    r = placeInitialToken(r, "M3", "M3", "L1");
    r = startRun(r);
    expect(r.lockInvariants).toEqual({ L1: { M1: FULL, M3: FULL }, L2: { M2: FULL } });
  });
});

describe("Fractional setup — manual half-token placement", () => {
  it("starts every row in the tray with two unplaced halves", () => {
    const s = mkState("fractional");
    expect(halvesInTray(s, "M1")).toEqual([0, 1]);
    expect(halvesInTray(s, "M2")).toEqual([0, 1]);
    expect(halvesInTray(s, "M3")).toEqual([0, 1]);
  });

  it("placing both halves into one cell stacks to FULL", () => {
    let r = mkState("fractional");
    r = placeHalfToken(r, "M1", 0, "L1");
    r = placeHalfToken(r, "M1", 1, "L1");
    expect(gu(r, "M1", "L1")).toBe(FULL);
    expect(halvesInTray(r, "M1")).toEqual([]);
  });

  it("places halves into separate cells and snapshots ½ per lock at startRun", () => {
    const r = startRun(stageCanonicalFractional(mkState("fractional")));
    expect(gu(r, "M1", "L1")).toBe(HALF);
    expect(gu(r, "M1", "T4")).toBe(HALF);
    expect(gu(r, "M2", "L2")).toBe(HALF);
    expect(gu(r, "M3", "L2")).toBe(HALF);
    expect(gu(r, "M2", "T4")).toBe(HALF);
    expect(gu(r, "M3", "T4")).toBe(HALF);

    expect(r.lockInvariants).toEqual({ L1: { M1: HALF }, L2: { M2: HALF, M3: HALF } });
  });

  it("pickUpHalfToken returns one half to the tray and clears HALF from dist", () => {
    let r = mkState("fractional");
    r = placeHalfToken(r, "M1", 0, "L1");
    r = placeHalfToken(r, "M1", 1, "T4");
    r = pickUpHalfToken(r, "M1", 1);
    expect(gu(r, "M1", "T4")).toBe(0);
    expect(gu(r, "M1", "L1")).toBe(HALF);
    expect(halvesInTray(r, "M1")).toEqual([1]);
  });

  it("pickUpInitialToken returns BOTH halves at once", () => {
    let r = mkState("fractional");
    r = placeHalfToken(r, "M1", 0, "L1");
    r = placeHalfToken(r, "M1", 1, "T4");
    r = pickUpInitialToken(r, "M1");
    expect(gu(r, "M1", "L1")).toBe(0);
    expect(gu(r, "M1", "T4")).toBe(0);
    expect(halvesInTray(r, "M1")).toEqual([0, 1]);
  });

  it("moveHalfFromCell routes one half from a stacked-FULL cell to a destination", () => {
    let r = mkState("fractional");
    r = placeHalfToken(r, "M1", 0, "L1");
    r = placeHalfToken(r, "M1", 1, "L1");
    expect(gu(r, "M1", "L1")).toBe(FULL);
    r = moveHalfFromCell(r, "M1", "L1", "T4");
    expect(gu(r, "M1", "L1")).toBe(HALF);
    expect(gu(r, "M1", "T4")).toBe(HALF);
  });

  it("moveHalfFromCell with dest=\"tray\" returns one half from a stacked cell", () => {
    let r = mkState("fractional");
    r = placeHalfToken(r, "M1", 0, "L1");
    r = placeHalfToken(r, "M1", 1, "L1");
    r = moveHalfFromCell(r, "M1", "L1", "tray");
    expect(gu(r, "M1", "L1")).toBe(HALF);
    expect(halvesInTray(r, "M1").length).toBe(1);
  });

  it("moveHalfFromCell from a single-HALF cell leaves the other half alone", () => {
    let r = mkState("fractional");
    r = placeHalfToken(r, "M1", 0, "L1");
    r = placeHalfToken(r, "M1", 1, "T4");
    r = moveHalfFromCell(r, "M1", "L1", "tray");
    expect(gu(r, "M1", "L1")).toBe(0);
    expect(gu(r, "M1", "T4")).toBe(HALF);
    expect(halvesInTray(r, "M1").length).toBe(1);
  });
});

describe("deferred failure (Fractional) — misplacement fails at access", () => {
  it("a writer's half placed in T1 instead of T4 → write rejects with 'race risk'", () => {
    let r = mkState("fractional");

    r = placeHalfToken(r, "M1", 0, "L1");
    r = placeHalfToken(r, "M1", 1, "T1");
    r = placeHalfToken(r, "M2", 0, "L2");
    r = placeHalfToken(r, "M2", 1, "T4");
    r = placeHalfToken(r, "M3", 0, "L2");
    r = placeHalfToken(r, "M3", 1, "T4");
    r = startRun(r);

    r = { ...r, selectedThread: "T4", stepIdx: { ...r.stepIdx, T4: 2 } };
    r.dist.M1.T4 = HALF;
    const res = verifyStep(r);
    expect(res.success).toBe(false);
    expect(res.message ?? "").toContain("race risk");
  });

  it("a half placed in the wrong lock → reader's read holds nothing → reject", () => {
    let r = mkState("fractional");

    r = placeHalfToken(r, "M1", 0, "L2");
    r = placeHalfToken(r, "M1", 1, "T4");
    r = placeHalfToken(r, "M2", 0, "L2");
    r = placeHalfToken(r, "M2", 1, "T4");
    r = placeHalfToken(r, "M3", 0, "L2");
    r = placeHalfToken(r, "M3", 1, "T4");
    r = startRun(r);

    r = { ...r, selectedThread: "T1", stepIdx: { ...r.stepIdx, T1: 1 } };
    const res = verifyStep(r);
    expect(res.success).toBe(false);
    expect(res.message ?? "").toContain("no permission");
  });
});

describe("applyMove (multi-leg, atomic)", () => {
  it("moves a single leg and clears the pending selection", () => {
    const s = mkRun("standard", "T1");
    s.dist.M1.L1 = FULL;
    const r = applyMove(s, "L1", "T1", [{ rowId: "M1", units: FULL }]);
    expect(gu(r, "M1", "L1")).toBe(0);
    expect(gu(r, "M1", "T1")).toBe(FULL);
    expect(r.selectedMove).toBeNull();
    expect(r.flowMessages.length).toBe(1);
  });

  it("moves every leg of a two-token lock at once", () => {
    const s = mkRun("standard", "T3");
    s.dist.M2.L2 = FULL;
    s.dist.M3.L2 = FULL;
    const r = applyMove(s, "L2", "T3", [{ rowId: "M2", units: FULL }, { rowId: "M3", units: FULL }]);
    expect(gu(r, "M2", "L2")).toBe(0);
    expect(gu(r, "M3", "L2")).toBe(0);
    expect(gu(r, "M2", "T3")).toBe(FULL);
    expect(gu(r, "M3", "T3")).toBe(FULL);
    expect(r.flowMessages.length).toBe(2);
  });
});

describe("per-row pickup — multi-token lock requires one move per variable", () => {
  it("single-row lock: one pickup, one drop, verify advances", () => {
    let s = mkState("standard");
    s = placeInitialToken(s, "M1", "M1", "L1");
    s = placeInitialToken(s, "M2", "M2", "L2");
    s = placeInitialToken(s, "M3", "M3", "L2");
    s = startRun(s);
    s = { ...s, selectedThread: "T1" };

    s = handleTokenClick(s, "M1", "L1");
    expect(s.selectedMove).toEqual({ sourceCol: "L1", legs: [{ rowId: "M1", units: FULL }] });
    const click = handleCellClick(s, "M1", "T1");
    expect(click.animate).toEqual({ fromCol: "L1", toCol: "T1", legs: [{ rowId: "M1", units: FULL }] });
    s = applyMove(click.state, "L1", "T1", click.animate!.legs);
    expect(verifyStep(s).success).toBe(true);
  });

  it("lock L2 requires moving Pb and Pc separately (one row per pickup)", () => {
    let s = mkState("standard");
    s = placeInitialToken(s, "M1", "M1", "L1");
    s = placeInitialToken(s, "M2", "M2", "L2");
    s = placeInitialToken(s, "M3", "M3", "L2");
    s = startRun(s);
    s = { ...s, selectedThread: "T3" };

    s = handleTokenClick(s, "M2", "L2");
    expect(s.selectedMove).toEqual({ sourceCol: "L2", legs: [{ rowId: "M2", units: FULL }] });
    const click1 = handleCellClick(s, "M2", "T3");
    expect(click1.animate?.legs).toEqual([{ rowId: "M2", units: FULL }]);
    s = applyMove(click1.state, "L2", "T3", click1.animate!.legs);
    expect(gu(s, "M2", "T3")).toBe(FULL);
    expect(gu(s, "M3", "L2")).toBe(FULL);

    const partial = verifyStep(s);
    expect(partial.success).toBe(false);
    expect(partial.message ?? "").toContain("Pc");

    s = handleTokenClick(s, "M3", "L2");
    expect(s.selectedMove).toEqual({ sourceCol: "L2", legs: [{ rowId: "M3", units: FULL }] });
    const click2 = handleCellClick(s, "M3", "T3");
    s = applyMove(click2.state, "L2", "T3", click2.animate!.legs);
    expect(gu(s, "M3", "T3")).toBe(FULL);

    expect(verifyStep(s).success).toBe(true);
  });

  it("lock verify rejects until the thread holds the WHOLE invariant", () => {

    const partial = mkRun("standard", "T3");
    partial.dist.M2.T3 = FULL;
    expect(verifyStep(partial).success).toBe(false);

    const whole = mkRun("standard", "T3");
    whole.dist.M2.T3 = FULL;
    whole.dist.M3.T3 = FULL;
    expect(verifyStep(whole).success).toBe(true);
  });
});

describe("deferred failure — misplacement fails at access, not at lock", () => {
  it("a misplaced Pc lets lock L2 succeed but write c reject", () => {

    let s = mkState("standard");
    s = placeInitialToken(s, "M1", "M1", "L1");
    s = placeInitialToken(s, "M2", "M2", "L2");
    s = placeInitialToken(s, "M3", "M3", "L1");
    s = startRun(s);
    s = { ...s, selectedThread: "T3" };

    s = handleTokenClick(s, "M2", "L2");
    const click = handleCellClick(s, "M2", "T3");
    s = applyMove(click.state, "L2", "T3", click.animate!.legs);
    const lockRes = verifyStep(s);
    expect(lockRes.success).toBe(true);

    const writeC = verifyStep(lockRes.state);
    expect(writeC.success).toBe(false);
    expect(writeC.message ?? "").toContain("Thread 2");
    expect(writeC.message ?? "").toContain("c");
  });
});

describe("atomic unlock — returns the whole invariant", () => {
  it("rejects until every borrowed token is back, then succeeds", () => {

    const partial = mkRun("standard", "T3", { T3: 3 }, { L2: "T3" });
    partial.dist.M2.L2 = FULL;
    partial.dist.M3.T3 = FULL;
    expect(verifyStep(partial).success).toBe(false);

    const whole = mkRun("standard", "T3", { T3: 3 }, { L2: "T3" });
    whole.dist.M2.L2 = FULL;
    whole.dist.M3.L2 = FULL;
    expect(verifyStep(whole).success).toBe(true);
  });
});

describe("Fractional reader — borrow ½, read, return ½", () => {
  it("lock hands the reader the lock's ½ and verify advances", () => {
    const s = mkRun("fractional", "T1");
    s.dist.M1.T1 = HALF;
    expect(verifyStep(s).success).toBe(true);
  });

  it("read accepts any positive share", () => {
    const s = mkRun("fractional", "T1", { T1: 1 });
    s.dist.M1.T1 = HALF;
    expect(verifyStep(s).success).toBe(true);
  });

  it("unlock requires the lock's ½ to be back", () => {
    const back = mkRun("fractional", "T1", { T1: 2 }, { L1: "T1" });
    back.dist.M1.L1 = HALF;
    expect(verifyStep(back).success).toBe(true);

    const notBack = mkRun("fractional", "T1", { T1: 2 }, { L1: "T1" });
    notBack.dist.M1.L1 = 0;
    notBack.dist.M1.T1 = HALF;
    expect(verifyStep(notBack).success).toBe(false);
  });
});

describe("Fractional writer — combine ½ + ½ = full, keep ½ on unlock", () => {
  it("lock combines the writer's ½ with the lock's ½ to reach FULL", () => {
    const s = mkRun("fractional", "T4");
    s.dist.M1.T4 = HALF;
    s.dist.M1.L1 = HALF;

    const moved = applyMove(s, "L1", "T4", [{ rowId: "M1", units: HALF }]);
    expect(gu(moved, "M1", "T4")).toBe(FULL);
    expect(verifyStep(moved).success).toBe(true);
  });

  it("write a succeeds with the reconstructed full token", () => {
    const s = mkRun("fractional", "T4", { T4: 2 });
    s.dist.M1.T4 = FULL;
    const res = verifyStep(s);
    expect(res.success).toBe(true);
    expect(res.state.memory.M1).toBe(105);
  });

  it("unlock returns exactly the ½ and the writer keeps its ½", () => {

    const s = mkRun("fractional", "T4", { T4: 6 }, { L1: "T4" });
    s.dist.M1.T4 = FULL;
    const moved = applyMove(s, "T4", "L1", [{ rowId: "M1", units: HALF }]);
    expect(gu(moved, "M1", "T4")).toBe(HALF);
    expect(gu(moved, "M1", "L1")).toBe(HALF);
    expect(verifyStep(moved).success).toBe(true);
  });
});

describe("per-lock mutex (lockHolder)", () => {
  it("rejects lock(L) on a thread when another thread is already inside the critical section", () => {

    const s = mkRun("standard", "T2", {}, { L1: "T1" });
    s.dist.M1.L1 = 0;
    s.dist.M1.T1 = FULL;
    s.dist.M1.T2 = FULL;
    const res = verifyStep(s);
    expect(res.success).toBe(false);
    expect(res.message ?? "").toContain("mutex");
    expect(res.message ?? "").toContain("Thread 0");
  });

  it("rejects vacuous lock when the thread already holds the snapshot from setup", () => {

    const s = mkRun("fractional", "T4");
    s.dist.M1.T4 = HALF;
    s.dist.M1.L1 = HALF;
    const res = verifyStep(s);
    expect(res.success).toBe(false);
    expect(res.message ?? "").toContain("hasn't been acquired");
  });

  it("a successful lock+unlock cycle clears the holder so the next thread can lock", () => {

    let s = mkRun("standard", "T1");
    s.dist.M1.L1 = FULL;
    s = handleTokenClick(s, "M1", "L1");
    const c1 = handleCellClick(s, "M1", "T1");
    s = applyMove(c1.state, "L1", "T1", c1.animate!.legs);
    s = verifyStep(s).state;
    expect(s.lockHolder.L1).toBe("T1");

    s = { ...s, stepIdx: { ...s.stepIdx, T1: 5 } };

    const c2 = handleCellClick({ ...s, selectedMove: { sourceCol: "T1", legs: [{ rowId: "M1", units: FULL }] } }, "M1", "L1");
    s = applyMove(c2.state, "T1", "L1", c2.animate!.legs);
    s = verifyStep(s).state;
    expect(s.lockHolder.L1).toBeNull();

    let s2: EngineState = { ...s, selectedThread: "T2" };
    s2 = handleTokenClick(s2, "M1", "L1");
    const c3 = handleCellClick(s2, "M1", "T2");
    s2 = applyMove(c3.state, "L1", "T2", c3.animate!.legs);
    expect(verifyStep(s2).success).toBe(true);
  });

  it("unlock by a non-holder rejects with a holder-specific diagnostic", () => {

    const s = mkRun("standard", "T1", { T1: 5 });
    s.dist.M1.L1 = FULL;
    const res = verifyStep(s);
    expect(res.success).toBe(false);
    expect(res.message ?? "").toContain("doesn't hold");
  });
});

describe("isBlocked — per-lock mutex", () => {
  it("Standard: a held lock blocks the next thread", () => {
    const blocked = mkRun("standard", "T1");
    blocked.dist.M1.L1 = 0;
    blocked.dist.M1.T2 = FULL;
    expect(isBlocked(blocked, "T1")).toBe(true);

    const free = mkRun("standard", "T1");
    free.dist.M1.L1 = FULL;
    expect(isBlocked(free, "T1")).toBe(false);
  });

  it("Fractional: readers are sequential — a borrowed ½ blocks the next locker", () => {
    const blocked = mkRun("fractional", "T2");
    blocked.dist.M1.L1 = 0;
    blocked.dist.M1.T1 = HALF;
    expect(isBlocked(blocked, "T2")).toBe(true);

    const free = mkRun("fractional", "T2");
    free.dist.M1.L1 = HALF;
    free.dist.M1.T4 = HALF;
    expect(isBlocked(free, "T2")).toBe(false);
  });
});

describe("lockStatus", () => {
  it("free when the lock holds its whole invariant", () => {
    const free = mkRun("standard", "T1");
    free.dist.M1.L1 = FULL;
    expect(lockStatus(free, "L1")).toEqual({ held: false, holder: null });
  });

  it("held + names the single holder when checked out", () => {
    const held = mkRun("standard", "T1");
    held.dist.M1.L1 = 0;
    held.dist.M1.T1 = FULL;
    expect(lockStatus(held, "L1")).toEqual({ held: true, holder: "T1" });
  });

  it("the writer's permanent ½ does not make the lock look held", () => {
    const s = mkRun("fractional", "T4");
    s.dist.M1.L1 = HALF;
    s.dist.M1.T4 = HALF;
    expect(lockStatus(s, "L1")).toEqual({ held: false, holder: null });
  });
});

describe("stepAnnotation", () => {
  const std = mkState("standard");
  const frac = mkState("fractional");
  const stdT1 = SCENARIOS.standard.threads.T1.steps;
  const stdT3 = SCENARIOS.standard.threads.T3.steps;
  const fracT1 = SCENARIOS.fractional.threads.T1.steps;

  it("write → requires Perm(x, write)", () => {
    expect(stepAnnotation(std, stdT1[2])).toBe("//@ requires Perm(a, write);");
  });
  it("lock (full) → inhale Perm(x, write) over the protected rows", () => {
    expect(stepAnnotation(std, stdT1[0])).toBe("//@ inhale Perm(a, write);");
  });
  it("a two-variable lock annotates both clauses at once", () => {

    expect(stepAnnotation(std, stdT3[0])).toBe("//@ inhale Perm(b, write) ** Perm(c, write);");
  });
  it("unlock → exhale Perm(x, write)", () => {
    expect(stepAnnotation(std, stdT1[4])).toBe("//@ exhale Perm(b, write) ** Perm(c, write);");
  });
  it("read → requires Perm(x, read)", () => {
    expect(stepAnnotation(frac, fracT1[1])).toBe("//@ requires Perm(a, read);");
  });
  it("read-lock (fractional) → inhale Perm(x, read), not a fixed fraction", () => {
    expect(stepAnnotation(frac, fracT1[0])).toBe("//@ inhale Perm(a, read);");
  });
});

describe("pickup + destination gates", () => {
  it("rejects pickup from a column that isn't the lock step's source", () => {
    const s = mkRun("standard", "T1");
    s.dist.M1.T2 = FULL;
    const after = handleTokenClick(s, "M1", "T2");
    expect(after.selectedMove).toBeNull();
  });

  it("lock destination accepts any thread column (wrong-thread drop → failed verify)", () => {
    let s = mkRun("standard", "T1");
    s.dist.M1.L1 = FULL;
    s = handleTokenClick(s, "M1", "L1");
    const click = handleCellClick(s, "M1", "T2");
    expect(click.animate).toEqual({ fromCol: "L1", toCol: "T2", legs: [{ rowId: "M1", units: FULL }] });
    const moved = applyMove(click.state, "L1", "T2", click.animate!.legs);
    const res = verifyStep(moved);
    expect(res.success).toBe(false);
  });

  it("lock destination accepts the other lock column (wrong-lock drop → failed verify)", () => {

    let s = mkRun("standard", "T1");
    s.dist.M1.L1 = FULL;
    s = handleTokenClick(s, "M1", "L1");
    const click = handleCellClick(s, "M1", "L2");
    expect(click.animate).toEqual({ fromCol: "L1", toCol: "L2", legs: [{ rowId: "M1", units: FULL }] });
    const moved = applyMove(click.state, "L1", "L2", click.animate!.legs);
    const res = verifyStep(moved);
    expect(res.success).toBe(false);
    expect(res.message ?? "").toContain("Thread 0");
  });

  it("unlock destination accepts a thread column (wrong-thread drop → failed verify)", () => {

    const s = mkRun("standard", "T1", { T1: 5 }, { L1: "T1" });
    s.dist.M1.T1 = FULL;
    const picked = handleTokenClick(s, "M1", "T1");
    expect(picked.selectedMove).not.toBeNull();
    const click = handleCellClick(picked, "M1", "T2");
    expect(click.animate).toEqual({ fromCol: "T1", toCol: "T2", legs: [{ rowId: "M1", units: FULL }] });
    const moved = applyMove(click.state, "T1", "T2", click.animate!.legs);
    const res = verifyStep(moved);
    expect(res.success).toBe(false);
    expect(res.message ?? "").toContain("Lock 1 is still missing");
  });
});

describe("verifyStep — write diagnostics", () => {
  it("partial holding mentions 'race risk'", () => {
    const s = mkRun("standard", "T1", { T1: 2 });
    s.dist.M1.T1 = HALF;
    const r = verifyStep(s);
    expect(r.success).toBe(false);
    expect(r.message ?? "").toContain("race risk");
  });

  it("holding nothing points at the setup placement", () => {
    const s = mkRun("standard", "T1", { T1: 2 });
    const r = verifyStep(s);
    expect(r.success).toBe(false);
    expect(r.message ?? "").toContain("Thread 0");
    expect(r.message ?? "").toContain("setup");
  });
});

describe("lockInvariant (used by the Hint rationale only)", () => {
  it("falls back to the canonically-protected rows during setup", () => {
    const s = mkState("standard");
    expect(lockInvariant(s, "L1")).toBe("Perm(a, write)");
    expect(lockInvariant(s, "L2")).toBe("Perm(b, write) ** Perm(c, write)");
  });

  it("reflects the snapshot at run time", () => {
    const s = mkRun("standard", "T1");
    expect(lockInvariant(s, "L2")).toBe("Perm(b, write) ** Perm(c, write)");
  });
});

describe("placementRationale", () => {
  it("explains a write step via the lock that owns the permission", () => {
    const s = mkState("standard");
    const step = SCENARIOS.standard.threads.T1.steps[2];
    const r = placementRationale(s, step);
    expect(r.short).toContain("a");
    expect(r.short).toContain("Lock 1");
    expect(r.long.length).toBeGreaterThan(40);
  });

  it("describes the whole invariant for a lock step", () => {
    const s = mkState("standard");
    const step = SCENARIOS.standard.threads.T3.steps[0];
    const r = placementRationale(s, step);
    expect(r.short).toContain("Lock 2");
    expect(r.short).toContain("Perm(b, write)");
    expect(r.short).toContain("Perm(c, write)");
  });
});

describe("revealHint cap is configurable", () => {
  it("respects the maxLevel argument (defaults to 2)", () => {
    const s = mkRun("standard", "T1");
    const oneLevel = revealHint(s, 1);
    expect(oneLevel.hintLevel).toBe(1);
    const stillOne = revealHint(oneLevel, 1);
    expect(stillOne.hintLevel).toBe(1);

    const fourLevels = revealHint(s, 4);
    expect(fourLevels.hintLevel).toBe(1);
    const two = revealHint(fourLevels, 4);
    expect(two.hintLevel).toBe(2);
  });
});

describe("stepRaceThread", () => {
  it("a thread run alone produces the correct (atomic) result", () => {
    let r = mkRaceState();
    while (!raceThreadDone(r, "T1")) r = stepRaceThread(r, "T1");
    expect(r.memory.M1).toBe(80);
    expect(r.memory.M2).toBe(70);
  });

  it("interleaved load/store exposes a lost update", () => {
    let r = mkRaceState();
    r = stepRaceThread(r, "T1");
    r = stepRaceThread(r, "T2");
    r = stepRaceThread(r, "T1");
    r = stepRaceThread(r, "T2");
    expect(r.memory.M1).toBe(70);
    const last = r.trace[r.trace.length - 1];
    expect(last.isStale).toBe(true);
  });
});
