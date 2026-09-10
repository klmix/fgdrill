// Verzeichnis der Spiele. Ein neues Spiel wird hier eingetragen, nachdem
// seine Datei in index.html geladen wurde - sonst ist nichts zu tun.
const GAMES = [
  GAME_GGST,
  GAME_SF6,
];

const GAME_BY_ID = new Map(GAMES.map((g) => [g.id, g]));

function gameById(id) {
  return GAME_BY_ID.get(id) ?? GAMES[0];
}
