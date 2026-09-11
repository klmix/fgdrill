// BlazBlue: Centralfiction
//
// Vier Knoepfe: A, B, C und D. Das D ist der Drive - was es tut, haengt am
// Charakter. Geschrieben wird mit dem Ziffernblock, wie bei Guilty Gear.
const GAME_BBCF = {
  id: "bbcf",
  name: "BlazBlue: Centralfiction",
  short: "BB",
  sharePrefix: "BBCF1-",
  example: "5B > 2C > 236C > 214D",

  characters: [
    { id: "amanenishiki",         name: "Amane Nishiki",           short: "AM" },
    { id: "arakune",              name: "Arakune",                 short: "AR" },
    { id: "azrael",               name: "Azrael",                  short: "AZ" },
    { id: "bangshishigami",       name: "Bang Shishigami",         short: "BA" },
    { id: "bullet",               name: "Bullet",                  short: "BU" },
    { id: "carlclover",           name: "Carl Clover",             short: "CA" },
    { id: "celicaamercury",       name: "Celica A. Mercury",       short: "CE" },
    { id: "es",                   name: "Es",                      short: "ES" },
    { id: "hakumen",              name: "Hakumen",                 short: "HA" },
    { id: "hazama",               name: "Hazama",                  short: "HZ" },
    { id: "hibikikohaku",         name: "Hibiki Kohaku",           short: "HI" },
    { id: "irontager",            name: "Iron Tager",              short: "IR" },
    { id: "izanami",              name: "Izanami",                 short: "IZ" },
    { id: "izayoi",               name: "Izayoi",                  short: "IA" },
    { id: "jinkisaragi",          name: "Jin Kisaragi",            short: "JI" },
    { id: "jubei",                name: "Jubei",                   short: "JU" },
    { id: "kaguramutsuki",        name: "Kagura Mutsuki",          short: "KA" },
    { id: "kokonoe",              name: "Kokonoe",                 short: "KO" },
    { id: "lambda11",             name: "Lambda-11",               short: "LA" },
    { id: "litchifayeling",       name: "Litchi Faye Ling",        short: "LI" },
    { id: "mainatsume",           name: "Mai Natsume",             short: "MA" },
    { id: "makotonanaya",         name: "Makoto Nanaya",           short: "MK" },
    { id: "mu12",                 name: "Mu-12",                   short: "MU" },
    { id: "naotokurogane",        name: "Naoto Kurogane",          short: "NA" },
    { id: "ninethephantom",       name: "Nine the Phantom",        short: "NI" },
    { id: "noelvermillion",       name: "Noel Vermillion",         short: "NO" },
    { id: "nu13",                 name: "Nu-13",                   short: "NU" },
    { id: "platinumthetrinity",   name: "Platinum the Trinity",    short: "PL" },
    { id: "rachelalucard",        name: "Rachel Alucard",          short: "RA" },
    { id: "ragnathebloodedge",    name: "Ragna the Bloodedge",     short: "RG" },
    { id: "reliusclover",         name: "Relius Clover",           short: "RE" },
    { id: "susanoo",              name: "Susano'o",                short: "SU" },
    { id: "taokaka",              name: "Taokaka",                 short: "TA" },
    { id: "trinityglassfille",    name: "Trinity Glassfille",      short: "TR" },
    { id: "tsubakiyayoi",         name: "Tsubaki Yayoi",           short: "TS" },
    { id: "valkenhaynrhellsing",  name: "Valkenhayn R. Hellsing",  short: "VA" },
    { id: "yuukiterumi",          name: "Yuuki Terumi",            short: "YU" },  ],

  // Kein baseRoster: in Centralfiction ist die gesamte Besetzung
  // freigeschaltet, also steht auch jeder als Dummy zur Wahl.

  states: ["jumping", "crouching", "\u{1F3AF} drill"],

  notation: {
    buttons: [
      { id: "A", match: "A", label: "A - light",  color: "#f472b6", light: "#e250a4",
        sample: "5A", kinds: "A, 2A, j.A, 236A" },
      { id: "B", match: "B", label: "B - medium", color: "#60a5fa", light: "#2f8fd8",
        sample: "2B", kinds: "B, 2B, j.B, 214B" },
      { id: "C", match: "C", label: "C - heavy",  color: "#4ade80", light: "#3aa757",
        sample: "5C", kinds: "C, 2C, j.C, 623C" },
      { id: "D", match: "D", label: "D - drive",  color: "#fbbf24", light: "#e8912b",
        sample: "236D", kinds: "The drive button: D, 2D, j.D, 214D" },
    ],

    prefixes: ["hj", "sj", "dj", "tk", "dl", "j", "c", "f"],
    directions: true,

    // Was der Zaehler kostet: Rapid Cancel, Overdrive und die Supers.
    cancels: {
      forms: ["RC", "OD", "EA", "AH", "DD", "CA"],
      label: "Rapid, Overdrive, Supers", sample: "RC",
      kinds: "RC, OD, EA, AH, DD, CA",
      color: "#a78bfa", light: "#8b5cf6",
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
        dash: "dash", whiff: "whiff", delay: "delay", land: "land",
        jc: "jc", hjc: "hjc", dc: "dc", iad: "IAD", "66": "66", "44": "44",
      },
    },
  },

  // Tiefblau mit Rot, wie das Spiel selbst.
  theme: {
    "--accent": "#3b6fe0",
    "--accent-hover": "#5585f0",
    "--accent-soft": "#0d1b3d",
    "--accent-soft-hover": "#14295a",
    "--send-bg": "#3b6fe0",
    "--send-bg-hover": "#5585f0",
    "--send-fg": "#ffffff",
    "--page-bg": "#08090d",
    "--composer-bg": "#14161f",
    "--surface": "#181b26",
  },
};
