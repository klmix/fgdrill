/* ============================================================
   Combo-Seite: Eingabefeld + Charakterauswahl
   ============================================================ */

const input       = document.getElementById("comboInput");
const highlight   = document.getElementById("comboHighlight");
const comment     = document.getElementById("commentInput");
const persistBox  = document.getElementById("persistInput");
const persistRow  = document.getElementById("composerUtils");
const exportBtn   = document.getElementById("exportButton");
const posBtn      = document.getElementById("positionButton");
const posMenu     = document.getElementById("positionMenu");
const positionIcon= document.getElementById("positionIcon");
const pickerBtn   = document.getElementById("pickerButton");
const pickerLabel = document.getElementById("pickerLabel");
const panel       = document.getElementById("pickerPanel");
const whoBtn      = document.getElementById("whoButton");
const whoPanel    = document.getElementById("whoPanel");
const whoGrid     = document.getElementById("whoGrid");
const stateBtn    = document.getElementById("stateButton");
const statePanel  = document.getElementById("statePanel");
const stateList   = document.getElementById("stateList");
const stateLabel  = document.getElementById("stateLabel");
const stateAdd    = document.getElementById("stateAdd");
const stateInput  = document.getElementById("stateInput");
const whoPortrait = document.getElementById("whoPortrait");
const whoName     = document.getElementById("whoName");

// Flip-Huelle und ihre beiden Seiten
const flip        = document.getElementById("flip");
const frontFace   = document.querySelector(".flip__front");
const backFace    = document.querySelector(".flip__back");
const tools       = document.getElementById("pickerTools");
const grid        = document.getElementById("charGrid");

// ============================================================
//  Das gewaehlte Spiel
//  Alles Spielspezifische kommt aus games/*.js. Die Bindungen hier
//  zeigen auf das gerade gewaehlte Spiel und werden von applyGameData()
//  neu gesetzt - deshalb let und nicht const.
// ============================================================
let GAME;
let CHARACTERS;
let CHAR_BY_ID;
let BASE_ROSTER;
let STATE_DEFAULTS;
let SHARE_PREFIX;
let BUTTONS;          // nach Laenge sortiert, laengste zuerst
let TOKEN_RE;
let ACTION_FORM;
let COLOR_ROLES;

// "drill" ist eine Sondermarke: solche Combos umgehen den Wiederholungsplan
// und sind in jeder Sitzung dabei. Sie beschreibt keinen Dummy-Zustand,
// taucht deshalb weder in der Sortierreihenfolge noch bei den uebrigen
// Marken auf - in der Liste steht sie dort, wo sonst der Plan-Stand waere.
// Erkannt wird sie am Namen ohne Zeichen, damit auch alte Ablagen ohne
// Zielscheibe weiter greifen.
const DRILL_STATE = "drill";

const CATEGORY_DEFAULTS = [DRILL_STATE];

// Schluessel fuer "in keiner Kategorie". Leer, damit er mit keinem
// echten Namen zusammenfallen kann.
const NO_CATEGORY = "";

// Zeichen, die in einem regulaeren Ausdruck etwas bedeuten, entschaerfen.
// Notwendig, weil Schreibweisen wie "(CH)" woertlich gemeint sind.
function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Lange Schreibweisen zuerst, sonst schluckt die kurze das Ende der
// langen - "RC" wuerde sonst aus "FRRC" nur das Ende treffen.
function longestFirst(liste) {
  return [...liste].sort((a, b) => b.length - a.length);
}

// Baut den Zerteiler aus der Notation eines Spiels. Die Gruppen behalten
// ihre Nummern, tokenize() und normalizeCombo() haengen daran.
function buildNotation(n) {
  const btns = n.buttons.map((b) => b.match).join("|");
  const prefix = "(?:(?:" + longestFirst(n.prefixes).map(escapeRe).join("|") + ")\\.)*";
  const dirs = n.directions ? "(?:\\[[1-9]\\]|[1-9])*" : "";

  // Buttons koennen gehalten "[H]" oder losgelassen "]H[" sein.
  const btnTeil = "(?:\\[(?:" + btns + ")+\\]|\\](?:" + btns + ")+\\[|(?:" + btns + ")+)";

  const cancel = longestFirst(n.cancels?.forms ?? []).map(escapeRe).join("|");
  const counter = longestFirst(n.counter?.forms ?? []).map(escapeRe).join("|");
  const action = longestFirst(Object.keys(n.actions?.forms ?? {})).map(escapeRe).join("|");

  // Nie leer lassen: eine leere Alternative wuerde ueberall treffen und
  // die Schleife zum Stillstand bringen.
  const nie = "(?!)";

  // Die Klammer mit den Wortgrenzen umschliesst alle bedeutungstragenden
  // Tokens: nur so bleibt "hello" ein Wort und wird nicht eingefaerbt.
  const re = new RegExp(
    "(?<![A-Za-z])(?:" +
      "(" + (cancel || nie) + ")" +                        // 1 Cancel-Familie
      "|(" + (counter || nie) + ")" +                      // 2 Counter Hit
      "|(" + prefix + dirs + "(" + btnTeil + "))" +        // 3 Term, 4 Buttons
      "|(" + (action || nie) + ")" +                       // 5 Bewegung/Cancel
      (n.directions ? "|([1-9]+)" : "|(" + nie + ")") +    // 6 Richtung ohne Button
    ")(?![A-Za-z])" +
      "|([>,~+/()\\[\\]:*])" +                             // 7 Trenner
      "|([\\s\\S])",                                       // 8 alles andere
    "gi"
  );

  return {
    re,
    actionForm: { ...(n.actions?.forms ?? {}) },
    buttons: [...n.buttons]
      .sort((a, b) => b.match.length - a.match.length)
      .map((b) => ({ ...b, re: new RegExp("^(?:" + b.match + ")", "i") })),
  };
}

// Welche Farben sich einstellen lassen. Die Buttons kommen aus dem Spiel,
// der Rest sind Rollen, die jedes Spiel hat.
function buildColorRoles(n) {
  const rollen = n.buttons.map((b) => ({
    key: "--tok-btn-" + b.id,
    label: b.label,
    sample: b.sample ?? b.id,
    kinds: b.kinds ?? "",
  }));

  for (const [teil, key] of [[n.cancels, "--tok-rc"], [n.counter, "--tok-ch"], [n.actions, "--tok-act"]]) {
    if (!teil) continue;
    rollen.push({ key, label: teil.label, sample: teil.sample, kinds: teil.kinds ?? "" });
  }

  if (n.directions) {
    rollen.push({ key: "--tok-dir", label: "Directions", sample: "236",
      kinds: "A motion on its own, without a button: 236, 5, [4]6" });
  }

  rollen.push({ key: "--tok-sep", label: "Separators", sample: ">",
    kinds: "> , ~ + / ( ) [ ] : *" });
  rollen.push({ key: "--tok-text", label: "Plain text", sample: "note",
    kinds: "Everything that is not notation" });

  return rollen;
}

// Setzt die Bindungen auf ein Spiel um. Beruehrt den Zustand nicht -
// das macht switchGame().
function applyGameData(game) {
  GAME = game;
  // Eigene Kopie: die eigenen Charaktere kommen spaeter dazu, und die
  // Liste der Spieldatei darf davon nichts mitbekommen.
  CHARACTERS = [...game.characters];
  CHAR_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));
  // Ohne Angabe steht das ganze Roster zur Wahl. Die Liste ist nur
  // noetig, wenn ein Teil hinter einem Zusatzkauf liegt.
  BASE_ROSTER = game.baseRoster ?? game.characters.map((c) => c.id);
  // Die Drill-Marke der Spieldateien ist jetzt eine Kategorie.
  STATE_DEFAULTS = (game.states ?? []).filter((n) => !istDrillName(n));
  SHARE_PREFIX = game.sharePrefix;

  const notation = buildNotation(game.notation);
  TOKEN_RE = notation.re;
  ACTION_FORM = notation.actionForm;
  BUTTONS = notation.buttons;
  COLOR_ROLES = buildColorRoles(game.notation);
}

// Die selbst angelegten Charaktere haengen hinten an der Liste des Spiels.
// Sie stehen damit ueberall zur Verfuegung - Auswahl, Gegner, Sortierung -
// ohne dass eine einzelne Stelle sie gesondert kennen muesste.
function applyCustomChars() {
  CHARACTERS = [...GAME.characters, ...state.customChars];
  CHAR_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));
  for (const char of state.customChars) state.selected.add(char.id);
}

// Muss vor allem anderen laufen: der Zustand unten greift schon darauf zu.
applyGameData(GAMES[0]);

// Zu welchem Spiel gehoert dieser Code? Erkannt werden alle Spiele, nicht
// nur das gerade offene - sonst landete ein fremder Code stillschweigend
// als Combo-Text im Eingabefeld.
function shareGame(text) {
  const t = text.trim();
  return GAMES.find((g) => t.startsWith(g.sharePrefix)) ?? null;
}

function looksLikeShare(text) {
  return shareGame(text) !== null;
}

// --- Zustand -------------------------------------------------
const state = {
  // Fuer welchen Charakter werden gerade Combos gesammelt (der eigene).
  character: CHARACTERS[0].id,
  // Gegen welche Charaktere die Combo gilt. Alle sind zu Beginn gewaehlt;
  // "gilt fuer alle" ist damit kein eigener Modus, sondern eine volle Auswahl.
  selected: new Set(CHARACTERS.map((c) => c.id)),
  position: "everywhere", // Bildschirmposition, siehe POSITIONS
  entries: [],            // bereits angelegte Combos
  expanded: new Set(),    // Charaktere, deren Liste komplett gezeigt wird
  editing: new Set(),     // Charaktere, deren Combos gerade bearbeitet werden
  training: null,         // laeuft ein Training? { queue, index, elapsed, since, editing }

  // Freie Marken fuer Zusatzinfos. Die Vorgaben stehen in STATE_DEFAULTS,
  // alles Weitere legt der Benutzer selbst an.
  states: [],             // wird aus STATE_DEFAULTS gefuellt, siehe unten
  categories: [],         // Kategorien; "drill" ist immer dabei
  category: null,         // was die naechste Karte bekommt
  groupByCategory: true,  // in der Liste nach Kategorie gruppieren?
  activeStates: new Set(),   // was die naechste Combo mitbekommt
  reviewed: {},              // Tagespensum je Charakter: { day, count }
  routines: [],              // eigene Trainingsplaene, siehe unten
  customChars: [],           // selbst angelegte Charaktere, siehe unten
};

// Marken duerfen mit einem Zeichen beginnen, z.B. "🎯 drill". Das Zeichen
// gehoert zum Namen, wird aber getrennt angezeigt: im Menue steht es
// anstelle des Farbpunkts.
function firstGrapheme(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    for (const teil of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)) {
      return teil.segment;
    }
    return "";
  }
  return [...text][0] ?? "";   // Notnagel: erstes Zeichen
}

function splitTag(name) {
  const roh = String(name).trim();
  const erstes = firstGrapheme(roh);

  // Alles jenseits der lateinischen Schrift behandeln wir als Zeichen.
  if (erstes && erstes.codePointAt(0) > 0x2000) {
    const rest = roh.slice(erstes.length).trim();
    if (rest) return { emoji: erstes, label: rest };
  }
  return { emoji: "", label: roh };
}

function tagLabel(name) {
  return splitTag(name).label;
}

// Einzige Quelle fuer die Vorgaben - sonst laufen Startliste und
// Nachtrag beim Laden auseinander.
state.states = [...STATE_DEFAULTS];
state.categories = [...CATEGORY_DEFAULTS];


// ============================================================
//  Kategorien
//  Eine Karte gehoert in hoechstens eine Kategorie. "drill" ist die
//  erste und laeuft am Wiederholungsplan vorbei - frueher war das eine
//  Marke, aber es beschreibt keinen Dummy-Zustand, sondern die Art der
//  Karte. Deshalb ein eigenes Feld.
// ============================================================

function categoryOf(entry) {
  return entry.category ?? null;
}

// Aus alten Ablagen: die Marke "drill" wird zur Kategorie.
function migrateDrillState(entry) {
  if (entry.category !== undefined) return;

  const marke = (entry.states ?? []).find(istDrillName);
  entry.category = marke ? DRILL_STATE : null;
  if (marke) entry.states = (entry.states ?? []).filter((n) => !istDrillName(n));
}

function istDrillName(name) {
  return tagLabel(name).toLowerCase() === DRILL_STATE;
}

function isDrill(entry) {
  return categoryOf(entry) === DRILL_STATE;
}

// Marken beschreiben jetzt nur noch den Dummy - die Sondermarke ist weg.
function visibleStates(entry) {
  return entry.states ?? [];
}

// Marken in der Reihenfolge stehen unter ihrem Namen, die beiden festen
// Kriterien unter diesen Kuerzeln.
const ORDER_CH = "@ch";
const ORDER_POS = "@pos";
const ORDER_MOVE = "@move";   // erster Move der Combo

// Die festen Kriterien; sie bleiben immer in der Liste.
const ORDER_FIXED = [ORDER_CH, ORDER_POS, ORDER_MOVE];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Positionen im Training, aufsteigend nach Aufwand. "everywhere" fehlt
// bewusst: solche Combos passen ueberall und werden dazwischengestreut.
const TRAINING_POSITIONS = ["center", "corner", "backtocorner"];

const TAG = 24 * 60 * 60 * 1000;

// Die Vorgaben haengen am Spiel - Marken, Roster, Reihenfolge. Deshalb
// eine Funktion und kein Literal: beim Spielwechsel wird sie neu gerufen.
function defaultSettings() {
  return {
    // Was zuerst zusammengefasst wird. Oben zuerst; per Ziehen aenderbar.
    // Der Charakterwechsel steht bewusst nicht drin: er ist immer das
    // Teuerste und daher fest an erster Stelle.
    // Start Move steht ganz unten - er gruppiert am feinsten und
    // kostet im Spiel gar nichts.
    order: [...STATE_DEFAULTS, ORDER_CH, ORDER_POS, ORDER_MOVE],

    // Beschriftung der Bewertungsknoepfe. Die Punktwertung haengt nicht
    // daran - sie ist fest, sonst waere der Prozentwert nicht vergleichbar.
    grades: { custom: false, again: "0/10", hard: "3+/10", good: "6+/10", easy: "9+/10" },

    colors: {},   // eigene Notationsfarben, nur die Abweichungen
    rules: [],    // eigene Muster: { name, pattern, color }

    randomCharacter: false,
    allowedChars: new Set(BASE_ROSTER),

    sr: {
      enabled: true,
      perDay: 10,      // wie viele neue Sachen je Zeitraum; null = ohne Deckel
      newDays: 1,      // Laenge des Zeitraums in Tagen
      maxDays: 7,      // Obergrenze fuer den Aufschub
    },
  };
}

// Setzt alles Spielabhaengige auf die Vorgaben zurueck. Danach legt
// loadStored() den gespeicherten Stand des Spiels darueber.
function resetStateForGame() {
  state.character = CHARACTERS[0].id;
  state.selected = new Set(CHARACTERS.map((c) => c.id));
  state.position = "everywhere";
  state.entries = [];
  state.expanded = new Set();
  state.editing = new Set();
  state.states = [...STATE_DEFAULTS];
  state.categories = [...CATEGORY_DEFAULTS];
  state.category = null;
  state.activeStates = new Set();
  state.reviewed = {};
  state.routines = [];
  state.customChars = [];
  state.settings = defaultSettings();
}

state.settings = defaultSettings();

// ============================================================
//  Reihenfolge im Training
//  Ziel ist, im Spiel moeglichst selten etwas umstellen zu muessen.
// ============================================================
function istBuchstabe(c) {
  return !!c && ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z"));
}

// Counter Hit zaehlt an jeder Stelle der Combo, nicht nur am Anfang.
function entryHasCH(entry) {
  const gross = (entry.text ?? "").toUpperCase();

  for (let i = 0; i < gross.length; i++) {
    if (!gross.startsWith("CH", i)) continue;
    if (istBuchstabe(gross[i - 1]) || istBuchstabe(gross[i + 2])) continue;
    return true;
  }
  return false;
}

function entryPositionRank(entry) {
  const i = TRAINING_POSITIONS.indexOf(entry.position);
  // "everywhere" kostet keine Umstellung, also zufaellig dazwischen -
  // sonst bildete es einen eigenen Block am Ende.
  return i >= 0 ? i : Math.random() * TRAINING_POSITIONS.length;
}

// Innerhalb einer Ebene wird die Reihenfolge der Werte je Runde neu
// ausgewuerfelt: mal kommt Center zuerst, mal Corner, mal Back to Corner -
// und bei Marken oder Counter Hit mal die eine, mal die andere Gruppe.
// Die Ebenen selbst bleiben in der eingestellten Reihenfolge, und die Zahl
// der noetigen Umstellungen im Spiel aendert sich dadurch nicht.
function shuffle(liste) {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeOrderSalt(entries = []) {
  return {
    // Je Kriterium: kommt die zutreffende Gruppe zuerst oder zuletzt?
    flip: state.settings.order.map(() => Math.random() < 0.5),
    positions: shuffle(TRAINING_POSITIONS),
    // Startmoves stehen nicht vorher fest, sie kommen aus der Auswahl.
    moves: shuffle([...new Set(entries.map(startMove))]),
  };
}

// Ein Schluessel je Kriterium, in der eingestellten Reihenfolge.
// Bei Marken zaehlt nur "hat sie oder nicht" - so landen alle mit
// derselben Marke beieinander.
function sortKeys(entry, salt) {
  return state.settings.order.map((token, i) => {
    const dreh = (wert) => (salt.flip[i] ? 1 - wert : wert);

    if (token === ORDER_CH) return dreh(entryHasCH(entry) ? 0 : 1);

    if (token === ORDER_MOVE) {
      const platz = salt.moves.indexOf(startMove(entry));
      return platz >= 0 ? platz : salt.moves.length;
    }

    if (token === ORDER_POS) {
      const platz = salt.positions.indexOf(entry.position);
      // "everywhere" kostet keine Umstellung, also zufaellig dazwischen -
      // sonst bildete es einen eigenen Block am Ende.
      return platz >= 0 ? platz : Math.random() * salt.positions.length;
    }

    return dreh((entry.states ?? []).some((n) => n.toLowerCase() === token.toLowerCase()) ? 0 : 1);
  });
}

function sortForTraining(entries, salt = makeOrderSalt()) {
  // Die Schluessel werden einmal berechnet: der Zufallswert fuer
  // "everywhere" darf sich waehrend des Sortierens nicht aendern,
  // sonst waeren die Vergleiche widerspruechlich.
  return entries
    .map((entry) => ({ entry, keys: sortKeys(entry, salt) }))
    .sort((a, b) => {
      for (let i = 0; i < a.keys.length; i++) {
        if (a.keys[i] !== b.keys[i]) return a.keys[i] - b.keys[i];
      }
      return 0;
    })
    .map((x) => x.entry);
}

// ============================================================
//  Spaced Repetition
//  Bewusst schlicht gehalten: das Intervall waechst je nach Note und
//  wird bei der eingestellten Obergrenze gekappt.
// ============================================================
const GRADE_FACTOR = { hard: 1.3, good: 2.2, easy: 3.5 };
const GRADE_FIRST = { hard: 1, good: 1, easy: 2 };

const GRADE_DEFAULT = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };

// Wieviel zaehlt eine Note fuer den Prozentwert am Ende? Fest verdrahtet,
// damit sich Ergebnisse vergleichen lassen, egal wie die Knoepfe heissen.
const GRADE_SCORE = { again: 0, hard: 3, good: 7, easy: 10 };

function gradeLabel(g) {
  const eigen = state.settings.grades;
  return eigen.custom && eigen[g] ? eigen[g] : GRADE_DEFAULT[g];
}

// Wie lange wuerde diese Note die Combo aufschieben? Wird sowohl fuer die
// Beschriftung der Knoepfe als auch fuers Anwenden benutzt - zwei Rechnungen
// koennten auseinanderlaufen.
function previewInterval(entry, grade, teil = null) {
  if (!state.settings.sr.enabled || isDrill(entry)) return null;
  if (grade === "again") return 0;

  const alt = srOf(entry, teil).interval || 0;
  const neu = alt <= 0 ? GRADE_FIRST[grade] : alt * GRADE_FACTOR[grade];
  return Math.min(neu, state.settings.sr.maxDays);
}

function describeInterval(tage) {
  if (tage === null) return "";
  if (tage <= 0) return "now";
  if (tage < 1) return "under 1 day";

  const gerundet = Math.round(tage * 10) / 10;
  return String(gerundet) + (gerundet === 1 ? " day" : " days");
}

function applyGrade(entry, grade, teil = null) {
  const traeger = srOf(entry, teil);
  traeger.lastGrade = grade;        // auch ohne Plan fuer die Liste interessant

  const tage = previewInterval(entry, grade, teil);
  if (tage === null) return;        // Plan aus oder Drill

  traeger.interval = tage;
  traeger.due = Date.now() + tage * TAG;
}

// Gegen welche der erlaubten Charaktere funktioniert diese Combo?
function moeglicheGegner(entry) {
  const eigene = entry.characters === "ALL"
    ? CHARACTERS.map((c) => c.id)
    : entry.characters;
  return new Set(eigene.filter((id) => state.settings.allowedChars.has(id)));
}

// Einen Gegner umzustellen ist im Spiel das Aufwendigste. Also moeglichst
// wenige verschiedene: wiederholt den Charakter nehmen, der die meisten
// offenen Combos abdeckt. Bei Gleichstand entscheidet der Zufall, damit
// nicht jede Sitzung denselben Charakter waehlt.
function assignCharacters(entries) {
  const moeglich = new Map(entries.map((e) => [e, moeglicheGegner(e)]));

  // Combos, die mit keinem erlaubten Charakter gehen, bekommen keinen.
  const neutral = entries.filter((e) => moeglich.get(e).size === 0);
  let offen = entries.filter((e) => moeglich.get(e).size > 0);

  const gruppen = [];
  while (offen.length > 0) {
    const zaehler = new Map();
    for (const e of offen) {
      for (const id of moeglich.get(e)) zaehler.set(id, (zaehler.get(id) ?? 0) + 1);
    }

    const meiste = Math.max(...zaehler.values());
    const kandidaten = [...zaehler].filter(([, n]) => n === meiste).map(([id]) => id);
    const gewaehlt = kandidaten[Math.floor(Math.random() * kandidaten.length)];

    gruppen.push({
      charId: gewaehlt,
      entries: offen.filter((e) => moeglich.get(e).has(gewaehlt)),
    });
    offen = offen.filter((e) => !moeglich.get(e).has(gewaehlt));
  }

  // Die neutralen haengen hinten dran: so erzwingen sie keinen Wechsel.
  if (neutral.length > 0) {
    if (gruppen.length > 0) gruppen[gruppen.length - 1].neutral = neutral;
    else gruppen.push({ charId: null, entries: [], neutral });
  }

  return gruppen;
}

// Was steht heute an? Erst die faelligsten, dann in Trainingsreihenfolge.
// Rueckgabe sind Paare aus Combo und dem Gegner, auf den sie geuebt wird.
// Tagespensum: je Charakter ein eigenes Konto, wie ein Deck in Anki.
// Der Schluessel kommt aus der lokalen Zeit, nicht aus UTC - sonst
// waechselte der Tag mitten am Abend.
function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

// Noch nie geuebt? Daran haengt der Deckel: was einmal dran war, kommt
// danach immer, wenn es faellig ist.
function isNewCard(entry, teil = null) {
  const traeger = srOf(entry, teil);
  return !traeger.lastGrade && !traeger.interval;
}

function hasNewCards(entry) {
  if (!hasParts(entry)) return isNewCard(entry);
  return entry.parts.some((_, i) => isNewCard(entry, i)) || isNewCard(entry);
}

