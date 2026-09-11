// Guilty Gear -Strive-
//
// Eine Spieldefinition beschreibt alles, was von Spiel zu Spiel anders ist:
// Roster, Notation, Vorgabe-Marken und die Farben des Spielthemas. Wer ein
// weiteres Spiel ergaenzen will, legt eine Datei wie diese an und traegt sie
// in games/index.js ein; am Programm selbst ist nichts zu aendern.
const GAME_GGST = {
  id: "ggst",
  name: "Guilty Gear -Strive-",
  short: "GG",                 // Kachel, solange kein Logo da ist
  sharePrefix: "GGST1-",       // Kennung der Teilen-Codes
  example: "2K > 2D > 236K > 214214H",   // Beispiel im leeren Eingabefeld

  // Portraits liegen unter assets/chars/<spiel>/<id>.png . Fehlt eins,
  // bleibt das Kuerzel stehen.
  characters: [
    { id: "sol",        name: "Sol Badguy",          short: "SO" },
    { id: "ky",         name: "Ky Kiske",            short: "KY" },
    { id: "may",        name: "May",                 short: "MA" },
    { id: "axl",        name: "Axl Low",             short: "AX" },
    { id: "chipp",      name: "Chipp Zanuff",        short: "CH" },
    { id: "potemkin",   name: "Potemkin",            short: "PO" },
    { id: "faust",      name: "Faust",               short: "FA" },
    { id: "millia",     name: "Millia Rage",         short: "MI" },
    { id: "zato",       name: "Zato-1",              short: "ZA" },
    { id: "ramlethal",  name: "Ramlethal Valentine", short: "RA" },
    { id: "leo",        name: "Leo Whitefang",       short: "LE" },
    { id: "nagoriyuki", name: "Nagoriyuki",          short: "NA" },
    { id: "giovanna",   name: "Giovanna",            short: "GI" },
    { id: "anji",       name: "Anji Mito",           short: "AN" },
    { id: "ino",        name: "I-No",                short: "IN" },
    { id: "goldlewis",  name: "Goldlewis Dickinson", short: "GO" },
    { id: "jacko",      name: "Jack-O'",             short: "JC" },
    { id: "happychaos", name: "Happy Chaos",         short: "HC" },
    { id: "baiken",     name: "Baiken",              short: "BA" },
    { id: "testament",  name: "Testament",           short: "TE" },
    { id: "bridget",    name: "Bridget",             short: "BR" },
    { id: "sin",        name: "Sin Kiske",           short: "SI" },
    { id: "bedman",     name: "Bedman?",             short: "BE" },
    { id: "asuka",      name: "Asuka R\u266F",       short: "AS" },
    { id: "johnny",     name: "Johnny",              short: "JO" },
    { id: "elphelt",    name: "Elphelt Valentine",   short: "EL" },
    { id: "aba",        name: "A.B.A",               short: "AB" },
    { id: "slayer",     name: "Slayer",              short: "SL" },
    { id: "dizzy",      name: "Queen Dizzy",         short: "DI" },
    { id: "venom",      name: "Venom",               short: "VE" },
    { id: "unika",      name: "Unika",               short: "UN" },
    { id: "lucy",       name: "Lucy",                short: "LU" },
    { id: "jam",        name: "Jam Kuradoberi",      short: "JA" },
    { id: "roboky",     name: "Robo-Ky",             short: "RK" },
  ],

  // Ohne Season Pass verfuegbar - Voreinstellung fuer die Zufallsauswahl.
  baseRoster: [
    "sol", "ky", "may", "axl", "chipp", "potemkin", "faust", "millia",
    "zato", "ramlethal", "leo", "nagoriyuki", "giovanna", "anji", "ino",
  ],

  // Vorgabe-Marken. Die Drill-Marke muss dabei sein - an ihr haengt das
  // Umgehen des Wiederholungsplans.
  states: ["jumping", "crouching", "\u{1F3AF} drill"],

  notation: {
    // Buttons stehen am Ende eines Terms und faerben ihn ganz: aus "2K"
    // wird also durchgehend blau, nicht nur das K. "match" ist ein Stueck
    // regulaerer Ausdruck - deshalb sind auch mehrbuchstabige Buttons
    // moeglich (LP, MP) oder Ziffern, wie andere Spiele sie benutzen.
    buttons: [
      { id: "P", match: "P", label: "Punch",       color: "#f472b6", light: "#e250a4",
        kinds: "Whole term ending in P: P, 2P, 5P, j.P, 236P, 5[P]" },
      { id: "K", match: "K", label: "Kick",        color: "#60a5fa", light: "#2f8fd8",
        kinds: "Whole term ending in K: K, 2K, j.K, 214K" },
      { id: "S", match: "S", label: "Slash",       color: "#4ade80", light: "#3aa757",
        kinds: "Whole term ending in S: S, c.S, f.S, 236S" },
      { id: "H", match: "H", label: "Heavy Slash", color: "#f87171", light: "#d93f3f",
        kinds: "Whole term ending in H: H, 5H, j.H, 632146H, 5[H]" },
      { id: "D", match: "D", label: "Dust",        color: "#fbbf24", light: "#e8912b",
        kinds: "Whole term ending in D: D, 2D, j.D" },
    ],

    // Vorsilben eines Terms, laengere zuerst.
    prefixes: ["hj", "dj", "sj", "jc", "tk", "dl", "j", "c", "f"],

    // Richtungen als Ziffernblock, mit Ladeeingabe in eckigen Klammern.
    directions: true,

    // Die Cancel-Familie des Spiels. Laengste Schreibweise zuerst, sonst
    // schluckt RC das Ende von FRRC.
    cancels: {
      forms: ["FRRC", "YRC", "BRC", "PRC", "RRC", "RC"],
      label: "Roman Cancel", sample: "RC",
      kinds: "RC, YRC, BRC, PRC, RRC, FRRC",
      color: "#a78bfa", light: "#8b5cf6",
    },

    // Vorbedingung der Combo, gilt an jeder Stelle im Text.
    counter: {
      forms: ["(CH)", "CH"],
      label: "Counter Hit", sample: "CH",
      kinds: "CH and (CH), anywhere in the combo",
      color: "#ff7300", light: "#ff7300",
    },

    // Bewegung, Cancels und Hinweise. Der Schluessel ist die Kleinschreibung,
    // der Wert die Form, in der es beim Tippen erscheint.
    actions: {
      label: "Movement, cancels", sample: "66",
      color: "#22d3ee", light: "#0891b2",
      forms: {
        whiff: "whiff", delay: "delay", dash: "dash", land: "land",
        hjc: "hjc", sjc: "sjc", adc: "adc", jc: "jc", dc: "dc", md: "md",
        iad: "IAD", ias: "IAS", ji: "JI", "66": "66", "44": "44",
      },
    },
  },

  // Das Spielthema. Was hier steht, ueberschreibt die Vorgaben aus
  // combo.css - ein Spiel kann also nur den Akzent aendern oder die
  // ganze Palette. https://www.guiltygear.com/ggst/
  theme: {
    "--accent": "#f13932",
    "--accent-hover": "#f24b44",
    "--accent-soft": "#3b0b06",
    "--accent-soft-hover": "#55100a",
    "--send-bg": "#f13932",
    "--send-bg-hover": "#f24b44",
    "--send-fg": "#ffffff",
  },
};
