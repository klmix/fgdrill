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
const posLabel    = document.getElementById("positionLabel");
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
  CHARACTERS = game.characters;
  CHAR_BY_ID = new Map(game.characters.map((c) => [c.id, c]));
  BASE_ROSTER = game.baseRoster;
  STATE_DEFAULTS = game.states;
  SHARE_PREFIX = game.sharePrefix;

  const notation = buildNotation(game.notation);
  TOKEN_RE = notation.re;
  ACTION_FORM = notation.actionForm;
  BUTTONS = notation.buttons;
  COLOR_ROLES = buildColorRoles(game.notation);
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
  activeStates: new Set(),   // was die naechste Combo mitbekommt
  tagFilter: new Set(),      // gezielte Runde: nur diese Marken, ohne Plan
  reviewed: {},              // Tagespensum je Charakter: { day, count }
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

// "drill" ist eine Sondermarke: solche Combos umgehen den Wiederholungsplan
// und sind in jeder Sitzung dabei. Sie beschreibt keinen Dummy-Zustand,
// taucht deshalb weder in der Sortierreihenfolge noch bei den uebrigen
// Marken auf - in der Liste steht sie dort, wo sonst der Plan-Stand waere.
// Erkannt wird sie am Namen ohne Zeichen, damit auch alte Ablagen ohne
// Zielscheibe weiter greifen.
const DRILL_STATE = "drill";

// Einzige Quelle fuer die Vorgaben - sonst laufen Startliste und
// Nachtrag beim Laden auseinander.
state.states = [...STATE_DEFAULTS];


function istDrillName(name) {
  return tagLabel(name).toLowerCase() === DRILL_STATE;
}

function isDrill(entry) {
  return (entry.states ?? []).some(istDrillName);
}

function drillTagName(entry) {
  return (entry.states ?? []).find(istDrillName) ?? DRILL_STATE;
}

