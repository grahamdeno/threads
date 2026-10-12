# Threads

A small phone app for seeing where free time actually goes.

Each interest is a thread with a weekly target. Log a session or some time with one tap. The Week view shows the one thread that most needs attention next and a pace chart for the rest. Fixed commitments are placed first, so goals fit around them instead of against them. A short Sunday review shows what got time, asks why a thread was short, and sets one focus for the next week.

## Status

Early setup. The app itself lands next.

## Planned layout

```
index.html              the whole app: markup, styles, script
sw.js                   service worker: offline shell, network first
manifest.webmanifest    home screen name, colors, icons
icons/                  app icon, maskable icon, favicons, source SVG
docs/                   architecture notes and screenshots
```

No build step and no dependencies. Data stays in the phone's browser storage: no account, no server, no analytics. CSV and JSON files are ignored by git so a personal export never ends up in this repo.

## License

MIT. See [LICENSE](LICENSE).
