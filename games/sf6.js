// Street Fighter 6
//
// Besonderheit gegenueber Guilty Gear: es gibt drei Schreibweisen fuer
// dieselben Eingaben, und alle drei sollen nebeneinander erlaubt sein.
//   klassisch   cr.MP > st.HK
//   Ziffernblock 2MP > 5HK
//   Modern       2M > 236SP
// Der Termaufbau "Vorsilbe + Richtung + Button" traegt alle drei: die
// Vorsilben decken die klassische Form ab, die Ziffern den Ziffernblock,
// und Modern ist nur eine andere Menge von Buttons.
const GAME_SF6 = {
  id: "sf6",
  name: "Street Fighter 6",
  short: "SF",
  sharePrefix: "SF61-",
  example: "cr.MP > cr.MK > 236LP",

  characters: [
    // Startbesetzung
    { id: "ryu",       name: "Ryu",        short: "RY" },
    { id: "luke",      name: "Luke",       short: "LU" },
    { id: "jamie",     name: "Jamie",      short: "JA" },
    { id: "chunli",    name: "Chun-Li",    short: "CH" },
    { id: "guile",     name: "Guile",      short: "GU" },
    { id: "kimberly",  name: "Kimberly",   short: "KI" },
    { id: "juri",      name: "Juri",       short: "JU" },
    { id: "ken",       name: "Ken",        short: "KE" },
    { id: "blanka",    name: "Blanka",     short: "BL" },
    { id: "dhalsim",   name: "Dhalsim",    short: "DH" },
    { id: "honda",     name: "E. Honda",   short: "HO" },
    { id: "deejay",    name: "Dee Jay",    short: "DJ" },
    { id: "manon",     name: "Manon",      short: "MA" },
    { id: "marisa",    name: "Marisa",     short: "MR" },
    { id: "jp",        name: "JP",         short: "JP" },
    { id: "zangief",   name: "Zangief",    short: "ZA" },
    { id: "lily",      name: "Lily",       short: "LI" },
    { id: "cammy",     name: "Cammy",      short: "CA" },
    // Year 1
    { id: "rashid",    name: "Rashid",     short: "RA" },
    { id: "aki",       name: "A.K.I.",     short: "AK" },
    { id: "ed",        name: "Ed",         short: "ED" },
    { id: "akuma",     name: "Akuma",      short: "AU" },
    // Year 2
    { id: "bison",     name: "M. Bison",   short: "BI" },
    { id: "terry",     name: "Terry",      short: "TE" },
    { id: "mai",       name: "Mai",        short: "MI" },
    { id: "elena",     name: "Elena",      short: "EL" },
    // Year 3
    { id: "sagat",     name: "Sagat",      short: "SA" },
    { id: "viper",     name: "C. Viper",   short: "VI" },
    { id: "alex",      name: "Alex",       short: "AL" },
    { id: "ingrid",    name: "Ingrid",     short: "IN" },
    // Year 4
    { id: "arjun",     name: "Arjun",      short: "AR" },
    { id: "yasmine",   name: "Yasmine",    short: "YA" },
  ],

  // Ohne Zusatzkauf spielbar - Voreinstellung fuer die Zufallsauswahl.
  baseRoster: [
    "ryu", "luke", "jamie", "chunli", "guile", "kimberly", "juri", "ken",
    "blanka", "dhalsim", "honda", "deejay", "manon", "marisa", "jp",
    "zangief", "lily", "cammy",
  ],

  // Burnout ist in SF6 ein eigener Dummy-Zustand und lohnt eine Marke.
  states: ["jumping", "crouching", "burnout", "\u{1F3AF} drill"],

  notation: {
    // Reihenfolge ist wichtig: der Zerteiler nimmt die erste passende
    // Schreibweise. Zweibuchstabige zuerst, sonst schluckt "P" das "PP"
    // und "M" das "MP".
    buttons: [
      { id: "LP", match: "LP", label: "Light Punch",  color: "#93c5fd", light: "#3b82f6",
        sample: "LP", kinds: "Classic or numpad: LP, cr.LP, 2LP, 236LP" },
      { id: "MP", match: "MP", label: "Medium Punch", color: "#60a5fa", light: "#2563eb",
        sample: "cr.MP", kinds: "MP, cr.MP, 2MP, 623MP" },
      { id: "HP", match: "HP", label: "Heavy Punch",  color: "#3b82f6", light: "#1d4ed8",
        sample: "HP", kinds: "HP, st.HP, 5HP, 214HP" },
      { id: "LK", match: "LK", label: "Light Kick",   color: "#86efac", light: "#16a34a",
        sample: "LK", kinds: "LK, cr.LK, 2LK" },
      { id: "MK", match: "MK", label: "Medium Kick",  color: "#4ade80", light: "#15803d",
        sample: "cr.MK", kinds: "MK, cr.MK, 2MK, 236MK" },
      { id: "HK", match: "HK", label: "Heavy Kick",   color: "#22c55e", light: "#166534",
        sample: "HK", kinds: "HK, st.HK, 5HK, j.HK" },
      { id: "PP", match: "PP", label: "Two punches",  color: "#c7d2fe", light: "#4f46e5",
        sample: "PP", kinds: "PP - both punches, e.g. Drive Impact input" },
      { id: "KK", match: "KK", label: "Two kicks",    color: "#bbf7d0", light: "#047857",
        sample: "KK", kinds: "KK - both kicks, e.g. Drive Rush input" },
      { id: "SP", match: "SP", label: "Modern Special", color: "#c084fc", light: "#7e22ce",
        sample: "236SP", kinds: "Modern one-button special: SP, 2SP, 6SP, 236SP" },
      { id: "L",  match: "L",  label: "Modern Light",  color: "#fcd34d", light: "#b45309",
        sample: "2L", kinds: "Modern light attack: L, 2L, j.L" },
      { id: "M",  match: "M",  label: "Modern Medium", color: "#fbbf24", light: "#a16207",
        sample: "2M", kinds: "Modern medium attack: M, 2M, 5M" },
      { id: "H",  match: "H",  label: "Modern Heavy",  color: "#f59e0b", light: "#854d0e",
        sample: "H", kinds: "Modern heavy attack: H, 2H, j.H" },
      { id: "A",  match: "A",  label: "Modern Assist", color: "#f472b6", light: "#be185d",
        sample: "A", kinds: "Modern assist button: A, A+L, A+H, A+SP" },
      { id: "P",  match: "P",  label: "Any punch",     color: "#c7d2fe", light: "#4f46e5",
        sample: "236P", kinds: "Strength left open: P, 236P, 623P" },
      { id: "K",  match: "K",  label: "Any kick",      color: "#bbf7d0", light: "#047857",
        sample: "214K", kinds: "Strength left open: K, 214K" },
    ],

    // Die klassische Schreibweise. Der Ziffernblock braucht keine davon.
    prefixes: ["cr", "st", "cl", "nj", "dl", "j", "f"],
    directions: true,

    // Das Drive-System und die Supers stehen an der Stelle, an der bei
    // Guilty Gear die Roman Cancels stehen.
    cancels: {
      forms: ["DRC", "SA1", "SA2", "SA3", "DR", "DI", "OD", "CA", "SA"],
      label: "Drive & Supers", sample: "DR",
      kinds: "DI, DR, DRC, OD, SA1, SA2, SA3, CA",
      color: "#a78bfa", light: "#6d28d9",
    },

    // Punish Counter zaehlt in SF6 mehr als der einfache Counter Hit -
    // beide gelten als Vorbedingung der ganzen Combo.
    counter: {
      forms: ["(PC)", "PC", "(CH)", "CH"],
      label: "Punish / Counter", sample: "PC",
      kinds: "PC, (PC), CH, (CH) - anywhere in the combo",
      color: "#ff7300", light: "#ff7300",
    },

    actions: {
      label: "Movement, cancels", sample: "66",
      color: "#22d3ee", light: "#0891b2",
      forms: {
        dash: "dash", backdash: "backdash", walk: "walk", whiff: "whiff",
        delay: "delay", land: "land", "66": "66", "44": "44", md: "md",
      },
    },
  },

  // Blau als Leitfarbe, wie im Spielmenue. https://www.streetfighter.com/6/
  theme: {
    "--accent": "#2f6bff",
    "--accent-hover": "#4d82ff",
    "--accent-soft": "#0b1b3f",
    "--accent-soft-hover": "#12295c",
    "--send-bg": "#2f6bff",
    "--send-bg-hover": "#4d82ff",
    "--send-fg": "#ffffff",
  },
};