// Wie viele neue Sachen sind im laufenden Zeitraum schon dazugekommen?
// Der Zeitraum beginnt beim ersten neuen Stueck und laeuft ueber so viele
// Tage, wie eingestellt sind.
function newWindow(charId) {
  const eintrag = state.reviewed[charId];
  if (!eintrag || !eintrag.start) return null;

  const tage = Math.max(1, state.settings.sr.newDays || 1);
  const abgelaufen = Date.now() - eintrag.start >= tage * TAG;
  return abgelaufen ? null : eintrag;
}

function newBudgetLeft(charId) {
  const sr = state.settings.sr;
  if (sr.perDay === null) return Infinity;

  const fenster = newWindow(charId);
  return Math.max(0, sr.perDay - (fenster ? fenster.count : 0));
}

function noteNewCard(charId) {
  const fenster = newWindow(charId);
  if (fenster) fenster.count++;
  else state.reviewed[charId] = { start: Date.now(), count: 1 };
}

// Der Plan-Anteil: was heute laut Wiederholung ansteht.
function dueSelection(charId) {
  const aktiv = state.entries.filter((e) => e.character === charId && !e.disabled);
  const sr = state.settings.sr;
  if (!sr.enabled) return [];

  const jetzt = Date.now();

  // Drill-Combos sind immer dabei und zaehlen nicht gegen den Deckel -
  // sonst koennte er sie wegschneiden.
  const drill = aktiv.filter(isDrill);
  // Bei zerschnittenen Combos zaehlt der frueheste Termin von Teil oder
  // Ganzem - sonst laege die Combo still, bis das Ganze faellig waere.
  const termin = (e) => {
    const eigene = [e, ...(hasParts(e) ? e.parts : [])].map((x) => x.due || 0);
    return Math.min(...eigene);
  };

  const geplant = aktiv
    .filter((e) => !isDrill(e))
    .filter((e) => termin(e) <= jetzt)
    .sort((a, b) => termin(a) - termin(b));   // laengst faellige zuerst

  // Was schon einmal dran war, kommt immer. Gedeckelt wird nur, wie
  // schnell Neues in den Umlauf kommt - sonst waechst der Berg schneller,
  // als man ihn abtragen kann.
  const bekannt = geplant.filter((e) => !hasNewCards(e));
  const neu = geplant.filter(hasNewCards);

  return [...drill, ...bekannt, ...neu.slice(0, newBudgetLeft(charId))];
}

// Was steht heute an? Erst die faelligsten, dann in Trainingsreihenfolge.
// Rueckgabe sind Paare aus Combo und dem Gegner, auf den sie geuebt wird.
// Ein Eintrag wird zu einer oder mehreren Karten: die Teile einzeln und,
// sobald freigeschaltet, die Gesamtcombo. "alles" heisst gezielte Runde
// oder Grinden - dann zaehlt Faelligkeit nicht.
function cardsOf(entry, alles) {
  const faellig = (traeger) =>
    alles || !state.settings.sr.enabled || !traeger.due || traeger.due <= Date.now();

  if (!hasParts(entry)) return [{ teil: null }];

  const karten = entry.parts
    .map((_, i) => i)
    .filter((i) => faellig(entry.parts[i]))
    .map((i) => ({ teil: i }));

  if (wholeUnlocked(entry) && faellig(entry)) karten.push({ teil: null });

  // Nichts faellig, aber die Combo ist trotzdem dran: dann das Ganze.
  return karten.length ? karten : [{ teil: null }];
}

// Setzt die Karten in die fertig sortierte Schlange ein. Teile bleiben
// beieinander, es sei denn der Eintrag erlaubt es anders - dann werden sie
// unter die uebrigen Karten gestreut.
function expandQueue(queue, alles) {
  const fest = [];
  const lose = [];

  for (const posten of queue) {
    const karten = cardsOf(posten.entry, alles);
    const streuen = hasParts(posten.entry) && posten.entry.chain === false;

    for (const karte of karten) {
      const neu = { ...posten, teil: karte.teil };
      // Die Gesamtcombo bleibt immer an ihrem Platz; nur Teile wandern.
      (streuen && karte.teil !== null ? lose : fest).push(neu);
    }
  }

  for (const posten of lose) {
    fest.splice(Math.floor(Math.random() * (fest.length + 1)), 0, posten);
  }
  return fest;
}

// Wie viele Drills stehen fuer diesen Charakter an? Gezaehlt werden
// Karten, nicht Eintraege: eine zerschnittene Combo bringt mehrere mit.
// Das Tagespensum ist eingerechnet - die Zahl sagt also, was eine Runde
// jetzt vorlegen wuerde.
function dueCount(charId) {
  return dueSelection(charId)
    .reduce((summe, entry) => summe + cardsOf(entry, false).length, 0);
}

// Reihenfolge wie in der Combo-Liste: wer zuletzt dran war, steht vorn,
// und wer noch nichts hat, kommt dahinter in der Reihenfolge des Rosters.
function charactersByActivity() {
  const mitDrills = [];
  const ohne = [];

  for (const char of CHARACTERS) {
    (state.entries.some((e) => e.character === char.id) ? mitDrills : ohne).push(char);
  }

  mitDrills.sort((a, b) => lastTouched(b.id) - lastTouched(a.id));
  return [...mitDrills, ...ohne];
}

// Alles, was sich fuer diesen Charakter ueben laesst.
function trainableEntries(charId) {
  return state.entries.filter((e) => e.character === charId && !e.disabled);
}

// Die Runde nach Plan: nur was heute ansteht, und die Noten zaehlen.
function srQueue(charId) {
  return expandQueue(ordneRunde(dueSelection(charId)), false);
}

// Gezielt ueben: die gewaehlten Kategorien, ohne Ruecksicht auf den Plan.
// Der leere Schluessel steht fuer "in keiner Kategorie".
function grindQueue(charId, kategorien) {
  const auswahl = trainableEntries(charId)
    .filter((e) => kategorien.has(categoryOf(e) ?? NO_CATEGORY));
  return expandQueue(ordneRunde(auswahl), true);
}

// Die Schritte einer Routine, die es noch gibt. Ein Schritt darf mehrfach
// vorkommen - genau das ist der Zweck.
function routineSteps(routine) {
  const bekannt = new Map(trainableEntries(routine.char).map((e) => [e.id, e]));
  return routine.items.map((id) => bekannt.get(id)).filter(Boolean);
}

// Nach einer Routine ueben: die Reihenfolge stammt vom Benutzer und wird
// nicht angetastet - weder sortiert noch gemischt. Der Gegner wird je
// Schritt gewuerfelt, denn gruppieren wuerde die Reihenfolge brechen.
function routineQueue(routine) {
  const queue = [];

  for (const entry of routineSteps(routine)) {
    let gegner = null;
    if (state.settings.randomCharacter) {
      const moeglich = [...moeglicheGegner(entry)];
      gegner = moeglich.length
        ? moeglich[Math.floor(Math.random() * moeglich.length)]
        : null;
    }
    for (const karte of cardsOf(entry, true)) {
      queue.push({ entry, charId: gegner, teil: karte.teil });
    }
  }
  return queue;
}

function routinesFor(charId) {
  return state.routines.filter((r) => r.char === charId);
}

// Sortieren und, wenn gewuenscht, auf Gegner aufteilen.
function ordneRunde(auswahl) {
  // Ein Wurf fuer die ganze Runde: sonst sortierte jede Gegner-Gruppe
  // nach einer anderen Reihenfolge.
  const salt = makeOrderSalt(auswahl);

  if (!state.settings.randomCharacter) {
    return sortForTraining(auswahl, salt).map((entry) => ({ entry, charId: null }));
  }

  // Der Charakterwechsel steht ueber allem: erst in Gruppen teilen,
  // dann jede Gruppe fuer sich sortieren.
  const queue = [];
  for (const gruppe of assignCharacters(auswahl)) {
    for (const entry of sortForTraining(gruppe.entries, salt)) {
      queue.push({ entry, charId: gruppe.charId });
    }
    for (const entry of sortForTraining(gruppe.neutral ?? [], salt)) {
      queue.push({ entry, charId: gruppe.charId, neutral: true });
    }
  }
  return queue;
}

function allSelected() {
  return state.selected.size === CHARACTERS.length;
}

// ============================================================
//  Ausklapp-Menues
//  Alle an einer Stelle registriert, damit nie zwei gleichzeitig
//  offen sind - sonst muesste jedes Menue jedes andere kennen.
// ============================================================
const POPOVERS = [];

// Die Gegnerauswahl haengt an einem Eintrag und wird bei jedem Neuzeichnen
// neu gebaut. Sie kann deshalb nicht ins Register - das wuerde bei jedem
// Rendern weiter wachsen. Es ist immer hoechstens eine offen.
let openEntryPicker = null;

function closeEntryPicker(neuZeichnen = true) {
  if (!openEntryPicker) return;

  openEntryPicker.menu.hidden = true;
  openEntryPicker.menu.innerHTML = "";     // 32 Kacheln nicht liegen lassen
  openEntryPicker.button.setAttribute("aria-expanded", "false");
  openEntryPicker = null;

  // Erst jetzt neu zeichnen: waehrend der Auswahl wuerde das Menue sonst
  // unter den Fingern verschwinden.
  if (neuZeichnen) renderEntries();
}

function closePopover(po) {
  po.menu.hidden = true;
  po.button.setAttribute("aria-expanded", "false");
}

function openPopover(po) {
  POPOVERS.forEach(closePopover);
  closeEntryPicker();
  po.menu.hidden = false;
  po.button.setAttribute("aria-expanded", "true");
}

// canOpen ist optional: gibt es die Pruefung und sagt sie nein, bleibt das
// Menue zu. CSS allein reicht dafuer nicht - pointer-events stoppt nur echte
// Mausklicks, per Tastatur waere das Menue weiter erreichbar.
function registerPopover(button, menu, canOpen) {
  const po = { button, menu };
  POPOVERS.push(po);

  button.addEventListener("click", () => {
    if (canOpen && !canOpen()) return;
    menu.hidden ? openPopover(po) : closePopover(po);
  });

  return po;
}

document.addEventListener("click", (e) => {
  POPOVERS.forEach((po) => {
    if (po.menu.hidden) return;
    if (!po.menu.contains(e.target) && !po.button.contains(e.target)) closePopover(po);
  });

  if (openEntryPicker &&
      !openEntryPicker.menu.contains(e.target) &&
      !openEntryPicker.button.contains(e.target)) {
    closeEntryPicker();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (dlg.open || settingsDlg.open) return;   // Dialoge schliessen sich selbst

  if (openEntryPicker) {
    closeEntryPicker();   // der Knopf wird beim Neuzeichnen ersetzt
    return;
  }

  const offen = POPOVERS.find((po) => !po.menu.hidden);
  if (offen) {
    closePopover(offen);
    offen.button.focus();
  }
});

// --- Textfelder wachsen mit dem Inhalt -----------------------
function autoGrow(feld) {
  feld.style.height = "auto";
  const max = parseFloat(getComputedStyle(feld).maxHeight);
  const height = Number.isFinite(max) ? Math.min(feld.scrollHeight, max) : feld.scrollHeight;
  feld.style.height = height + "px";
}

// ============================================================
//  Combo einfaerben (Farbschema wie auf Dustloop)
//  Die farbige Fassung liegt als eigene Ebene hinter dem Textfeld,
//  weil ein <textarea> selbst keine Teilfarben kann.
// ============================================================
// Welcher Button steckt im Button-Teil eines Terms? Die Klammern des
// Haltens fallen weg; gesucht wird die laengste passende Schreibweise,
// damit in einem Spiel mit P und LP nicht das kurze gewinnt.
function buttonIdOf(text) {
  const roh = text.replace(/[\[\]]/g, "");
  for (const b of BUTTONS) {
    if (b.re.test(roh)) return b.id;
  }
  return BUTTONS[0].id;
}

function escapeHtml(text) {
  return text.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
}

// Liefert die eingefaerbte HTML-Fassung eines Combo-Textes.
// Wird von der Editor-Ebene und von der Liste darunter genutzt.
// Eigene Regeln werden vor der eingebauten Notation geprueft. Sticky,
// damit ein Treffer genau an der Stelle sitzt statt weiter hinten - sonst
// wuerde die Regel Text ueberspringen.
let ruleCache = null;

function invalidateRules() {
  ruleCache = null;
}

function compiledRules() {
  if (ruleCache) return ruleCache;

  ruleCache = [];
  for (const regel of state.settings.rules) {
    try {
      ruleCache.push({
        color: regel.color,
        re: new RegExp("(?:" + regel.pattern + ")", "yi"),
      });
    } catch {
      // Kaputte Muster werden beim Anlegen abgefangen; hier still ueberspringen.
    }
  }
  return ruleCache;
}

// Trifft an dieser Stelle eine eigene Regel? Leertreffer werden verworfen,
// sonst kaeme die Schleife nicht von der Stelle.
function matchRule(text, i) {
  for (const regel of compiledRules()) {
    regel.re.lastIndex = i;
    const treffer = regel.re.exec(text);
    if (treffer && treffer[0].length > 0) {
      return { text: treffer[0], color: regel.color };
    }
  }
  return null;
}

function tokenize(text) {
  let html = "";
  let rest = "";
  let i = 0;

  // Alles, was keine Notation ist, wird gesammelt und als ein Stueck
  // ausgegeben - sonst entstuende pro Zeichen ein eigenes <span>.
  const flush = () => {
    if (rest) {
      html += '<span class="tok-text">' + rest + "</span>";
      rest = "";
    }
  };

  while (i < text.length) {
    const eigene = matchRule(text, i);
    if (eigene) {
      flush();
      html += '<span class="tok-move tok-custom" style="color:' + eigene.color + '">' +
              escapeHtml(eigene.text) + "</span>";
      i += eigene.text.length;
      continue;
    }

    // Die letzte Alternative trifft jedes Zeichen, es gibt also immer
    // einen Treffer genau an dieser Stelle.
    TOKEN_RE.lastIndex = i;
    const m = TOKEN_RE.exec(text);
    if (!m) break;

    const piece = escapeHtml(m[0]);
    if (!m[8]) flush();

    if (m[1]) {
      html += '<span class="tok-move tok-RC">' + piece + "</span>";
    } else if (m[2]) {
      html += '<span class="tok-move tok-CH">' + piece + "</span>";
    } else if (m[3]) {
      // Der komplette Term traegt die Farbe seines Buttons, nicht nur der
      // Buchstabe: "2K" ist also durchgehend blau, nicht nur das K.
      html += '<span class="tok-move" style="color:var(--tok-btn-' + buttonIdOf(m[4]) +
              ')">' + piece + "</span>";
    } else if (m[5]) {
      html += '<span class="tok-move tok-act">' + piece + "</span>";
    } else if (m[6]) {
      html += '<span class="tok-dir">' + piece + "</span>";
    } else if (m[7]) {
      html += '<span class="tok-sep">' + piece + "</span>";
    } else {
      rest += piece;
    }

    i = TOKEN_RE.lastIndex;
  }

  flush();
  return html;
}

// Schreibweise vereinheitlichen: Buttons gross, Vorsilben klein -
// aus "2k" wird "2K", aus "J.236h" wird "j.236H".
// Die Laenge bleibt dabei gleich, deshalb laesst sich der Cursor
// danach exakt zuruecksetzen.
function normalizeCombo(text) {
  let out = "";
  let i = 0;

  while (i < text.length) {
    // Was eine eigene Regel trifft, bleibt wie getippt.
    const eigene = matchRule(text, i);
    if (eigene) {
      out += eigene.text;
      i += eigene.text.length;
      continue;
    }

    TOKEN_RE.lastIndex = i;
    const m = TOKEN_RE.exec(text);
    if (!m) break;

    if (m[1]) {
      out += m[0].toUpperCase();                 // RC, YRC, FRRC ...
    } else if (m[2]) {
      out += m[0].toUpperCase();
    } else if (m[3]) {
      // Die Buttons stehen am Ende des Terms, davor Vorsilbe und Richtung.
      const kopf = m[0].slice(0, m[0].length - m[4].length);
      out += kopf.toLowerCase() + m[4].toUpperCase();
    } else if (m[5]) {
      out += ACTION_FORM[m[0].toLowerCase()] ?? m[0];
    } else {
      out += m[0];
    }

    i = TOKEN_RE.lastIndex;
  }

  return out;
}

function paint() {
  const text = input.value;
  // Ein Share-Code ist keine Notation - ihn einzufaerben ergaebe Unsinn.
  const html = looksLikeShare(text) ? escapeHtml(text) : tokenize(text);
  // Abschliessender Zeilenumbruch wuerde sonst verschluckt.
  highlight.innerHTML = html + "\n";
}

// Beide Seiten liegen absolut uebereinander, die Huelle hat daher keine
// eigene Hoehe - wir setzen sie auf die gerade sichtbare Seite.
// sofort = ohne Uebergang. Beim Bearbeiten soll die Karte nur Platz
// machen; eine wandernde Hoehe sieht dort nach Bewegung aus, die es
// nicht gibt. Beim Umklappen bleibt der Uebergang, er gehoert zur Drehung.
function updateFlipHeight(sofort = false) {
  if (sofort) flip.classList.add("is-instant");

  // Im Abschluss haengt die Hoehe an der Vorderseite: das gruene Feld soll
  // nicht groesser wirken als die leere Eingabe. Feste Pixelwerte waeren
  // hier falsch, die verschoeben sich mit jeder Schriftaenderung.
  if (state.training?.finished) {
    const hoehe = frontFace.offsetHeight;
    backFace.style.height = hoehe + "px";
    flip.style.height = hoehe + "px";
    return festhalten(sofort);
  }

  backFace.style.height = "";
  const face = state.training ? backFace : frontFace;
  flip.style.height = face.offsetHeight + "px";
  festhalten(sofort);
}

// Den neuen Wert noch ohne Uebergang festschreiben, sonst holt ihn der
// wieder eingeschaltete Uebergang doch noch ein.
function festhalten(sofort) {
  if (!sofort) return;
  void flip.offsetHeight;
  flip.classList.remove("is-instant");
}

function onInput() {
  // Ein Share-Code darf nicht angefasst werden: base64 unterscheidet
  // Gross- und Kleinschreibung, ein einziges umgewandeltes Zeichen
  // macht ihn unlesbar.
  const normalisiert = looksLikeShare(input.value)
    ? input.value
    : normalizeCombo(input.value);
  if (normalisiert !== input.value) {
    // Nur schreiben, wenn sich wirklich etwas aendert - jedes Setzen von
    // .value loescht sonst den Undo-Verlauf des Browsers.
    const von = input.selectionStart;
    const bis = input.selectionEnd;
    input.value = normalisiert;
    input.setSelectionRange(von, bis);
  }

  autoGrow(input);
  autoGrow(comment);
  paint();
  updateFlipHeight();
}

// Die Notiz waechst mit und veraendert damit die Hoehe der Vorderseite.
comment.addEventListener("input", () => {
  autoGrow(comment);
  updateFlipHeight();
});

input.addEventListener("input", onInput);
input.addEventListener("scroll", () => { highlight.scrollTop = input.scrollTop; });
// Bei geaenderter Fensterbreite bricht der Text anders um - Hoehe nachziehen.
window.addEventListener("resize", updateFlipHeight);
// Einmal nach dem Laden des Stylesheets nachmessen, sonst stimmt die Starthoehe nicht.
window.addEventListener("load", onInput);
onInput();

// ============================================================
//  Position auf dem Bildschirm
// ============================================================
const POSITIONS = [
  { id: "everywhere",     label: "Everywhere",     dots: [6, 13, 20] },
  { id: "center",         label: "Center",         dots: [13] },
  { id: "corner",         label: "Corner",         dots: [19.5] },
  { id: "backtocorner",   label: "Back to Corner", dots: [6.5] },
];

// Buehne mit den Punkten der Position. Wird im Menue, am Auswahlknopf
// und in der Combo-Liste benutzt.
function stageIcon(dots, className = "menu__stage") {
  const points = dots
    .map((x) => '<circle cx="' + x + '" cy="9" r="1.8" fill="currentColor" stroke="none"/>')
    .join("");

  return (
    '<svg class="' + className + '" viewBox="0 0 26 18" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" aria-hidden="true">' +
    '<rect x="1" y="1" width="24" height="16" rx="2.5"/>' + points +
    "</svg>"
  );
}

function positionIconFor(id, className) {
  const pos = POSITIONS.find((p) => p.id === id) ?? POSITIONS[0];
  return stageIcon(pos.dots, className);
}

function buildPositionMenu() {
  posMenu.innerHTML = "";

  for (const pos of POSITIONS) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "menu__item";
    item.dataset.position = pos.id;
    item.setAttribute("role", "menuitemradio");

    item.innerHTML =
      stageIcon(pos.dots) +
      '<span class="menu__label">' + pos.label + "</span>" +
      '<svg class="menu__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="m5 13 4 4L19 7"/></svg>';

    posMenu.append(item);
  }
}

function syncPositionUi() {
  const active = POSITIONS.find((p) => p.id === state.position);
  posBtn.title = active.label;
  positionIcon.innerHTML = stageIcon(active.dots, "picker-button__stage-svg");

  posMenu.querySelectorAll(".menu__item").forEach((item) => {
    const on = item.dataset.position === state.position;
    item.classList.toggle("is-active", on);
    item.setAttribute("aria-checked", String(on));
  });
}

const posPop = registerPopover(posBtn, posMenu);

posMenu.addEventListener("click", (e) => {
  const item = e.target.closest(".menu__item");
  if (!item) return;

  state.position = item.dataset.position;
  syncPositionUi();
  closePopover(posPop);
  posBtn.focus();
});

// --- Grid aufbauen -------------------------------------------
const CHECK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>';

// Ein Charakter-Icon: Portrait, sonst das Kuerzel als Platzhalter.
// Wird im Auswahlraster und in der Combo-Liste benutzt.
function charIcon(char, className) {
  const icon = document.createElement("span");
  // .char-icon traegt das Gemeinsame, die zweite Klasse nur Groesse und Radius.
  icon.className = "char-icon " + className;
  icon.textContent = char.short;
  icon.title = char.name;

  // Portraits liegen unter assets/chars/<spiel>/<id>.png . Ein Spiel ohne
  // Bilder setzt portraits: false - sonst liefe jeder Aufbau in dreissig
  // vergebliche Anfragen. Fehlt ein einzelnes Bild, bleibt das Kuerzel.
  // Selbst angelegte Charaktere bringen ihr Bild als Link mit.
  if (char.icon || GAME.portraits !== false) {
    const img = document.createElement("img");
    img.src = char.icon || "assets/chars/" + GAME.id + "/" + char.id + ".png";
    img.alt = "";
    img.addEventListener("error", () => img.remove());
    icon.append(img);
  }

  return icon;
}

// Das Raster wird genau einmal gebaut, danach wechseln nur noch die Zustaende.
function buildGrid() {
  grid.innerHTML = "";

  for (const char of CHARACTERS) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "char";
    tile.dataset.id = char.id;
    tile.title = char.name;
    tile.setAttribute("aria-label", char.name);
    tile.setAttribute("aria-pressed", String(state.selected.has(char.id)));
    tile.append(charIcon(char, "char__portrait"));
    grid.append(tile);
  }
}

// --- Anzeige aktualisieren -----------------------------------
// "ALL" oder eine Liste von ids in einen lesbaren Text uebersetzen.
function describeCharacters(characters) {
  if (characters === "ALL") return "Works on Everyone";
  if (characters.length === 0) return "No characters";
  if (characters.length === 1) {
    return CHAR_BY_ID.get(characters[0])?.name ?? "1 character";
  }
  return characters.length + " characters";
}

function describePosition(id) {
  return POSITIONS.find((p) => p.id === id)?.label ?? id;
}

// Die aktuelle Auswahl so, wie sie in einem Eintrag landet.
function currentCharacters() {
  return allSelected() ? "ALL" : [...state.selected];
}

