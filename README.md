# FGDrills

Spaced-repetition trainer for fighting game combos, built for Guilty Gear Strive.

Enter combos in Dustloop notation, and the trainer schedules them for review.
Cards are grouped so that the settings you have to change in game — dummy
state, position, opponent — change as rarely as possible during a session.

## Features

- Syntax highlighting for GGST notation, including prefixes (`j.`, `c.`, `f.`),
  charge and hold (`[4]6S`, `5[H]`), Roman Cancels and Counter Hit
- Spaced repetition with a per-character daily budget, or a free "grind" round
- Drag-and-drop ordering of the sort levels; values within a level are
  shuffled every round
- Opponent assignment that covers your combo set with as few dummy changes
  as possible
- Custom tags per combo, a drill tag that bypasses the schedule
- Three themes, custom notation colours and your own regex rules
- Everything is stored in the browser; combos travel via export files or
  share codes

## Running it

No build step and no dependencies — it is plain HTML, CSS and JavaScript.

    node serve.js

Then open http://localhost:5173. Any static file server works just as well.
