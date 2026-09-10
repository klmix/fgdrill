# FGDrills

Spaced-repetition trainer for fighting game combos.

Enter combos in the notation of the game you play, and the trainer schedules
them for review. Cards are grouped so that the settings you have to change in
game — dummy state, position, opponent — change as rarely as possible during
a session.

Guilty Gear -Strive- ships with the tool; other games are added as data.

## Features

- Syntax highlighting for the game's notation, including prefixes (`j.`, `c.`,
  `f.`), charge and hold (`[4]6S`, `5[H]`), the cancel family and counter hit
- Spaced repetition with a per-character daily budget, or a free "grind" round
- Drag-and-drop ordering of the sort levels; values within a level are
  shuffled every round
- Opponent assignment that covers your combo set with as few dummy changes
  as possible
- Custom tags per combo, a drill tag that bypasses the schedule
- Three themes, custom notation colours and your own regex rules
- Everything is stored in the browser; combos travel via export files or
  share codes

## Adding a game

Every game brings its own roster, notation, default tags and colours. Copy
`games/ggst.js`, fill it in, load it in `index.html` and add it to the list in
`games/index.js` — there is nothing to change in the program itself.

The notation is described as data: which buttons exist (one letter, two, or
digits), which prefixes a term can carry, whether motions use the numpad, the
cancel family, the counter-hit spelling and the movement shorthands. Portraits
are optional and live in `assets/chars/<game>/<character>.png`; without them
the tiles show the character's short code.

Combos, tags and preferences are stored per game, so switching games never
mixes collections.

## Running it

No build step and no dependencies — it is plain HTML, CSS and JavaScript.

    node serve.js

Then open http://localhost:5173. Any static file server works just as well.