function render() {
  grid.querySelectorAll(".char").forEach((tile) => {
    tile.setAttribute("aria-pressed", String(state.selected.has(tile.dataset.id)));
  });
  pickerLabel.textContent = describeCharacters(currentCharacters());
}

// ============================================================
//  Eigener Charakter: fuer wen wird gerade gesammelt
// ============================================================
function buildWhoGrid() {
  whoGrid.innerHTML = "";

  for (const char of charactersByActivity()) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "char";
    tile.dataset.id = char.id;
    tile.title = char.name;
    tile.setAttribute("aria-label", char.name);
    tile.append(charIcon(char, "char__portrait"));

    const faellig = dueCount(char.id);
    if (faellig > 0) tile.append(dueBadge(faellig));

    whoGrid.append(tile);
  }

  // Fehlt jemand im Spiel, legt man ihn selbst an.
  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "char char--add";
  plus.dataset.addChar = "1";
  plus.title = "Add your own character";
  plus.setAttribute("aria-label", "Add your own character");
  plus.textContent = "+";
  whoGrid.append(plus);
}

// Die Zahl im Kreis. Nur wo etwas ansteht - eine Null waere kein Hinweis,
// sondern nur ein Fleck mehr.
function dueBadge(zahl) {
  const kreis = document.createElement("span");
  kreis.className = "due-badge";
  kreis.textContent = zahl > 99 ? "99+" : String(zahl);
  kreis.title = zahl + (zahl === 1 ? " item due" : " items due");
  return kreis;
}

function syncWho() {
  const char = CHAR_BY_ID.get(state.character);
  whoName.textContent = char.name;
  syncDojo();

  whoPortrait.innerHTML = "";
  whoPortrait.append(charIcon(char, "who-button__icon"));

  whoGrid.querySelectorAll(".char").forEach((tile) => {
    tile.setAttribute("aria-pressed", String(tile.dataset.id === state.character));
    // Wer noch keine Combo hat, tritt zurueck - waehlbar bleibt er trotzdem.
    tile.classList.toggle("is-empty",
      !state.entries.some((e) => e.character === tile.dataset.id));
  });
  persist();
}

whoGrid.addEventListener("click", (e) => {
  // Das Plus traegt dieselbe Klasse wie die Kacheln, also zuerst pruefen.
  if (e.target.closest("[data-add-char]")) {
    openCharDialog();
    return;
  }

  const tile = e.target.closest(".char");
  if (!tile) return;

  state.character = tile.dataset.id;
  syncWho();
  closePopover(whoPop);
  whoBtn.focus();
});

// ============================================================
//  Special States: freie Marken an einer Combo
// ============================================================
// Jede Marke bekommt ihre eigene Farbe, ohne dass wir sie speichern.
// Vergeben wird nach Position in der Liste: so sind die ersten zwoelf
// garantiert verschieden. Ein Streuwert aus dem Namen waere zwar gegen
// Umsortieren immun, verteilt aber schlecht - bei zehn Marken landeten
// im Test vier auf demselben Ton.
// Die Farbtoene sind vorgegeben statt frei gestreut, sonst kaemen
// stumpfe Zwischentoene heraus, die sich schlecht unterscheiden.
const TAG_HUES = [210, 265, 330, 5, 30, 48, 75, 100, 150, 178, 195, 300];

// Fuer Marken, die nicht mehr in der Liste stehen (entfernt, aber noch an
// einer alten Combo): Streuwert aus dem Namen, damit sie trotzdem Farbe haben.
function tagFallbackIndex(name) {
  let h = 2166136261;
  for (const ch of name.toLowerCase()) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % TAG_HUES.length;
}

function tagHue(name) {
  const i = state.states.findIndex((n) => n.toLowerCase() === name.toLowerCase());
  return TAG_HUES[(i >= 0 ? i : tagFallbackIndex(name)) % TAG_HUES.length];
}

function tagColors(name) {
  const h = tagHue(name);
  return {
    bg:  "hsl(" + h + " 72% 94%)",
    fg:  "hsl(" + h + " 55% 32%)",
    dot: "hsl(" + h + " 58% 50%)",
  };
}

// Der erste echte Move der Combo - also der erste Term mit einem Button.
// Der Tokenizer erledigt das Aussortieren schon: CH, (WS) oder ein Wort
// wie COMBO sind keine Terme und werden hier gar nicht erst angeboten.
function startMove(entry) {
  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(entry.text ?? "")) !== null) {
    if (m[3]) return m[0].toUpperCase();
  }
  return "";
}

// Reihenfolge in der Liste: Position, dann Startmove, dann Counter Hit,
// zuletzt die neuesten zuerst.
const LIST_POSITIONS = POSITIONS.map((p) => p.id);

function sortForList(entries) {
  return entries
    .map((entry, i) => ({
      entry,
      pos: LIST_POSITIONS.indexOf(entry.position),
      move: startMove(entry),
      ch: entryHasCH(entry) ? 0 : 1,
      i,
    }))
    .sort((a, b) =>
      a.pos - b.pos ||
      a.move.localeCompare(b.move) ||
      a.ch - b.ch ||
      b.i - a.i)          // neuere zuerst
    .map((x) => x.entry);
}

// Wann ist die Combo wieder dran?
function describeDue(entry) {
  if (!entry.due) return null;

  const rest = entry.due - Date.now();
  if (rest <= 0) return "due";

  const stunden = Math.round(rest / (60 * 60 * 1000));
  if (stunden < 24) return "in " + Math.max(1, stunden) + "h";

  const tage = Math.round(rest / TAG);
  return tage <= 1 ? "tomorrow" : "in " + tage + " days";
}

// Vor dem Namen steht entweder das Zeichen der Marke oder, wenn keins
// da ist, ihr Farbpunkt.
function tagMarker(name, className) {
  const { emoji } = splitTag(name);

  // Immer dieselbe Box, egal ob Zeichen oder Punkt darin steckt - sonst
  // stehen die Namen daneben unterschiedlich weit rechts.
  const el = document.createElement("span");
  el.className = className;

  if (emoji) {
    el.classList.add("is-emoji");
    el.textContent = emoji;
  } else {
    const punkt = document.createElement("span");
    punkt.className = "tag-dot";
    punkt.style.background = tagColors(name).dot;
    el.append(punkt);
  }
  return el;
}

// Eine Marke als Pille. Einzige Stelle, an der eine entsteht.
function stateTag(name) {
  const farbe = tagColors(name);
  const tag = document.createElement("span");
  tag.className = "state-tag";
  tag.textContent = name;
  tag.style.background = farbe.bg;
  tag.style.color = farbe.fg;
  return tag;
}

function stateTags(namen, className) {
  const box = document.createElement("div");
  box.className = className;
  namen.forEach((name) => box.append(stateTag(name)));
  return box;
}

const STATE_CHECK_SVG =
  '<svg class="menu__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="m5 13 4 4L19 7"/></svg>';

function buildStateList() {
  stateList.innerHTML = "";

  for (const name of state.states) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "menu__item";
    item.dataset.state = name;
    item.setAttribute("role", "menuitemcheckbox");

    const label = document.createElement("span");
    label.className = "menu__label";
    // Ohne Zeichen: das steht schon im Marker davor, sonst doppelt es sich.
    label.textContent = tagLabel(name);

    // Zeichen der Marke, sonst ihr Farbpunkt - damit man beim Waehlen sieht,
    // welche gemeint ist.
    item.innerHTML = STATE_CHECK_SVG;
    item.prepend(tagMarker(name, "menu__dot"), label);

    // Vorgegebene States bleiben, selbst angelegte kann man wieder loswerden.
    // Den Platz fuer das x bekommt jede Zeile, sonst rutscht der Haken bei
    // eigenen Marken um dessen Breite nach links.
    const drop = document.createElement("span");
    drop.className = "menu__drop";
    if (!STATE_DEFAULTS.includes(name)) {
      drop.dataset.dropState = name;
      drop.title = "Remove state";
      drop.textContent = "×";
    }
    item.append(drop);

    stateList.append(item);
  }
}

function syncStates() {
  const gewaehlt = [...state.activeStates];

  stateLabel.textContent =
    gewaehlt.length === 0 ? "State"
    : gewaehlt.length === 1 ? gewaehlt[0]
    : gewaehlt.length + " States";

  stateList.querySelectorAll(".menu__item").forEach((item) => {
    const an = state.activeStates.has(item.dataset.state);
    item.classList.toggle("is-active", an);
    item.setAttribute("aria-checked", String(an));
  });
}

stateList.addEventListener("click", (e) => {
  // Erst pruefen, ob das kleine x getroffen wurde - es liegt im Eintrag.
  const weg = e.target.closest("[data-drop-state]")?.dataset.dropState;
  if (weg) {
    state.states = state.states.filter((n) => n !== weg);
    state.activeStates.delete(weg);
    syncStateOrder();
    buildStateList();
    syncStates();
    return;
  }

  const item = e.target.closest("[data-state]");
  if (!item) return;

  const name = item.dataset.state;
  state.activeStates.has(name)
    ? state.activeStates.delete(name)
    : state.activeStates.add(name);
  syncStates();
});

stateAdd.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = stateInput.value.trim();
  if (!name) return;

  // Doppelte vermeiden, ohne auf Gross-/Kleinschreibung zu bestehen.
  const schonDa = state.states.find((n) => n.toLowerCase() === name.toLowerCase());
  const nutzen = schonDa ?? name;
  if (!schonDa) state.states.push(name);

  state.activeStates.add(nutzen);   // neu angelegt heisst: gleich gemeint
  stateInput.value = "";
  syncStateOrder();
  buildStateList();
  syncStates();
});

// --- Kategorie -----------------------------------------------
const categoryBtn = document.getElementById("categoryButton");
const categoryPanel = document.getElementById("categoryPanel");
const categoryList = document.getElementById("categoryList");
const categoryAdd = document.getElementById("categoryAdd");
const categoryInput = document.getElementById("categoryInput");

// Das Ordnersymbol, solange keine Kategorie gewaehlt ist.
function CATEGORY_ICON() {
  const huelle = document.createElement("span");
  huelle.innerHTML = CATEGORY_SVG;
  const svg = huelle.firstElementChild;
  svg.setAttribute("class", "picker-button__icon");
  return svg;
}

function buildCategoryList() {
  categoryList.innerHTML = "";

  // Kein Eintrag fuer "ohne": ein zweiter Klick auf die gewaehlte
  // Kategorie nimmt sie wieder weg.
  for (const name of state.categories) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "menu__item";
    item.dataset.category = name ?? "";
    item.setAttribute("role", "menuitemradio");

    const label = document.createElement("span");
    label.className = "menu__label";
    label.textContent = name ? categoryLabelOf(name) : "No category";

    item.innerHTML = STATE_CHECK_SVG;
    item.prepend(tagMarker(name, "menu__dot"), label);

    // Eigene Kategorien lassen sich wieder loswerden, "drill" nicht.
    if (!CATEGORY_DEFAULTS.includes(name)) {
      const drop = document.createElement("span");
      drop.className = "menu__drop";
      drop.dataset.dropCategory = name;
      drop.title = "Remove category";
      drop.textContent = "×";
      item.append(drop);
    }

    categoryList.append(item);
  }
}

function categoryLabelOf(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function syncCategory() {
  // Statt des Ordners steht hier das Zeichen der Kategorie - ihr Emoji,
  // sonst ihr Farbpunkt. Der Grund bleibt neutral, nur der Rand zeigt an,
  // dass etwas gewaehlt ist.
  const symbol = categoryBtn.querySelector(".picker-button__icon, .menu__dot");
  if (state.category) {
    const marker = tagMarker(state.category, "menu__dot picker-button__mark");
    symbol.replaceWith(marker);
    categoryBtn.style.borderColor = tagColors(state.category).dot;
  } else {
    symbol.replaceWith(CATEGORY_ICON());
    categoryBtn.style.borderColor = "";
  }

  categoryBtn.classList.toggle("is-set", !!state.category);
  categoryBtn.title = state.category
    ? "Category: " + categoryLabelOf(state.category)
    : "No category";

  categoryList.querySelectorAll("[data-category]").forEach((item) => {
    const an = (item.dataset.category || null) === state.category;
    item.classList.toggle("is-active", an);
    item.setAttribute("aria-checked", String(an));
  });
}

categoryList.addEventListener("click", (e) => {
  const weg = e.target.closest("[data-drop-category]")?.dataset.dropCategory;
  if (weg) {
    state.categories = state.categories.filter((n) => n !== weg);
    if (state.category === weg) state.category = null;
    for (const eintrag of state.entries) {
      if (eintrag.category === weg) eintrag.category = null;
    }
    buildCategoryList();
    syncCategory();
    renderEntries();
    return;
  }

  const item = e.target.closest("[data-category]");
  if (!item) return;

  // Noch einmal auf dieselbe: Kategorie wieder weg.
  const gewaehlt = item.dataset.category;
  state.category = state.category === gewaehlt ? null : gewaehlt;
  syncCategory();
});

categoryAdd.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = categoryInput.value.trim();
  if (!name) return;

  const schonDa = state.categories.find((n) => n.toLowerCase() === name.toLowerCase());
  const nutzen = schonDa ?? name;
  if (!schonDa) state.categories.push(name);

  state.category = nutzen;
  categoryInput.value = "";
  buildCategoryList();
  syncCategory();
  persist();
});

// --- Menues anmelden -----------------------------------------
registerPopover(pickerBtn, panel);   // gegen welche Charaktere
registerPopover(stateBtn, statePanel);            // Special States
registerPopover(categoryBtn, categoryPanel);      // Kategorie
// Waehrend des Trainings steht der Charakter fest.
const whoPop = registerPopover(whoBtn, whoPanel, () => !state.training);

// --- Spielauswahl --------------------------------------------
const gameBtn = document.getElementById("gameButton");
const gamePanel = document.getElementById("gamePanel");
const gameLabel = document.getElementById("gameLabel");
let gameTile = document.getElementById("gameTile");

// Die Kachel eines Spiels: sein Symbol, sonst das Kuerzel. Eigene Spiele
// duerfen eine Adresse angeben - so bleibt die Definition reiner Text.
function gameTileFor(spiel, klasse) {
  const kachel = document.createElement("span");
  kachel.className = klasse;
  kachel.textContent = spiel.short ?? "";

  const quelle = spiel.icon ?? "assets/games/" + spiel.id + ".png";
  const bild = document.createElement("img");
  bild.src = quelle;
  bild.alt = "";
  bild.addEventListener("error", () => bild.remove());
  kachel.append(bild);

  return kachel;
}

function buildGameList() {
  gamePanel.innerHTML = "";

  for (const spiel of GAMES) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "menu__item";
    item.dataset.game = spiel.id;
    item.setAttribute("role", "menuitemradio");

    const kachel = gameTileFor(spiel, "game-tile");

    const label = document.createElement("span");
    label.className = "menu__label";
    label.textContent = spiel.name;

    item.innerHTML = STATE_CHECK_SVG;
    item.prepend(kachel, label);
    gamePanel.append(item);
  }

  // Neu anlegen geht immer; steht ein eigenes Spiel offen, bearbeitet es.
  const neu = document.createElement("button");
  neu.type = "button";
  neu.className = "menu__item menu__item--new";
  neu.dataset.gameNew = "1";
  neu.textContent = "+ Your own game ...";
  gamePanel.append(neu);
}

function syncGameUi() {
  gameLabel.textContent = GAME.name;
  gameTile.replaceWith(gameTileFor(GAME, "game-button__tile"));
  gameTile = document.querySelector(".game-button__tile");
  input.placeholder = GAME.example
    ? "Enter a combo, e.g. " + GAME.example
    : "Enter a combo";

  gamePanel.querySelectorAll("[data-game]").forEach((item) => {
    const an = item.dataset.game === GAME.id;
    item.classList.toggle("is-active", an);
    item.setAttribute("aria-checked", String(an));
  });
}

// Waehrend eines Durchlaufs steht das Spiel fest - wie der Charakter auch.
const gamePop = registerPopover(gameBtn, gamePanel, () => !state.training);

gamePanel.addEventListener("click", (e) => {
  if (e.target.closest("[data-game-new]")) {
    closePopover(gamePop);
    openGameEditor(GAME.custom ? GAME : null);
    return;
  }

  const id = e.target.closest("[data-game]")?.dataset.game;
  if (!id) return;

  closePopover(gamePop);
  switchGame(id);
});

buildGameList();

// --- Eigenes Spiel -------------------------------------------
const gameDlg = document.getElementById("gameDialog");
const gameSource = document.getElementById("gameSource");
const gameError = document.getElementById("gameError");

// Vorlage fuer ein neues Spiel. Bewusst knapp: was fehlt, hat eine
// brauchbare Vorgabe, und laenger als noetig schreckt nur ab.
function gameTemplate() {
  return {
    id: "myfg",
    name: "My Fighting Game",
    short: "MY",
    sharePrefix: "MYFG1-",
    example: "2A > 5B > 236C",
    characters: [
      { id: "alpha", name: "Alpha", short: "AL", icon: "https://example.com/alpha.png" },
      { id: "beta", name: "Beta", short: "BE" },
    ],
    baseRoster: ["alpha", "beta"],
    states: ["jumping", "crouching", "🎯 drill"],
    notation: {
      buttons: [
        { id: "A", match: "A", label: "Light", color: "#60a5fa", sample: "5A", kinds: "A, 2A, j.A" },
        { id: "B", match: "B", label: "Medium", color: "#fbbf24", sample: "5B", kinds: "B, 2B, j.B" },
        { id: "C", match: "C", label: "Heavy", color: "#f87171", sample: "5C", kinds: "C, 2C, j.C" },
      ],
      prefixes: ["dl", "j", "c", "f"],
      directions: true,
      cancels: { forms: ["RC"], label: "Cancels", sample: "RC", kinds: "RC", color: "#a78bfa" },
      counter: { forms: ["CH"], label: "Counter Hit", sample: "CH", kinds: "CH", color: "#ff7300" },
      actions: { label: "Movement", sample: "66", color: "#22d3ee",
                 forms: { dash: "dash", "66": "66", "44": "44" } },
    },
    theme: { "--accent": "#7c5cff", "--accent-hover": "#9077ff",
             "--accent-soft": "#1a1240", "--send-bg": "#7c5cff",
             "--send-bg-hover": "#9077ff", "--send-fg": "#ffffff" },
  };
}

function customGames() {
  try {
    const liste = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]");
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

function openGameEditor(spiel) {
  gameSource.value = JSON.stringify(spiel ?? gameTemplate(), null, 2);
  gameError.hidden = true;
  document.getElementById("gameDrop").hidden = !spiel?.custom;
  gameDlg.showModal();
  gameSource.focus();
}

document.getElementById("gameCancel").addEventListener("click", () => gameDlg.close());

document.getElementById("gameSave").addEventListener("click", () => {
  let entwurf;
  try {
    entwurf = JSON.parse(gameSource.value);
  } catch (err) {
    gameError.hidden = false;
    gameError.textContent = "Not valid JSON: " + err.message;
    return;
  }

  const problem = checkGame(entwurf);
  if (problem) {
    gameError.hidden = false;
    gameError.textContent = problem;
    return;
  }

  // Die eingebauten Spiele lassen sich nicht ueberschreiben - sonst waere
  // eine Sammlung nach einem Tippfehler nicht mehr zuzuordnen.
  const eingebaut = GAME_BY_ID.get(entwurf.id);
  if (eingebaut && !eingebaut.custom) {
    gameError.hidden = false;
    gameError.textContent = "That id belongs to a built-in game. Pick another.";
    return;
  }

  const liste = customGames().filter((g) => g.id !== entwurf.id);
  liste.push(entwurf);
  writeJson(CUSTOM_KEY, liste);

  registerGame(entwurf);
  buildGameList();
  gameDlg.close();
  switchGame(entwurf.id);
  showNotice(entwurf.name + " saved.");
});

document.getElementById("gameDrop").addEventListener("click", async () => {
  const spiel = GAME_BY_ID.get(JSON.parse(gameSource.value || "{}").id);
  if (!spiel?.custom) return;

  const ja = await askDialog({
    title: "Delete " + spiel.name + "?",
    text: "The game and everything you saved under it will be removed.",
    buttons: [
      { value: true, label: "Delete", kind: "danger" },
      { value: null, label: "Cancel", kind: "quiet" },
    ],
  });
  if (!ja) return;

  writeJson(CUSTOM_KEY, customGames().filter((g) => g.id !== spiel.id));
  try {
    localStorage.removeItem(storageKey(spiel.id));
  } catch { /* ohne Ablage gibt es nichts zu raeumen */ }

  const i = GAMES.indexOf(spiel);
  if (i >= 0) GAMES.splice(i, 1);
  GAME_BY_ID.delete(spiel.id);

  gameDlg.close();
  buildGameList();
  switchGame(GAMES[0].id);
});

// --- Alle / Keine --------------------------------------------
tools.addEventListener("click", (e) => {
  const action = e.target.closest("[data-select]")?.dataset.select;
  if (!action) return;

  state.selected.clear();
  if (action === "all") CHARACTERS.forEach((c) => state.selected.add(c.id));
  render();
});

// --- Einzelne Kachel klicken ---------------------------------
grid.addEventListener("click", (e) => {
  const tile = e.target.closest(".char");
  if (!tile) return;

  const id = tile.dataset.id;
  state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
  render();
});

// ============================================================
//  Liste der bereits angelegten Combos
//  Haelt die Eintraege bisher nur im Speicher - beim Neuladen ist die
//  Liste wieder leer, solange es keine Ablage (Server/localStorage) gibt.
// ============================================================
const entryList = document.getElementById("entryList");

// Welche Icons zeigen wir zu einem Eintrag? Immer die kuerzere Liste:
// sind die meisten Charaktere abgewaehlt, zeigen wir die gewaehlten;
// fehlen nur ein paar, zeigen wir stattdessen diese ausgegraut.
function iconsFor(characters) {
  if (characters === "ALL") return null;

  const chosen = new Set(characters);
  const missing = CHARACTERS.filter((c) => !chosen.has(c.id));

  if (missing.length < chosen.size) {
    return { chars: missing, muted: true };
  }
  return { chars: CHARACTERS.filter((c) => chosen.has(c.id)), muted: false };
}

// Notizen duerfen Links auf Combo-Videos enthalten - die sollen in der
// Liste anklickbar sein. Erst escapen, dann Links suchen: der Suchtreffer
// kann so keine Anfuehrungszeichen mehr enthalten und das Attribut nicht
// verlassen. Nur http(s), damit kein javascript: durchrutscht.
const URL_RE = /(?<![A-Za-z0-9])https?:\/\/[^\s<>"']+/g;

function linkify(text) {
  return escapeHtml(text).replace(URL_RE, (url) =>
    '<a class="comment-link" href="' + url + '" target="_blank" rel="noopener noreferrer">' +
    url + "</a>");
}

// --- Bearbeitbare Felder eines Eintrags ----------------------
// Combo-Text mit derselben Overlay-Technik wie im Hauptfeld: farbige
// Ebene hinter einem durchsichtigen Textfeld.
function comboField(entry) {
  const box = document.createElement("div");
  box.className = "editor editor--entry";

  const hl = document.createElement("div");
  hl.className = "editor__highlight";
  hl.setAttribute("aria-hidden", "true");

  const feld = document.createElement("textarea");
  feld.className = "composer__input entry__input";
  feld.rows = 1;
  feld.spellcheck = false;
  feld.value = entry.text;

  const male = () => { hl.innerHTML = tokenize(feld.value) + "\n"; };

  feld.addEventListener("input", () => {
    const norm = normalizeCombo(feld.value);
    if (norm !== feld.value) {
      const von = feld.selectionStart;
      const bis = feld.selectionEnd;
      feld.value = norm;
      feld.setSelectionRange(von, bis);
    }
    // Direkt in den Eintrag schreiben, aber die Liste nicht neu bauen -
    // das wuerde den Cursor mitten im Tippen wegreissen.
    entry.text = feld.value.trim();
    touch(entry);
    male();
    autoGrow(feld);
  });

  feld.addEventListener("scroll", () => { hl.scrollTop = feld.scrollTop; });

  box.append(hl, feld);
  male();
  return box;
}

function positionSelect(entry) {
  const sel = document.createElement("select");
  sel.className = "entry__position";
  sel.title = "Position";

  for (const pos of POSITIONS) {
    const opt = document.createElement("option");
    opt.value = pos.id;
    opt.textContent = pos.label;
    opt.selected = pos.id === entry.position;
    sel.append(opt);
  }

  sel.addEventListener("change", () => { entry.position = sel.value; touch(entry); });
  return sel;
}

// Kategorie eines Eintrags. Wie bei der Position ein schmales Auswahlfeld -
// in einer Zeile voller Karten ist dafuer kein Platz fuer mehr.
function categorySelect(entry) {
  const sel = document.createElement("select");
  sel.className = "entry__position entry__category";
  sel.title = "Category";

  const leer = document.createElement("option");
  leer.value = "";
  leer.textContent = "No category";
  leer.selected = !entry.category;
  sel.append(leer);

  // Auch eine Kategorie zeigen, die es nicht mehr in der Liste gibt -
  // sonst faellt sie beim ersten Bearbeiten unbemerkt weg.
  const alle = [...new Set([...state.categories, entry.category].filter(Boolean))];
  for (const name of alle) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = categoryLabelOf(name);
    opt.selected = name === entry.category;
    sel.append(opt);
  }

  sel.addEventListener("change", () => {
    entry.category = sel.value || null;
    touch(entry);
    persist();
    renderEntries();
  });

  return sel;
}

// Alle waehlbaren Marken; die des Eintrags farbig, die anderen blass.
// Wer neu zeichnet, haengt vom Ort ab: in der Liste die Liste, im
// Training die Karte.
function stateEditor(entry, neuZeichnen = renderEntries) {
  const box = document.createElement("div");
  box.className = "entry__states entry__states--edit";

  const an = new Set(entry.states ?? []);
  // Auch Marken zeigen, die nicht mehr in der Liste stehen - sonst
  // verschwaenden sie beim ersten Bearbeiten unbemerkt.
  const alle = [...new Set([...state.states, ...an])];

  for (const name of alle) {
    const tag = stateTag(name);
    tag.dataset.toggleState = name;
    tag.classList.add("state-tag--pick");

    if (!an.has(name)) {
      tag.classList.add("is-off");
      tag.style.background = "transparent";
      tag.style.color = "#a3aab5";
    }
    box.append(tag);
  }

  box.append(newStateControl(entry, neuZeichnen));
  return box;
}

// Eine neue Marke gleich am Eintrag anlegen, statt dafuer zurueck ins
// Eingabefeld zu muessen. Sie steht danach ueberall zur Wahl.
function newStateControl(entry, neuZeichnen = renderEntries) {
  const knopf = document.createElement("button");
  knopf.type = "button";
  knopf.className = "state-tag state-tag--pick state-tag--add";
  knopf.textContent = "+";
  knopf.title = "Add a new tag";

  const feld = document.createElement("input");
  feld.type = "text";
  feld.className = "entry__state-input";
  feld.placeholder = "New tag";
  feld.maxLength = 24;
  feld.hidden = true;

  const zeigen = (an) => {
    feld.hidden = !an;
    knopf.hidden = an;
    if (an) feld.focus();
  };

  const anlegen = () => {
    const name = feld.value.trim();
    if (!name) return zeigen(false);

    // Doppelte vermeiden, ohne auf Gross-/Kleinschreibung zu bestehen.
    const schonDa = state.states.find((n) => n.toLowerCase() === name.toLowerCase());
    const nutzen = schonDa ?? name;
    if (!schonDa) {
      state.states.push(name);
      syncStateOrder();
      buildStateList();
      syncStates();
    }

    entry.states = [...new Set([...(entry.states ?? []), nutzen])];
    touch(entry);
    persist();
    neuZeichnen();
  };

  knopf.addEventListener("click", () => zeigen(true));

  feld.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); anlegen(); }
    if (e.key === "Escape") { feld.value = ""; zeigen(false); }
  });

  // Verlassen ohne Eingabe heisst: doch nicht.
  feld.addEventListener("blur", () => { if (!feld.value.trim()) zeigen(false); });

  const huelle = document.createElement("span");
  huelle.className = "entry__state-new";
  huelle.append(knopf, feld);
  return huelle;
}

