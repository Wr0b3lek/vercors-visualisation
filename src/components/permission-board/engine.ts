// Author: Szymon Wróbel
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

export const DENOM = 12;
export const FULL = 12;
export const HALF = 6;
export const THIRD = 4;
export const QUART = 3;

export type Tid = "T1" | "T2" | "T3" | "T4";
export type ColId = "L1" | "L2" | "T1" | "T2" | "T3" | "T4";
export type RowId = "M1" | "M2" | "M3";
export type LogTone = "info" | "success" | "error" | "unsafe" | "hint";

export const THREAD_IDS: Tid[] = ["T1", "T2", "T3", "T4"];
export const COL_IDS: ColId[] = ["L1", "L2", "T1", "T2", "T3", "T4"];

export function fracLabel(units: number): string {
  if (units <= 0) return "0";
  if (units >= FULL) return "full";
  if (units === HALF) return "½";
  if (units === THIRD) return "⅓";
  if (units === QUART) return "¼";
  if (units === 9) return "¾";
  if (units === 8) return "⅔";
  return `${units}/${DENOM}`;
}

export interface RowDef {
  id: RowId;
  label: string;
  semanticName: string;
  protectedBy: "L1" | "L2";
}

export interface ColDef {
  id: ColId;
  label: string;
  kind: "lock" | "thread";
}

export interface CodeLine {
  num: number;
  text: string;
  kind: "comment" | "code" | "frame";

  stepIds: string[];
}

export interface StepDef {
  id: string;

  rowId?: RowId;
  lockId: "L1" | "L2";
  action: "lock" | "read" | "write" | "unlock";

  requiredUnits: number;
  memoryDelta: number | null;
  code: string;
  hints: [string, string, string];
}

export interface ThreadDef {
  id: Tid;
  label: string;
  codeLines: CodeLine[];
  steps: StepDef[];
}

export const ROWS: RowDef[] = [
  { id: "M1", label: "a", semanticName: "Variable a", protectedBy: "L1" },
  { id: "M2", label: "b", semanticName: "Variable b", protectedBy: "L2" },
  { id: "M3", label: "c", semanticName: "Variable c", protectedBy: "L2" },
];

export const COLUMNS: ColDef[] = [
  { id: "L1", label: "Lock 1", kind: "lock" },
  { id: "L2", label: "Lock 2", kind: "lock" },
  { id: "T1", label: "Thread 0", kind: "thread" },
  { id: "T2", label: "Thread 1", kind: "thread" },
  { id: "T3", label: "Thread 2", kind: "thread" },
  { id: "T4", label: "Thread 3", kind: "thread" },
];

export const THREADS: Record<Tid, ThreadDef> = {
  T1: {
    id: "T1", label: "Thread 0",
    codeLines: [
      { num: 1, text: "context Value(L1) ** Value(L2);", kind: "frame", stepIds: [] },
      { num: 2, text: "void run() {", kind: "frame", stepIds: [] },
      { num: 3, text: "  lock L1;", kind: "code", stepIds: ["t0-lock-1"] },
      { num: 4, text: "  lock L2;", kind: "code", stepIds: ["t0-lock-2"] },
      { num: 5, text: "  a := a - 20;", kind: "code", stepIds: ["t0-write-a"] },
      { num: 6, text: "  b := b + 20;", kind: "code", stepIds: ["t0-write-b"] },
      { num: 7, text: "  unlock L2;", kind: "code", stepIds: ["t0-unlock-2"] },
      { num: 8, text: "  unlock L1;", kind: "code", stepIds: ["t0-unlock-1"] },
      { num: 9, text: "}", kind: "frame", stepIds: [] },
    ],
    steps: [
      { id: "t0-lock-1", lockId: "L1", action: "lock", requiredUnits: FULL, memoryDelta: null, code: "lock(L1);", hints: ["This thread accesses variable a, protected by L1.", "lock(L1) takes everything L1 holds in one move.", "Click or drag L1 to move its whole invariant onto Thread 0."] },
      { id: "t0-lock-2", lockId: "L2", action: "lock", requiredUnits: FULL, memoryDelta: null, code: "lock(L2);", hints: ["The transfer also changes variable b, protected by L2.", "lock(L2) takes the lock's whole invariant at once — even tokens this thread won't use.", "Click or drag L2 to move it all onto Thread 0."] },
      { id: "t0-write-a", rowId: "M1", lockId: "L1", action: "write", requiredUnits: FULL, memoryDelta: -20, code: "a = a - 20;", hints: ["Thread 0 must hold the full a permission to write a.", "Writing requires the full permission token.", "Press Verify Step."] },
      { id: "t0-write-b", rowId: "M2", lockId: "L2", action: "write", requiredUnits: FULL, memoryDelta: 20, code: "b = b + 20;", hints: ["Thread 0 must hold the full b permission to write b.", "Depositing is a write.", "Press Verify Step."] },
      { id: "t0-unlock-2", lockId: "L2", action: "unlock", requiredUnits: FULL, memoryDelta: null, code: "unlock(L2);", hints: ["Thread 0 is done with L2.", "unlock(L2) returns everything L2 gave you in one move.", "Click or drag the held L2 tokens back to L2."] },
      { id: "t0-unlock-1", lockId: "L1", action: "unlock", requiredUnits: FULL, memoryDelta: null, code: "unlock(L1);", hints: ["Now release L1.", "unlock(L1) returns its whole invariant.", "Move the held L1 token back to L1."] },
    ],
  },
  T2: {
    id: "T2", label: "Thread 1",
    codeLines: [
      { num: 1, text: "context Value(L1) ** Value(L2);", kind: "frame", stepIds: [] },
      { num: 2, text: "void run() {", kind: "frame", stepIds: [] },
      { num: 3, text: "  lock L1;", kind: "code", stepIds: ["t1-lock-1"] },
      { num: 4, text: "  lock L2;", kind: "code", stepIds: ["t1-lock-2"] },
      { num: 5, text: "  a := a - 30;", kind: "code", stepIds: ["t1-write-a"] },
      { num: 6, text: "  c := c + 30;", kind: "code", stepIds: ["t1-write-c"] },
      { num: 7, text: "  unlock L2;", kind: "code", stepIds: ["t1-unlock-2"] },
      { num: 8, text: "  unlock L1;", kind: "code", stepIds: ["t1-unlock-1"] },
      { num: 9, text: "}", kind: "frame", stepIds: [] },
    ],
    steps: [
      { id: "t1-lock-1", lockId: "L1", action: "lock", requiredUnits: FULL, memoryDelta: null, code: "lock(L1);", hints: ["This thread starts by claiming variable a, protected by L1.", "lock(L1) takes the lock's whole invariant at once.", "Click or drag L1 onto Thread 1."] },
      { id: "t1-lock-2", lockId: "L2", action: "lock", requiredUnits: FULL, memoryDelta: null, code: "lock(L2);", hints: ["The transfer also writes variable c, protected by L2.", "lock(L2) takes every token L2 holds in one move.", "Click or drag L2 onto Thread 1."] },
      { id: "t1-write-a", rowId: "M1", lockId: "L1", action: "write", requiredUnits: FULL, memoryDelta: -30, code: "a = a - 30;", hints: ["Thread 1 must hold the full a permission to write a.", "Writing requires the full permission token.", "Press Verify Step."] },
      { id: "t1-write-c", rowId: "M3", lockId: "L2", action: "write", requiredUnits: FULL, memoryDelta: 30, code: "c = c + 30;", hints: ["Now write variable c.", "Keep the full c permission token under Thread 1.", "Press Verify Step."] },
      { id: "t1-unlock-2", lockId: "L2", action: "unlock", requiredUnits: FULL, memoryDelta: null, code: "unlock(L2);", hints: ["Thread 1 is done with L2.", "unlock(L2) returns its whole invariant at once.", "Move the held L2 tokens back to L2."] },
      { id: "t1-unlock-1", lockId: "L1", action: "unlock", requiredUnits: FULL, memoryDelta: null, code: "unlock(L1);", hints: ["Now release L1.", "unlock(L1) returns its whole invariant.", "Move the held L1 token back to L1."] },
    ],
  },
  T3: {
    id: "T3", label: "Thread 2",
    codeLines: [
      { num: 1, text: "context Value(L2);", kind: "frame", stepIds: [] },
      { num: 2, text: "void run() {", kind: "frame", stepIds: [] },
      { num: 3, text: "  lock L2;", kind: "code", stepIds: ["t2-lock"] },
      { num: 4, text: "  c := c - 40;", kind: "code", stepIds: ["t2-write-c"] },
      { num: 5, text: "  b := b + 40;", kind: "code", stepIds: ["t2-write-b"] },
      { num: 6, text: "  unlock L2;", kind: "code", stepIds: ["t2-unlock"] },
      { num: 7, text: "}", kind: "frame", stepIds: [] },
    ],

    steps: [
      { id: "t2-lock", lockId: "L2", action: "lock", requiredUnits: FULL, memoryDelta: null, code: "lock(L2);", hints: ["lock(L2) grants Perm(b, write) ** Perm(c, write) atomically.", "Both tokens move together — you can't take just one.", "Click or drag L2 to move its whole invariant onto Thread 2."] },
      { id: "t2-write-c", rowId: "M3", lockId: "L2", action: "write", requiredUnits: FULL, memoryDelta: -40, code: "c = c - 40;", hints: ["Withdraw from variable c first.", "Keep the full c permission token under Thread 2.", "Press Verify Step."] },
      { id: "t2-write-b", rowId: "M2", lockId: "L2", action: "write", requiredUnits: FULL, memoryDelta: 40, code: "b = b + 40;", hints: ["Now deposit into variable b.", "Keep the full b permission token under Thread 2.", "Press Verify Step."] },
      { id: "t2-unlock", lockId: "L2", action: "unlock", requiredUnits: FULL, memoryDelta: null, code: "unlock(L2);", hints: ["unlock(L2) returns Pb and Pc together.", "Everything L2 gave you goes back in one move.", "Click or drag the held L2 tokens back to L2."] },
    ],
  },
  T4: {
    id: "T4", label: "Thread 3",
    codeLines: [
      { num: 1, text: "context Value(L2);", kind: "frame", stepIds: [] },
      { num: 2, text: "void run() {", kind: "frame", stepIds: [] },
      { num: 3, text: "  lock L2;", kind: "code", stepIds: ["t3-lock"] },
      { num: 4, text: "  b := b - 10;", kind: "code", stepIds: ["t3-write-b"] },
      { num: 5, text: "  c := c + 10;", kind: "code", stepIds: ["t3-write-c"] },
      { num: 6, text: "  unlock L2;", kind: "code", stepIds: ["t3-unlock"] },
      { num: 7, text: "}", kind: "frame", stepIds: [] },
    ],
    steps: [
      { id: "t3-lock", lockId: "L2", action: "lock", requiredUnits: FULL, memoryDelta: null, code: "lock(L2);", hints: ["lock(L2) grants Perm(b, write) ** Perm(c, write) atomically.", "Both tokens move together — you can't take just one.", "Click or drag L2 to move its whole invariant onto Thread 3."] },
      { id: "t3-write-b", rowId: "M2", lockId: "L2", action: "write", requiredUnits: FULL, memoryDelta: -10, code: "b = b - 10;", hints: ["Focus on variable b.", "The assignment writes variable b.", "Keep full b permission under Thread 3."] },
      { id: "t3-write-c", rowId: "M3", lockId: "L2", action: "write", requiredUnits: FULL, memoryDelta: 10, code: "c = c + 10;", hints: ["Now focus on variable c.", "Depositing into variable c is a write.", "Thread 3 needs the full c permission token."] },
      { id: "t3-unlock", lockId: "L2", action: "unlock", requiredUnits: FULL, memoryDelta: null, code: "unlock(L2);", hints: ["unlock(L2) returns Pb and Pc together.", "Everything L2 gave you goes back in one move.", "Click or drag the held L2 tokens back to L2."] },
    ],
  },
};

