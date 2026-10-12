// Threads core logic.
// Pure date, pace and score functions with no DOM or storage access, shared by the
// app (loaded with a <script> tag before the main script) and by the tests (require()).
// Every function takes the week start day (wso: 1 = Monday, 0 = Sunday) and, where
// time matters, the current Date, so tests can run any day of any week.

var ThreadsCore = (function () {
  "use strict";

  // Release number shown in Settings, as MAJOR.MINOR.PATCH:
  //   MAJOR  breaking changes, such as a stored-data change that needs migration
  //   MINOR  new features and enhancements (PATCH resets to 0)
  //   PATCH  defect fixes only
  // Must match the service worker cache name ("threads-v" + VERSION) so a phone that
  // shows this number is running this code. The tests fail if the two drift apart.
  var VERSION = "1.4.0";
  var BUILT = "2026-10-12";

  // Allowance before a thread counts as behind: half a session or half an hour.
  var SLACK = 0.5;

  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function parse(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  // Calendar arithmetic on local dates. setDate keeps local midnight across daylight
  // saving changes, where adding 24 hours would not.
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function weekStart(d, wso) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() - wso + 7) % 7)); return x; }
  // 0 for the first day of the week through 6 for the last.
  function dayIdx(now, wso) { return (now.getDay() - wso + 7) % 7; }

  // Share of the week elapsed, from 0 at the start of the first day to 1 at the end
  // of the last. Counts whole days plus the part of today gone by, measured against
  // today's real length, so 23 and 25 hour daylight saving days still end at 1/7 steps.
  // Earlier versions counted today as fully elapsed from midnight, which marked a daily
  // thread behind every morning before there was a chance to log it.
  function weekFrac(now, wso) {
    var mid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var next = addDays(mid, 1);
    var today = (now - mid) / (next - mid);
    return (dayIdx(now, wso) + today) / 7;
  }

  // Total logged for one thread in the 7 days starting ws. Logs store local dates
  // as YYYY-MM-DD strings, so a string range compare is exact.
  function weekDone(logs, tid, ws) {
    var a = ymd(ws), b = ymd(addDays(ws, 6)), sum = 0;
    logs.forEach(function (l) { if (l.tid === tid && l.d >= a && l.d <= b) sum += Number(l.amt) || 0; });
    return Math.round(sum * 100) / 100;
  }

  // What should be logged by now to stay on pace.
  function expected(target, frac) { return target * frac; }

  // On pace when the target is met, or when no more than SLACK short of where the
  // week says it should be.
  function onTrack(target, done, frac) { return done >= target || done >= expected(target, frac) - SLACK; }

  // Week score: mean share of target reached, each thread capped at 100% so overdoing
  // one thread cannot hide another that got nothing. 0 to 100.
  function score(items) {
    if (!items.length) return 0;
    var sum = items.reduce(function (a, x) { return a + Math.min(1, x.done / x.target); }, 0);
    return Math.round(sum / items.length * 100);
  }

  return { VERSION: VERSION, BUILT: BUILT, SLACK: SLACK, ymd: ymd, parse: parse, addDays: addDays,
    weekStart: weekStart, dayIdx: dayIdx, weekFrac: weekFrac, weekDone: weekDone,
    expected: expected, onTrack: onTrack, score: score };
})();

if (typeof module !== "undefined" && module.exports) module.exports = ThreadsCore;