// Gegnerauswahl an einem Eintrag: kleines Ausklappmenue statt des
// grossen 540er-Rasters, das pro Zeile viel zu wuchtig waere.
function setEntryChars(entry, ids) {
  entry.characters = ids.length === CHARACTERS.length ? "ALL" : ids;
  touch(entry);
  // Selber sichern: waehrend das Menue offen ist wird bewusst nicht neu
  // gezeichnet, es kaeme also sonst niemand zum Speichern.
  persist();
}

function entryCharIds(entry) {
  return entry.characters === "ALL"
    ? CHARACTERS.map((c) => c.id)
    : [...entry.characters];
}

function fillEntryCharMenu(entry, menu) {
  menu.innerHTML = "";

  const tools = document.createElement("div");
  tools.className = "char-menu__tools";

  for (const [aktion, text] of [["all", "All"], ["none", "None"]]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.dataset.entrySelect = aktion;
    b.textContent = text;
    tools.append(b);
  }

  const grid = document.createElement("div");
  grid.className = "char-grid";
  const gewaehlt = new Set(entryCharIds(entry));

  for (const char of CHARACTERS) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "char";
    tile.dataset.entryChar = char.id;
    tile.title = char.name;
    tile.setAttribute("aria-label", char.name);
    tile.setAttribute("aria-pressed", String(gewaehlt.has(char.id)));
    tile.append(charIcon(char, "char__portrait"));
    grid.append(tile);
  }

  menu.append(tools, grid);
}

function entryCharPicker(entry) {
  const box = document.createElement("div");
  box.className = "picker picker--entry";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "entry__chars-btn";
  button.dataset.charsFor = entry.id;
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");

  const label = document.createElement("span");
  label.className = "entry__chars-label";
  label.textContent = describeCharacters(entry.characters);

  button.append(label);
  button.insertAdjacentHTML("beforeend", CHEVRON_SVG);

  // Das Menue bleibt leer, bis es geoeffnet wird - sonst haetten wir bei
  // jedem Neuzeichnen 32 Kacheln je Eintrag im Dokument.
  const menu = document.createElement("div");
  menu.className = "char-menu char-menu--entry";
  menu.hidden = true;

  box.append(button, menu);
  return box;
}

function commentField(entry) {
  const feld = document.createElement("textarea");
  feld.className = "entry__comment-input";
  feld.rows = 1;
  feld.spellcheck = false;
  feld.placeholder = "Note, link, tip ...";
  feld.value = entry.comment ?? "";

  feld.addEventListener("input", () => {
    entry.comment = feld.value.trim();
    touch(entry);
    autoGrow(feld);
  });

  return feld;
}

// Eine Liste von Karten; mehrfach gebraucht, weil die Kategorien je einen
// eigenen Rahmen um ihre Karten bekommen.
function entryList2(entries, bearbeiten) {
  const list = document.createElement("ol");
  list.className = "group__list";
  entries.forEach((entry) => list.append(buildEntry(entry, bearbeiten)));
  return list;
}

function buildEntry(entry, bearbeiten) {
  const item = document.createElement("li");
  item.className = "entry" + (bearbeiten ? " is-editing" : "") +
                            (entry.disabled ? " is-off" : "");
  item.dataset.id = entry.id;

  // Zwei Spalten nebeneinander. Die linke fliesst eigenstaendig, damit
  // Notiz und Charaktere direkt unter der Combo stehen - und nicht erst
  // unterhalb der rechten Spalte, die zwei Zeilen hoch ist.
  const head = document.createElement("div");
  head.className = "entry__head";

  const links = document.createElement("div");
  links.className = "entry__left";

  if (bearbeiten) {
    links.append(comboField(entry));
  } else {
    // Symbol, Combo und Marken fliessen in einer Zeile: das Symbol
    // ersetzt den Positionstext, die Marken haengen hinten an.
    const text = document.createElement("p");
    text.className = "entry__text";
    text.title = describePosition(entry.position);
    text.insertAdjacentHTML("beforeend",
      positionIconFor(entry.position, "entry__stage"));

    const combo = document.createElement("span");
    combo.className = "entry__combo";

    if (hasParts(entry)) {
      // Die Gesamtcombo bleibt lesbar; die Schnitte sind nur markiert, und
      // unter jedem Teil zeigt ein Balken, wie sicher er sitzt.
      entry.parts.forEach((teil, i) => {
        if (i > 0) {
          // Das echte Trennzeichen bleibt stehen - gestrichelt umrandet
          // als Schnitt, aber weiter als Gatling oder Link zu lesen.
          const fuge = document.createElement("span");
          fuge.className = "entry__cut";
          fuge.textContent = partJoin(entry, i) || ">";
          fuge.title = "Cut - sub combo " + (i + 1) + " starts here";
          combo.append(fuge);
        }

        const stueck = document.createElement("span");
        stueck.className = "entry__part" +
          (teil.lastGrade ? " entry__part--" + teil.lastGrade : "");
        stueck.innerHTML = tokenize(teil.text);
        stueck.title = "Part " + (i + 1) + ": " +
          (teil.lastGrade ? gradeLabel(teil.lastGrade) : "not trained yet") +
          (teil.due ? " · " + describeDue(teil) : "");
        combo.append(stueck);
      });
    } else {
      combo.innerHTML = tokenize(entry.text);   // gleiche Faerbung wie im Feld
    }

    text.append(combo);

    visibleStates(entry).forEach((name) => {
      const tag = stateTag(name);
      tag.classList.add("entry__tag");
      text.append(tag);
    });

    links.append(text);

    // Erst die Notiz, dann die Charaktere - jedes nur, wenn es da ist.
    if (entry.comment) {
      const notiz = document.createElement("p");
      notiz.className = "entry__comment";
      notiz.innerHTML = linkify(entry.comment);
      links.append(notiz);
    }

    // Die Notizen der Teile darunter, in ihrer Reihenfolge und nummeriert.
    if (hasParts(entry)) {
      entry.parts.forEach((teil, i) => {
        if (!teil.comment) return;

        const notiz = document.createElement("p");
        notiz.className = "entry__comment entry__comment--part";

        const nummer = document.createElement("span");
        nummer.className = "entry__part-no";
        nummer.textContent = i + 1;

        notiz.append(nummer);
        notiz.insertAdjacentHTML("beforeend", linkify(teil.comment));
        links.append(notiz);
      });
    }

    const icons = iconsFor(entry.characters);
    if (icons && icons.chars.length) {
      const chars = document.createElement("div");
      chars.className = "entry__chars" + (icons.muted ? " is-muted" : "");
      chars.title = icons.muted ? "Works against everyone except these" : "Works against these characters";
      icons.chars.forEach((c) => chars.append(charIcon(c, "entry__char")));
      links.append(chars);
    }
  }

  // Rechte Spalte: Marken und Position in einer Zeile, darunter der
  // Stand aus dem Training.
  const meta = document.createElement("div");
  meta.className = "entry__meta";

  if (bearbeiten) {
    meta.append(positionSelect(entry), categorySelect(entry), entryCharPicker(entry));
  } else {
    // Position und Marken stehen jetzt links bei der Combo; hier bleibt
    // nur der Stand aus dem Training.
    // Alles in einer Zeile: Drill-Marke, letzte Note, naechster Termin.
    // Getrennte Kinder der Spalte ergaeben sonst eine zweite Zeile.
    const stand = document.createElement("span");
    stand.className = "entry__sr";

    if (entry.lastGrade) {
      const n = document.createElement("span");
      n.className = "entry__grade entry__grade--" + entry.lastGrade;
      n.textContent = gradeLabel(entry.lastGrade);
      stand.append(n);
    }

    // Bei Drill waere ein Termin irrefuehrend - die Combo kommt ohnehin.
    const wann = isDrill(entry) ? null : describeDue(entry);
    if (wann) {
      const w = document.createElement("span");
      w.textContent = wann;
      stand.append(w);
    }

    if (stand.children.length) meta.append(stand);
  }

  head.append(links, meta);
  item.append(head);

  // Marken beim Bearbeiten in voller Breite, sonst wird die Spalte zu eng.
  if (bearbeiten) item.append(stateEditor(entry));

  if (bearbeiten) {
    item.append(commentField(entry));

    const icons = iconsFor(entry.characters);
    if (icons && icons.chars.length) {
      const chars = document.createElement("div");
      chars.className = "entry__chars" + (icons.muted ? " is-muted" : "");
      chars.title = icons.muted ? "Works against everyone except these" : "Works against these characters";
      icons.chars.forEach((c) => chars.append(charIcon(c, "entry__char")));
      item.append(chars);
    }
  }

  // Rechts oben: Ein-/Ausschalten immer, Loeschen nur beim Bearbeiten.
  const werkzeuge = document.createElement("div");
  werkzeuge.className = "entry__tools";

  const schalter = document.createElement("button");
  schalter.type = "button";
  schalter.className = "entry__toggle";
  schalter.dataset.toggleEntry = entry.id;
  schalter.title = entry.disabled
    ? "Include in training again"
    : "Exclude from training";
  schalter.setAttribute("aria-label", schalter.title);
  schalter.setAttribute("aria-pressed", String(!entry.disabled));
  schalter.innerHTML = entry.disabled ? EYE_OFF_SVG : EYE_SVG;
  werkzeuge.append(schalter);

  if (bearbeiten) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "entry__remove";
    remove.dataset.remove = entry.id;
    remove.title = "Delete combo";
    remove.setAttribute("aria-label", "Delete combo");
    remove.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    werkzeuge.append(remove);
  }

  item.append(werkzeuge);
  return item;
}

// So viele Combos zeigt ein Charakter, bevor der Rest eingeklappt wird.
const VISIBLE_PER_CHARACTER = 5;

const WARN_SVG =
  '<svg class="drill__warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 4.5 2.8 20h18.4L12 4.5Z"/><path d="M12 10v4"/><path d="M12 17h.01"/></svg>';

const EYE_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/>' +
  '<circle cx="12" cy="12" r="2.8"/></svg>';

const EYE_OFF_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M4 4l16 16"/>' +
  '<path d="M9.9 5.8A9.3 9.3 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3.2 3.9"/>' +
  '<path d="M6.5 8.1A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1.2 0 2.3-.2 3.3-.6"/></svg>';

const SHARE_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/>' +
  '<circle cx="18" cy="19" r="2.6"/>' +
  '<path d="m8.3 10.8 7.4-4.3M8.3 13.2l7.4 4.3"/></svg>';

const CATEGORY_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>' +
  "</svg>";

const PENCIL_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 20h9"/>' +
  '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

const CHEVRON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

// Ein Rahmen pro Charakter, mit Portrait, Namen und Anzahl als Kopf.
function buildGroup(char, entries) {
  const bearbeiten = state.editing.has(char.id);

  const group = document.createElement("section");
  group.className = "group" + (bearbeiten ? " is-editing" : "");
  group.dataset.character = char.id;

  const head = document.createElement("div");
  head.className = "group__head";
  head.append(charIcon(char, "group__portrait"));

  const name = document.createElement("h2");
  name.className = "group__name";
  name.textContent = char.name;

  const count = document.createElement("span");
  count.className = "group__count";
  // "Drill" ist unser Wort fuer die Sache, nicht das des Benutzers -
  // in der Liste steht deshalb die neutrale Zahl.
  count.textContent = entries.length + (entries.length === 1 ? " item" : " items");

  // Bearbeiten gilt nur fuer diesen Charakter.
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "group__edit" + (bearbeiten ? " is-active" : "");
  edit.dataset.edit = char.id;
  edit.title = bearbeiten ? "Done editing" : "Edit this character's list";
  edit.setAttribute("aria-pressed", String(bearbeiten));
  edit.innerHTML = PENCIL_SVG;

  const teilen = document.createElement("button");
  teilen.type = "button";
  teilen.className = "group__edit";
  teilen.dataset.share = char.id;
  teilen.title = "Share this character's list as a code";
  teilen.setAttribute("aria-label", "Share");
  teilen.innerHTML = SHARE_SVG;

  // Erst der Name, dann die Zahl der Karten, dann was davon ansteht.
  const faellig = dueCount(char.id);
  head.append(name, count);
  if (faellig > 0) head.append(dueBadge(faellig));
  // Umschalter: Kategorien zeigen oder alles in einer Reihe.
  const gruppieren = document.createElement("button");
  gruppieren.type = "button";
  gruppieren.className = "group__edit" + (state.groupByCategory ? " is-active" : "");
  gruppieren.dataset.groupToggle = "1";
  gruppieren.title = state.groupByCategory
    ? "Categories on - click to show one plain list"
    : "Categories off - click to group by category";
  gruppieren.setAttribute("aria-pressed", String(state.groupByCategory));
  gruppieren.innerHTML = CATEGORY_SVG;

  head.append(gruppieren, teilen, edit);

  // Sortiert nach Position, Startmove, Counter Hit und zuletzt Alter.
  // Beim Bearbeiten wird immer alles gezeigt.
  const neueste = sortForList(entries);
  const offen = bearbeiten || state.expanded.has(char.id);
  const sichtbar = offen ? neueste : neueste.slice(0, VISIBLE_PER_CHARACTER);

  group.append(head);

  if (state.groupByCategory) {
    // Karten ohne Kategorie stehen wie bisher; die uebrigen bekommen je
    // Kategorie einen farbigen Rahmen. Der Einzug bleibt derselbe, damit
    // alle Combos an derselben Stelle beginnen.
    // Die Kategorien stehen oben - sie sind das, wonach man sucht.
    const nach = new Map();
    for (const entry of sichtbar) {
      const k = categoryOf(entry);
      if (!k) continue;
      if (!nach.has(k)) nach.set(k, []);
      nach.get(k).push(entry);
    }

    for (const [name, teil] of nach) {
      const rahmen = document.createElement("section");
      rahmen.className = "category";
      // Der Rahmen traegt die Farbe allein, deshalb die kraeftige Fassung.
      rahmen.style.setProperty("--category-color", tagColors(name).fg);

      const titel = document.createElement("span");
      titel.className = "category__title";
      titel.textContent = categoryLabelOf(name);

      rahmen.append(titel, entryList2(teil, bearbeiten));
      group.append(rahmen);
    }

    const ohne = sichtbar.filter((e) => !categoryOf(e));
    if (ohne.length) group.append(entryList2(ohne, bearbeiten));
  } else {
    group.append(entryList2(sichtbar, bearbeiten));
  }

  const versteckt = neueste.length - VISIBLE_PER_CHARACTER;
  if (versteckt > 0 && !bearbeiten) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "group__more" + (offen ? " is-open" : "");
    more.dataset.expand = char.id;
    more.innerHTML = CHEVRON_SVG + "<span>" +
      (offen ? "Show less" : versteckt + " more") + "</span>";
    group.append(more);
  }

  return group;
}

// Unter der Liste bleibt so viel Platz, dass sich die letzte Gruppe bis
// unter den stehenden Kopf schieben laesst. Ohne diesen Vorrat wird die
// Seite beim Neuzeichnen kuerzer als die aktuelle Scrollposition, und der
// Browser zieht den Blick zurueck nach oben.
function reserveScrollRoom() {
  if (entryList.hidden || !entryList.lastElementChild) {
    entryList.style.marginBottom = "";
    return;
  }

  const kopf = document.querySelector(".composer__stick")?.offsetHeight ?? 0;
  const rest = window.innerHeight - kopf - entryList.lastElementChild.offsetHeight;
  entryList.style.marginBottom = Math.max(0, Math.round(rest)) + "px";
}

window.addEventListener("resize", reserveScrollRoom);

// --- Logo ueber der Karte -------------------------------------
// Es schrumpft und blasst ab, waehrend die Seite nach oben laeuft, und ist
// genau dann weg, wenn die Kopfzeile oben andockt. Der Wert wird nur als
// Zahl gesetzt; was damit geschieht, steht im Stylesheet.
const brandImg = document.querySelector(".brand__img");
const stickBox = document.querySelector(".composer__stick");
let brandWartet = false;

function updateBrand() {
  brandWartet = false;

  // Der Abstand haengt am Layout, nicht am Zoom des Bildes - eine
  // Rueckkopplung kann es also nicht geben.
  const weg = stickBox.getBoundingClientRect().top + window.scrollY;
  const anteil = weg > 0 ? Math.min(1, window.scrollY / weg) : 1;
  brandImg.style.setProperty("--brand-p", anteil.toFixed(3));
}

window.addEventListener("scroll", () => {
  // Pro Bild einmal rechnen reicht; das Scrollereignis kommt oefter.
  if (brandWartet) return;
  brandWartet = true;
  requestAnimationFrame(updateBrand);
}, { passive: true });

window.addEventListener("resize", updateBrand);
updateBrand();

function renderEntries() {
  // Ohne Eintraege bleibt unter dem Feld nichts stehen.
  entryList.hidden = state.training !== null || state.entries.length === 0;
  // Im Training gibt es keine Eingabe - weder die Option noch Sichern/Laden.
  persistRow.hidden = state.training !== null;
  entryList.innerHTML = "";

  // Nach Charakter buendeln.
  const byChar = new Map();
  for (const entry of state.entries) {
    if (!byChar.has(entry.character)) byChar.set(entry.character, []);
    byChar.get(entry.character).push(entry);
  }

  // Zuletzt bearbeitet, ergaenzt oder trainiert kommt nach oben.
  const charaktere = CHARACTERS
    .filter((c) => byChar.has(c.id))
    .sort((a, b) => lastTouched(b.id) - lastTouched(a.id));

  for (const char of charaktere) {
    entryList.append(buildGroup(char, byChar.get(char.id)));
  }

  // Textfelder koennen erst gemessen werden, wenn sie im Dokument haengen.
  entryList.querySelectorAll(".entry__input, .entry__comment-input")
    .forEach((feld) => autoGrow(feld));

  reserveScrollRoom();

  exportBtn.hidden = state.entries.length === 0;
  syncDojo();
  persist();
}

// Die Gegnerauswahl haengt an jedem Eintrag - in der Liste wie auf der
// Trainingskarte. Beide melden ihre Klicks hier an; unterschiedlich ist
// nur, was danach neu gezeichnet wird.
function entryPickerClick(e, neuZeichnen) {
  // --- Gegnerauswahl auf- und zuklappen ---
  const charsFor = e.target.closest("[data-chars-for]")?.dataset.charsFor;
  if (charsFor) {
    const box = e.target.closest(".picker--entry");
    const button = box.querySelector("[data-chars-for]");
    const menu = box.querySelector(".char-menu--entry");
    const schonOffen = openEntryPicker?.button === button;

    closeEntryPicker(false);          // ohne Neuzeichnen, sonst waere box weg
    if (schonOffen) { neuZeichnen(); return true; }

    POPOVERS.forEach(closePopover);
    const entry = state.entries.find((x) => x.id === charsFor);
    fillEntryCharMenu(entry, menu);
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    openEntryPicker = { button, menu, entry };
    return true;
  }

  // --- Einzelnen Gegner umschalten. Bewusst ohne Neuzeichnen: das
  //     wuerde das offene Menue mitten im Waehlen abraeumen. ---
  const gegner = e.target.closest("[data-entry-char]")?.dataset.entryChar;
  if (gegner && openEntryPicker) {
    const { entry, menu, button } = openEntryPicker;
    const ids = new Set(entryCharIds(entry));
    ids.has(gegner) ? ids.delete(gegner) : ids.add(gegner);
    setEntryChars(entry, [...ids]);

    menu.querySelector('[data-entry-char="' + gegner + '"]')
        .setAttribute("aria-pressed", String(ids.has(gegner)));
    button.querySelector(".entry__chars-label").textContent =
      describeCharacters(entry.characters);
    return true;
  }

  const alleKeine = e.target.closest("[data-entry-select]")?.dataset.entrySelect;
  if (alleKeine && openEntryPicker) {
    const { entry, menu, button } = openEntryPicker;
    setEntryChars(entry, alleKeine === "all" ? CHARACTERS.map((c) => c.id) : []);

    const gewaehlt = new Set(entryCharIds(entry));
    menu.querySelectorAll("[data-entry-char]").forEach((t) =>
      t.setAttribute("aria-pressed", String(gewaehlt.has(t.dataset.entryChar))));
    button.querySelector(".entry__chars-label").textContent =
      describeCharacters(entry.characters);
    return true;
  }

  return false;
}