export const ROWS_FRACTIONAL: RowDef[] = [
  { id: "M1", label: "a", semanticName: "Variable a", protectedBy: "L1" },
  { id: "M2", label: "b", semanticName: "Variable b", protectedBy: "L2" },
  { id: "M3", label: "c", semanticName: "Variable c", protectedBy: "L2" },
];

export const THREADS_FRACTIONAL: Record<Tid, ThreadDef> = {

  T1: {
    id: "T1", label: "Thread 0",
    codeLines: [
      { num: 1, text: "context Value(L1);", kind: "frame", stepIds: [] },
      { num: 2, text: "void run() {", kind: "frame", stepIds: [] },
      { num: 3, text: "  lock L1;", kind: "code", stepIds: ["f-t0-lock"] },
      { num: 4, text: "  int v0 := a;", kind: "code", stepIds: ["f-t0-read"] },
      { num: 5, text: "  unlock L1;", kind: "code", stepIds: ["f-t0-unlock"] },
      { num: 6, text: "}", kind: "frame", stepIds: [] },
    ],
    steps: [
      { id: "f-t0-lock",   lockId: "L1", action: "lock",   requiredUnits: HALF, memoryDelta: null, code: "lock(L1);",
        hints: ["Reading a only needs a read permission: any positive share of Perm(a).", "lock(L1) hands you the lock's whole share — here that's ½ of a.", "Click or drag L1 to move its ½ onto Thread 0."] },
      { id: "f-t0-read",   rowId: "M1", lockId: "L1", action: "read",   requiredUnits: HALF, memoryDelta: null, code: "int v0 := a;",
        hints: ["Reading needs Perm(a, p) for any p > 0 — ½ is plenty.", "Thread 0 holds the ½ the lock gave it.", "Press Verify Step."] },
      { id: "f-t0-unlock", lockId: "L1", action: "unlock", requiredUnits: HALF, memoryDelta: null, code: "unlock(L1);",
        hints: ["Return Thread 0's ½ share back to L1.", "unlock(L1) returns exactly what the lock gave you.", "Click or drag the held L1 share back to L1."] },
    ],
  },

  T2: {
    id: "T2", label: "Thread 1",
    codeLines: [
      { num: 1, text: "context Value(L1);", kind: "frame", stepIds: [] },
      { num: 2, text: "void run() {", kind: "frame", stepIds: [] },
      { num: 3, text: "  lock L1;", kind: "code", stepIds: ["f-t1-lock"] },
      { num: 4, text: "  int v1 := a;", kind: "code", stepIds: ["f-t1-read"] },
      { num: 5, text: "  unlock L1;", kind: "code", stepIds: ["f-t1-unlock"] },
      { num: 6, text: "}", kind: "frame", stepIds: [] },
    ],
    steps: [
      { id: "f-t1-lock",   lockId: "L1", action: "lock",   requiredUnits: HALF, memoryDelta: null, code: "lock(L1);",
        hints: ["L1 is a mutex — Thread 1 can only lock it once Thread 0 has returned its share.", "lock(L1) hands you the lock's ½ of a.", "Click or drag L1 onto Thread 1."] },
      { id: "f-t1-read",   rowId: "M1", lockId: "L1", action: "read",   requiredUnits: HALF, memoryDelta: null, code: "int v1 := a;",
        hints: ["Any positive share suffices for a read.", "Thread 1 holds the ½ the lock gave it.", "Press Verify Step."] },
      { id: "f-t1-unlock", lockId: "L1", action: "unlock", requiredUnits: HALF, memoryDelta: null, code: "unlock(L1);",
        hints: ["Return Thread 1's ½ share back to L1.", "unlock(L1) returns exactly what the lock gave you.", "The writer can't lock until L1 holds its ½ again."] },
    ],
  },

  T3: {
    id: "T3", label: "Thread 2",
    codeLines: [
      { num: 1, text: "context Value(L2);", kind: "frame", stepIds: [] },
      { num: 2, text: "void run() {", kind: "frame", stepIds: [] },
      { num: 3, text: "  lock L2;", kind: "code", stepIds: ["f-t2-lock"] },
      { num: 4, text: "  int v2 := b + c;", kind: "code", stepIds: ["f-t2-read-b", "f-t2-read-c"] },
      { num: 5, text: "  unlock L2;", kind: "code", stepIds: ["f-t2-unlock"] },
      { num: 6, text: "}", kind: "frame", stepIds: [] },
    ],
    steps: [
      { id: "f-t2-lock",   lockId: "L2", action: "lock",   requiredUnits: HALF, memoryDelta: null, code: "lock(L2);",
        hints: ["Reading b and c needs a read share of each — any positive fraction.", "lock(L2) hands you its whole invariant: ½ of b AND ½ of c, together.", "Click or drag L2 to move both shares onto Thread 2."] },
      { id: "f-t2-read-b",   rowId: "M2", lockId: "L2", action: "read",   requiredUnits: HALF, memoryDelta: null, code: "read b;",
        hints: ["Reading b needs Perm(b, p) for any p > 0.", "Thread 2 holds the ½ share of b.", "Press Verify Step."] },
      { id: "f-t2-read-c",   rowId: "M3", lockId: "L2", action: "read",   requiredUnits: HALF, memoryDelta: null, code: "read c;",
        hints: ["Reading c needs Perm(c, p) for any p > 0.", "Thread 2 sums b + c into v2.", "Press Verify Step."] },
      { id: "f-t2-unlock", lockId: "L2", action: "unlock", requiredUnits: HALF, memoryDelta: null, code: "unlock(L2);",
        hints: ["unlock(L2) returns both ½ shares together.", "The writer cannot lock L2 until its ½ of b and c are both back.", "Click or drag the held L2 shares back to L2."] },
    ],
  },

  T4: {
    id: "T4", label: "Thread 3",
    codeLines: [
      { num: 1, text: "context Value(L1) ** Value(L2);", kind: "frame", stepIds: [] },
      { num: 2, text: "void run() {", kind: "frame", stepIds: [] },
      { num: 3, text: "  lock L1;", kind: "code", stepIds: ["f-t3-lock-1"] },
      { num: 4, text: "  lock L2;", kind: "code", stepIds: ["f-t3-lock-2"] },
      { num: 5, text: "  a := a + 5;", kind: "code", stepIds: ["f-t3-write-a"] },
      { num: 6, text: "  b := b + 3;", kind: "code", stepIds: ["f-t3-write-b"] },
      { num: 7, text: "  c := c + 2;", kind: "code", stepIds: ["f-t3-write-c"] },
      { num: 8, text: "  unlock L2;", kind: "code", stepIds: ["f-t3-unlock-2"] },
      { num: 9, text: "  unlock L1;", kind: "code", stepIds: ["f-t3-unlock-1"] },
      { num: 10, text: "}", kind: "frame", stepIds: [] },
    ],
    steps: [
      { id: "f-t3-lock-1", lockId: "L1", action: "lock", requiredUnits: FULL, memoryDelta: null, code: "lock(L1);",
        hints: ["Writer already holds ½ of a; lock(L1) supplies the missing ½ → the full token.", "Blocked until both readers return their shares so L1 holds its ½ again.", "Click or drag L1 — its ½ merges with the ½ you hold into a whole token."] },
      { id: "f-t3-lock-2", lockId: "L2", action: "lock", requiredUnits: FULL, memoryDelta: null, code: "lock(L2);",
        hints: ["lock(L2) hands over ½ of b AND ½ of c, completing both tokens.", "Each merges with the ½ you already hold → a full write permission.", "Click or drag L2 to move both shares onto Thread 3."] },
      { id: "f-t3-write-a", rowId: "M1", lockId: "L1", action: "write", requiredUnits: FULL, memoryDelta: 5, code: "a += 5;",
        hints: ["Writing a requires the full permission token.", "Thread 3 holds ½ + ½ = the whole token.", "Press Verify Step."] },
      { id: "f-t3-write-b", rowId: "M2", lockId: "L2", action: "write", requiredUnits: FULL, memoryDelta: 3, code: "b += 3;",
        hints: ["Writing b.", "Thread 3 holds the full permission token.", "Press Verify Step."] },
      { id: "f-t3-write-c", rowId: "M3", lockId: "L2", action: "write", requiredUnits: FULL, memoryDelta: 2, code: "c += 2;",
        hints: ["Writing c.", "Thread 3 holds the full permission token.", "Press Verify Step."] },
      { id: "f-t3-unlock-2", lockId: "L2", action: "unlock", requiredUnits: FULL, memoryDelta: null, code: "unlock(L2);",
        hints: ["unlock(L2) returns exactly the ½ of b and ½ of c the lock lent you.", "You keep your ½ of each.", "Click or drag the lock's shares back to L2."] },
      { id: "f-t3-unlock-1", lockId: "L1", action: "unlock", requiredUnits: FULL, memoryDelta: null, code: "unlock(L1);",
        hints: ["unlock(L1) returns the ½ of a the lock lent you.", "You keep your ½. All threads have finished.", "Click or drag the lock's share back to L1."] },
    ],
  },
};

