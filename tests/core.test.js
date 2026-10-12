// Tests for core.js and for the wiring that keeps the installed app in sync.
// Run with: node --test   (Node 18 or later, no dependencies)

// Fix the time zone so daylight saving cases are real: US Eastern time ends daylight
// saving on Sunday Nov 1, 2026 (a 25 hour day) and starts it on Sunday Mar 8, 2026
// (a 23 hour day). Must be set before any Date is created.
process.env.TZ = "America/New_York";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../core.js");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const MON = 1, SUN = 0;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + " is not " + b);

test("version matches the service worker cache name", () => {
  const m = read("sw.js").match(/const CACHE = "threads-v(\d+)"/);
  assert.ok(m, "CACHE constant not found in sw.js");
  assert.equal(Number(m[1]), C.VERSION);
});

test("core.js is loaded by the page and cached for offline use", () => {
  assert.match(read("index.html"), /<script src="core\.js"><\/script>\s*<script>/);
  assert.match(read("sw.js"), /"core\.js"/);
});

test("service worker bypasses the HTTP cache for same-origin files", () => {
  assert.match(read("sw.js"), /cache: "no-cache"/);
});

test("logs are never pruned", () => {
  assert.doesNotMatch(read("index.html"), /pruneLogs|-400\)/);
});

test("weekStart finds the Monday or Sunday that starts the week", () => {
  // Sunday Oct 11, 2026
  assert.equal(C.ymd(C.weekStart(at(2026, 10, 11, 22), MON)), "2026-10-05");
  assert.equal(C.ymd(C.weekStart(at(2026, 10, 11, 22), SUN)), "2026-10-11");
  // Monday Oct 12, 2026
  assert.equal(C.ymd(C.weekStart(at(2026, 10, 12, 0, 1), MON)), "2026-10-12");
  assert.equal(C.ymd(C.weekStart(at(2026, 10, 12, 0, 1), SUN)), "2026-10-11");
});

test("week boundaries stay on local midnight across daylight saving", () => {
  const ws = C.weekStart(at(2026, 11, 1, 12), MON); // the fall-back Sunday
  assert.equal(C.ymd(ws), "2026-10-26");
  const next = C.addDays(ws, 7);
  assert.equal(C.ymd(next), "2026-11-02");
  assert.equal(next.getHours(), 0);
  const spring = C.addDays(C.weekStart(at(2026, 3, 8, 12), MON), 7);
  assert.equal(C.ymd(spring), "2026-03-09");
  assert.equal(spring.getHours(), 0);
});

test("weekFrac counts the elapsed share of the week, not whole days", () => {
  close(C.weekFrac(at(2026, 10, 12, 0), MON), 0);
  close(C.weekFrac(at(2026, 10, 12, 12), MON), 0.5 / 7);
  close(C.weekFrac(at(2026, 10, 15, 6), MON), 3.25 / 7);
  close(C.weekFrac(at(2026, 10, 11, 12), SUN), 0.5 / 7);
});

test("weekFrac uses the real length of a 25 or 23 hour day", () => {
  // Nov 1, 2026: 25 hours. Noon is 13 hours in.
  close(C.weekFrac(at(2026, 11, 1, 12), MON), (6 + 13 / 25) / 7);
  // Mar 8, 2026: 23 hours. Noon is 11 hours in.
  close(C.weekFrac(at(2026, 3, 8, 12), MON), (6 + 11 / 23) / 7);
  assert.ok(C.weekFrac(at(2026, 11, 1, 23, 59), MON) < 1);
});

test("a daily thread is not behind on a fresh morning (regression)", () => {
  const frac = C.weekFrac(at(2026, 10, 12, 8), MON); // Monday 8am, nothing logged
  assert.equal(C.onTrack(7, 0, frac), true);
  const tue = C.weekFrac(at(2026, 10, 13, 8), MON); // Tuesday 8am, Monday logged
  assert.equal(C.onTrack(7, 1, tue), true);
});

test("a thread falls behind as the week passes without logging", () => {
  assert.equal(C.onTrack(7, 0, C.weekFrac(at(2026, 10, 12, 23), MON)), false);
  assert.equal(C.onTrack(7, 2, C.weekFrac(at(2026, 10, 15, 23), MON)), false);
  assert.equal(C.onTrack(3, 0, C.weekFrac(at(2026, 10, 14, 12), MON)), false);
});

test("meeting the target is always on pace", () => {
  assert.equal(C.onTrack(3, 3, 0.99), true);
  assert.equal(C.onTrack(2, 5, 1), true);
});

test("weekDone sums one thread inside the week only", () => {
  const ws = C.weekStart(at(2026, 10, 14), MON); // Oct 12 to Oct 18
  const logs = [
    { tid: "a", d: "2026-10-11", amt: 9 },   // day before
    { tid: "a", d: "2026-10-12", amt: 1 },   // first day
    { tid: "a", d: "2026-10-18", amt: 0.5 }, // last day
    { tid: "a", d: "2026-10-19", amt: 9 },   // day after
    { tid: "b", d: "2026-10-14", amt: 9 },   // other thread
    { tid: "a", d: "2026-10-15", amt: "2" }  // string amount from an import
  ];
  assert.equal(C.weekDone(logs, "a", ws), 3.5);
});

test("score caps each thread at its target", () => {
  assert.equal(C.score([]), 0);
  assert.equal(C.score([{ done: 10, target: 2 }, { done: 0, target: 3 }]), 50);
  assert.equal(C.score([{ done: 1, target: 2 }, { done: 3, target: 3 }]), 75);
});