entryList.addEventListener("click", (e) => {
  if (entryPickerClick(e, renderEntries)) return;

  const schalten = e.target.closest("[data-toggle-entry]")?.dataset.toggleEntry;
  if (schalten) {
    const entry = state.entries.find((x) => x.id === schalten);
    if (entry) {
      entry.disabled = !entry.disabled;
      renderEntries();
    }
    return;
  }

  const teilen = e.target.closest("[data-share]")?.dataset.share;
  if (teilen) {
    shareCharacter(teilen);
    return;
  }

  // Bearbeiten an- und ausschalten - gilt nur fuer diesen Charakter.
  if (e.target.closest("[data-group-toggle]")) {
    state.groupByCategory = !state.groupByCategory;
    renderEntries();
    return;
  }

  const stift = e.target.closest("[data-edit]")?.dataset.edit;
  if (stift) {
    closeEntryPicker(false);
    state.editing.has(stift) ? state.editing.delete(stift) : state.editing.add(stift);

    // Die angeklickte Gruppe soll stehenbleiben. Neu gezeichnet wird die
    // ganze Liste, und mit ihr aendert sich die Seitenhoehe - ohne diesen
    // Ausgleich rutscht der Blick auf eine ganz andere Stelle.
    const oben = e.target.closest(".group")?.getBoundingClientRect().top;
    renderEntries();

    if (oben !== undefined) {
      const gruppe = entryList.querySelector('[data-character="' + stift + '"]');
      if (gruppe) window.scrollBy(0, gruppe.getBoundingClientRect().top - oben);
    }
    return;
  }

  // Marke an einem Eintrag umschalten.
  const marke = e.target.closest("[data-toggle-state]")?.dataset.toggleState;
  if (marke) {
    const id = e.target.closest(".entry")?.dataset.id;
    const entry = state.entries.find((x) => x.id === id);
    if (entry) {
      const an = new Set(entry.states ?? []);
      an.has(marke) ? an.delete(marke) : an.add(marke);
      entry.states = [...an];
      touch(entry);
      renderEntries();
    }
    return;
  }

  const auf = e.target.closest("[data-expand]")?.dataset.expand;
  if (auf) {
    state.expanded.has(auf) ? state.expanded.delete(auf) : state.expanded.add(auf);
    renderEntries();
    return;
  }

  const id = e.target.closest("[data-remove]")?.dataset.remove;
  if (!id) return;

  state.entries = state.entries.filter((entry) => entry.id !== id);
  renderEntries();
});

// --- Speichern -----------------------------------------------
// Wann wurde an dieser Combo zuletzt etwas getan? Danach ordnen sich
// die Charakter-Gruppen in der Liste.
function touch(entry) {
  if (entry) entry.touched = Date.now();
}

function lastTouched(charId) {
  return state.entries
    .filter((e) => e.character === charId)
    .reduce((max, e) => Math.max(max, e.touched ?? 0), 0);
}

function newId() {
  return String(Date.now()) + Math.random().toString(36).slice(2, 7);
}

// ============================================================
//  Zerschnittene Combos
//  Lange Combos uebt man in Stuecken, die fuer sich funktionieren.
//  Ein Eintrag traegt dann zusaetzlich seine Teile; jeder Teil hat einen
//  eigenen Wiederholungsplan, die Gesamtcombo behaelt ihren.
// ============================================================
function hasParts(entry) {
  return Array.isArray(entry.parts) && entry.parts.length > 1;
}

// Traeger des Plans: der Teil oder der Eintrag selbst.
function srOf(entry, teil) {
  return teil == null ? entry : entry.parts[teil];
}

// Combos, die vor dieser Aenderung zerschnitten wurden, haben das
// Trennzeichen noch nicht gespeichert. Es laesst sich aus dem Gesamttext
// zurueckholen: zwischen zwei Teilen steht genau eine Fuge.
function partJoin(entry, i) {
  const teil = entry.parts[i];
  if (typeof teil.join === "string") return teil.join;
  if (i === 0) return "";

  let ab = 0;
  for (let k = 0; k < i; k++) {
    const pos = entry.text.indexOf(entry.parts[k].text, ab);
    if (pos < 0) return ">";
    ab = pos + entry.parts[k].text.length;
  }

  const start = entry.text.indexOf(teil.text, ab);
  const treffer = (start < 0 ? "" : entry.text.slice(ab, start)).match(/[>,~]/);
  return treffer ? treffer[0] : ">";
}

function cardText(entry, teil) {
  return teil == null ? entry.text : entry.parts[teil].text;
}

// Marken gelten fuer den ganzen Eintrag; ein Teil kann eigene haben.
function cardStates(entry, teil) {
  if (teil == null) return entry.states ?? [];
  return entry.parts[teil].states ?? entry.states ?? [];
}

// Gilt ein Teil als sicher? Ab "good" - "hard" heisst, es wackelt noch.
const SICHER = new Set(["good", "easy"]);

function partsLearned(entry) {
  return entry.parts.every((t) => SICHER.has(t.lastGrade));
}

// Steht die Gesamtcombo schon zur Wahl?
function wholeUnlocked(entry) {
  if (!hasParts(entry)) return true;
  return entry.unlock === "always" || partsLearned(entry);
}

// --- Schnittansicht ------------------------------------------
// Geschnitten wird an den Fugen der Notation - dort, wo ohnehin ein
// Trennzeichen steht. Innerhalb eines Terms zu schneiden ergaebe keine
// Combo, die man fuer sich ueben koennte.
const editorBox = document.getElementById("editorBox");
const cutPane = document.getElementById("cutPane");
const cutText = document.getElementById("cutText");
const cutBtn = document.getElementById("cutButton");
const cutTags = document.getElementById("cutTags");
const cutChain = document.getElementById("cutChain");
const cutUnlock = document.getElementById("cutUnlock");

let cutStellen = new Set();     // Zeichenpositionen, an denen getrennt wird

// Zerlegt den Text in Stuecke und die Fugen dazwischen. Eine Fuge ist ein
// Trennzeichen mit Text davor und dahinter.
function cutJoints(text) {
  const fugen = [];
  TOKEN_RE.lastIndex = 0;
  let m;

  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (!m[7]) continue;                       // nur Trennzeichen
    if (!">,~".includes(m[0])) continue;       // Klammern sind keine Fugen
    if (!text.slice(0, m.index).trim()) continue;
    if (!text.slice(m.index + m[0].length).trim()) continue;
    fugen.push({ von: m.index, bis: m.index + m[0].length, zeichen: m[0] });
  }
  return fugen;
}

// Die Teile, wie sie nach den gesetzten Schnitten entstehen. Das
// Trennzeichen der Fuge wird mitgefuehrt: ">" ist ein Gatling, "," ein
// Link - das ist ein Unterschied, den der Schnitt nicht verschlucken darf.
function cutParts(text, stellen) {
  const punkte = [...stellen].sort((a, b) => a - b);
  const roh = [];
  let ab = 0;

  for (const p of punkte) {
    roh.push(text.slice(ab, p));
    ab = p;
  }
  roh.push(text.slice(ab));

  return roh
    .map((stueck) => {
      const treffer = stueck.match(/^\s*([>,~])\s*/);
      return {
        join: treffer ? treffer[1] : "",
        text: (treffer ? stueck.slice(treffer[0].length) : stueck).trim(),
      };
    })
    .filter((t) => t.text);
}

function renderCut() {
  const text = input.value;
  cutText.innerHTML = "";

  const fugen = cutJoints(text);
  let ab = 0;

  const stueck = (von, bis) => {
    const roh = text.slice(von, bis);
    if (!roh) return;
    const span = document.createElement("span");
    span.className = "cut__piece";
    span.innerHTML = tokenize(roh);
    cutText.append(span);
  };

  for (const fuge of fugen) {
    stueck(ab, fuge.von);

    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "cut__joint" + (cutStellen.has(fuge.von) ? " is-cut" : "");
    knopf.dataset.joint = String(fuge.von);
    knopf.textContent = fuge.zeichen;
    knopf.title = cutStellen.has(fuge.von) ? "Join again" : "Cut here";
    cutText.append(knopf);

    ab = fuge.bis;
  }
  stueck(ab, text.length);

  const teile = cutParts(text, cutStellen);
  cutPane.classList.toggle("is-split", teile.length > 1);
}

cutText.addEventListener("click", (e) => {
  const stelle = e.target.closest("[data-joint]")?.dataset.joint;
  if (stelle === undefined) return;

  const n = Number(stelle);
  cutStellen.has(n) ? cutStellen.delete(n) : cutStellen.add(n);
  renderCut();
  updateFlipHeight(true);
});

function setCutMode(an) {
  if (an && !input.value.trim()) { input.focus(); return; }

  cutPane.hidden = !an;
  editorBox.hidden = an;
  cutBtn.classList.toggle("is-active", an);
  cutBtn.setAttribute("aria-pressed", String(an));
  cutBtn.title = an ? "Back to typing" : "Split into parts";

  if (an) {
    cutStellen = new Set();
    renderCut();
  }
  updateFlipHeight(true);
}

cutBtn.addEventListener("click", () => setCutMode(cutPane.hidden));

function inCutMode() {
  return !cutPane.hidden;
}

// In der Schnittansicht liegt der Zeiger nicht mehr im Textfeld - die
// Eingabetaste muss deshalb hier abgefangen werden.
document.addEventListener("keydown", (e) => {
  if (!inCutMode()) return;

  if (e.key === "Enter") { e.preventDefault(); saveCombo(); }
  else if (e.key === "Escape") { e.preventDefault(); setCutMode(false); }
});

function saveCombo() {
  const text = input.value.trim();
  if (!text) { input.focus(); return; }

  const eintrag = {
    id: newId(),
    text,
    character: state.character,          // fuer welchen Charakter
    characters: currentCharacters(),     // gegen welche Charaktere
    position: state.position,
    states: [...state.activeStates],
    category: state.category,
    comment: comment.value.trim(),
    touched: Date.now(),
  };

  // Aus der Schnittansicht kommen die Teile gleich mit.
  if (inCutMode()) {
    const teile = cutParts(text, cutStellen);
    if (teile.length > 1) {
      const marken = cutTags.value === "all" ? [...state.activeStates] : [];
      eintrag.parts = teile.map((t) => ({
        text: t.text, join: t.join, comment: "", states: marken,
      }));
      eintrag.chain = cutChain.value === "1";
      eintrag.unlock = cutUnlock.value;
    }
    setCutMode(false);
  }

  state.entries.push(eintrag);

  // Mit "Persistent input" bleibt alles stehen - praktisch, wenn man
  // Varianten derselben Combo in derselben Lage hintereinander eingibt.
  if (!persistBox.checked) resetComposer();

  onInput();
  renderEntries();
  input.focus();
}

// Alle Eingaben auf den Ausgangszustand zuruecksetzen.
function resetComposer() {
  input.value = "";
  comment.value = "";
  // Das Notizfeld bleibt stehen - es soll ohne Zutun da sein, nicht erst
  // nach Shift+Enter. Geleert wird es, versteckt nicht.
  autoGrow(comment);

  state.position = "everywhere";
  syncPositionUi();

  state.selected = new Set(CHARACTERS.map((c) => c.id));
  state.activeStates.clear();
  // Die Kategorie bleibt stehen: wer sie einmal gesetzt hat, legt
  // meist mehrere Karten derselben Art hintereinander an.
  render();
  syncStates();
}

document.getElementById("saveButton").addEventListener("click", saveCombo);

// Enter speichert sofort, Shift+Enter springt in die Notiz darunter.
input.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.isComposing) return;
  e.preventDefault();

  if (e.shiftKey) {
    openComment();
    return;
  }
  saveCombo();
});

// In der Notiz speichert Enter ebenfalls; Shift+Enter macht dort einen
// Zeilenumbruch - Notizen sind Fliesstext und duerfen mehrzeilig sein.
comment.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
  e.preventDefault();
  saveCombo();
});

function openComment() {
  comment.hidden = false;
  autoGrow(comment);
  updateFlipHeight();
  comment.focus();
  // Cursor ans Ende, falls schon etwas drinsteht.
  comment.setSelectionRange(comment.value.length, comment.value.length);
}

// ============================================================
//  Training
//  Noch ohne Algorithmus: die Bewertung schaltet nur eine Combo weiter.
//  Was "easy" spaeter mit dem Intervall macht, kommt hier hinein.
// ============================================================
const dojoBtn    = document.getElementById("dojoButton");
const dojoLabel  = document.getElementById("dojoLabel");

const drillCombo    = document.getElementById("drillCombo");
const drillPosition = document.getElementById("drillPosition");
const drillProgress = document.getElementById("drillProgress");
const drillStates   = document.getElementById("drillStates");
const drillComment  = document.getElementById("drillComment");
const drillOpponent = document.getElementById("drillOpponent");
const drillComboEdit= document.getElementById("drillComboEdit");
const drillNote     = document.getElementById("drillNote");
const drillEditBtn  = document.getElementById("drillEditButton");
const drillMain     = document.getElementById("drillMain");
const drillDone     = document.getElementById("drillDone");
const drillBack     = document.querySelector(".flip__back");
const drillDoneRate = document.getElementById("drillDoneRate");
const doneList      = document.getElementById("doneList");
const settingsBtn   = document.getElementById("settingsButton");
const drillChars    = document.getElementById("drillChars");
const drillPart     = document.getElementById("drillPart");
const drillStateEdit= document.getElementById("drillStateEdit");
const drillCharEdit = document.getElementById("drillCharEdit");
const drillGrades   = document.getElementById("drillGrades");

let timerId = null;

// Trainiert wird immer der gerade gewaehlte Charakter - hat der noch
// keine Combo, gibt es fuer ihn nichts zu wiederholen.
function syncDojo() {
  if (state.training) return;   // laeuft ein Training, ist es der Stop-Knopf

  const name = CHAR_BY_ID.get(state.character).name;
  const hatCombos = state.entries.some((e) => e.character === state.character);
  const uebbar = trainableEntries(state.character).length;
  const faellig = dueCount(state.character);

  // Die Art der Runde steht erst im Fenster fest - der Knopf heisst
  // deshalb immer gleich und zeigt nur an, ob es etwas zu tun gibt.
  dojoBtn.disabled = uebbar === 0;
  dojoLabel.textContent = "Start training";

  dojoBtn.title = !hatCombos
    ? "Nothing saved for " + name + " yet"
    : uebbar === 0
      ? "Nothing to train for " + name
      : faellig > 0
        ? "Train " + name + " - " + faellig + " due"
        : "Train " + name + " - nothing due today";
}

function formatTime(ms) {
  const sek = Math.floor(ms / 1000);
  return String(Math.floor(sek / 60)).padStart(2, "0") + ":" +
         String(sek % 60).padStart(2, "0");
}

// Beim Bearbeiten steht die Uhr. Deshalb wird die verstrichene Zeit
// aufsummiert statt aus einem festen Startpunkt gerechnet.
function trainingElapsed() {
  const t = state.training;
  if (t.stopped) return t.elapsed;      // beim Abschluss festgehalten
  return t.elapsed + (t.editing ? 0 : Date.now() - t.since);
}

// Kurze Dauer je Combo: unter einer Minute in Sekunden, sonst m:ss.
function formatShort(ms) {
  const sek = Math.max(0, Math.round(ms / 1000));
  if (sek < 60) return sek + " s";
  return Math.floor(sek / 60) + ":" + String(sek % 60).padStart(2, "0");
}

function tick() {
  dojoLabel.textContent = formatTime(trainingElapsed());
}

// Die Combo, die gerade dran ist, auf die Rueckseite schreiben.
function showDrill() {
  const t = state.training;
  const posten = t.queue[t.index];
  const entry = posten.entry;
  const teil = posten.teil ?? null;

  // Gegen wen wird geuebt? Nur im Zufallsmodus vergeben.
  drillOpponent.innerHTML = "";
  drillOpponent.hidden = !posten.charId;

  if (posten.charId) {
    const gegner = CHAR_BY_ID.get(posten.charId);
    drillOpponent.append(charIcon(gegner, "drill__opponent-icon"));

    const name = document.createElement("span");
    name.textContent = gegner.name;
    drillOpponent.append(name);

    // Neutral heisst: mit keinem erlaubten Charakter moeglich. Die Combo
    // kommt trotzdem dran, aber der eingestellte Gegner passt nicht.
    drillOpponent.classList.toggle("is-warning", !!posten.neutral);
    if (posten.neutral) {
      drillOpponent.title = "This combo does not work against " + gegner.name;
      drillOpponent.insertAdjacentHTML("beforeend", WARN_SVG);
    } else {
      drillOpponent.title = "Set the dummy to " + gegner.name;
    }
  }

  // Lesen oder bearbeiten? Der Stift oben schaltet um.
  const bearbeiten = !!t.editing;

  // Ein Teil einer zerschnittenen Combo wird nur geuebt, nicht bearbeitet -
  // geaendert wird sie als Ganzes in der Liste.
  const nurLesen = bearbeiten && teil !== null;

  if (bearbeiten && !nurLesen) {
    drillComboEdit.innerHTML = "";
    const box = comboField(entry);
    box.classList.add("editor--drill");
    drillComboEdit.append(box);
    autoGrow(box.querySelector("textarea"));   // erst im Dokument messbar
  } else {
    drillCombo.innerHTML = tokenize(cardText(entry, teil));
  }
  drillCombo.hidden = bearbeiten && !nurLesen;
  drillComboEdit.hidden = !bearbeiten || nurLesen;

  drillPosition.textContent = describePosition(entry.position);

  // Woran arbeitet man gerade? Bei Teilen die Nummer, sonst nichts.
  drillPart.hidden = teil === null;
  if (teil !== null) {
    drillPart.textContent = "Part " + (teil + 1) + " / " + entry.parts.length;
  }

  // Die Marken sind genau die Zusatzinfo, die beim Ueben zaehlt. Beim
  // Bearbeiten treten sie unter die Combo, weil die waehlbare Fassung
  // mit dem Pluszeichen zu breit fuer die Kopfzeile ist.
  drillStates.innerHTML = "";
  drillStates.hidden = bearbeiten;
  if (!bearbeiten) {
    visibleStates({ states: cardStates(entry, teil) })
      .forEach((name) => drillStates.append(stateTag(name)));
  }

  drillStateEdit.innerHTML = "";
  drillStateEdit.hidden = !bearbeiten;
  if (bearbeiten) {
    drillStateEdit.append(stateEditor(entry, () => {
      showDrill();
      updateFlipHeight(true);
    }));
  }
  // Nicht queue.length: eine mit "Again" zurueckgelegte Combo haengt
  // hinten wieder dran und liesse die Gesamtzahl sonst wachsen.
  drillProgress.textContent = Math.min(t.index + 1, t.total) + " / " + t.total;

  // Beim Lesen gerendert, damit Links anklickbar sind; beim Bearbeiten
  // als Feld. Beides zugleich geht nicht - ein Textfeld kennt keine Links.
  drillComment.hidden = !bearbeiten;

  const notiz = teil === null ? entry.comment : (entry.parts[teil].comment || entry.comment);
  drillNote.hidden = bearbeiten || !notiz;

  if (bearbeiten) {
    drillComment.value = entry.comment ?? "";
    autoGrow(drillComment);
  } else {
    drillNote.innerHTML = notiz ? linkify(notiz) : "";
  }

  // Wie lange wuerde jede Note aufschieben?
  drillGrades.querySelectorAll("[data-days]").forEach((el) => {
    // In der gezielten Runde wird nichts geplant - eine Tagesangabe waere gelogen.
    el.textContent = t.temporary
      ? ""
      : describeInterval(previewInterval(entry, el.dataset.days, teil));
  });

  drillCharEdit.innerHTML = "";
  drillCharEdit.hidden = !bearbeiten;
  if (bearbeiten) {
    // Die Kategorie gehoert zur ganzen Karte, nicht zu einem Teil.
    const wahl = categorySelect(entry);
    wahl.addEventListener("change", () => { showDrill(); updateFlipHeight(true); });
    drillCharEdit.append(wahl, entryCharPicker(entry));
  }

  const icons = iconsFor(entry.characters);
  drillChars.innerHTML = "";
  drillChars.hidden = bearbeiten || !icons || icons.chars.length === 0;

  if (!drillChars.hidden) {
    drillChars.className = "drill__chars" + (icons.muted ? " is-muted" : "");
    drillChars.title = icons.muted ? "Works against everyone except these" : "Works against these characters";
    icons.chars.forEach((c) => drillChars.append(charIcon(c, "entry__char")));
  }
}

// Marken und Gegner lassen sich auch auf der Karte aendern - dieselben
// Bedienelemente wie in der Liste, nur zeichnet hier die Karte neu.
drillMain.addEventListener("click", (e) => {
  if (!state.training?.editing) return;

  const zeichnen = () => { showDrill(); updateFlipHeight(true); };
  if (entryPickerClick(e, zeichnen)) return;

  const marke = e.target.closest("[data-toggle-state]")?.dataset.toggleState;
  if (!marke) return;

  const entry = state.training.queue[state.training.index].entry;
  const an = new Set(entry.states ?? []);
  an.has(marke) ? an.delete(marke) : an.add(marke);
  entry.states = [...an];
  touch(entry);
  persist();
  zeichnen();
});

drillComment.addEventListener("input", () => {
  autoGrow(drillComment);
  updateFlipHeight(true);

  if (!state.training) return;
  const entry = state.training.queue[state.training.index].entry;
  entry.comment = drillComment.value.trim();
});

const DONE_OK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="m5 13 4 4L19 7"/></svg>';

const DONE_FAIL_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" ' +
  'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

// --- Was schon dran war ---------------------------------------
// Eine Zeile je Combo, nicht je Klick: kommt eine Combo nach "Again"
// noch einmal, wandert ihre Zeile nach oben statt sich zu verdoppeln.
// nachOben=false beim Nachbessern aus der Liste: dort soll die Zeile
// stehenbleiben, sonst rutscht sie unter dem Mauszeiger weg.
function setGrade(entry, grade, nachOben = true, dauer = null, teil = null) {
  const t = state.training;
  const traeger = srOf(entry, teil);
  let posten = t.done.find((d) => d.entry === entry && d.teil === teil);

  if (posten) {
    // Auf den Stand vor der ersten Bewertung zuruecksetzen. Ohne das
    // wuerde sich das Intervall bei jeder Korrektur weiter aufschaukeln.
    Object.assign(traeger, posten.vorher);
    if (nachOben) t.done = t.done.filter((d) => d !== posten);
  } else {
    posten = {
      entry,
      teil,
      vorher: {
        interval: traeger.interval ?? 0,
        due: traeger.due ?? 0,
        lastGrade: traeger.lastGrade ?? null,
      },
    };
  }

  // Beim Grinden wird nichts gespeichert: die Noten gelten nur fuer diese
  // Sitzung und duerfen weder den Plan noch das Tagespensum verstellen.
  if (!t.temporary) {
    // Nur der allererste Kontakt zaehlt gegen den Deckel.
    const warNeu = !posten.gezaehlt && !posten.vorher.lastGrade && !posten.vorher.interval;
    applyGrade(entry, grade, teil);
    if (warNeu) { noteNewCard(entry.character); posten.gezaehlt = true; }
  }

  touch(entry);              // haelt die Gruppe in der Liste oben
  posten.grade = grade;
  if (dauer !== null) posten.dauer = dauer;   // beim Nachbessern unveraendert
  if (nachOben) t.done.unshift(posten);       // neueste oben
}