export type ScenarioId = "standard" | "fractional";

export interface ScenarioDef {
  id: ScenarioId;
  label: string;
  rows: RowDef[];
  threads: Record<Tid, ThreadDef>;
  preamble: string[];
  initialMemory: Record<RowId, number>;
}

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  standard: {
    id: "standard",
    label: "Standard",
    rows: ROWS,
    threads: THREADS,
    preamble: [
      "int a, b, c;",
      "Lock L1, L2;",
      "",
      "resource L1_inv() = Perm(a, write);",
      "resource L2_inv() = Perm(b, write) ** Perm(c, write);",
    ],
    initialMemory: { M1: 100, M2: 50, M3: 20 },
  },
  fractional: {
    id: "fractional",
    label: "Fractional",
    rows: ROWS_FRACTIONAL,
    threads: THREADS_FRACTIONAL,
    preamble: [
      "int a, b, c;",
      "Lock L1, L2;",
      "",
      "resource L1_inv() = Perm(a, 1\\2);",
      "resource L2_inv() = Perm(b, 1\\2) ** Perm(c, 1\\2);",
    ],
    initialMemory: { M1: 100, M2: 50, M3: 20 },
  },
};

export function getScenario(s: { scenarioId: ScenarioId }): ScenarioDef {
  return SCENARIOS[s.scenarioId];
}
export function getRows(s: { scenarioId: ScenarioId }): RowDef[] {
  return SCENARIOS[s.scenarioId].rows;
}
export function getThreads(s: { scenarioId: ScenarioId }): Record<Tid, ThreadDef> {
  return SCENARIOS[s.scenarioId].threads;
}

export const THREAD_CSS: Record<Tid, string> = { T1: "t0", T2: "t1", T3: "t2", T4: "t3" };

export const THREAD_SVG_FILL: Record<ColId, string> = {
  L1: "#eee", L2: "#eee",
  T1: "#eee", T2: "#eee",
  T3: "#eee", T4: "#eee",
};
export const THREAD_SVG_STROKE: Record<ColId, string> = {
  L1: "#000", L2: "#000",
  T1: "#000", T2: "#000",
  T3: "#000", T4: "#000",
};

export interface SeqLane {
  id: ColId;
  label: string;
  kind: "lock" | "thread";
}

export const SEQ_LANES: SeqLane[] = [
  { id: "L1", label: "Lock 1", kind: "lock" },
  { id: "L2", label: "Lock 2", kind: "lock" },
  { id: "T1", label: "Thread 0", kind: "thread" },
  { id: "T2", label: "Thread 1", kind: "thread" },
  { id: "T3", label: "Thread 2", kind: "thread" },
  { id: "T4", label: "Thread 3", kind: "thread" },
];

export const SEQ_LAYOUT = {
  width: 760,
  headerY: 18,
  headerH: 56,
  laneTop: 90,
  rowH: 38,
  bottomPad: 18,
  nodeW: 110,
  sidePad: 18,
};

export interface FlowMessage {
  id: string;
  threadId: Tid | null;
  threadLabel: string;
  rowId: RowId;
  fromLane: ColId;
  toLane: ColId;
  units: number;
  pending?: boolean;
}

export type Dist = Record<RowId, Record<ColId, number>>;

export type Phase = "setup" | "run";

export type SetupPos =
  | { row: RowId; col: ColId }
  | { halves: [ColId | null, ColId | null] }
  | null;

function emptySetupPositions(scenarioId: ScenarioId): Record<RowId, SetupPos> {
  if (scenarioId === "fractional") {
    return {
      M1: { halves: [null, null] },
      M2: { halves: [null, null] },
      M3: { halves: [null, null] },
    };
  }
  return { M1: null, M2: null, M3: null };
}

export type SelectedMove = { sourceCol: ColId; legs: Array<{ rowId: RowId; units: number }> } | null;

export type LockInvariants = Record<"L1" | "L2", Partial<Record<RowId, number>>>;

export type LockHolders = Record<"L1" | "L2", Tid | null>;

export interface EngineState {
  scenarioId: ScenarioId;
  phase: Phase;
  dist: Dist;

