# Threads architecture

Threads is a single page app with no build step and no backend. Everything happens on the phone. The only outside services are GitHub Pages (hosting) and Google Fonts.

## Where everything sits

```mermaid
flowchart TB
    subgraph host["GitHub Pages (grahamdeno.github.io/threads)"]
        direction LR
        html["index.html<br/>markup, styles, UI script"]
        corefile["core.js<br/>date, pace, score math (tested)"]
        swfile["sw.js<br/>service worker"]
        mani["manifest.webmanifest<br/>name, colors, icons"]
        icons["icons/"]
    end

    subgraph phone["iPhone: Safari / home screen app"]
        direction TB

        subgraph ui["Screens"]
            direction LR
            week["Week<br/>Next up, pace chart, all threads"]
            review["Review<br/>where the time went, why short, next focus"]
            threads["Threads<br/>list, placed first, detail"]
            settings["Settings<br/>theme, week start, your data"]
        end

        subgraph logic["App script (index.html) and core.js"]
            direction LR
            model["Week model<br/>weekModel, onTrack, score"]
            log["Logging<br/>logEntry, swipe, sheet, undo"]
            store["Storage<br/>save, readLocal, normalize"]
            io["Back up / Restore<br/>CSV import / export"]
        end

        subgraph device["On-device storage"]
            direction LR
            ls[("localStorage<br/>threads, logs, reviews, prefs")]
            cache[("Cache Storage<br/>app shell, fonts")]
        end

        sw["Service worker"]
    end

    fonts["Google Fonts"]
    files["Files / iCloud Drive<br/>JSON backup, CSV"]

    host -- "first visit and updates" --> sw
    sw <--> cache
    sw -.->|network first| fonts

    week --> model
    week --> log
    review --> model
    threads --> store
    settings --> io
    log --> store
    model --> store
    store <--> ls
    io <--> ls
    io <--> files
```

## A week, from setup to review

```mermaid
flowchart LR
    setup["First run<br/>name threads, set targets,<br/>add what is placed first"] --> wk
    wk["Week<br/>log sessions or time"] --> pace{"On pace?<br/>done >= target x share of week elapsed, less 0.5"}
    pace -- no --> nextup["Next up<br/>focus thread first, then the biggest gap"]
    pace -- yes --> wk
    nextup --> wk
    wk --> rev["Sunday review<br/>why was a thread short?<br/>pick one focus"]
    rev --> lock["Lock in next week<br/>focus saved under next week's start date"]
    lock --> wk
```

## How the Week tab decides what to show

- **Pace.** A thread is on pace when what is logged this week is at least its target times the share of the week gone by, less half a unit of slack. The share counts whole days plus the part of today already gone, so at 6pm Thursday of a Monday week it is 3.75 / 7. A 3 session target then expects 1.6, so 2 sessions is on pace and 1 is behind. Counting today as partly elapsed matters for daily threads: a 7 a week walk is not behind at 8am before there was a chance to log it. Today's length is measured as it really is, so the 23 and 25 hour days at daylight saving changes still add up to a full week.
- **Next up.** Threads behind pace come first, the review's focus thread ahead of the rest, then by how far behind they are relative to their target. When nothing is behind, the thread with the most left to do is shown. "Not now" steps to the next one.
- **Week score.** The average share of target reached across all threads, each capped at 100%, so one overdone thread cannot hide a starved one.

## Data shape

```json
{
  "v": 1,
  "threads": [{ "id": "…", "name": "Guitar", "target": 3, "unit": "sessions", "milestones": [{ "name": "…", "done": false }], "intent": "…" }],
  "fixed":   [{ "id": "…", "label": "Family dinner", "when": "Sun evening" }],
  "logs":    [{ "id": "…", "tid": "<thread id>", "d": "2026-10-11", "amt": 1, "ts": 1791766000000 }],
  "reviews": { "2026-10-12": { "focus": "<thread id>", "reasons": { "<thread id>": "family" }, "at": 1791766000000 } },
  "setupDone": true,
  "skin": "auto",
  "weekStartsOn": 1
}
```

- Logs are kept indefinitely. Each entry is about 70 bytes, so years of daily logging stay well inside browser storage limits.
- Review keys are the start date of the week they plan, so changing the week start day leaves older reviews in place under their original dates.

## Versioning and updates

`core.js` holds `VERSION`, shown at the bottom of Settings. The service worker cache is named `threads-v` plus the same number, and a test fails if the two differ. Bump both on every release so installed phones drop the old cache, and so the number in Settings confirms which build is running. The service worker fetches same-origin files with `cache: "no-cache"`, so a new release is picked up on the next launch rather than after GitHub Pages' ten minute cache lifetime.

## Tests

`node --test` runs `tests/core.test.js` with no dependencies, pinned to US Eastern time so daylight saving cases are real. It covers week start on Monday and Sunday, week boundaries across both 2026 daylight saving changes, the elapsed share of the week, pace (including the daily-thread morning case), weekly totals, the score cap, and the version, offline cache and log retention wiring. GitHub Actions runs the same command on every push to `main`.