function successRate() {
  const done = state.training?.done ?? [];
  if (done.length === 0) return 0;

  const punkte = done.reduce((summe, d) => summe + (GRADE_SCORE[d.grade] ?? 0), 0);
  return Math.round((punkte / (10 * done.length)) * 100);
}

// Nur die eine Zeile auffrischen. Ein kompletter Neuaufbau wuerde auch
// das Element unter dem Mauszeiger ersetzen - dann faellt der Rahmen
// zusammen, bis man die Maus bewegt.
function updateDoneRow(item, posten) {
  const geschafft = posten.grade !== "again";

  const zeichen = item.querySelector(".done__mark");
  zeichen.classList.toggle("is-fail", !geschafft);
  zeichen.innerHTML = geschafft ? DONE_OK_SVG : DONE_FAIL_SVG;

  item.querySelectorAll("[data-regrade]").forEach((b) => {
    b.classList.toggle("is-chosen", b.dataset.regrade === posten.grade);
  });
}

function renderDone() {
  const done = state.training?.done ?? [];
  doneList.hidden = done.length === 0;
  doneList.innerHTML = "";

  for (const posten of done) {
    const item = document.createElement("li");
    item.className = "done__item";
    item.dataset.id = posten.entry.id;
    item.dataset.teil = String(posten.teil ?? "");

    const zeile = document.createElement("div");
    zeile.className = "done__row";

    const zeichen = document.createElement("span");
    const geschafft = posten.grade !== "again";
    zeichen.className = "done__mark" + (geschafft ? "" : " is-fail");
    zeichen.innerHTML = geschafft ? DONE_OK_SVG : DONE_FAIL_SVG;

    const combo = document.createElement("p");
    combo.className = "done__combo";
    combo.innerHTML = tokenize(cardText(posten.entry, posten.teil ?? null));

    zeile.append(zeichen, combo);

    // Direkt hinter der Combo, nicht am rechten Rand.
    if (posten.dauer != null) {
      const zeit = document.createElement("span");
      zeit.className = "done__time";
      zeit.textContent = formatShort(posten.dauer);
      zeit.title = "Time spent on this combo";
      zeile.append(zeit);
    }

    item.append(zeile);

    // Zum Nachbessern, falls man sich verklickt hat.
    const noten = document.createElement("div");
    noten.className = "done__grades";
    for (const g of ["again", "hard", "good", "easy"]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "grade grade--" + g + " done__grade" +
                    (g === posten.grade ? " is-chosen" : "");
      b.dataset.regrade = g;
      b.textContent = gradeLabel(g);
      noten.append(b);
    }
    item.append(noten);

    doneList.append(item);
  }
}

// Eine mit "Again" zurueckgelegte Combo haengt noch hinten in der
// Warteschlange. Wird sie nachtraeglich als geschafft bewertet, ist die
// Wiederholung hinfaellig - gerade eben ist sie ja gelungen.
function dropPendingRepeat(entry, teil = null) {
  const t = state.training;
  const i = t.queue.findIndex((p, k) =>
    k >= t.index && p.entry === entry && (p.teil ?? null) === teil);
  if (i === -1) return false;

  t.queue.splice(i, 1);
  return true;
}

doneList.addEventListener("click", (e) => {
  const grade = e.target.closest("[data-regrade]")?.dataset.regrade;
  if (!grade || !state.training) return;

  const item = e.target.closest(".done__item");
  const t = state.training;
  const posten = t.done.find((d) =>
    d.entry.id === item?.dataset.id && String(d.teil ?? "") === item?.dataset.teil);
  if (!posten) return;

  setGrade(posten.entry, grade, false, null, posten.teil ?? null);   // Zeile bleibt
  updateDoneRow(item, posten);            // und bleibt aufgeklappt

  // Stand die Wiederholung schon im Hauptfeld, ruecken die restlichen
  // Combos nach; war es die letzte, ist die Runde damit durch.
  if (grade !== "again" && dropPendingRepeat(posten.entry, posten.teil ?? null) && !t.finished) {
    if (t.index >= t.queue.length) {
      showFinished();
      return;
    }
    t.comboStart = trainingElapsed();   // die naechste faengt bei null an
    showDrill();
    updateFlipHeight(true);
  }

  if (t.finished) showFinished();
});

// --- Abschluss ------------------------------------------------
function showFinished() {
  const t = state.training;
  t.finished = true;

  t.elapsed = trainingElapsed();   // Stand festhalten, bevor sie stehenbleibt
  t.stopped = true;

  clearInterval(timerId);      // die Sitzung ist durch, die Uhr auch
  timerId = null;

  drillMain.hidden = true;
  drillDone.hidden = false;
  drillBack.classList.add("is-done");
  drillDoneRate.textContent =
    "~" + successRate() + "% Performance (" + t.done.length +
    (t.done.length === 1 ? " drill)" : " drills)") +
    " · " + formatTime(t.elapsed);

  drillEditBtn.hidden = true;
  dojoBtn.hidden = true;       // der rote Knopf lenkt hier nur ab
  updateFlipHeight();
}

document.getElementById("drillDoneClose").addEventListener("click", stopTraining);

// Bearbeiten haelt die Uhr an: die Zeit soll das Ueben messen, nicht das Tippen.
function setDrillEditing(an) {
  const t = state.training;
  if (!t || t.editing === an) return;

  if (an) t.elapsed += Date.now() - t.since;
  else t.since = Date.now();
  t.editing = an;

  drillEditBtn.setAttribute("aria-pressed", String(an));
  drillEditBtn.classList.toggle("is-active", an);
  drillEditBtn.title = an
    ? "Stop editing - the clock resumes"
    : "Edit combo and note - pauses the clock";
  dojoBtn.classList.toggle("is-paused", an);

  showDrill();
  updateFlipHeight(true);
  tick();
}

drillEditBtn.addEventListener("click", () => setDrillEditing(!state.training?.editing));

function startTraining(plan) {
  const charId = state.character;
  const queue = plan.mode === "sr" ? srQueue(charId)
    : plan.mode === "routine" ? routineQueue(plan.routine)
    : grindQueue(charId, plan.cats);

  if (queue.length === 0) {
    showNotice("Nothing to train for " + CHAR_BY_ID.get(charId).name + ".",
               "error");
    return;
  }

  POPOVERS.forEach(closePopover);   // nichts soll auf der weggedrehten Seite offen stehen
  state.training = { queue, index: 0, total: queue.length,
                     elapsed: 0, since: Date.now(),
                     editing: false, done: [], finished: false,
                     stopped: false, comboStart: 0,
                     temporary: plan.mode !== "sr" };

  drillMain.hidden = false;
  drillDone.hidden = true;
  drillBack.classList.remove("is-done");
  renderDone();

  showDrill();
  flip.classList.add("is-flipped");

  // Der Charakter steht jetzt fest.
  whoBtn.classList.add("is-static");
  whoBtn.tabIndex = -1;

  // Aus Start wird Stop, mit laufender Uhr.
  dojoBtn.classList.add("is-stop");
  dojoBtn.title = "Stop training";

  // Im Training gibt es keine Einstellungen, dafuer den Stift.
  settingsBtn.hidden = true;
  drillEditBtn.hidden = false;
  tick();
  timerId = setInterval(tick, 1000);

  renderEntries();      // blendet die Liste aus
  updateFlipHeight();
}

function stopTraining() {
  clearInterval(timerId);
  timerId = null;
  state.training = null;

  doneList.hidden = true;
  doneList.innerHTML = "";
  drillMain.hidden = false;
  drillDone.hidden = true;
  drillBack.classList.remove("is-done");

  flip.classList.remove("is-flipped");

  whoBtn.classList.remove("is-static");
  whoBtn.tabIndex = 0;

  dojoBtn.classList.remove("is-stop");
  dojoBtn.classList.remove("is-paused");
  dojoLabel.textContent = "Start training";

  dojoBtn.hidden = false;
  settingsBtn.hidden = false;
  drillEditBtn.hidden = true;
  drillEditBtn.classList.remove("is-active");
  drillEditBtn.setAttribute("aria-pressed", "false");

  renderEntries();      // holt die Liste zurueck und ruft syncDojo
  updateFlipHeight();
}

dojoBtn.addEventListener("click", () => {
  state.training ? stopTraining() : openTrainPicker();
});

drillGrades.addEventListener("click", (e) => {
  const grade = e.target.closest("[data-grade]")?.dataset.grade;
  if (!grade || !state.training) return;

  const t = state.training;
  if (t.finished) return;

  const posten = t.queue[t.index];
  const dauer = trainingElapsed() - (t.comboStart ?? 0);
  setGrade(posten.entry, grade, true, dauer, posten.teil ?? null);

  // "Nochmal" heisst: noch in dieser Runde wieder vorlegen. Hinten anhaengen,
  // damit erst der Rest drankommt.
  if (grade === "again") t.queue.push(posten);

  t.index++;
  t.comboStart = trainingElapsed();   // Uhrstand fuer die naechste Combo
  renderDone();

  if (t.index >= t.queue.length) {
    showFinished();     // Durchlauf zu Ende, Liste bleibt zum Nachbessern
    return;
  }
  showDrill();
  updateFlipHeight();
});

// --- Welche Runde? ------------------------------------------
// Der Startknopf fragt, statt die Art des Trainings aus der Lage zu
// raten: nach Plan, oder gezielt auf ausgesuchte Kategorien.

const trainDlg     = document.getElementById("trainDialog");
const trainWho     = document.getElementById("trainWho");
const trainModes   = document.getElementById("trainModes");
const trainDue     = document.getElementById("trainDue");
const trainAmount  = document.getElementById("trainGrindCount");
const trainPick    = document.getElementById("trainPick");
const trainCats    = document.getElementById("trainCats");
const trainGo      = document.getElementById("trainGo");
const trainRoutinePick  = document.getElementById("trainRoutinePick");
const trainRoutines     = document.getElementById("trainRoutines");
const trainRoutineCount = document.getElementById("trainRoutineCount");

let trainMode  = "sr";
let trainGroups = [];
let grindPick  = null;    // null = noch nie gewaehlt, dann gilt alles
let pickedRoutine = null; // Kennung der gewaehlten Routine

// Welche Kategorien hat dieser Charakter, und wie viele Karten haengen
// daran? Reihenfolge wie in der Liste: Kategorien zuerst, Uebriges unten.
function grindGroups(charId) {
  const zaehler = new Map();

  for (const entry of trainableEntries(charId)) {
    const key = categoryOf(entry) ?? NO_CATEGORY;
    zaehler.set(key, (zaehler.get(key) ?? 0) + cardsOf(entry, true).length);
  }

  const namen = state.categories.filter((n) => zaehler.has(n));
  for (const key of zaehler.keys()) {
    if (key !== NO_CATEGORY && !namen.includes(key)) namen.push(key);
  }
  if (zaehler.has(NO_CATEGORY)) namen.push(NO_CATEGORY);

  return namen.map((key) => ({ key, count: zaehler.get(key) }));
}

function buildTrainCats() {
  trainCats.innerHTML = "";

  for (const gruppe of trainGroups) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "train-cat";
    item.dataset.cat = gruppe.key;

    // Leere Box fuer "ohne Kategorie": haelt die Namen auf einer Linie.
    const marke = gruppe.key === NO_CATEGORY
      ? document.createElement("span")
      : tagMarker(gruppe.key, "menu__dot");
    if (gruppe.key === NO_CATEGORY) marke.className = "menu__dot";

    const name = document.createElement("span");
    name.className = "train-cat__name";
    name.textContent = gruppe.key === NO_CATEGORY
      ? "No category"
      : categoryLabelOf(tagLabel(gruppe.key));

    const zahl = document.createElement("span");
    zahl.className = "train-cat__count";
    zahl.textContent = gruppe.count;

    item.append(marke, name, zahl);
    item.insertAdjacentHTML("beforeend", STATE_CHECK_SVG);
    trainCats.append(item);
  }
}

// Die gespeicherten Plaene dieses Charakters, einer davon gewaehlt.
function buildTrainRoutines() {
  trainRoutines.innerHTML = "";

  const meine = routinesFor(state.character);
  if (meine.length === 0) {
    const leer = document.createElement("p");
    leer.className = "setting__hint routine-empty";
    leer.textContent = "No routine yet. Build one and it stays here.";
    trainRoutines.append(leer);
    return;
  }

  for (const routine of meine) {
    const zeile = document.createElement("div");
    zeile.className = "routine-row";
    zeile.dataset.routine = routine.id;

    const waehlen = document.createElement("button");
    waehlen.type = "button";
    waehlen.className = "train-cat routine-row__pick";
    waehlen.dataset.pickRoutine = routine.id;

    const name = document.createElement("span");
    name.className = "train-cat__name";
    name.textContent = routine.name;

    const zahl = document.createElement("span");
    zahl.className = "train-cat__count";
    const schritte = routineSteps(routine).length;
    zahl.textContent = schritte + (schritte === 1 ? " step" : " steps");

    waehlen.append(name, zahl);
    waehlen.insertAdjacentHTML("beforeend", STATE_CHECK_SVG);

    const stift = document.createElement("button");
    stift.type = "button";
    stift.className = "routine-row__edit";
    stift.dataset.editRoutine = routine.id;
    stift.title = "Edit routine";
    stift.setAttribute("aria-label", "Edit routine");
    stift.insertAdjacentHTML("beforeend", PENCIL_SVG);

    zeile.append(waehlen, stift);
    trainRoutines.append(zeile);
  }
}

function selectedRoutine() {
  return routinesFor(state.character).find((r) => r.id === pickedRoutine) ?? null;
}

function syncTrainUi() {
  trainModes.querySelectorAll("[data-mode]").forEach((b) => {
    const an = b.dataset.mode === trainMode;
    b.classList.toggle("is-active", an);
    b.setAttribute("aria-pressed", String(an));
  });

  trainPick.hidden = trainMode !== "grind";
  trainRoutinePick.hidden = trainMode !== "routine";

  trainCats.querySelectorAll("[data-cat]").forEach((b) => {
    const an = grindPick.has(b.dataset.cat);
    b.classList.toggle("is-active", an);
    b.setAttribute("aria-pressed", String(an));
  });

  trainRoutines.querySelectorAll("[data-pick-routine]").forEach((b) => {
    const an = b.dataset.pickRoutine === pickedRoutine;
    b.classList.toggle("is-active", an);
    b.setAttribute("aria-pressed", String(an));
  });

  const karten = trainGroups
    .filter((g) => grindPick.has(g.key))
    .reduce((summe, g) => summe + g.count, 0);
  trainAmount.textContent = karten === 0 ? "nothing picked" : karten + " items";

  const gewaehlt = selectedRoutine();
  const schritte = gewaehlt ? routineSteps(gewaehlt).length : 0;
  const anzahl = routinesFor(state.character).length;
  trainRoutineCount.textContent = gewaehlt
    ? schritte + (schritte === 1 ? " step" : " steps")
    : anzahl === 0 ? "none yet"
    : anzahl + (anzahl === 1 ? " routine" : " routines");

  trainGo.disabled =
    (trainMode === "grind" && karten === 0) ||
    (trainMode === "routine" && schritte === 0);
}

function openTrainPicker() {
  const charId = state.character;
  trainGroups = grindGroups(charId);

  // Nur behalten, was es bei diesem Charakter gibt - sonst uebte man
  // nach einem Wechsel gegen eine leere Auswahl.
  const vorhanden = new Set(trainGroups.map((g) => g.key));
  grindPick = new Set([...(grindPick ?? vorhanden)].filter((k) => vorhanden.has(k)));
  if (grindPick.size === 0) grindPick = new Set(vorhanden);

  trainWho.textContent = CHAR_BY_ID.get(charId).name;

  // Nach Plan geht nur, wenn er an ist und heute etwas trifft.
  const faellig = dueCount(charId);
  const planAn = state.settings.sr.enabled;
  const nachPlan = planAn && faellig > 0;

  const srBtn = trainModes.querySelector('[data-mode="sr"]');
  srBtn.disabled = !nachPlan;
  srBtn.title = !planAn
    ? "Spaced repetition is off in the preferences"
    : faellig === 0
      ? "Nothing due today"
      : "";
  trainDue.textContent = !planAn ? "off"
    : faellig > 0 ? faellig + " due"
    : "nothing due";

  // Eine Routine, die es nicht mehr gibt, darf nicht gewaehlt bleiben.
  if (!selectedRoutine()) {
    pickedRoutine = routinesFor(charId)[0]?.id ?? null;
  }

  trainMode = nachPlan ? "sr" : "grind";
  buildTrainCats();
  buildTrainRoutines();
  syncTrainUi();
  trainDlg.showModal();
  trainGo.focus();
}

trainModes.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-mode]");
  if (!btn || btn.disabled) return;
  trainMode = btn.dataset.mode;
  syncTrainUi();
});

trainCats.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-cat]");
  if (!btn) return;
  const key = btn.dataset.cat;
  grindPick.has(key) ? grindPick.delete(key) : grindPick.add(key);
  syncTrainUi();
});

trainRoutines.addEventListener("click", (e) => {
  const stift = e.target.closest("[data-edit-routine]");
  if (stift) {
    openRoutineEditor(state.routines.find((r) => r.id === stift.dataset.editRoutine));
    return;
  }

  const btn = e.target.closest("[data-pick-routine]");
  if (!btn) return;
  pickedRoutine = btn.dataset.pickRoutine;
  syncTrainUi();
});

document.getElementById("routineNew")
  .addEventListener("click", () => openRoutineEditor(null));

trainPick.addEventListener("click", (e) => {
  const wahl = e.target.closest("[data-pick]")?.dataset.pick;
  if (!wahl) return;
  grindPick = wahl === "all" ? new Set(trainGroups.map((g) => g.key)) : new Set();
  syncTrainUi();
});

document.getElementById("trainCancel").addEventListener("click", () => trainDlg.close());

trainGo.addEventListener("click", () => {
  const routine = selectedRoutine();
  if (trainMode === "routine" && !routine) return;

  trainDlg.close();
  startTraining(
    trainMode === "sr" ? { mode: "sr" }
    : trainMode === "routine" ? { mode: "routine", routine }
    : { mode: "grind", cats: new Set(grindPick) });
});

// --- Eigene Charaktere --------------------------------------
// Sie liegen beim Spiel, nicht global: ein selbst angelegter Gast
// gehoert in das Spiel, in dem man ihn spielt.

const charDlg      = document.getElementById("charDialog");
const charNameIn   = document.getElementById("charName");
const charShortIn  = document.getElementById("charShort");
const charIconIn   = document.getElementById("charIconUrl");
const charErrorEl  = document.getElementById("charError");
const charOwnBox   = document.getElementById("charOwnBox");
const charOwnList  = document.getElementById("charOwn");

// Aus "Baiken" wird "baiken"; Gleichnamiges bekommt eine Ziffer.
function charIdFor(name) {
  const roh = name.toLowerCase().replace(/[^a-z0-9]+/g, "") || "char";
  let id = roh;
  for (let i = 2; CHAR_BY_ID.has(id); i++) id = roh + i;
  return id;
}

function charError(text) {
  charErrorEl.textContent = text;
  charErrorEl.hidden = !text;
}

function openCharDialog() {
  charNameIn.value = "";
  charShortIn.value = "";
  charIconIn.value = "";
  charError("");
  buildCharOwn();
  closePopover(whoPop);
  charDlg.showModal();
  charNameIn.focus();
}

// Was man selbst angelegt hat, laesst sich hier auch wieder loswerden.
function buildCharOwn() {
  charOwnList.innerHTML = "";
  charOwnBox.hidden = state.customChars.length === 0;

  for (const char of state.customChars) {
    const zeile = document.createElement("div");
    zeile.className = "char-own";

    zeile.append(charIcon(char, "char-own__icon"));

    const name = document.createElement("span");
    name.className = "char-own__name";
    name.textContent = char.name;

    const zahl = document.createElement("span");
    zahl.className = "train-cat__count";
    const n = state.entries.filter((e) => e.character === char.id).length;
    zahl.textContent = n === 0 ? "" : n + (n === 1 ? " item" : " items");

    const weg = document.createElement("button");
    weg.type = "button";
    weg.className = "routine-step__btn";
    weg.dataset.dropChar = char.id;
    weg.textContent = "×";
    weg.title = "Remove character";
    weg.setAttribute("aria-label", "Remove character");

    zeile.append(name, zahl, weg);
    charOwnList.append(zeile);
  }
}

charOwnList.addEventListener("click", (e) => {
  const id = e.target.closest("[data-drop-char]")?.dataset.dropChar;
  if (!id) return;

  // Mit dem Charakter verschwaenden auch seine Drills - lieber erst
  // fragen, als sie still mitzunehmen.
  const drills = state.entries.filter((entry) => entry.character === id).length;
  if (drills > 0) {
    charError(CHAR_BY_ID.get(id).name + " still has " + drills +
              (drills === 1 ? " drill. Delete it first." : " drills. Delete them first."));
    return;
  }

  state.customChars = state.customChars.filter((c) => c.id !== id);
  state.routines = state.routines.filter((r) => r.char !== id);
  state.settings.allowedChars.delete(id);
  applyCustomChars();
  if (!CHAR_BY_ID.has(state.character)) state.character = CHARACTERS[0].id;

  charError("");
  refreshRosterUi();
  buildCharOwn();
});

// Alles, was die Charakterliste zeigt, neu aufbauen.
function refreshRosterUi() {
  buildGrid();
  buildWhoGrid();
  allowedGrid.innerHTML = "";     // wird beim naechsten Oeffnen neu gebaut
  syncWho();
  render();
  renderEntries();
  persist();
}

document.getElementById("charSave").addEventListener("click", () => {
  const name = charNameIn.value.trim();
  if (!name) {
    charError("A name is needed.");
    charNameIn.focus();
    return;
  }

  if (CHARACTERS.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    charError("There is already a character called " + name + ".");
    return;
  }

  const link = charIconIn.value.trim();
  if (link && !/^https?:\/\//i.test(link)) {
    charError("The picture needs a full link, starting with https://");
    return;
  }

  // Ohne Kuerzel: die ersten zwei Buchstaben. Es steht nur da, solange
  // kein Bild geladen ist.
  const kurz = (charShortIn.value.trim() || name.slice(0, 2)).toUpperCase();

  const char = { id: charIdFor(name), name, short: kurz, icon: link };
  state.customChars.push(char);
  applyCustomChars();

  // Wer sich einen Charakter anlegt, will mit ihm weitermachen.
  state.character = char.id;
  state.settings.allowedChars.add(char.id);

  charDlg.close();
  refreshRosterUi();
});

document.getElementById("charCancel").addEventListener("click", () => charDlg.close());

// --- Der Baukasten fuer eine Routine ------------------------
// Eine Routine ist eine Liste von Verweisen auf Combos. Mehrfach
// derselbe Verweis ist ausdruecklich erlaubt - daran haengt der Nutzen
// bei Druckserien oder mehreren Enden auf denselben Anfang.

const routineDlg     = document.getElementById("routineDialog");
const routineNameIn  = document.getElementById("routineName");
const routineList    = document.getElementById("routineSteps");
const routineSource  = document.getElementById("routineSource");
const routineEmptyEl = document.getElementById("routineEmpty");
const routineGoneEl  = document.getElementById("routineGone");
const routineDropBtn = document.getElementById("routineDrop");
const routineSaveBtn = document.getElementById("routineSave");

let routineDraft = null;

// "Routine 3": der erste Name, den es noch nicht gibt.
function nextRoutineName(charId) {
  const belegt = new Set(routinesFor(charId).map((r) => r.name));
  for (let i = 1; ; i++) {
    const name = "Routine " + i;
    if (!belegt.has(name)) return name;
  }
}

