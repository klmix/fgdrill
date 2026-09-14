// Granblue Fantasy Versus: Rising
//
// Vier Angriffsknoepfe: L, M, H und U. Das U ist der Unique-Knopf, mit dem
// die Charakter-Skills auch ohne Bewegungseingabe gehen.
const GAME_GBVSR = {
  id: "gbvsr",
  name: "Granblue Fantasy Versus: Rising",
  short: "GB",
  sharePrefix: "GBVR1-",
  example: "5M > 5H > 236M > 236236H",

  characters: [
    { id: "2b",            name: "2B",             short: "2B" },
    { id: "anila",         name: "Anila",          short: "AN" },
    { id: "anre",          name: "Anre",           short: "AR" },
    { id: "avatarbelial",  name: "Avatar Belial",  short: "AV" },
    { id: "beatrix",       name: "Beatrix",        short: "BE" },
    { id: "beelzebub",     name: "Beelzebub",      short: "BL" },
    { id: "belial",        name: "Belial",         short: "BI" },
    { id: "cagliostro",    name: "Cagliostro",     short: "CA" },
    { id: "charlotta",     name: "Charlotta",      short: "CH" },
    { id: "djeeta",        name: "Djeeta",         short: "DE" },
    { id: "djeetaex",      name: "Djeeta (EX)",    short: "DJ" },
    { id: "eustace",       name: "Eustace",        short: "EU" },
    { id: "ferry",         name: "Ferry",          short: "FE" },
    { id: "galleon",       name: "Galleon",        short: "GA" },
    { id: "gran",          name: "Gran",           short: "GN" },
    { id: "granex",        name: "Gran (EX)",      short: "GR" },
    { id: "grimnir",       name: "Grimnir",        short: "GI" },
    { id: "ilsa",          name: "Ilsa",           short: "IS" },
    { id: "katalina",      name: "Katalina",       short: "KA" },
    { id: "ladiva",        name: "Ladiva",         short: "LA" },
    { id: "lancelot",      name: "Lancelot",       short: "LN" },
    { id: "lowain",        name: "Lowain",         short: "LO" },
    { id: "lucilius",      name: "Lucilius",       short: "LU" },
    { id: "meg",           name: "Meg",            short: "ME" },
    { id: "metera",        name: "Metera",         short: "MT" },
    { id: "narmaya",       name: "Narmaya",        short: "NR" },
    { id: "narmayaex",     name: "Narmaya (EX)",   short: "NA" },
    { id: "nier",          name: "Nier",           short: "NI" },
    { id: "percival",      name: "Percival",       short: "PE" },
    { id: "sandalphon",    name: "Sandalphon",     short: "SA" },
    { id: "seox",          name: "Seox",           short: "SE" },
    { id: "siegfried",     name: "Siegfried",      short: "SI" },
    { id: "soriz",         name: "Soriz",          short: "SO" },
    { id: "vane",          name: "Vane",           short: "VA" },
    { id: "vaseraga",      name: "Vaseraga",       short: "VS" },
    { id: "versusia",      name: "Versusia",       short: "VE" },
    { id: "vikala",        name: "Vikala",         short: "VI" },
    { id: "vira",          name: "Vira",           short: "VR" },
    { id: "wilnas",        name: "Wilnas",         short: "WI" },
    { id: "yuel",          name: "Yuel",           short: "YU" },
    { id: "zeta",          name: "Zeta",           short: "ZE" },
    { id: "zooey",         name: "Zooey",          short: "ZO" },  ],

  // Ohne Zusatzkauf spielbar - die Besetzung zum Erscheinen.
  baseRoster: [
    "gran", "djeeta", "katalina", "charlotta", "lancelot", "percival",
    "ladiva", "metera", "lowain", "ferry", "zeta", "vaseraga", "narmaya",
    "soriz", "zooey", "cagliostro", "yuel", "anre", "eustace", "seox",
    "vira", "avatarbelial", "beelzebub", "vikala", "siegfried", "grimnir",
    "nier", "beatrix", "sandalphon", "anila", "belial",
  ],

  states: ["jumping", "crouching", "\u{1F3AF} drill"],

  notation: {
    buttons: [
      { id: "L", match: "L", label: "Light",  color: "#7dd3fc", light: "#0284c7",
        sample: "5L", kinds: "L, 2L, j.L, 236L" },
      { id: "M", match: "M", label: "Medium", color: "#fbbf24", light: "#d97706",
        sample: "5M", kinds: "M, 2M, j.M, 214M" },
      { id: "H", match: "H", label: "Heavy",  color: "#f87171", light: "#dc2626",
        sample: "5H", kinds: "H, 2H, j.H, 623H" },
      { id: "U", match: "U", label: "Unique", color: "#c084fc", light: "#7e22ce",
        sample: "236U", kinds: "The unique button: U, 2U, 236U" },
      { id: "X", match: "X", label: "Any strength", color: "#a3e635", light: "#4d7c0f",
        sample: "236X", kinds: "Strength left open: 236X, 214X" },
    ],

    prefixes: ["dl", "j", "c", "f"],
    directions: true,

    // Skybound Arts und die Abwehrmechaniken.
    cancels: {
      forms: ["SSBA", "SBA", "BC", "RS", "DC", "RC"],
      label: "Skybound Arts, defence", sample: "SBA",
      kinds: "SBA, SSBA, BC, RS, DC, RC",
      color: "#38bdf8", light: "#0369a1",
    },

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
        dash: "dash", backdash: "backdash", whiff: "whiff", delay: "delay",
        land: "land", jc: "jc", "66": "66", "44": "44",
      },
    },
  },

  // Himmelblau und Gold, wie das Spiel.
  theme: {
    "--accent": "#38a3e8",
    "--accent-hover": "#57b9f5",
    "--accent-soft": "#07263c",
    "--accent-soft-hover": "#0c3a58",
    "--send-bg": "#38a3e8",
    "--send-bg-hover": "#57b9f5",
    "--send-fg": "#ffffff",
    "--page-bg": "#080b0f",
    "--composer-bg": "#141a20",
    "--surface": "#182027",
  },
};