  setupPositions: Record<RowId, SetupPos>;

  lockInvariants: LockInvariants;

  lockHolder: LockHolders;
  memory: Record<RowId, number>;
  stepIdx: Record<Tid, number>;
  selectedThread: Tid | null;
  selectedMove: SelectedMove;
  hintLevel: number;
  history: HistoryEntry[];
  consoleEntries: { tone: LogTone; text: string }[];
  flowMessages: FlowMessage[];
}

interface HistoryEntry {
  scenarioId: ScenarioId;
  phase: Phase;
  dist: Dist;
  setupPositions: Record<RowId, SetupPos>;
  lockInvariants: LockInvariants;
  lockHolder: LockHolders;
  memory: Record<RowId, number>;
  stepIdx: Record<Tid, number>;
  selectedThread: Tid | null;
  selectedMove: SelectedMove;
  hintLevel: number;
  consoleEntries: { tone: LogTone; text: string }[];
  flowMessages: FlowMessage[];
}

const EMPTY_DIST: Dist = {
  M1: { L1: 0, L2: 0, T1: 0, T2: 0, T3: 0, T4: 0 },
  M2: { L1: 0, L2: 0, T1: 0, T2: 0, T3: 0, T4: 0 },
  M3: { L1: 0, L2: 0, T1: 0, T2: 0, T3: 0, T4: 0 },
};

function cloneDist(d: Dist): Dist {
  const r = {} as Dist;
  for (const k of Object.keys(d) as RowId[]) r[k] = { ...d[k] };
  return r;
}

function emptyLockInvariants(): LockInvariants {
  return { L1: {}, L2: {} };
}

function emptyLockHolders(): LockHolders {
  return { L1: null, L2: null };
}

export function mkState(scenarioId: ScenarioId = "standard"): EngineState {
  return {
    scenarioId,
    phase: "setup",
    dist: cloneDist(EMPTY_DIST),
    setupPositions: emptySetupPositions(scenarioId),
    lockInvariants: emptyLockInvariants(),
    lockHolder: emptyLockHolders(),
    memory: { ...SCENARIOS[scenarioId].initialMemory },
    stepIdx: { T1: 0, T2: 0, T3: 0, T4: 0 },
    selectedThread: null,
    selectedMove: null,
    hintLevel: 0,
    history: [],
    consoleEntries: [{ tone: "info", text: "Setup." }],
    flowMessages: [],
  };
}

export function gu(s: EngineState, rowId: RowId, colId: ColId): number {
  return s.dist[rowId]?.[colId] ?? 0;
}

export function getCurrentStep(s: EngineState, tid?: Tid | null): StepDef | null {
  const t = tid ?? s.selectedThread;
  if (!t) return null;
  return getThreads(s)[t].steps[s.stepIdx[t]] ?? null;
}

export function isComplete(s: EngineState, tid: Tid): boolean {
  return s.stepIdx[tid] >= getThreads(s)[tid].steps.length;
}

export function lockInvRows(s: EngineState, lockId: "L1" | "L2"): Array<{ rowId: RowId; units: number }> {
  const inv = s.lockInvariants[lockId];
  return (Object.keys(inv) as RowId[])
    .map(r => ({ rowId: r, units: inv[r] ?? 0 }))
    .filter(x => x.units > 0);
}

function lockFullyHeld(s: EngineState, lockId: "L1" | "L2"): boolean {
  return lockInvRows(s, lockId).every(({ rowId, units }) => gu(s, rowId, lockId) >= units);
}

export function isBlocked(s: EngineState, tid: Tid): boolean {
  const step = getCurrentStep(s, tid);
  if (!step || step.action !== "lock" || isComplete(s, tid)) return false;
  const holder = s.lockHolder[step.lockId];
  if (holder !== null && holder !== tid) return true;
  if (lockInvRows(s, step.lockId).length === 0) return false;
  return !lockFullyHeld(s, step.lockId);
}

export function lockStatus(s: EngineState, lockId: "L1" | "L2"): { held: boolean; holder: Tid | null } {

  const tracked = s.lockHolder[lockId];
  if (tracked) return { held: true, holder: tracked };
  const invRows = lockInvRows(s, lockId);

  if (invRows.length === 0 || lockFullyHeld(s, lockId)) return { held: false, holder: null };

  const holders = new Set<Tid>();
  for (const { rowId, units } of invRows) {
    if (gu(s, rowId, lockId) >= units) continue;
    for (const t of THREAD_IDS) if (gu(s, rowId, t) > 0) holders.add(t);
  }
  return { held: true, holder: holders.size === 1 ? [...holders][0] : null };
}

export function lockInvariant(s: EngineState, lockId: "L1" | "L2"): string {
  const invRows = lockInvRows(s, lockId);
  const labels = invRows.length > 0
    ? invRows.map(({ rowId }) => getRows(s).find(r => r.id === rowId)?.label ?? rowId)
    : getRows(s).filter(r => r.protectedBy === lockId).map(r => r.label);
  return labels.map(v => `Perm(${v}, write)`).join(" ** ");
}

export function stepAnnotation(s: EngineState, step: StepDef): string {
  const lockPerm = step.requiredUnits >= FULL ? "write" : "read";
  if (step.action === "lock" || step.action === "unlock") {

    const rows = lockInvRows(s, step.lockId);
    const clause = (rows.length > 0
      ? rows.map(({ rowId }) => getRows(s).find(r => r.id === rowId)?.label ?? rowId)
      : getRows(s).filter(r => r.protectedBy === step.lockId).map(r => r.label))
      .map(v => `Perm(${v}, ${lockPerm})`).join(" ** ") || "true";
    return step.action === "lock" ? `//@ inhale ${clause};` : `//@ exhale ${clause};`;
  }
  const v = getRows(s).find(r => r.id === step.rowId)?.label ?? step.rowId ?? "";
  return step.action === "read"
    ? `//@ requires Perm(${v}, read);`
    : `//@ requires Perm(${v}, write);`;
}

function cloneLockInvariants(li: LockInvariants): LockInvariants {
  return { L1: { ...li.L1 }, L2: { ...li.L2 } };
}

function pushHistory(s: EngineState): void {
  s.history.push({
    scenarioId: s.scenarioId,
    phase: s.phase,
    dist: cloneDist(s.dist),
    setupPositions: { ...s.setupPositions },
    lockInvariants: cloneLockInvariants(s.lockInvariants),
    lockHolder: { ...s.lockHolder },
    memory: { ...s.memory },
    stepIdx: { ...s.stepIdx },
    selectedThread: s.selectedThread,
    selectedMove: s.selectedMove ? { sourceCol: s.selectedMove.sourceCol, legs: s.selectedMove.legs.map(l => ({ ...l })) } : null,
    hintLevel: s.hintLevel,
    consoleEntries: s.consoleEntries.map(e => ({ ...e })),
    flowMessages: s.flowMessages.map(m => ({ ...m })),
  });
}

export function placedUnits(s: EngineState, rowId: RowId): number {
  return COL_IDS.reduce((sum, c) => sum + (s.dist[rowId][c] || 0), 0);
}

export function isTokenInTray(s: EngineState, rowId: RowId): boolean {
  if (s.phase === "setup") {
    const pos = s.setupPositions[rowId];
    if (pos === null) return true;
    if ("halves" in pos) return pos.halves.every(h => h === null);
    return false;
  }
  return placedUnits(s, rowId) === 0;
}

export function halvesInTray(s: EngineState, rowId: RowId): Array<0 | 1> {
  const pos = s.setupPositions[rowId];
  if (!pos || !("halves" in pos)) return [];
  const out: Array<0 | 1> = [];
  if (pos.halves[0] === null) out.push(0);
  if (pos.halves[1] === null) out.push(1);
  return out;
}

export function allTokensPlaced(s: EngineState): boolean {
  return getRows(s).every(r => {
    const pos = s.setupPositions[r.id];
    if (pos === null) return false;
    if ("halves" in pos) return pos.halves.every(h => h !== null);
    return true;
  });
}

export function setupTokenAt(s: EngineState, row: RowId, col: ColId): RowId | null {
  for (const r of getRows(s)) {
    const pos = s.setupPositions[r.id];
    if (!pos) continue;
    if ("halves" in pos) {
      if (r.id === row && (pos.halves[0] === col || pos.halves[1] === col)) return r.id;
    } else if (pos.row === row && pos.col === col) {
      return r.id;
    }
  }
  return null;
}