function openRoutineEditor(routine) {
  const vorhanden = !!routine;
  routineDraft = vorhanden
    ? { ...routine, items: [...routine.items] }
    : { id: newId(), name: "", char: state.character, items: [] };

  // Ein Schritt, dessen Combo geloescht wurde, laesst sich nicht zeigen.
  // Er faellt hier weg, damit die Liste zeigt, was wirklich laufen wuerde.
  const bekannt = new Set(trainableEntries(routineDraft.char).map((e) => e.id));
  const vorher = routineDraft.items.length;
  routineDraft.items = routineDraft.items.filter((id) => bekannt.has(id));
  routineGoneEl.hidden = routineDraft.items.length === vorher;

  routineNameIn.value = routineDraft.name;
  routineNameIn.placeholder = nextRoutineName(routineDraft.char);
  routineDropBtn.hidden = !vorhanden;

  buildRoutineSteps();
  buildRoutineSource();
  routineDlg.showModal();
  routineNameIn.focus();
}

function buildRoutineSteps() {
  routineList.innerHTML = "";
  routineEmptyEl.hidden = routineDraft.items.length > 0;
  routineSaveBtn.disabled = routineDraft.items.length === 0;
  routineSaveBtn.title = routineDraft.items.length === 0
    ? "A routine needs at least one step"
    : "";

  const bekannt = new Map(trainableEntries(routineDraft.char).map((e) => [e.id, e]));

  routineDraft.items.forEach((id, i) => {
    const entry = bekannt.get(id);
    if (!entry) return;

    const zeile = document.createElement("li");
    zeile.className = "routine-step";
    // Merkt sich, an welcher Stelle die Zeile gebaut wurde. Nach dem
    // Ziehen laesst sich die neue Reihenfolge daran ablesen.
    zeile.dataset.row = String(i);

    zeile.insertAdjacentHTML("beforeend", GRIP_SVG.replace("order__grip", "routine-step__grip"));

    const nummer = document.createElement("span");
    nummer.className = "routine-step__no";

    const marke = categoryOf(entry)
      ? tagMarker(categoryOf(entry), "menu__dot")
      : document.createElement("span");
    if (!categoryOf(entry)) marke.className = "menu__dot";

    const text = document.createElement("span");
    text.className = "routine-step__combo";
    text.innerHTML = tokenize(entry.text);

    const werkzeug = document.createElement("span");
    werkzeug.className = "routine-step__tools";

    const knoepfe = [
      ["dup",  "+1",      "Use once more"],
      ["drop", "×", "Remove step"],
    ];

    for (const [act, zeichen, titel] of knoepfe) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "routine-step__btn";
      b.dataset.step = String(i);
      b.dataset.act = act;
      b.textContent = zeichen;
      b.title = titel;
      b.setAttribute("aria-label", titel);
      werkzeug.append(b);
    }

    zeile.append(nummer, marke, text, werkzeug);
    routineList.append(zeile);
  });
}

function buildRoutineSource() {
  routineSource.innerHTML = "";
  const alle = trainableEntries(routineDraft.char);

  if (alle.length === 0) {
    const leer = document.createElement("p");
    leer.className = "setting__hint";
    leer.textContent = "Nothing saved for this character yet.";
    routineSource.append(leer);
    return;
  }

  for (const entry of alle) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "routine-add";
    b.dataset.add = entry.id;
    b.title = "Add to the routine";

    const marke = categoryOf(entry)
      ? tagMarker(categoryOf(entry), "menu__dot")
      : document.createElement("span");
    if (!categoryOf(entry)) marke.className = "menu__dot";

    const text = document.createElement("span");
    text.className = "routine-add__combo";
    text.innerHTML = tokenize(entry.text);

    const plus = document.createElement("span");
    plus.className = "routine-add__plus";
    plus.textContent = "+";

    b.append(marke, text, plus);
    routineSource.append(b);
  }
}

routineList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn || !routineDraft) return;

  const i = Number(btn.dataset.step);
  const items = routineDraft.items;

  if (btn.dataset.act === "dup") {
    items.splice(i + 1, 0, items[i]);
  } else if (btn.dataset.act === "drop") {
    items.splice(i, 1);
  }

  buildRoutineSteps();
});

makeSortable(routineList, {
  item: ".routine-step",
  handle: ".routine-step__grip",
  onDrop: () => {
    if (!routineDraft) return;
    routineDraft.items = [...routineList.children]
      .map((zeile) => routineDraft.items[Number(zeile.dataset.row)]);
    buildRoutineSteps();
  },
});

routineSource.addEventListener("click", (e) => {
  const id = e.target.closest("[data-add]")?.dataset.add;
  if (!id || !routineDraft) return;
  routineDraft.items.push(id);
  buildRoutineSteps();
  // Der neue Schritt steht ganz unten - dorthin schauen.
  routineList.lastElementChild?.scrollIntoView({ block: "nearest" });
});

routineSaveBtn.addEventListener("click", () => {
  if (!routineDraft || routineDraft.items.length === 0) return;

  routineDraft.name = routineNameIn.value.trim() || nextRoutineName(routineDraft.char);

  const i = state.routines.findIndex((r) => r.id === routineDraft.id);
  if (i >= 0) state.routines[i] = routineDraft;
  else state.routines.push(routineDraft);

  // Was man gerade gebaut hat, will man auch laufen lassen.
  pickedRoutine = routineDraft.id;
  trainMode = "routine";
  routineDraft = null;

  persist();
  routineDlg.close();
  buildTrainRoutines();
  syncTrainUi();
});

routineDropBtn.addEventListener("click", () => {
  if (!routineDraft) return;
  state.routines = state.routines.filter((r) => r.id !== routineDraft.id);
  if (pickedRoutine === routineDraft.id) pickedRoutine = null;
  routineDraft = null;

  persist();
  routineDlg.close();
  buildTrainRoutines();
  if (!selectedRoutine()) pickedRoutine = routinesFor(state.character)[0]?.id ?? null;
  syncTrainUi();
});

document.getElementById("routineCancel").addEventListener("click", () => {
  routineDraft = null;
  routineDlg.close();
});

// --- Zahnrad: Einstellungen ---------------------------------

function openPreferences() {
  buildOrderList();
  buildColorList();
  buildRuleList();
  if (!allowedGrid.children.length) buildAllowedGrid();
  syncAllowedUi();
  syncSettingsUi();
  settingsDlg.showModal();
}

settingsBtn.addEventListener("click", openPreferences);

// ============================================================
//  Teilen, Import und Export
//  Ein Share-Code enthaelt die Combos genau eines Charakters. Aufbau:
//    <Spielkennung>-<base64url>, z.B. GGST1-...
//  Die Nutzdaten sind ein Byte Kennung (1 = deflate, 0 = roh) plus
//  JSON mit kurzen Feldnamen. Das Praefix ist noetig, damit sich der
//  Code beim Einfuegen sicher von einer echten Combo unterscheiden
//  laesst - raten waere hier die falsche Loesung.
// ============================================================
function b64urlEncode(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  // Ohne Regex, damit keine Escapes noetig sind.
  return btoa(bin).split("+").join("-").split("/").join("_").split("=").join("");
}

function b64urlDecode(text) {
  let roh = text.split("-").join("+").split("_").join("/");
  while (roh.length % 4 !== 0) roh += "=";      // atob braucht die Fuellzeichen
  const bin = atob(roh);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function durchStream(bytes, stream) {
  const daten = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(daten).arrayBuffer());
}

// Kurze Feldnamen: der Code soll kopierbar bleiben, nicht lesbar sein.
function packEntry(entry) {
  const o = { t: entry.text, p: entry.position };
  if (entry.states?.length) o.s = entry.states;
  if (entry.characters !== "ALL") o.x = entry.characters;
  if (entry.comment) o.n = entry.comment;
  return o;
}

function unpackEntry(o, charId) {
  return {
    id: newId(),
    text: String(o.t ?? "").trim(),
    character: charId,
    characters: Array.isArray(o.x) ? o.x : "ALL",
    position: POSITIONS.some((p) => p.id === o.p) ? o.p : "everywhere",
    states: Array.isArray(o.s) ? o.s.map(String) : [],
    comment: typeof o.n === "string" ? o.n : "",
  };
}

async function makeShareCode(charId) {
  const eintraege = state.entries.filter((e) => e.character === charId);
  const json = JSON.stringify({ v: 1, c: charId, e: eintraege.map(packEntry) });
  const roh = new TextEncoder().encode(json);

  let kennung = 0;
  let daten = roh;

  // Komprimieren, wenn der Browser es kann - sonst bleibt es lesbar lang.
  if (typeof CompressionStream === "function") {
    try {
      daten = await durchStream(roh, new CompressionStream("deflate-raw"));
      kennung = 1;
    } catch { /* dann eben roh */ }
  }

  const nutz = new Uint8Array(daten.length + 1);
  nutz[0] = kennung;
  nutz.set(daten, 1);
  return SHARE_PREFIX + b64urlEncode(nutz);
}

async function readShareCode(code) {
  const nutz = b64urlDecode(code.slice(SHARE_PREFIX.length));
  if (nutz.length < 2) throw new Error("empty");

  let daten = nutz.subarray(1);
  if (nutz[0] === 1) {
    daten = await durchStream(daten, new DecompressionStream("deflate-raw"));
  }

  const paket = JSON.parse(new TextDecoder().decode(daten));
  if (!paket || !CHAR_BY_ID.has(paket.c) || !Array.isArray(paket.e)) {
    throw new Error("Unknown format");
  }
  return paket;
}

// --- Zusammenfuehren ohne Dubletten -------------------------
// Zwei Eintraege gelten als gleich, wenn ihr ganzer Inhalt gleich ist.
// Sonst wuerde ein zweimal eingefuegter Code alles verdoppeln.
function signature(entry) {
  return JSON.stringify([
    entry.character,
    entry.text,
    entry.position,
    [...(entry.states ?? [])].sort(),
    entry.characters === "ALL" ? "ALL" : [...entry.characters].sort(),
    entry.comment ?? "",
  ]);
}

function mergeEntries(neue) {
  const bekannt = new Set(state.entries.map(signature));
  let dazu = 0;

  for (const entry of neue) {
    if (!entry.text) continue;
    const sig = signature(entry);
    if (bekannt.has(sig)) continue;
    bekannt.add(sig);
    state.entries.push(entry);
    dazu++;
  }

  // Marken aus fremden Sammlungen in die Auswahlliste uebernehmen,
  // sonst liessen sie sich spaeter nicht wieder anwaehlen.
  for (const entry of neue) {
    for (const name of entry.states ?? []) {
      if (!state.states.some((n) => n.toLowerCase() === name.toLowerCase())) {
        state.states.push(name);
      }
    }
  }

  return dazu;
}

// Erwartet ein bereits gelesenes Paket - die Rueckfrage braucht die
// Zahlen ja schon vor dem Anwenden.
function applyShare(paket) {
  const eintraege = paket.e.map((o) => unpackEntry(o, paket.c));
  const dazu = mergeEntries(eintraege);

  buildStateList();
  syncStates();
  renderEntries();

  const name = CHAR_BY_ID.get(paket.c).name;
  const uebersprungen = eintraege.length - dazu;
  return dazu === 0
    ? "Nothing imported - all " + eintraege.length + " drills for " + name + " are already here."
    : dazu + (dazu === 1 ? " drill" : " drills") + " for " + name + " imported" +
      (uebersprungen > 0 ? " (" + uebersprungen + " already here)" : "") + ".";
}

// --- Reiter im Einstellungsdialog -----------------------------
// Direkt aus dem Dokument geholt, nicht ueber settingsDlg: diese Zeile
// laeuft beim Laden, und settingsDlg wird als const erst weiter unten
// angelegt - der Zugriff waere zu frueh.
const settingsBox = document.getElementById("settingsDialog");
const settingsTabs = settingsBox.querySelector(".tabs");

settingsTabs.addEventListener("click", (e) => {
  const gewaehlt = e.target.closest("[data-tab]")?.dataset.tab;
  if (!gewaehlt) return;

  settingsTabs.querySelectorAll("[data-tab]").forEach((b) => {
    const an = b.dataset.tab === gewaehlt;
    b.classList.toggle("is-active", an);
    b.setAttribute("aria-selected", String(an));
  });

  settingsBox.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== gewaehlt;
  });
});

// --- Notationsfarben ------------------------------------------
const colorList = document.getElementById("colorList");
const ruleList = document.getElementById("ruleList");
const ruleAdd = document.getElementById("ruleAdd");
const ruleName = document.getElementById("ruleName");
const rulePattern = document.getElementById("rulePattern");
const ruleColor = document.getElementById("ruleColor");
const ruleError = document.getElementById("ruleError");

// Eigene Farben liegen als Inline-Eigenschaft auf dem Wurzelelement.
// Das schlaegt jedes Thema, gilt also unabhaengig von hell, dunkel, game.
function applyColorOverrides() {
  const wurzel = document.documentElement;
  const hell = wurzel.dataset.theme === "light";
  const n = GAME.notation;

  // Die Farben des Spiels bilden die Grundlage. Das helle Thema braucht
  // eigene Werte - was auf Schwarz leuchtet, verschwindet auf Weiss.
  const basis = {};
  for (const b of n.buttons) {
    basis["--tok-btn-" + b.id] = hell ? (b.light ?? b.color) : b.color;
  }
  for (const [teil, key] of [[n.cancels, "--tok-rc"], [n.counter, "--tok-ch"], [n.actions, "--tok-act"]]) {
    if (teil?.color) basis[key] = hell ? (teil.light ?? teil.color) : teil.color;
  }

  for (const [key, wert] of Object.entries(basis)) wurzel.style.setProperty(key, wert);

  // Eigene Farben darueber; wo keine gesetzt ist, bleibt die des Spiels.
  for (const rolle of COLOR_ROLES) {
    const wert = state.settings.colors[rolle.key];
    if (wert && HEX_RE.test(wert)) wurzel.style.setProperty(rolle.key, wert);
    else if (!(rolle.key in basis)) wurzel.style.removeProperty(rolle.key);
  }
}

// Das Spielthema: was in game.theme steht, ueberschreibt die Vorgaben aus
// dem Stylesheet. In den neutralen Themen bleibt es aussen vor.
function applyGameTheme() {
  const wurzel = document.documentElement;
  const an = wurzel.dataset.theme === "game";

  for (const [key, wert] of Object.entries(GAME.theme ?? {})) {
    if (an) wurzel.style.setProperty(key, wert);
    else wurzel.style.removeProperty(key);
  }
}

function currentColor(key) {
  const wert = getComputedStyle(document.documentElement).getPropertyValue(key).trim();
  if (HEX_RE.test(wert)) return wert;

  // Kurzform wie #abc auf sechs Stellen bringen - das Farbfeld braucht sie.
  if (/^#[0-9a-fA-F]{3}$/.test(wert)) {
    return "#" + [...wert.slice(1)].map((c) => c + c).join("");
  }
  return "#888888";
}

function buildColorList() {
  colorList.innerHTML = "";

  for (const rolle of COLOR_ROLES) {
    const zeile = document.createElement("label");
    zeile.className = "colors__row";

    const feld = document.createElement("input");
    feld.type = "color";
    feld.className = "colors__swatch";
    feld.dataset.colorKey = rolle.key;
    feld.value = currentColor(rolle.key);

    const text = document.createElement("span");
    text.className = "colors__text";

    const name = document.createElement("span");
    name.className = "colors__label";
    name.textContent = rolle.label;

    const arten = document.createElement("span");
    arten.className = "colors__kinds";
    arten.textContent = rolle.kinds;

    text.append(name, arten);

    const probe = document.createElement("span");
    probe.className = "colors__sample";
    probe.textContent = rolle.sample;
    probe.style.color = "var(" + rolle.key + ")";

    zeile.append(feld, text, probe);
    colorList.append(zeile);
  }
}

colorList.addEventListener("input", (e) => {
  const key = e.target.dataset?.colorKey;
  if (!key) return;

  state.settings.colors[key] = e.target.value;
  applyColorOverrides();
  persist();
});

document.getElementById("colorReset").addEventListener("click", () => {
  state.settings.colors = {};
  applyColorOverrides();
  buildColorList();
  persist();
});

// --- Eigene Regeln --------------------------------------------
// Prueft ein Muster, bevor es angelegt wird: es muss uebersetzbar sein
// und darf nicht die leere Zeichenkette treffen.
function checkPattern(muster) {
  let re;
  try {
    re = new RegExp("(?:" + muster + ")", "yi");
  } catch (err) {
    return String(err.message);
  }

  re.lastIndex = 0;
  const treffer = re.exec("x");
  if (treffer && treffer[0].length === 0) return "Matches an empty string";
  return null;
}

function buildRuleList() {
  ruleList.innerHTML = "";

  if (state.settings.rules.length === 0) {
    const leer = document.createElement("p");
    leer.className = "rules__empty";
    leer.textContent = "No custom rules yet.";
    ruleList.append(leer);
    return;
  }

  state.settings.rules.forEach((regel, i) => {
    const zeile = document.createElement("div");
    zeile.className = "rules__row";

    const punkt = document.createElement("span");
    punkt.className = "rules__dot";
    punkt.style.background = regel.color;

    const name = document.createElement("span");
    name.className = "rules__name";
    name.textContent = regel.name;

    const muster = document.createElement("code");
    muster.className = "rules__pattern";
    muster.textContent = regel.pattern;

    const weg = document.createElement("button");
    weg.type = "button";
    weg.className = "rules__drop";
    weg.dataset.dropRule = String(i);
    weg.title = "Remove rule";
    weg.textContent = "\u00d7";

    zeile.append(punkt, name, muster, weg);
    ruleList.append(zeile);
  });
}

function refreshRules() {
  invalidateRules();
  buildRuleList();
  paint();
  renderEntries();
  persist();
}

ruleList.addEventListener("click", (e) => {
  const i = e.target.closest("[data-drop-rule]")?.dataset.dropRule;
  if (i === undefined) return;

  state.settings.rules.splice(Number(i), 1);
  refreshRules();
});

ruleAdd.addEventListener("submit", (e) => {
  e.preventDefault();

  const muster = rulePattern.value.trim();
  if (!muster) return;

  const problem = checkPattern(muster);
  ruleError.hidden = !problem;
  ruleError.textContent = problem ?? "";
  if (problem) return;

  state.settings.rules.push({
    name: ruleName.value.trim() || muster,
    pattern: muster,
    color: HEX_RE.test(ruleColor.value) ? ruleColor.value : "#22d3ee",
  });

  ruleName.value = "";
  rulePattern.value = "";
  refreshRules();
});

// --- Rueckfrage -----------------------------------------------
// Natives <dialog>: Escape und Fokus-Falle kommen vom Browser.
// Aufgeloest wird mit dem Wert des gedrueckten Knopfes, bei Escape
// oder Abbrechen mit null.
const dlg = document.getElementById("askDialog");
const dialogTitle = document.getElementById("dialogTitle");
const dialogText = document.getElementById("dialogText");
const dialogActions = document.getElementById("dialogActions");

function askDialog({ title, text, buttons }) {
  return new Promise((resolve) => {
    dialogTitle.textContent = title;
    dialogText.textContent = text;
    dialogActions.innerHTML = "";

    let antwort = null;

    const fertig = () => {
      dlg.removeEventListener("close", fertig);
      resolve(antwort);
    };

    for (const b of buttons) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "dialog__btn" + (b.kind ? " is-" + b.kind : "");
      el.textContent = b.label;
      el.dataset.answer = String(b.value);
      el.addEventListener("click", () => { antwort = b.value; dlg.close(); });
      dialogActions.append(el);
    }

    dlg.addEventListener("close", fertig);
    dlg.showModal();
    dialogActions.querySelector(".is-primary")?.focus();
  });
}

// Was steckt in einem Code? "Sol Badguy, 32 Combos"
function describePacket(paket) {
  const name = CHAR_BY_ID.get(paket.c).name;
  const n = paket.e.length;
  return name + ", " + n + (n === 1 ? " drill" : " drills");
}

// ============================================================
//  Einstellungen fuer das Training
// ============================================================
const settingsDlg = document.getElementById("settingsDialog");
const orderList   = document.getElementById("orderList");
const randomChar  = document.getElementById("randomChar");
const allowedGrid = document.getElementById("allowedGrid");
const allowedRow  = document.getElementById("allowedRow");
const allowedCount= document.getElementById("allowedCount");
const srEnabled   = document.getElementById("srEnabled");
const srPerDay    = document.getElementById("srPerDay");
const srAll       = document.getElementById("srAll");
const srNewDays   = document.getElementById("srNewDays");
const srMaxDays   = document.getElementById("srMaxDays");

const GRIP_SVG =
  '<svg class="order__grip" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>' +
  '<circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>' +
  '<circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';

// Die Reihenfolge muss die vorhandenen Marken widerspiegeln: neue kommen
// hinten dazu, geloeschte fliegen raus. Die beiden festen Kriterien
// bleiben immer erhalten.
function syncStateOrder() {
  const order = state.settings.order;

  for (const name of state.states) {
    if (istDrillName(name)) continue;   // kein Dummy-Zustand
    if (!order.some((n) => n.toLowerCase() === name.toLowerCase())) order.push(name);
  }

  state.settings.order = order.filter(
    (n) => ORDER_FIXED.includes(n) ||
           (!istDrillName(n) &&
            state.states.some((m) => m.toLowerCase() === n.toLowerCase()))
  );

  // Fehlende feste Kriterien hinten anhaengen - so landet ein neu
  // hinzugekommenes automatisch dort, wo es nicht stoert.
  for (const fest of ORDER_FIXED) {
    if (!state.settings.order.includes(fest)) state.settings.order.push(fest);
  }
}

// Wie die feste Ebene heisst, sagt das Spiel: nicht ueberall heisst der
// Treffer in die Bewegung "Counter Hit".
function orderLabel(key) {
  if (key === ORDER_CH) return GAME.notation.counter?.label ?? "Counter Hit";
  if (key === ORDER_POS) return "Position";
  if (key === ORDER_MOVE) return "Start Move";
  return key;
}

function buildOrderList() {
  syncStateOrder();
  orderList.innerHTML = "";

  for (const token of state.settings.order) {
    const fest = ORDER_FIXED.includes(token);

    const item = document.createElement("li");
    item.className = "order__item" + (fest ? " order__item--fixed" : "");
    item.dataset.state = token;

    let punkt;
    if (fest) {
      punkt = document.createElement("span");
      punkt.className = "order__dot";
      const innen = document.createElement("span");
      innen.className = "tag-dot tag-dot--fixed";
      punkt.append(innen);
    } else {
      punkt = tagMarker(token, "order__dot");
    }

    const text = document.createElement("span");
    text.className = "order__label";
    text.textContent = ORDER_FIXED.includes(token) ? orderLabel(token) : tagLabel(token);

    item.innerHTML = GRIP_SVG;
    item.prepend(punkt);
    item.append(text);
    orderList.append(item);
  }
}

