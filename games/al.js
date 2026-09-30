// Avatar Legends: The Fighting Game
//
// Vier Knoepfe: A, B und C fuer leicht, mittel und schwer, dazu D - der
// Flow-Knopf, der im Spiel auch F heisst. Geschrieben wird mit dem
// Ziffernblock. Die Kombinationen AD (Wurf), BC (Dash), CD (Guard
// Reversal) und ABC (Super) sind nur Knopfnamen und brauchen nichts
// Eigenes.
const GAME_AL = {
  id: "al",
  name: "Avatar Legends: The Fighting Game",
  short: "AL",
  sharePrefix: "AL1-",
  example: "5A > 5B > f.B > 236C",

  characters: [
    { id: "aang",           name: "Aang",            short: "AA" },
    { id: "avataraang",     name: "Avatar Aang",     short: "AV" },
    { id: "azula",          name: "Azula",           short: "AZ" },
    { id: "katara",         name: "Katara",          short: "KA" },
    { id: "korra",          name: "Korra",           short: "KO" },
    { id: "kyoshi",         name: "Kyoshi",          short: "KY" },
    { id: "nightmarekorra", name: "Nightmare Korra", short: "NK" },
    { id: "ozai",           name: "Ozai",            short: "OZ" },
    { id: "sokka",          name: "Sokka",           short: "SO" },
    { id: "toph",           name: "Toph",            short: "TO" },
    { id: "zaheer",         name: "Zaheer",          short: "ZA" },
    { id: "zuko",           name: "Zuko",            short: "ZU" },
  ],

  // Kein baseRoster: alle zwoelf sind von Anfang an spielbar.

  // "unbalanced" ist der Zustand mit leerem Flow - jeder Treffer darauf
  // zaehlt als Counter Hit, die Combo sieht also anders aus.
  states: ["jumping", "crouching", "unbalanced", "\u{1F3AF} drill"],

  notation: {
    buttons: [
      { id: "A", match: "A", label: "A - light",  color: "#fbbf24", light: "#d97706",
        sample: "5A", kinds: "A, 2A, j.A, 236A" },
      { id: "B", match: "B", label: "B - medium", color: "#60a5fa", light: "#2f8fd8",
        sample: "5B", kinds: "B, 2B, j.B, 214B" },
      { id: "C", match: "C", label: "C - heavy",  color: "#f87171", light: "#dc2626",
        sample: "5C", kinds: "C, 2C, j.C, 623C" },
      { id: "D", match: "D|F", label: "D - flow", color: "#4ade80", light: "#3aa757",
        sample: "236D", kinds: "The flow button, D or F: 5D, 2D, 236D" },
      // Steht wie ein Knopf hinter der Bewegung, deshalb gehoert es hierher
      // und nicht in eine eigene Familie: sonst zerfiele "236EX".
      { id: "EX", match: "EX", label: "EX - energy", color: "#a78bfa", light: "#8b5cf6",
        sample: "236EX", kinds: "Specials that cost energy: 236EX, j.236EX" },
    ],

    prefixes: ["hj", "dj", "tk", "dl", "j", "c", "f"],
    directions: true,

    counter: {
      forms: ["(CH)", "CH"],
      label: "Counter Hit", sample: "CH",
      kinds: "CH and (CH), anywhere in the combo",
      color: "#ff7300", light: "#ff7300",
    },

    actions: {
      label: "Movement, cancels", sample: "66",
      color: "#22d3ee", light: "#0891b2",
      forms: {
        dash: "dash", whiff: "whiff", delay: "delay", land: "land",
        jc: "jc", dc: "dc", iad: "IAD", "66": "66", "44": "44",
      },
    },
  },

  // Das Blaugruen des Schriftzugs auf dem tiefblauen Schild des Logos.
  theme: {
    "--accent": "#2bb5c4",
    "--accent-hover": "#46cfdd",
    "--accent-soft": "#07222b",
    "--accent-soft-hover": "#0d3441",
    "--send-bg": "#2bb5c4",
    "--send-bg-hover": "#46cfdd",
    "--send-fg": "#04191f",
    "--page-bg": "#060c12",
    "--composer-bg": "#111c26",
    "--surface": "#16232e",
  },
};
