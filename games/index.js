// Verzeichnis der Spiele. Ein neues Spiel wird hier eingetragen, nachdem
// seine Datei in index.html geladen wurde - sonst ist nichts zu tun.
const GAMES = [
  GAME_GGST,
  GAME_SF6,
  GAME_BBCF,
  GAME_GBVSR,
];

const GAME_BY_ID = new Map(GAMES.map((g) => [g.id, g]));

function gameById(id) {
  return GAME_BY_ID.get(id) ?? GAMES[0];
}

// Selbst angelegte Spiele stehen im Browser und kommen beim Laden dazu.
// Sie sind reiner Text: Bilder liegen als Adresse dabei, damit sich so ein
// Spiel weitergeben laesst, ohne Dateien mitzuschicken.
const CUSTOM_KEY = "fgdrills-custom-games";

function registerGame(spiel) {
  spiel.custom = true;
  const alt = GAME_BY_ID.get(spiel.id);
  if (alt) GAMES[GAMES.indexOf(alt)] = spiel;
  else GAMES.push(spiel);
  GAME_BY_ID.set(spiel.id, spiel);
}

function loadCustomGames() {
  let liste;
  try {
    liste = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]");
  } catch {
    return;
  }
  if (!Array.isArray(liste)) return;

  for (const spiel of liste) {
    if (checkGame(spiel) === null) registerGame(spiel);
  }
}

// Prueft eine Spieldefinition. Gibt null zurueck, wenn sie taugt, sonst
// den Grund - so kann der Dialog ihn anzeigen statt still zu scheitern.
function checkGame(g) {
  if (!g || typeof g !== "object") return "Not an object";
  if (!/^[a-z0-9-]{2,20}$/.test(g.id ?? "")) return "id: 2-20 characters, a-z 0-9 and -";
  if (!g.name) return "name is missing";
  if (!Array.isArray(g.characters) || g.characters.length === 0) return "characters is empty";

  for (const c of g.characters) {
    if (!c?.id || !c?.name) return "every character needs an id and a name";
  }
  if (new Set(g.characters.map((c) => c.id)).size !== g.characters.length) {
    return "character ids must be unique";
  }

  const n = g.notation;
  if (!n || !Array.isArray(n.buttons) || n.buttons.length === 0) return "notation.buttons is empty";
  for (const b of n.buttons) {
    if (!b?.id || !b?.match) return "every button needs an id and a match";
    try {
      new RegExp(b.match);
    } catch {
      return "button " + b.id + ": match is not a valid pattern";
    }
  }
  return null;
}