// --- Ziehen und Ablegen --------------------------------------
// Eigene Mechanik statt der des Browsers. Dessen Zugbild haengt als
// zweites, halbdurchsichtiges Abbild am Zeiger, waehrend die Zeile in
// der Liste schon mitwandert - zwei Kopien derselben Sache, dazu der
// Verbotszeiger, sobald man den Rand verlaesst. Auf dem Telefon laeuft
// die Browser-Mechanik ausserdem gar nicht.
//
// Gemeinsam fuer jede sortierbare Liste: die Zeile wandert live durch
// das Dokument, beim Loslassen liest der Aufrufer die Reihenfolge
// zurueck.
function makeSortable(liste, { item: itemSel, handle: handleSel, onDrop }) {
  const SCHWELLE = 4;      // erst ab hier ist es ein Zug und kein Klick

  let zieht = null;        // die Zeile, die gerade wandert
  let wartet = null;       // angefasst, aber noch nicht weit genug bewegt
  let zeiger = null;
  let start = 0;

  function zeileUnter(y) {
    const andere = [...liste.querySelectorAll(itemSel)].filter((el) => el !== zieht);
    return andere.find((el) => {
      const r = el.getBoundingClientRect();
      return y < r.top + r.height / 2;
    }) ?? null;
  }

  // Am Rand einer scrollenden Liste mitlaufen, sonst kommt man in einer
  // langen Routine nicht ans andere Ende.
  function randlauf(y) {
    if (liste.scrollHeight <= liste.clientHeight) return;
    const r = liste.getBoundingClientRect();
    if (y < r.top + 26) liste.scrollTop -= 8;
    else if (y > r.bottom - 26) liste.scrollTop += 8;
  }

  liste.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;

    const item = e.target.closest(itemSel);
    if (!item || !liste.contains(item)) return;

    const griff = handleSel ? e.target.closest(handleSel) : null;
    // Knoepfe in der Zeile bleiben Knoepfe.
    if (!griff && e.target.closest("button") && e.target.closest("button") !== item) return;
    // Auf dem Telefon nur am Griff - sonst liesse sich die Liste, die
    // ja scrollt, nicht mehr bewegen.
    if (e.pointerType !== "mouse" && !griff) return;

    wartet = item;
    zeiger = e.pointerId;
    start = e.clientY;
  });

  liste.addEventListener("pointermove", (e) => {
    if (e.pointerId !== zeiger) return;

    if (wartet && Math.abs(e.clientY - start) > SCHWELLE) {
      zieht = wartet;
      wartet = null;
      zieht.classList.add("is-dragging");
      liste.classList.add("is-sorting");
      // Erst jetzt fangen: vor der Schwelle wuerde das Fangen den
      // folgenden Klick auf einen Knopf in der Zeile verschlucken.
      // Schlaegt es fehl, wird trotzdem gezogen - nur eben ohne Fang.
      try { liste.setPointerCapture(zeiger); } catch { }
    }
    if (!zieht) return;

    e.preventDefault();
    const davor = zeileUnter(e.clientY);
    if (davor === null) liste.append(zieht);
    else if (davor !== zieht.nextElementSibling) liste.insertBefore(zieht, davor);

    randlauf(e.clientY);
  });

  function ende(e) {
    if (e.pointerId !== zeiger) return;

    if (zieht) {
      try { liste.releasePointerCapture(zeiger); } catch { }
      zieht.classList.remove("is-dragging");
      liste.classList.remove("is-sorting");
      zieht = null;
      onDrop();
    }
    wartet = null;
    zeiger = null;
  }

  liste.addEventListener("pointerup", ende);
  liste.addEventListener("pointercancel", ende);
}

makeSortable(orderList, {
  item: ".order__item",
  handle: ".order__grip",
  onDrop: () => {
    state.settings.order =
      [...orderList.querySelectorAll(".order__item")].map((el) => el.dataset.state);
    syncDojo();
    persist();
  },
});

// --- Erlaubte Gegner ------------------------------------------
function buildAllowedGrid() {
  allowedGrid.innerHTML = "";

  for (const char of CHARACTERS) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "char";
    tile.dataset.allowChar = char.id;
    tile.title = char.name;
    tile.setAttribute("aria-label", char.name);
    tile.append(charIcon(char, "char__portrait"));
    allowedGrid.append(tile);
  }
}

function syncAllowedUi() {
  const an = state.settings.randomCharacter;

  randomChar.checked = an;
  allowedRow.classList.toggle("is-off", !an);
  allowedGrid.classList.toggle("is-off", !an);
  allowedCount.textContent =
    state.settings.allowedChars.size + " of " + CHARACTERS.length;

  allowedGrid.querySelectorAll(".char").forEach((tile) => {
    tile.setAttribute("aria-pressed",
      String(state.settings.allowedChars.has(tile.dataset.allowChar)));
  });
}

allowedGrid.addEventListener("click", (e) => {
  const id = e.target.closest("[data-allow-char]")?.dataset.allowChar;
  if (!id || !state.settings.randomCharacter) return;

  const erlaubt = state.settings.allowedChars;
  erlaubt.has(id) ? erlaubt.delete(id) : erlaubt.add(id);
  syncAllowedUi();
  syncDojo();
  persist();
});

allowedRow.addEventListener("click", (e) => {
  const was = e.target.closest("[data-allowed]")?.dataset.allowed;
  if (!was || !state.settings.randomCharacter) return;

  const erlaubt = state.settings.allowedChars;
  erlaubt.clear();
  if (was === "all") CHARACTERS.forEach((c) => erlaubt.add(c.id));
  else if (was === "base") BASE_ROSTER.forEach((id) => erlaubt.add(id));

  syncAllowedUi();
  syncDojo();
  persist();
});

randomChar.addEventListener("change", () => {
  state.settings.randomCharacter = randomChar.checked;
  syncAllowedUi();
  syncDojo();
  persist();
});

// --- Spaced Repetition ----------------------------------------
// --- Beschriftung der Bewertungsknoepfe -----------------------
const gradeCustom = document.getElementById("gradeCustom");
const gradeRow = document.getElementById("gradeRow");
const gradeFields = {
  again: document.getElementById("gradeAgain"),
  hard: document.getElementById("gradeHard"),
  good: document.getElementById("gradeGood"),
  easy: document.getElementById("gradeEasy"),
};

// Die Knoepfe stehen fest im HTML, ihre Aufschrift kommt also nicht von
// selbst nach - hier wird sie nachgezogen.
function applyGradeLabels() {
  drillGrades.querySelectorAll("[data-grade]").forEach((b) => {
    const feld = b.querySelector(".grade__label");
    if (feld) feld.textContent = gradeLabel(b.dataset.grade);
  });

  if (state.training) renderDone();
}

function leseGrades() {
  const g = state.settings.grades;
  g.custom = gradeCustom.checked;

  for (const key of Object.keys(gradeFields)) {
    const wert = gradeFields[key].value.trim();
    // Ein leeres Feld faellt auf die Vorgabe zurueck, statt den Knopf
    // unbeschriftet zu lassen.
    if (wert) g[key] = wert;
  }

  syncGradeUi();
  applyGradeLabels();
  persist();
}

function syncGradeUi() {
  const g = state.settings.grades;
  gradeCustom.checked = g.custom;
  gradeRow.classList.toggle("is-off", !g.custom);

  for (const key of Object.keys(gradeFields)) {
    gradeFields[key].value = g[key] ?? "";
    gradeFields[key].placeholder = GRADE_DEFAULT[key];
    gradeFields[key].disabled = !g.custom;
  }
}

gradeCustom.addEventListener("change", leseGrades);
Object.values(gradeFields).forEach((el) => el.addEventListener("input", leseGrades));

function syncSettingsUi() {
  const sr = state.settings.sr;

  srEnabled.checked = sr.enabled;
  srAll.checked = sr.perDay === null;
  srPerDay.value = sr.perDay ?? 10;
  srPerDay.disabled = !sr.enabled || sr.perDay === null;
  srNewDays.value = sr.newDays ?? 1;
  srNewDays.disabled = !sr.enabled || sr.perDay === null;
  document.getElementById("srNewDaysUnit").textContent =
    (Number(srNewDays.value) === 1 ? "day" : "days") + ", per character";
  srMaxDays.value = sr.maxDays;
  srMaxDays.disabled = !sr.enabled;
  srAll.disabled = !sr.enabled;

  document.getElementById("srPerDayRow").classList.toggle("is-off", !sr.enabled);
  document.getElementById("srMaxRow").classList.toggle("is-off", !sr.enabled);

  syncGradeUi();
}

function leseSettings() {
  const sr = state.settings.sr;
  sr.enabled = srEnabled.checked;
  sr.perDay = srAll.checked ? null : Math.max(1, Number(srPerDay.value) || 1);
  sr.newDays = Math.min(60, Math.max(1, Number(srNewDays.value) || 1));
  sr.maxDays = Math.min(365, Math.max(1, Number(srMaxDays.value) || 1));

  syncSettingsUi();
  syncDojo();
  persist();
}

[srEnabled, srAll, srPerDay, srNewDays, srMaxDays].forEach((el) =>
  el.addEventListener("change", leseSettings));

document.getElementById("settingsClose").addEventListener("click", () => settingsDlg.close());

// --- Alles loeschen ------------------------------------------
// Raeumt jede Ablage dieses Programms, auch die aus der Zeit vor der
// Spielauswahl. Danach neu laden, damit nichts aus dem Arbeitsspeicher
// die geleerte Ablage gleich wieder fuellt.
document.getElementById("wipeAll").addEventListener("click", async () => {
  const ja = await askDialog({
    title: "Delete everything?",
    text: "Every drill, tag, category and preference of every game will be " +
          "removed, including games you built yourself. This cannot be undone.",
    buttons: [
      { value: true, label: "Delete everything", kind: "danger" },
      { value: null, label: "Cancel", kind: "quiet" },
    ],
  });
  if (!ja) return;

  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("fgdrills") || key.startsWith("ggst-combo-trainer")) {
        localStorage.removeItem(key);
      }
    }
  } catch { /* ohne Ablage gibt es nichts zu raeumen */ }

  location.reload();
});

// --- Rueckmeldung --------------------------------------------
// Ohne sichtbare Antwort waere nach dem Einfuegen eines Codes nicht
// erkennbar, ob etwas passiert ist.
const notice = document.getElementById("notice");
let noticeTimer = null;

function showNotice(text, art = "info", code = null) {
  notice.className = "notice" + (art === "error" ? " is-error" : "");
  notice.textContent = text;
  notice.hidden = false;

  if (code) {
    // Der Code gehoert nicht ins Combo-Feld: dort wuerde ihn die
    // Normalisierung anfassen und unlesbar machen.
    const box = document.createElement("code");
    box.className = "notice__code";
    box.textContent = code;
    notice.append(box);

    // Gleich markieren, damit Strg+C reicht.
    const bereich = document.createRange();
    bereich.selectNodeContents(box);
    const auswahl = getSelection();
    auswahl.removeAllRanges();
    auswahl.addRange(bereich);
  }

  clearTimeout(noticeTimer);
  // Mit Code laenger stehen lassen - der muss von Hand kopiert werden.
  noticeTimer = setTimeout(() => { notice.hidden = true; }, code ? 120000 : 6000);
}

// --- Teilen ---------------------------------------------------
async function shareCharacter(charId) {
  const anzahl = state.entries.filter((e) => e.character === charId).length;
  if (anzahl === 0) {
    showNotice("Nothing to share for " + CHAR_BY_ID.get(charId).name + " yet.", "error");
    return;
  }

  const code = await makeShareCode(charId);
  const name = CHAR_BY_ID.get(charId).name;

  try {
    await navigator.clipboard.writeText(code);
    showNotice("Share code for " + name + " copied (" + anzahl +
               (anzahl === 1 ? " drill" : " drills") + ", " + code.length + " characters).");
  } catch {
    // Zwischenablage kann gesperrt sein - dann den Code zum Kopieren zeigen.
    showNotice("Clipboard unavailable - the code is selected, copy it with Ctrl+C:",
               "error", code);
  }
}

// --- Einfuegen erkennen ---------------------------------------
input.addEventListener("paste", async (e) => {
  const text = e.clipboardData?.getData("text") ?? "";
  const spiel = shareGame(text);
  if (!spiel) return;

  e.preventDefault();    // muss vor dem ersten await passieren

  // Ein Code aus einem anderen Spiel passt weder zum Roster noch zur
  // Notation - er wird nicht heimlich uebernommen.
  if (spiel.id !== GAME.id) {
    showNotice("That code belongs to " + spiel.name + ". Switch to that game first.", "error");
    input.value = "";
    onInput();
    return;
  }

  let paket;
  try {
    paket = await readShareCode(text.trim());
  } catch {
    showNotice("That looks like a share code, but it could not be read.", "error");
    return;
  }

  const ja = await askDialog({
    title: "Import drills?",
    text: describePacket(paket) + ". They will be added to your collection; " +
          "drills you already have are left untouched.",
    buttons: [
      { value: true, label: "Import", kind: "primary" },
      { value: null, label: "Cancel", kind: "quiet" },
    ],
  });

  if (!ja) return;

  input.value = "";
  onInput();
  showNotice(applyShare(paket));
});

// --- Export ---------------------------------------------------
exportBtn.addEventListener("click", () => {
  if (state.entries.length === 0) {
    showNotice("Nothing to export yet.", "error");
    return;
  }

  const daten = {
    v: 1,
    states: state.states,
    entries: state.entries.map((e) => ({ ...packEntry(e), c: e.character })),
  };

  const datum = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(daten, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "combos-" + datum + ".json";
  a.click();
  URL.revokeObjectURL(url);

  showNotice(state.entries.length + " drills exported.");
});

// --- Import ---------------------------------------------------
const importFile = document.getElementById("importFile");
// Liegt ein Code in der Zwischenablage, ist das meistens gemeint -
// also anbieten, statt gleich den Dateidialog aufzumachen.
async function codeAusZwischenablage() {
  try {
    const text = await navigator.clipboard.readText();
    if (shareGame(text)?.id !== GAME.id) return null;   // fremd oder keiner
    return await readShareCode(text.trim());
  } catch {
    return null;    // kein Zugriff oder unlesbar - dann eben nur die Datei
  }
}

document.getElementById("importButton").addEventListener("click", async () => {
  const paket = await codeAusZwischenablage();

  if (!paket) {
    importFile.click();
    return;
  }

  const wahl = await askDialog({
    title: "Import",
    text: "There is a share code in your clipboard: " + describePacket(paket) + ".",
    buttons: [
      { value: "code", label: "Import share code", kind: "primary" },
      { value: "file", label: "Choose a file instead" },
      { value: null, label: "Cancel", kind: "quiet" },
    ],
  });

  if (wahl === "code") showNotice(applyShare(paket));
  else if (wahl === "file") importFile.click();
});

importFile.addEventListener("change", async () => {
  const datei = importFile.files?.[0];
  if (!datei) return;

  try {
    const daten = JSON.parse(await datei.text());
    if (!Array.isArray(daten.entries)) throw new Error("Format");

    const eintraege = daten.entries
      .filter((o) => CHAR_BY_ID.has(o.c))
      .map((o) => unpackEntry(o, o.c));

    if (Array.isArray(daten.states)) {
      for (const name of daten.states) {
        if (!state.states.some((n) => n.toLowerCase() === String(name).toLowerCase())) {
          state.states.push(String(name));
        }
      }
    }

    const dazu = mergeEntries(eintraege);
    buildStateList();
    syncStates();
    renderEntries();

    showNotice(dazu === 0
      ? "Nothing imported - all " + eintraege.length + " drills are already here."
      : dazu + (dazu === 1 ? " drill" : " drills") + " imported" +
        (eintraege.length - dazu > 0 ? " (" + (eintraege.length - dazu) + " already here)" : "") + ".");
  } catch {
    showNotice("Could not read that file.", "error");
  }

  importFile.value = "";   // dieselbe Datei soll erneut waehlbar sein
});

// ============================================================
//  Ablage im Browser
//  Sets lassen sich nicht als JSON schreiben, deshalb wandern sie als
//  Listen raus und werden beim Laden wieder eingesammelt.
// ============================================================
// Jede Spielsammlung liegt fuer sich - Combos, Marken und Einstellungen
// gehoeren zum Spiel, nicht zur Person. Daneben eine kleine Ablage fuer
// das, was uebergreifend gilt: welches Spiel zuletzt offen war.
const APP_KEY = "fgdrills-app";
const LEGACY_KEY = "ggst-combo-trainer-v1";

function storageKey(gameId = GAME.id) {
  return "fgdrills-game-" + gameId;
}

function readJson(key) {
  try {
    const roh = localStorage.getItem(key);
    return roh ? JSON.parse(roh) : null;
  } catch {
    return null;
  }
}

function writeJson(key, wert) {
  try {
    localStorage.setItem(key, JSON.stringify(wert));
  } catch {
    // Privater Modus oder Speicher voll - dann laeuft es eben ohne Ablage.
  }
}

// Der Stand aus der Zeit vor der Spielauswahl gehoert zu Guilty Gear.
// Einmalig umziehen, das Original bleibt als Sicherheitsnetz liegen.
function migrateLegacy() {
  if (readJson(APP_KEY)) return;

  const alt = readJson(LEGACY_KEY);
  if (alt && !readJson(storageKey("ggst"))) writeJson(storageKey("ggst"), alt);
}
let saveTimer = null;

function persist() {
  // Gebuendelt schreiben: bei jedem Tastendruck zu speichern waere unnoetig.
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}

function saveNow() {
  const daten = {
    v: 1,
    entries: state.entries,
    states: state.states,
    categories: state.categories,
    groupByCategory: state.groupByCategory,
    customChars: state.customChars,
    routines: state.routines,
    reviewed: state.reviewed,
    character: state.character,
    persistInput: persistBox.checked,
    settings: {
      order: state.settings.order,
      randomCharacter: state.settings.randomCharacter,
      allowedChars: [...state.settings.allowedChars],
      sr: state.settings.sr,
      grades: state.settings.grades,
      colors: state.settings.colors,
      rules: state.settings.rules,
    },
  };

  writeJson(storageKey(), daten);
  writeJson(APP_KEY, { v: 1, game: GAME.id });
}

function loadStored() {
  const daten = readJson(storageKey());
  if (!daten || typeof daten !== "object") return;

  // Zuerst die eigenen Charaktere: alles Weitere - Eintraege, Routinen,
  // erlaubte Gegner - wird gegen CHAR_BY_ID geprueft.
  if (Array.isArray(daten.customChars)) {
    state.customChars = daten.customChars
      .filter((c) => c && c.id && c.name && !GAME.characters.some((g) => g.id === c.id))
      .map((c) => ({
        id: String(c.id),
        name: String(c.name),
        short: String(c.short ?? "").slice(0, 3),
        icon: c.icon ? String(c.icon) : "",
      }));
    applyCustomChars();
  }

  if (Array.isArray(daten.entries)) {
    // Nur Eintraege mit bekanntem Charakter uebernehmen.
    state.entries = daten.entries.filter((e) => e && CHAR_BY_ID.has(e.character));
    state.entries.forEach(migrateDrillState);
  }

  if (Array.isArray(daten.states) && daten.states.length) {
    // Die Drill-Marke faellt weg; sie ist jetzt eine Kategorie.
    state.states = daten.states.map(String).filter((n) => !istDrillName(n));
    // Aeltere Ablagen kennen die Vorgaben noch nicht.
    for (const name of STATE_DEFAULTS) {
      const da = state.states.some(
        (n) => tagLabel(n).toLowerCase() === tagLabel(name).toLowerCase());
      if (!da) state.states.push(name);
    }
  }

  if (Array.isArray(daten.categories) && daten.categories.length) {
    state.categories = daten.categories.map(String);
    if (!state.categories.includes(DRILL_STATE)) state.categories.unshift(DRILL_STATE);
  }
  if (typeof daten.groupByCategory === "boolean") state.groupByCategory = daten.groupByCategory;

  if (Array.isArray(daten.routines)) {
    // Nur was sich noch ueben laesst: Charakter muss es geben, und ein
    // Plan ohne Schritte waere ein leeres Versprechen.
    state.routines = daten.routines
      .filter((r) => r && CHAR_BY_ID.has(r.char) && Array.isArray(r.items))
      .map((r) => ({
        id: String(r.id ?? newId()),
        name: String(r.name ?? ""),
        char: r.char,
        items: r.items.map(String),
      }));
  }

  if (daten.reviewed && typeof daten.reviewed === "object") state.reviewed = daten.reviewed;
  if (CHAR_BY_ID.has(daten.character)) state.character = daten.character;
  if (typeof daten.persistInput === "boolean") persistBox.checked = daten.persistInput;

  const g = daten.settings;
  if (g && typeof g === "object") {
    if (Array.isArray(g.order)) state.settings.order = g.order.map(String);
    if (typeof g.randomCharacter === "boolean") state.settings.randomCharacter = g.randomCharacter;
    if (Array.isArray(g.allowedChars)) {
      state.settings.allowedChars = new Set(g.allowedChars.filter((id) => CHAR_BY_ID.has(id)));
    }
    if (g.grades && typeof g.grades === "object") {
      Object.assign(state.settings.grades, g.grades);
    }

    if (g.colors && typeof g.colors === "object") state.settings.colors = g.colors;

    if (Array.isArray(g.rules)) {
      // Nur uebersetzbare Muster uebernehmen - ein kaputtes wuerde die
      // Faerbung bei jedem Tastendruck stolpern lassen.
      state.settings.rules = g.rules.filter(
        (r) => r && typeof r.pattern === "string" && checkPattern(r.pattern) === null
      );
    }

    if (g.sr && typeof g.sr === "object") {
      state.settings.sr = {
        enabled: g.sr.enabled !== false,
        perDay: g.sr.perDay === null ? null : Math.max(1, Number(g.sr.perDay) || 20),
        maxDays: Math.min(365, Math.max(1, Number(g.sr.maxDays) || 7)),
      };
    }
  }

  syncStateOrder();   // haelt Marken und Reihenfolge in Deckung
}

persistBox.addEventListener("change", persist);

// --- Theme -----------------------------------------------------
// The theme itself is applied in <head>; this only handles switching.
const THEME_KEY = "ggst-combo-trainer-theme";
const themeSwitch = document.querySelector(".theme-switch");

function syncTheme() {
  const current = document.documentElement.dataset.theme || "game";
  themeSwitch.querySelectorAll("[data-theme-set]").forEach((b) => {
    const on = b.dataset.themeSet === current;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

themeSwitch.addEventListener("click", (e) => {
  const wanted = e.target.closest("[data-theme-set]")?.dataset.themeSet;
  if (!wanted) return;

  document.documentElement.dataset.theme = wanted;
  try {
    localStorage.setItem(THEME_KEY, wanted);
  } catch { /* without storage the choice lasts for this session only */ }

  // Beide haengen am Thema: das Spielthema gilt nur unter "game", und die
  // Notationsfarben haben im hellen Thema eigene Werte.
  applyGameTheme();
  applyColorOverrides();
  syncTheme();
});

syncTheme();

// --- Spielwechsel --------------------------------------------
// Alles, was am Spiel haengt, neu aufbauen: Notation, Farben, Zustand
// und jede Liste, die Charaktere oder Marken zeigt.
function loadGame(game) {
  applyGameData(game);
  resetStateForGame();
  loadStored();

  applyGradeLabels();
  applyGameTheme();
  applyColorOverrides();
  invalidateRules();

  buildGrid();
  buildWhoGrid();
  syncWho();
  render();
  buildPositionMenu();
  syncPositionUi();
  buildStateList();
  syncStates();
  buildCategoryList();
  syncCategory();
  syncGameUi();

  // Das Gegner-Raster in den Einstellungen wird erst beim Oeffnen gebaut
  // und danach nicht mehr angefasst. Beim Spielwechsel muss es also weg,
  // sonst stehen dort weiter die Charaktere des alten Spiels.
  allowedGrid.innerHTML = "";

  renderEntries();
}

function switchGame(id) {
  // Kein stiller Rueckfall auf das erste Spiel: eine unbekannte Kennung
  // sieht dann wie ein erfolgreicher Wechsel aus, waehrend man in
  // Wahrheit im alten Spiel steht - und dort weiterschreibt.
  const game = GAME_BY_ID.get(id);
  if (!game) {
    showNotice("No game with the id \"" + id + "\".", "error");
    return;
  }
  if (game.id === GAME.id) return;

  // Der laufende Durchlauf gehoert zum alten Spiel - erst beenden.
  if (state.training) stopTraining();

  saveNow();                 // den Stand des alten Spiels sichern
  closeEntryPicker(false);
  POPOVERS.forEach(closePopover);

  loadGame(game);
  writeJson(APP_KEY, { v: 1, game: game.id });
}

// --- Start ---------------------------------------------------
migrateLegacy();
loadCustomGames();
loadGame(gameById(readJson(APP_KEY)?.game ?? GAMES[0].id));