export function setupUnitsAt(s: EngineState, row: RowId, col: ColId): number {
  const tokenRow = setupTokenAt(s, row, col);
  if (!tokenRow) return 0;
  return gu(s, tokenRow, col);
}

function findHalfAt(s: EngineState, rowId: RowId, col: ColId): 0 | 1 | null {
  const pos = s.setupPositions[rowId];
  if (!pos || !("halves" in pos)) return null;
  if (pos.halves[1] === col) return 1;
  if (pos.halves[0] === col) return 0;
  return null;
}

export function placeInitialToken(s: EngineState, draggedRow: RowId, targetRow: RowId, targetCol: ColId): EngineState {
  if (s.phase !== "setup") return s;
  if (s.scenarioId === "fractional") return s;
  const existingAtTarget = setupTokenAt(s, targetRow, targetCol);

  if (existingAtTarget === draggedRow) return s;
  pushHistory(s);

  const prevRaw = s.setupPositions[draggedRow];
  const previousPos = prevRaw && !("halves" in prevRaw) ? prevRaw : null;
  const newPositions: Record<RowId, SetupPos> = { ...s.setupPositions, [draggedRow]: { row: targetRow, col: targetCol } };
  const nd = cloneDist(s.dist);

  if (previousPos) nd[draggedRow][previousPos.col] = 0;

  nd[draggedRow][targetCol] = FULL;

  if (existingAtTarget && existingAtTarget !== draggedRow) {

    nd[existingAtTarget][targetCol] = 0;
    if (previousPos) {

      newPositions[existingAtTarget] = previousPos;
      nd[existingAtTarget][previousPos.col] = FULL;
    } else {

      newPositions[existingAtTarget] = null;
      for (const c of COL_IDS) nd[existingAtTarget][c] = 0;
    }
  }

  const ns = { ...s, dist: nd, setupPositions: newPositions };
  const rows = getRows(s);
  const rowName = rows.find(r => r.id === draggedRow)?.semanticName ?? draggedRow;
  if (existingAtTarget && previousPos) {
    const otherName = rows.find(r => r.id === existingAtTarget)?.semanticName ?? existingAtTarget;
    setStatus(ns, "info", `Swapped ${rowName} and ${otherName}.`);
  } else if (existingAtTarget) {
    const otherName = rows.find(r => r.id === existingAtTarget)?.semanticName ?? existingAtTarget;
    setStatus(ns, "info", `Placed ${rowName} on ${targetCol}; ${otherName} returned to the tray.`);
  } else if (previousPos) {
    setStatus(ns, "info", `Moved ${rowName} to (${targetRow}, ${targetCol}).`);
  } else {
    const wrongRow = targetRow !== draggedRow;
    setStatus(ns, "info", wrongRow
      ? `Placed ${rowName} on (${targetRow}, ${targetCol}). Note it's not in ${draggedRow}'s row.`
      : `Placed ${rowName} on ${targetCol}.`);
  }
  return ns;
}

export function pickUpInitialToken(s: EngineState, rowId: RowId): EngineState {
  if (s.phase !== "setup") return s;
  const pos = s.setupPositions[rowId];
  if (pos === null) return s;
  if ("halves" in pos && pos.halves[0] === null && pos.halves[1] === null) return s;
  pushHistory(s);
  const resetPos: SetupPos = "halves" in pos ? { halves: [null, null] } : null;
  const newPositions = { ...s.setupPositions, [rowId]: resetPos };
  const nd = cloneDist(s.dist);
  for (const c of COL_IDS) nd[rowId][c] = 0;
  const ns = { ...s, dist: nd, setupPositions: newPositions };
  const rowName = getRows(s).find(r => r.id === rowId)?.semanticName ?? rowId;
  setStatus(ns, "info", `Put ${rowName} back in the tray.`);
  return ns;
}

export function placeHalfToken(s: EngineState, rowId: RowId, halfIndex: 0 | 1, targetCol: ColId): EngineState {
  if (s.phase !== "setup" || s.scenarioId !== "fractional") return s;
  const pos = s.setupPositions[rowId];
  if (!pos || !("halves" in pos)) return s;
  if (pos.halves[halfIndex] === targetCol) return s;
  pushHistory(s);
  const oldCol = pos.halves[halfIndex];
  const newHalves: [ColId | null, ColId | null] = [pos.halves[0], pos.halves[1]];
  newHalves[halfIndex] = targetCol;
  const newPositions = { ...s.setupPositions, [rowId]: { halves: newHalves } };
  const nd = cloneDist(s.dist);
  if (oldCol !== null) nd[rowId][oldCol] = Math.max(0, nd[rowId][oldCol] - HALF);
  nd[rowId][targetCol] = (nd[rowId][targetCol] || 0) + HALF;
  return { ...s, dist: nd, setupPositions: newPositions };
}

export function pickUpHalfToken(s: EngineState, rowId: RowId, halfIndex: 0 | 1): EngineState {
  if (s.phase !== "setup" || s.scenarioId !== "fractional") return s;
  const pos = s.setupPositions[rowId];
  if (!pos || !("halves" in pos)) return s;
  const oldCol = pos.halves[halfIndex];
  if (oldCol === null) return s;
  pushHistory(s);
  const newHalves: [ColId | null, ColId | null] = [pos.halves[0], pos.halves[1]];
  newHalves[halfIndex] = null;
  const newPositions = { ...s.setupPositions, [rowId]: { halves: newHalves } };
  const nd = cloneDist(s.dist);
  nd[rowId][oldCol] = Math.max(0, nd[rowId][oldCol] - HALF);
  return { ...s, dist: nd, setupPositions: newPositions };
}

export function moveHalfFromCell(s: EngineState, rowId: RowId, fromCol: ColId, dest: ColId | "tray"): EngineState {
  if (s.phase !== "setup" || s.scenarioId !== "fractional") return s;
  const idx = findHalfAt(s, rowId, fromCol);
  if (idx === null) return s;
  return dest === "tray" ? pickUpHalfToken(s, rowId, idx) : placeHalfToken(s, rowId, idx, dest);
}

export function startRun(s: EngineState): EngineState {
  if (s.phase !== "setup") return s;
  if (!allTokensPlaced(s)) {
    const ns = { ...s };
    setStatus(ns, "error", "Can't do that yet.");
    return ns;
  }
  pushHistory(s);

  const snapshot = (lockId: "L1" | "L2"): Partial<Record<RowId, number>> => {
    const inv: Partial<Record<RowId, number>> = {};
    for (const r of getRows(s)) {
      const u = gu(s, r.id, lockId);
      if (u > 0) inv[r.id] = u;
    }
    return inv;
  };
  const ns: EngineState = { ...s, phase: "run", lockInvariants: { L1: snapshot("L1"), L2: snapshot("L2") }, lockHolder: emptyLockHolders() };
  setStatus(ns, "info", "Run started.");
  return ns;
}

export function resetPlacement(s: EngineState): EngineState {
  pushHistory(s);
  const ns: EngineState = {
    ...s,
    phase: "setup",
    dist: cloneDist(EMPTY_DIST),
    setupPositions: emptySetupPositions(s.scenarioId),
    lockInvariants: emptyLockInvariants(),
    lockHolder: emptyLockHolders(),
    memory: { ...SCENARIOS[s.scenarioId].initialMemory },
    stepIdx: { T1: 0, T2: 0, T3: 0, T4: 0 },
    selectedThread: null,
    selectedMove: null,
    hintLevel: 0,
    flowMessages: [],
  };
  setStatus(ns, "info", "Back to setup.");
  return ns;
}

function setStatus(s: EngineState, tone: LogTone, text: string): void {
  s.consoleEntries = [...s.consoleEntries, { tone, text }].slice(-8);
}