// Marken ohne die Sondermarke - alles, was wirklich eine Einstellung meint.
function visibleStates(entry) {
  return (entry.states ?? []).filter((n) => !istDrillName(n));
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
      perDay: 20,      // null = alle faelligen
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
  state.activeStates = new Set();
  state.tagFilter = new Set();
  state.reviewed = {};
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
function previewInterval(entry, grade) {
  if (!state.settings.sr.enabled || isDrill(entry)) return null;
  if (grade === "again") return 0;

  const alt = entry.interval || 0;
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

function applyGrade(entry, grade) {
  entry.lastGrade = grade;          // auch ohne Plan fuer die Liste interessant

  const tage = previewInterval(entry, grade);
  if (tage === null) return;        // Plan aus oder Drill

  entry.interval = tage;
  entry.due = Date.now() + tage * TAG;
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

function reviewedToday(charId) {
  const eintrag = state.reviewed[charId];
  return eintrag && eintrag.day === todayKey() ? eintrag.count : 0;
}

function noteReviewed(charId) {
  const heute = todayKey();
  const eintrag = state.reviewed[charId];

  if (!eintrag || eintrag.day !== heute) state.reviewed[charId] = { day: heute, count: 1 };
  else eintrag.count++;
}

// Der Plan-Anteil: was heute laut Wiederholung ansteht.
function dueSelection(charId) {
  const aktiv = state.entries.filter((e) => e.character === charId && !e.disabled);
  const sr = state.settings.sr;
  if (!sr.enabled) return [];

  const jetzt = Date.now();

  // Drill-Combos sind immer dabei und zaehlen nicht gegen das Tagespensum -
  // sonst koennte der Deckel sie wegschneiden.
  const drill = aktiv.filter(isDrill);
  const geplant = aktiv
    .filter((e) => !isDrill(e))
    .filter((e) => !e.due || e.due <= jetzt)
    .sort((a, b) => (a.due || 0) - (b.due || 0));   // laengst faellige zuerst

  const rest = sr.perDay ? Math.max(0, sr.perDay - reviewedToday(charId)) : Infinity;
  return [...drill, ...geplant.slice(0, rest)];
}

// Grinden heisst: ohne Plan ueben. Das ist der Fall bei einer gezielten
// Runde, bei abgeschalteter Wiederholung, und wenn heute nichts ansteht.
function isGrindMode(charId = state.character) {
  if (state.tagFilter.size > 0) return true;
  if (!state.settings.sr.enabled) return true;
  return dueSelection(charId).length === 0;
}

// Was steht heute an? Erst die faelligsten, dann in Trainingsreihenfolge.
// Rueckgabe sind Paare aus Combo und dem Gegner, auf den sie geuebt wird.
function trainingQueue(charId) {
  const aktiv = state.entries.filter((e) => e.character === charId && !e.disabled);

  // Gezielte Runde ueber das Zahnrad: alle Combos mit einer der gewaehlten
  // Marken, ohne Ruecksicht auf Faelligkeit oder Tagespensum.
  if (state.tagFilter.size > 0) {
    return ordneRunde(aktiv.filter((e) =>
      (e.states ?? []).some((n) => state.tagFilter.has(n))));
  }

  const faellig = dueSelection(charId);
  return ordneRunde(faellig.length > 0 ? faellig : aktiv);
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
  posLabel.textContent = active.label;
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
  if (GAME.portraits !== false) {
    const img = document.createElement("img");
    img.src = "assets/chars/" + GAME.id + "/" + char.id + ".png";
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

  for (const char of CHARACTERS) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "char";
    tile.dataset.id = char.id;
    tile.title = char.name;
    tile.setAttribute("aria-label", char.name);
    tile.append(charIcon(char, "char__portrait"));
    whoGrid.append(tile);
  }
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
    if (!STATE_DEFAULTS.includes(name)) {
      const drop = document.createElement("span");
      drop.className = "menu__drop";
      drop.dataset.dropState = name;
      drop.title = "Remove state";
      drop.textContent = "×";
      item.append(drop);
    }

    stateList.append(item);
  }
}

function syncStates() {
  const gewaehlt = [...state.activeStates];

  stateLabel.textContent =
    gewaehlt.length === 0 ? "Special States"
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

// --- Menues anmelden -----------------------------------------
registerPopover(pickerBtn, panel);   // gegen welche Charaktere
registerPopover(stateBtn, statePanel);            // Special States
// Waehrend des Trainings steht der Charakter fest.
const whoPop = registerPopover(whoBtn, whoPanel, () => !state.training);

// --- Spielauswahl --------------------------------------------
const gameBtn = document.getElementById("gameButton");
const gamePanel = document.getElementById("gamePanel");
const gameLabel = document.getElementById("gameLabel");
const gameTile = document.getElementById("gameTile");

function buildGameList() {
  gamePanel.innerHTML = "";

  for (const spiel of GAMES) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "menu__item";
    item.dataset.game = spiel.id;
    item.setAttribute("role", "menuitemradio");

    const kachel = document.createElement("span");
    kachel.className = "game-tile";
    kachel.textContent = spiel.short;

    const label = document.createElement("span");
    label.className = "menu__label";
    label.textContent = spiel.name;

    item.innerHTML = STATE_CHECK_SVG;
    item.prepend(kachel, label);
    gamePanel.append(item);
  }
}

function syncGameUi() {
  gameLabel.textContent = GAME.name;
  gameTile.textContent = GAME.short;
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
  const id = e.target.closest("[data-game]")?.dataset.game;
  if (!id) return;

  closePopover(gamePop);
  switchGame(id);
});

buildGameList();

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
    combo.innerHTML = tokenize(entry.text);   // gleiche Faerbung wie im Eingabefeld
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
    meta.append(positionSelect(entry), entryCharPicker(entry));
  } else {
    // Position und Marken stehen jetzt links bei der Combo; hier bleibt
    // nur der Stand aus dem Training.
    // Alles in einer Zeile: Drill-Marke, letzte Note, naechster Termin.
    // Getrennte Kinder der Spalte ergaeben sonst eine zweite Zeile.
    const stand = document.createElement("span");
    stand.className = "entry__sr";

    if (isDrill(entry)) {
      const drill = document.createElement("span");
      drill.className = "entry__drill";
      drill.textContent = drillTagName(entry);
      drill.title = "Drill: skips spaced repetition";
      stand.append(drill);
    }

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
  count.textContent = entries.length + (entries.length === 1 ? " combo" : " combos");

  // Bearbeiten gilt nur fuer diesen Charakter.
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "group__edit" + (bearbeiten ? " is-active" : "");
  edit.dataset.edit = char.id;
  edit.title = bearbeiten ? "Done editing" : "Edit combos";
  edit.setAttribute("aria-pressed", String(bearbeiten));
  edit.innerHTML = PENCIL_SVG;

  const teilen = document.createElement("button");
  teilen.type = "button";
  teilen.className = "group__edit";
  teilen.dataset.share = char.id;
  teilen.title = "Share this character's combos as a code";
  teilen.setAttribute("aria-label", "Share");
  teilen.innerHTML = SHARE_SVG;

  head.append(name, count, teilen, edit);

  // Sortiert nach Position, Startmove, Counter Hit und zuletzt Alter.
  // Beim Bearbeiten wird immer alles gezeigt.
  const neueste = sortForList(entries);
  const offen = bearbeiten || state.expanded.has(char.id);
  const sichtbar = offen ? neueste : neueste.slice(0, VISIBLE_PER_CHARACTER);

  const list = document.createElement("ol");
  list.className = "group__list";
  sichtbar.forEach((entry) => list.append(buildEntry(entry, bearbeiten)));

  group.append(head, list);

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

function saveCombo() {
  const text = input.value.trim();
  if (!text) { input.focus(); return; }

  state.entries.push({
    id: newId(),
    text,
    character: state.character,          // fuer welchen Charakter
    characters: currentCharacters(),     // gegen welche Charaktere
    position: state.position,
    states: [...state.activeStates],
    comment: comment.value.trim(),
    touched: Date.now(),
  });

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
  const anstehend = trainingQueue(state.character).length;
  const grind = isGrindMode();
  const marken = [...state.tagFilter].map(tagLabel).join(", ");

  dojoBtn.disabled = anstehend === 0;
  dojoBtn.classList.toggle("is-grind", grind && anstehend > 0);
  dojoLabel.textContent = grind ? "Start grinding" : "Start training";

  dojoBtn.title = !hatCombos
    ? "No combos saved for " + name + " yet"
    : anstehend === 0
      ? (marken ? "No combos tagged " + marken : "No combos to train for " + name)
      : marken
        ? "Focused set: " + marken + " (" + anstehend + "), nothing is scheduled"
        : grind
          ? "Nothing due - grind all " + anstehend + " combos for " + name +
            " (this does not change the schedule)"
          : "Start training with " + name + " (" + anstehend + ")";
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

  drillCombo.hidden = bearbeiten;
  drillComboEdit.hidden = !bearbeiten;

  if (bearbeiten) {
    drillComboEdit.innerHTML = "";
    const box = comboField(entry);
    box.classList.add("editor--drill");
    drillComboEdit.append(box);
    autoGrow(box.querySelector("textarea"));   // erst im Dokument messbar
  } else {
    drillCombo.innerHTML = tokenize(entry.text);   // gleiche Faerbung wie im Feld
  }
  drillPosition.textContent = describePosition(entry.position);

  // Die Marken sind genau die Zusatzinfo, die beim Ueben zaehlt. Beim
  // Bearbeiten treten sie unter die Combo, weil die waehlbare Fassung
  // mit dem Pluszeichen zu breit fuer die Kopfzeile ist.
  drillStates.innerHTML = "";
  drillStates.hidden = bearbeiten;
  if (!bearbeiten) {
    visibleStates(entry).forEach((name) => drillStates.append(stateTag(name)));
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
  drillNote.hidden = bearbeiten || !entry.comment;

  if (bearbeiten) {
    drillComment.value = entry.comment ?? "";
    autoGrow(drillComment);
  } else {
    drillNote.innerHTML = entry.comment ? linkify(entry.comment) : "";
  }

  // Wie lange wuerde jede Note aufschieben?
  drillGrades.querySelectorAll("[data-days]").forEach((el) => {
    // In der gezielten Runde wird nichts geplant - eine Tagesangabe waere gelogen.
    el.textContent = t.temporary
      ? ""
      : describeInterval(previewInterval(entry, el.dataset.days));
  });

  drillCharEdit.innerHTML = "";
  drillCharEdit.hidden = !bearbeiten;
  if (bearbeiten) drillCharEdit.append(entryCharPicker(entry));

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
function setGrade(entry, grade, nachOben = true, dauer = null) {
  const t = state.training;
  let posten = t.done.find((d) => d.entry === entry);

  if (posten) {
    // Auf den Stand vor der ersten Bewertung zuruecksetzen. Ohne das
    // wuerde sich das Intervall bei jeder Korrektur weiter aufschaukeln.
    Object.assign(entry, posten.vorher);
    if (nachOben) t.done = t.done.filter((d) => d !== posten);
  } else {
    posten = {
      entry,
      vorher: {
        interval: entry.interval ?? 0,
        due: entry.due ?? 0,
        lastGrade: entry.lastGrade ?? null,
      },
    };
  }

  // Beim Grinden wird nichts gespeichert: die Noten gelten nur fuer diese
  // Sitzung und duerfen weder den Plan noch das Tagespensum verstellen.
  if (!t.temporary) {
    const neu = !posten.gezaehlt;
    applyGrade(entry, grade);
    if (neu) { noteReviewed(entry.character); posten.gezaehlt = true; }
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

    const zeile = document.createElement("div");
    zeile.className = "done__row";

    const zeichen = document.createElement("span");
    const geschafft = posten.grade !== "again";
    zeichen.className = "done__mark" + (geschafft ? "" : " is-fail");
    zeichen.innerHTML = geschafft ? DONE_OK_SVG : DONE_FAIL_SVG;

    const combo = document.createElement("p");
    combo.className = "done__combo";
    combo.innerHTML = tokenize(posten.entry.text);

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
function dropPendingRepeat(entry) {
  const t = state.training;
  const i = t.queue.findIndex((p, k) => k >= t.index && p.entry === entry);
  if (i === -1) return false;

  t.queue.splice(i, 1);
  return true;
}

doneList.addEventListener("click", (e) => {
  const grade = e.target.closest("[data-regrade]")?.dataset.regrade;
  if (!grade || !state.training) return;

  const item = e.target.closest(".done__item");
  const t = state.training;
  const posten = t.done.find((d) => d.entry.id === item?.dataset.id);
  if (!posten) return;

  setGrade(posten.entry, grade, false);   // Zeile bleibt, wo sie ist
  updateDoneRow(item, posten);            // und bleibt aufgeklappt

  // Stand die Wiederholung schon im Hauptfeld, ruecken die restlichen
  // Combos nach; war es die letzte, ist die Runde damit durch.
  if (grade !== "again" && dropPendingRepeat(posten.entry) && !t.finished) {
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
    (t.done.length === 1 ? " combo)" : " combos)") +
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

function startTraining() {
  const queue = trainingQueue(state.character);
  if (queue.length === 0) {
    showNotice("Nothing due for " + CHAR_BY_ID.get(state.character).name +
               " today.", "error");
    return;
  }

  POPOVERS.forEach(closePopover);   // nichts soll auf der weggedrehten Seite offen stehen
  state.training = { queue, index: 0, total: queue.length,
                     elapsed: 0, since: Date.now(),
                     editing: false, done: [], finished: false,
                     stopped: false, comboStart: 0,
                     temporary: isGrindMode() };

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
  state.training ? stopTraining() : startTraining();
});

drillGrades.addEventListener("click", (e) => {
  const grade = e.target.closest("[data-grade]")?.dataset.grade;
  if (!grade || !state.training) return;

  const t = state.training;
  if (t.finished) return;

  const posten = t.queue[t.index];
  const dauer = trainingElapsed() - (t.comboStart ?? 0);
  setGrade(posten.entry, grade, true, dauer);

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

// --- Zahnrad: gezielte Runde oder Einstellungen ---------------
const settingsMenu = document.getElementById("settingsMenu");
const tagFilterList = document.getElementById("tagFilterList");

function openPreferences() {
  buildOrderList();
  buildColorList();
  buildRuleList();
  if (!allowedGrid.children.length) buildAllowedGrid();
  syncAllowedUi();
  syncSettingsUi();
  settingsDlg.showModal();
}

// Eine Zeile je Marke. Auswahl heisst: nur diese Combos, alle davon,
// ohne Wiederholungsplan.
function buildTagFilter() {
  tagFilterList.innerHTML = "";

  // Die Dummy-Vorgaben stehen hier nicht zur Wahl - sie beschreiben eine
  // Haltung, keine eigene Kategorie. Drill ist die Ausnahme.
  const vorgaben = STATE_DEFAULTS.filter((n) => !istDrillName(n))
    .map((n) => n.toLowerCase());

  for (const name of state.states.filter(
    (n) => istDrillName(n) || !vorgaben.includes(n.toLowerCase()))) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "menu__item";
    item.dataset.filterTag = name;
    item.setAttribute("role", "menuitemcheckbox");

    const label = document.createElement("span");
    label.className = "menu__label";
    label.textContent = tagLabel(name);

    item.innerHTML = STATE_CHECK_SVG;
    item.prepend(tagMarker(name, "menu__dot"), label);
    tagFilterList.append(item);
  }

  syncTagFilter();
}

function syncTagFilter() {
  // Marken, die es nicht mehr gibt, fliegen aus der Auswahl.
  for (const name of [...state.tagFilter]) {
    if (!state.states.includes(name)) state.tagFilter.delete(name);
  }

  tagFilterList.querySelectorAll("[data-filter-tag]").forEach((item) => {
    const an = state.tagFilter.has(item.dataset.filterTag);
    item.classList.toggle("is-active", an);
    item.setAttribute("aria-checked", String(an));
  });

  // Am Zahnrad sichtbar machen, dass eine Auswahl aktiv ist - sonst
  // waere unerklaerlich, warum nur ein Teil der Combos drankommt.
  settingsBtn.classList.toggle("is-filtered", state.tagFilter.size > 0);
  syncDojo();
}

settingsMenu.addEventListener("click", (e) => {
  if (e.target.closest("[data-open-prefs]")) {
    closePopover(gearPop);
    openPreferences();
    return;
  }

  const name = e.target.closest("[data-filter-tag]")?.dataset.filterTag;
  if (!name) return;

  state.tagFilter.has(name) ? state.tagFilter.delete(name) : state.tagFilter.add(name);
  syncTagFilter();
});

const gearPop = registerPopover(settingsBtn, settingsMenu, () => {
  buildTagFilter();
  return true;
});

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
    ? "Nothing imported - all " + eintraege.length + " combos for " + name + " are already here."
    : dazu + (dazu === 1 ? " combo" : " combos") + " for " + name + " imported" +
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
  return name + ", " + n + (n === 1 ? " combo" : " combos");
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
    item.draggable = true;
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
// Die Liste wird beim Ziehen live umgestellt; beim Loslassen lesen wir
// die Reihenfolge aus dem Dokument zurueck.
function elementNachCursor(y) {
  const andere = [...orderList.querySelectorAll(".order__item:not(.is-dragging)")];
  return andere.find((el) => {
    const r = el.getBoundingClientRect();
    return y < r.top + r.height / 2;
  }) ?? null;
}

orderList.addEventListener("dragstart", (e) => {
  const item = e.target.closest(".order__item");
  if (!item) return;
  item.classList.add("is-dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", item.dataset.state);
});

orderList.addEventListener("dragover", (e) => {
  e.preventDefault();
  const ziehend = orderList.querySelector(".is-dragging");
  if (!ziehend) return;

  const davor = elementNachCursor(e.clientY);
  if (davor === null) orderList.append(ziehend);
  else orderList.insertBefore(ziehend, davor);
});

orderList.addEventListener("dragend", () => {
  const ziehend = orderList.querySelector(".is-dragging");
  if (ziehend) ziehend.classList.remove("is-dragging");

  state.settings.order =
    [...orderList.querySelectorAll(".order__item")].map((el) => el.dataset.state);
  syncDojo();
  persist();
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
  srPerDay.value = sr.perDay ?? 20;
  srPerDay.disabled = !sr.enabled || sr.perDay === null;
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
  sr.maxDays = Math.min(365, Math.max(1, Number(srMaxDays.value) || 1));

  syncSettingsUi();
  syncDojo();
  persist();
}

[srEnabled, srAll, srPerDay, srMaxDays].forEach((el) =>
  el.addEventListener("change", leseSettings));

document.getElementById("settingsClose").addEventListener("click", () => settingsDlg.close());

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
               (anzahl === 1 ? " combo" : " combos") + ", " + code.length + " characters).");
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
    title: "Import combos?",
    text: describePacket(paket) + ". They will be added to your collection; " +
          "combos you already have are left untouched.",
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

  showNotice(state.entries.length + " combos exported.");
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
      ? "Nothing imported - all " + eintraege.length + " combos are already here."
      : dazu + (dazu === 1 ? " combo" : " combos") + " imported" +
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

  if (Array.isArray(daten.entries)) {
    // Nur Eintraege mit bekanntem Charakter uebernehmen.
    state.entries = daten.entries.filter((e) => e && CHAR_BY_ID.has(e.character));
  }

  if (Array.isArray(daten.states) && daten.states.length) {
    state.states = daten.states.map(String);
    // Aeltere Ablagen kennen die Vorgaben noch nicht.
    for (const name of STATE_DEFAULTS) {
      const da = state.states.some(
        (n) => tagLabel(n).toLowerCase() === tagLabel(name).toLowerCase());
      if (!da) state.states.push(name);
    }
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
  syncGameUi();
  renderEntries();
}

function switchGame(id) {
  const game = gameById(id);
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
loadGame(gameById(readJson(APP_KEY)?.game ?? GAMES[0].id));
