# Sol — Tamil Vocabulary Trainer

A local-first English–Tamil vocabulary practice app built with Vite, React, TypeScript, Tailwind CSS, Dexie (IndexedDB), Zustand and Lucide.

## Run locally

Requirements: Node.js 20+

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build

```bash
npm run build
npm run preview
```

## Included vocabulary

`public/glossary.jsonl` contains the supplied 2,864 entries. The app imports it into IndexedDB automatically on first launch.

## Features

- Daily new-word target (10 / 20 / 30 / 40)
- Due-word review queue
- English → Tamil and Tamil → English
- Multiple-choice and typed-answer modes
- Spaced repetition scheduling
- Searchable vocabulary library
- Import additional JSONL files; duplicates are skipped
- Progress, accuracy, mastery and streak tracking
- Local-first storage; no account or backend required

## Data and privacy

Progress is stored in this browser's IndexedDB. Clearing browser site data will remove local progress, so export/backup is not yet included. The supplied JSONL file remains in `public/` as the initial vocabulary source.