function buildInstruction(s: EngineState, tid: Tid): string {
  const thread = getThreads(s)[tid];
  const step = getCurrentStep(s, tid);
  if (!step) return `${thread.label} has completed all its proof steps.`;

  if (step.action === "lock" || step.action === "unlock") {
    const invRows = lockInvRows(s, step.lockId);
    const lockLabel = COLUMNS.find(c => c.id === step.lockId)?.label ?? step.lockId;
    if (invRows.length === 0) {
      return `${thread.label}: ${lockLabel} holds no permissions. Press Verify Step.`;
    }
    const names = invRows.map(({ rowId }) => getRows(s).find(r => r.id === rowId)?.label ?? rowId).join(", ");
    if (step.action === "lock") {
      const heldAll = invRows.every(({ rowId, units }) => gu(s, rowId, tid) >= units);
      if (heldAll) return `${thread.label}: holds ${lockLabel}'s permissions (${names}). Press Verify Step.`;
      return `${thread.label}: lock(${lockLabel}) moves its whole invariant (${names}) to ${thread.label} in one gesture.`;
    }
    const backAll = invRows.every(({ rowId, units }) => gu(s, rowId, step.lockId) >= units);
    if (backAll) return `${thread.label}: ${lockLabel}'s permissions are back. Press Verify Step.`;
    return `${thread.label}: unlock(${lockLabel}) returns its whole invariant (${names}) back to ${lockLabel}.`;
  }

  const rowName = getRows(s).find(r => r.id === step.rowId)?.semanticName ?? step.rowId;
  const heldThread = step.rowId ? gu(s, step.rowId, tid) : 0;
  if (step.action === "read") {

    if (heldThread > 0) return `${thread.label}: Holds ${fracLabel(heldThread)} of ${rowName}. Press Verify Step to confirm the read.`;
    return `${thread.label}: ${rowName} must be under ${thread.label} to read it (any positive share works).`;
  }
  if (step.action === "write") {
    if (heldThread >= FULL) return `${thread.label}: ${rowName} permission confirmed. Press Verify Step.`;
    return `${thread.label}: ${thread.label} needs the full ${rowName} permission to write. Acquire it via the lock that owns it.`;
  }
  return step.code;
}

export function selectThread(s: EngineState, tid: Tid): EngineState {
  if (s.phase !== "run") return s;
  pushHistory(s);
  const ns = { ...s };
  ns.selectedThread = tid;
  ns.selectedMove = null;
  ns.hintLevel = 0;
  ns.consoleEntries = [...ns.consoleEntries];
  setStatus(ns, "info", `Picked ${getThreads(s)[tid].label}.`);
  return ns;
}

function moveLegsFor(s: EngineState, step: StepDef): { sourceCol: ColId; legs: Array<{ rowId: RowId; units: number }> } | null {
  if (step.action !== "lock" && step.action !== "unlock") return null;
  const sourceCol: ColId = step.action === "lock" ? step.lockId : (s.selectedThread as ColId);
  if (!sourceCol) return null;
  const legs = lockInvRows(s, step.lockId)
    .filter(({ rowId, units }) => gu(s, rowId, sourceCol) >= units)
    .map(({ rowId, units }) => ({ rowId, units }));
  return { sourceCol, legs };
}

function pickupSource(s: EngineState, rowId: RowId, colId: ColId): { ok: boolean; sourceCol: ColId; legs: Array<{ rowId: RowId; units: number }> } {
  const none = { ok: false, sourceCol: colId, legs: [] };
  if (s.phase !== "run" || !s.selectedThread) return none;
  const step = getCurrentStep(s, s.selectedThread);
  if (!step || (step.action !== "lock" && step.action !== "unlock")) return none;
  const move = moveLegsFor(s, step);
  if (!move || colId !== move.sourceCol || move.legs.length === 0) return none;
  const leg = move.legs.find(l => l.rowId === rowId);
  if (!leg) return none;
  return { ok: true, sourceCol: move.sourceCol, legs: [leg] };
}

export function handleTokenClick(s: EngineState, rowId: RowId, colId: ColId): EngineState {
  const pickup = pickupSource(s, rowId, colId);
  if (!pickup.ok) return s;
  const already = s.selectedMove && s.selectedMove.sourceCol === colId
    && s.selectedMove.legs.length === 1 && s.selectedMove.legs[0].rowId === rowId;
  if (already) {
    return { ...s, selectedMove: null };
  }
  const ns = { ...s, selectedMove: { sourceCol: colId, legs: pickup.legs } };
  const name = getRows(s).find(r => r.id === rowId)?.label ?? rowId;
  setStatus(ns, "info", `Picked up P${name} from ${colId}. Drop it on the destination.`);
  return ns;
}

export function handleTokenDragStart(s: EngineState, rowId: RowId, colId: ColId): EngineState {
  const pickup = pickupSource(s, rowId, colId);
  if (!pickup.ok) return s;
  const already = s.selectedMove && s.selectedMove.sourceCol === colId
    && s.selectedMove.legs.length === 1 && s.selectedMove.legs[0].rowId === rowId;
  if (already) return s;
  return { ...s, selectedMove: { sourceCol: colId, legs: pickup.legs } };
}

export interface MoveResult {
  state: EngineState;
  animate?: { fromCol: ColId; toCol: ColId; legs: Array<{ rowId: RowId; units: number }> };
}

export function handleCellClick(s: EngineState, _rowId: RowId, colId: ColId): MoveResult {
  const sel = s.selectedMove;
  if (!sel) return { state: s };

  if (sel.sourceCol === colId) {
    const ns = { ...s, selectedMove: null };
    setStatus(ns, "info", `Left it where it was.`);
    return { state: ns };
  }

  for (const leg of sel.legs) {
    if (gu(s, leg.rowId, colId) + leg.units > FULL) {
      const ns = { ...s, selectedMove: null };
      setStatus(ns, "unsafe", "Not allowed.");
      return { state: ns };
    }
  }

  return { state: s, animate: { fromCol: sel.sourceCol, toCol: colId, legs: sel.legs } };
}

