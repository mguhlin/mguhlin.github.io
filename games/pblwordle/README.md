# PBL Wordle

Play at https://mguhlin.github.io/games/pblwordle/.

A standalone classroom word game built from the **visible slides only** of
Miguel Guhlin’s *Pedagogy Showcase: PBL for Critical Thinking—Designing Projects
That Outsmart AI Shortcuts*. The source PDF has 42 slides. Speaker notes were
not used or published. `words.mjs` contains 32 terms with clues, adapted
explanations, classroom discussion questions, and PDF slide references.

## Play and teach

- Start a five-word mix, or use **Teacher setup** to choose a topic, session
  length, and whether clues are visible initially.
- Words vary in length. Each round allows six guesses. Letters show both
  color and symbols for position feedback; repeated letters are counted once
  per matching copy. Guesses need the correct length and use letters, with no
  dictionary restriction, so session acronyms also work.
- A solved word earns 60 to 10 points, depending on the number of guesses.
  Hints are free. A missed word earns no points and still reveals its learning
  connection. Completed sessions include a vocabulary review.
- Teacher setup accepts up to 20 custom words of 4–12 letters. Known terms
  retain their slide connections. Other custom words are labeled separately.
- Pupil links encode a word set and shuffle seed, so students get the same
  ordered challenge and the setup controls are hidden. This is a learning
  activity, not a secure assessment; vocabulary is present in the static code.
- **Projector view** enlarges the board. **Contrast** changes the feedback
  colors. The physical keyboard and touch keyboard both work.
- Progress and contrast preferences stay in local storage. Storage or
  clipboard restrictions do not prevent play; copying has a manual fallback.

## Files and deployment

The site has no build step, server, accounts, analytics, or runtime network
dependencies. All images and fonts are local. GitHub Pages publishes the
repository’s `main` branch at `/`; this folder maps to `/games/pblwordle/`.

From the repository root:

```sh
python3 -m http.server 4199 --bind 127.0.0.1
node --test games/pblwordle/tests/engine.test.mjs
CHROME_PATH=/usr/bin/google-chrome npm test -- --config games/pblwordle/playwright.config.cjs
```

Set `PBL_TEST_URL=https://mguhlin.github.io/games/pblwordle/` to run the browser
checks against production. Set `CHROME_PATH` for an installed Chrome, or omit
it when Playwright’s bundled Chromium is installed.

## Artwork and inspiration

`assets/word-island.webp` is original artwork made with built-in imagegen.
The brief was a colorful tactile paper island with PBL letter tiles, two
collaborating explorers, a magnifying glass, connected ideas, and a rocket to
suggest learning transfer. No slide artwork or reference app assets were
copied. The small favicon is an original SVG.

Fredoka and Nunito Sans are distributed locally under their included SIL Open
Font License files. The format is inspired by
[Classroom Wordle](https://classroomwordle.apphive.us/); code, content, and art
are independent, with no affiliation implied.