export function applyMove(s: EngineState, fromCol: ColId, toCol: ColId, legs: Array<{ rowId: RowId; units: number }>): EngineState {
  pushHistory(s);
  const nd = cloneDist(s.dist);
  const tid = s.selectedThread;
  const newMsgs: FlowMessage[] = legs.map((leg, i) => {
    nd[leg.rowId][fromCol] = (nd[leg.rowId][fromCol] || 0) - leg.units;
    nd[leg.rowId][toCol] = (nd[leg.rowId][toCol] || 0) + leg.units;
    return {
      id: `move-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      threadId: tid,
      threadLabel: tid ? getThreads(s)[tid].label : "·",
      rowId: leg.rowId,
      fromLane: fromCol,
      toLane: toCol,
      units: leg.units,
    };
  });
  const ns = { ...s, dist: nd, selectedMove: null, flowMessages: [...s.flowMessages, ...newMsgs] };
  const names = legs.map(l => getRows(s).find(r => r.id === l.rowId)?.label ?? l.rowId).join(", ");
  setStatus(ns, "info", `Moved ${names} to ${toCol}.`);
  return ns;
}

export interface VerifyResult {
  state: EngineState;
  success: boolean;
  flashType?: "success" | "error";
  balanceFlash?: RowId;

  message?: string;
}

export function verifyStep(s: EngineState): VerifyResult {
  if (!s.selectedThread) {
    const ns = { ...s };
    setStatus(ns, "error", "Pick a thread first.");
    return { state: ns, success: false, message: "Pick a thread first." };
  }

  const tid = s.selectedThread;
  const thread = getThreads(s)[tid];
  const step = getCurrentStep(s, tid);
  if (!step) {
    const ns = { ...s };
    setStatus(ns, "error", "Not allowed.");
    return { state: ns, success: false, message: `${thread.label} has already finished its steps.` };
  }

  const lockLabel = COLUMNS.find(c => c.id === step.lockId)?.label ?? step.lockId;
  const threadLabel = thread.label;
  const rowName = step.rowId ? (getRows(s).find(r => r.id === step.rowId)?.semanticName ?? step.rowId) : "";
  const rowLabel = step.rowId ? (getRows(s).find(r => r.id === step.rowId)?.label ?? step.rowId) : "";
  const heldThread = step.rowId ? gu(s, step.rowId, tid) : 0;

  if (step.action === "lock") {

    const holder = s.lockHolder[step.lockId];
    if (holder !== null && holder !== tid) {
      const ns = { ...s };
      const holderLabel = getThreads(s)[holder].label;
      const message = `${lockLabel} is a mutex — ${holderLabel} currently holds it. ${threadLabel} must wait until ${holderLabel} runs unlock(${lockLabel}).`;
      setStatus(ns, "error", "Step rejected.");
      return { state: ns, success: false, flashType: "error", message };
    }

    const invRows = lockInvRows(s, step.lockId);
    const missing = invRows.filter(({ rowId, units }) => gu(s, rowId, tid) < units);
    if (missing.length > 0) {
      const ns = { ...s };
      const names = missing.map(({ rowId }) => `P${getRows(s).find(r => r.id === rowId)?.label ?? rowId}`).join(", ");
      const message = `lock(${lockLabel}) transfers its whole invariant to ${threadLabel} at once. ${threadLabel} still needs: ${names}. Click or drag ${lockLabel} to move everything it holds.`;
      setStatus(ns, "error", "Step rejected.");
      return { state: ns, success: false, flashType: "error", message };
    }

    if (invRows.length > 0 && lockFullyHeld(s, step.lockId)) {
      const ns = { ...s };
      const noun = invRows.length > 1 ? "permissions" : "permission";
      const message = `${lockLabel} hasn't been acquired yet — move ${lockLabel}'s ${noun} onto ${threadLabel} before pressing Verify Step.`;
      setStatus(ns, "error", "Step rejected.");
      return { state: ns, success: false, flashType: "error", message };
    }
  }
  if (step.action === "read") {

    if (heldThread <= 0) {
      const ns = { ...s };
      const message = `${threadLabel} can't read ${rowName}: it holds no permission for ${rowLabel}. A permission only reaches a thread through a lock whose invariant owns it — check the setup placement.`;
      setStatus(ns, "error", "Step rejected.");
      return { state: ns, success: false, flashType: "error", message };
    }
  }
  if (step.action === "write") {
    if (heldThread < FULL) {
      const ns = { ...s };
      const tone: LogTone = heldThread > 0 ? "unsafe" : "error";
      const message = heldThread > 0
        ? `Writing ${rowName} needs the full permission token; ${threadLabel} holds only ${fracLabel(heldThread)} — race risk.`
        : `${threadLabel} can't write ${rowName}: it holds no permission for ${rowLabel}. It only acquires what its locks own, and the invariants were fixed at setup — check where P${rowLabel} was placed.`;
      setStatus(ns, tone, "Step rejected.");
      return { state: ns, success: false, flashType: "error", message };
    }
  }
  if (step.action === "unlock") {

    if (s.lockHolder[step.lockId] !== tid) {
      const ns = { ...s };
      const message = `${threadLabel} doesn't hold ${lockLabel} — unlock(${lockLabel}) needs ${threadLabel} to have run lock(${lockLabel}) first.`;
      setStatus(ns, "error", "Step rejected.");
      return { state: ns, success: false, flashType: "error", message };
    }

    const invRows = lockInvRows(s, step.lockId);
    const missing = invRows.filter(({ rowId, units }) => gu(s, rowId, step.lockId) < units);
    if (missing.length > 0) {
      const ns = { ...s };
      const names = missing.map(({ rowId }) => `P${getRows(s).find(r => r.id === rowId)?.label ?? rowId}`).join(", ");
      const message = `unlock(${lockLabel}) must return everything it lent ${threadLabel}. ${lockLabel} is still missing: ${names}. Click or drag the held permissions back to ${lockLabel}.`;
      setStatus(ns, "error", "Step rejected.");
      return { state: ns, success: false, flashType: "error", message };
    }
  }

  pushHistory(s);
  const nextHolder = { ...s.lockHolder };
  if (step.action === "lock") nextHolder[step.lockId] = tid;
  else if (step.action === "unlock") nextHolder[step.lockId] = null;
  const ns: EngineState = {
    ...s,
    stepIdx: { ...s.stepIdx, [tid]: s.stepIdx[tid] + 1 },
    hintLevel: 0,
    selectedMove: null,
    lockHolder: nextHolder,
    consoleEntries: [...s.consoleEntries],
    flowMessages: [...s.flowMessages],
  };

  let balanceFlash: RowId | undefined;

  if (step.action === "write" && step.rowId && step.memoryDelta) {
    const prev = s.memory[step.rowId];
    ns.memory = { ...s.memory, [step.rowId]: prev + step.memoryDelta };
    balanceFlash = step.rowId;
    setStatus(ns, "success", `${thread.label} wrote ${rowName}: ${prev} → ${ns.memory[step.rowId]}.`);
  } else if (step.action === "read" && step.rowId) {
    setStatus(ns, "success", `${thread.label} read ${rowName} (= ${ns.memory[step.rowId]}) with ${fracLabel(heldThread)} of the permission token.`);
  } else if (step.action === "unlock") {
    setStatus(ns, "success", `${thread.label} released ${lockLabel}.`);
  } else if (step.action === "lock") {
    setStatus(ns, "success", `${thread.label} acquired ${lockLabel}.`);
  } else {
    setStatus(ns, "success", `${thread.label} step verified.`);
  }

  const nextStep = getCurrentStep(ns, tid);
  if (!nextStep) setStatus(ns, "info", `${thread.label} finished.`);

  return { state: ns, success: true, flashType: "success", balanceFlash };
}

export function goBack(s: EngineState): EngineState {
  if (s.history.length === 0) {
    const ns = { ...s };
    setStatus(ns, "info", "Nothing to undo.");
    return ns;
  }
  const prev = s.history[s.history.length - 1];
  return {
    scenarioId: prev.scenarioId,
    phase: prev.phase,
    dist: prev.dist,
    setupPositions: prev.setupPositions,
    lockInvariants: prev.lockInvariants,
    lockHolder: prev.lockHolder,
    memory: prev.memory,
    stepIdx: prev.stepIdx,
    selectedThread: prev.selectedThread,
    selectedMove: prev.selectedMove,
    hintLevel: prev.hintLevel,
    consoleEntries: prev.consoleEntries,
    flowMessages: prev.flowMessages,
    history: s.history.slice(0, -1),
  };
}

export function resetAll(scenarioId: ScenarioId = "standard"): EngineState {
  return mkState(scenarioId);
}

export function placementRationale(s: EngineState, step: StepDef): { short: string; long: string } {
  const lockLabel = COLUMNS.find(c => c.id === step.lockId)?.label ?? step.lockId;
  const inv = lockInvariant(s, step.lockId);
  const rowLabel = step.rowId ? (getRows(s).find(r => r.id === step.rowId)?.label ?? step.rowId) : null;
  const short = rowLabel
    ? `Writing ${rowLabel} needs the full permission, which only ${lockLabel} can hand over if its invariant (${inv}) owns it.`
    : `${lockLabel} owns a fixed invariant (${inv}); lock/unlock move all of it at once.`;
  const long =
    "Every lock owns a fixed set of permissions — its invariant. When you place a permission token into a lock " +
    "during setup, you are establishing that invariant. At runtime, lock(L) transfers exactly those " +
    "permissions from L to the thread, all at once; unlock(L) returns exactly the same amount. If you put a " +
    "permission token in the wrong lock, the thread acquiring that lock never receives it — so the failure shows " +
    "up later, at the read or write that actually needs the permission, not at the lock itself.";
  return { short, long };
}

function buildConceptualHint(step: StepDef): string {
  switch (step.action) {
    case "lock":
      return "Locking transfers the lock invariant's permission from the lock pool to this thread.";
    case "read":
      return "Reading requires Perm(x, p) for any p > 0 — any positive fraction held by this thread is enough.";
    case "write":
      return "Writing requires the full permission token; while this thread holds it, no other thread may read or write the cell.";
    case "unlock":
      return "Unlocking returns the lock invariant's permission to the pool so another thread can acquire it.";
    default:
      return "";
  }
}

export function revealHint(s: EngineState, maxLevel = 2): EngineState {
  if (!s.selectedThread) {
    const ns = { ...s };
    setStatus(ns, "error", "Pick a thread first.");
    return ns;
  }
  const step = getCurrentStep(s, s.selectedThread);
  if (!step) {
    const ns = { ...s };
    setStatus(ns, "error", "Not allowed.");
    return ns;
  }
  pushHistory(s);

  const newLevel = Math.min(maxLevel, s.hintLevel + 1);
  const ns = { ...s, hintLevel: newLevel, consoleEntries: [...s.consoleEntries] };
  const text = newLevel === 1 ? buildInstruction(ns, s.selectedThread!) : buildConceptualHint(step);
  setStatus(ns, "hint", text);
  return ns;
}

export function clearFlowMessages(s: EngineState): EngineState {
  return { ...s, flowMessages: [] };
}

export function buildPendingMessage(s: EngineState): FlowMessage | null {
  const sel = s.selectedMove;
  if (!sel || sel.legs.length === 0) return null;
  const tid = s.selectedThread;

  const leg = sel.legs[0];
  return {
    id: "pending",
    threadId: tid,
    threadLabel: tid ? getThreads(s)[tid].label : "·",
    rowId: leg.rowId,
    fromLane: sel.sourceCol,
    toLane: sel.sourceCol,
    units: leg.units,
    pending: true,
  };
}

export function laneCenterX(laneId: ColId): number {
  const idx = SEQ_LANES.findIndex(l => l.id === laneId);
  if (idx < 0) return 0;
  const W = SEQ_LAYOUT.width;
  const slot = (W - SEQ_LAYOUT.sidePad * 2) / SEQ_LANES.length;
  return SEQ_LAYOUT.sidePad + slot * idx + slot / 2;
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

const TOKEN_LABELS: Record<string, string> = { M1: "Pa", M2: "Pb", M3: "Pc" };
const tokenLabel = (rowId: string): string => TOKEN_LABELS[rowId] ?? rowId;

export const ROW_COLOR: Record<string, { fill: string; ink: string }> = {
  M1: { fill: "#0d9488", ink: "#ffffff" },
  M2: { fill: "#d97706", ink: "#ffffff" },
  M3: { fill: "#4f46e5", ink: "#ffffff" },
};
const rowColor = (rowId: string) => ROW_COLOR[rowId] ?? { fill: "#000", ink: "#fff" };

export function makePieTokenSVG(rowId: string, units: number, _colId: ColId, size = 44): string {
  const R = (size / 2) - 2;
  const cx = size / 2, cy = size / 2;
  const frac = Math.min(units / FULL, 1);
  const { fill, ink } = rowColor(rowId);

  let arcPath: string;
  let labelBg = "";
  let textFill = ink;
  if (frac >= 1) {

    arcPath = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${fill}" stroke="#000" stroke-width="1.5"/>`;
  } else {

    const angle = frac * 360;
    const [x1, y1] = polarToXY(cx, cy, R, 0);
    const [x2, y2] = polarToXY(cx, cy, R, angle);
    const large = angle > 180 ? 1 : 0;
    arcPath = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#fff" stroke="#000" stroke-width="1.5"/>
      <path d="M${cx},${cy} L${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} Z" fill="${fill}" stroke="none"/>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#000" stroke-width="1.5"/>`;
    labelBg = `<rect x="${cx - 9}" y="${cy - 6}" width="18" height="12" fill="${fill}" stroke="#000" stroke-width="0.5"/>`;
    textFill = ink;
  }

  const fontSize = size < 36 ? 9 : 11;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block">
    ${arcPath}
    ${labelBg}
    <text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="middle" font-family="monospace" font-size="${fontSize}" font-weight="700" fill="${textFill}">${tokenLabel(rowId)}</text>
  </svg>`;
}

export function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface RaceTraceEntry {
  tid: Tid;

  rowId: RowId;

  action: "read" | "write";

  value: number;

  isStale: boolean;

  delta: number | null;
  text: string;

  seq: number;
}

export interface RaceState {
  memory: Record<RowId, number>;
  stepIdx: Record<Tid, number>;

  tempReg: Record<Tid, Partial<Record<RowId, number>>>;

  trace: RaceTraceEntry[];
  traceSeq: number;
}

export const EXPECTED_FINAL_BALANCES: Record<RowId, number> = { M1: 50, M2: 100, M3: 20 };

export function mkRaceState(): RaceState {
  return {
    memory: { M1: 100, M2: 50, M3: 20 },
    stepIdx: { T1: 0, T2: 0, T3: 0, T4: 0 },
    tempReg: { T1: {}, T2: {}, T3: {}, T4: {} },
    trace: [],
    traceSeq: 0,
  };
}

export function raceAllDone(s: RaceState): boolean {
  return THREAD_IDS.every(tid => s.stepIdx[tid] >= THREADS[tid].steps.length);
}

export function raceThreadDone(s: RaceState, tid: Tid): boolean {
  return s.stepIdx[tid] >= THREADS[tid].steps.length;
}

function raceCurrentStep(s: RaceState, tid: Tid) {
  const i = s.stepIdx[tid];
  if (i >= THREADS[tid].steps.length) return null;
  return THREADS[tid].steps[i];
}

export function stepRaceThread(s: RaceState, tid: Tid): RaceState {

  let cur = s;
  while (true) {
    const peek = raceCurrentStep(cur, tid);
    if (!peek) return cur;
    if (peek.action === "lock" || peek.action === "unlock") {
      cur = { ...cur, stepIdx: { ...cur.stepIdx, [tid]: cur.stepIdx[tid] + 1 } };
      continue;
    }
    break;
  }
  const step = raceCurrentStep(cur, tid)!;

  const rowId = step.rowId;
  if (rowId === undefined) {
    return { ...cur, stepIdx: { ...cur.stepIdx, [tid]: cur.stepIdx[tid] + 1 } };
  }
  const threadLabel = THREADS[tid].label.replace(/^Thread\s+/, "T");

  const rowName = ROWS.find(r => r.id === rowId)?.semanticName.replace("Variable ", "") ?? rowId;
  const seq = cur.traceSeq + 1;

  if (step.action === "read") {
    const v = cur.memory[rowId];
    const nextTempReg = { ...cur.tempReg, [tid]: { ...cur.tempReg[tid], [rowId]: v } };
    return {
      ...cur,
      stepIdx: { ...cur.stepIdx, [tid]: cur.stepIdx[tid] + 1 },
      tempReg: nextTempReg,
      trace: [...cur.trace, { tid, rowId, action: "read", value: v, isStale: false, delta: null, text: `${threadLabel} read ${rowName} = ${v}.`, seq }],
      traceSeq: seq,
    };
  }

  if (step.action === "write") {
    const delta = step.memoryDelta ?? 0;
    const snapshot = cur.tempReg[tid][rowId];

    if (snapshot === undefined) {

      const v = cur.memory[rowId];
      const nextTempReg = { ...cur.tempReg, [tid]: { ...cur.tempReg[tid], [rowId]: v } };
      return {
        ...cur,
        tempReg: nextTempReg,
        trace: [...cur.trace, { tid, rowId, action: "read", value: v, isStale: false, delta: null, text: `${threadLabel} read ${rowName} = ${v} (preparing to write).`, seq }],
        traceSeq: seq,
      };
    }

    const next = snapshot + delta;
    const memBefore = cur.memory[rowId];
    const stale = snapshot !== memBefore;
    const nextMemory = { ...cur.memory, [rowId]: next };

    const nextTempReg = { ...cur.tempReg, [tid]: { ...cur.tempReg[tid] } } as RaceState["tempReg"];
    delete nextTempReg[tid][rowId];
    const traceText = stale
      ? `${threadLabel} wrote ${rowName}: stale base ${snapshot} + (${delta >= 0 ? "+" : ""}${delta}) = ${next}. Memory was actually ${memBefore}. Update lost.`
      : `${threadLabel} wrote ${rowName}: ${snapshot} + (${delta >= 0 ? "+" : ""}${delta}) = ${next}.`;
    return {
      ...cur,
      memory: nextMemory,
      stepIdx: { ...cur.stepIdx, [tid]: cur.stepIdx[tid] + 1 },
      tempReg: nextTempReg,
      trace: [...cur.trace, { tid, rowId, action: "write", value: next, isStale: stale, delta, text: traceText, seq }],
      traceSeq: seq,
    };
  }

  return { ...cur, stepIdx: { ...cur.stepIdx, [tid]: cur.stepIdx[tid] + 1 } };
}

export function stepRandomRaceThread(s: RaceState): RaceState {
  const active = THREAD_IDS.filter(tid => !raceThreadDone(s, tid));
  if (active.length === 0) return s;
  const pick = active[Math.floor(Math.random() * active.length)];
  return stepRaceThread(s, pick);
}

export function raceOutcomeSummary(s: RaceState): { matches: boolean; diffs: { rowId: RowId; actual: number; expected: number; delta: number }[] } {
  const diffs: { rowId: RowId; actual: number; expected: number; delta: number }[] = [];
  for (const r of ROWS) {
    const actual = s.memory[r.id];
    const expected = EXPECTED_FINAL_BALANCES[r.id];
    if (actual !== expected) diffs.push({ rowId: r.id, actual, expected, delta: actual - expected });
  }
  return { matches: diffs.length === 0, diffs };
}
