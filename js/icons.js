/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Icon-Set
   Eigene SVG-Symbole statt Emoji: überall gleicher Stil,
   kräftige Flächen, dunkle Konturen, Neon-Verläufe.
   Nutzung:  GK.icon('dragon')  → <svg>-Element
             GK.iconHTML('crown') → String fürs innerHTML
   ═══════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  /* Gemeinsame Verläufe — einmal ins Dokument, dann von allen Icons genutzt */
  var DEFS =
    '<linearGradient id="gkg-gold" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#fff3a8"/><stop offset="45%" stop-color="#ffd12e"/><stop offset="100%" stop-color="#f08000"/></linearGradient>' +
    '<linearGradient id="gkg-red" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#ff8fa8"/><stop offset="50%" stop-color="#ff3b6b"/><stop offset="100%" stop-color="#b1002f"/></linearGradient>' +
    '<linearGradient id="gkg-green" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#c6ff9b"/><stop offset="50%" stop-color="#7cff3b"/><stop offset="100%" stop-color="#1f8f16"/></linearGradient>' +
    '<linearGradient id="gkg-cyan" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#b8fbff"/><stop offset="50%" stop-color="#00e5ff"/><stop offset="100%" stop-color="#0067a8"/></linearGradient>' +
    '<linearGradient id="gkg-pink" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#ffb3f0"/><stop offset="50%" stop-color="#ff2fd0"/><stop offset="100%" stop-color="#8b1a7e"/></linearGradient>' +
    '<linearGradient id="gkg-purple" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#c9a6ff"/><stop offset="50%" stop-color="#8b3bff"/><stop offset="100%" stop-color="#3d0b86"/></linearGradient>' +
    '<linearGradient id="gkg-orange" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#ffd08a"/><stop offset="50%" stop-color="#ff8a00"/><stop offset="100%" stop-color="#c03a00"/></linearGradient>' +
    '<linearGradient id="gkg-ice" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#ffffff"/><stop offset="55%" stop-color="#c9ecff"/><stop offset="100%" stop-color="#6fa8d6"/></linearGradient>' +
    '<linearGradient id="gkg-steel" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#f2f5ff"/><stop offset="50%" stop-color="#9aa7c7"/><stop offset="100%" stop-color="#4a5578"/></linearGradient>' +
    '<linearGradient id="gkg-deep" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#3f7fd0"/><stop offset="100%" stop-color="#0d2f5e"/></linearGradient>' +
    '<radialGradient id="gkg-pearl" cx="35%" cy="30%" r="75%">' +
      '<stop offset="0%" stop-color="#ffffff"/><stop offset="55%" stop-color="#e8d9ff"/><stop offset="100%" stop-color="#9b7fd4"/></radialGradient>' +
    '<linearGradient id="gkg-wood" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#c98a4b"/><stop offset="100%" stop-color="#6b3d12"/></linearGradient>';

  var OUT = '#20003f';   // Konturfarbe

  function s(d, fill, extra) {
    return '<path d="' + d + '" fill="' + fill + '" stroke="' + OUT + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"' + (extra || '') + '/>';
  }

  /* ── Die Icons. Alle im Raster 0 0 64 64. ── */
  var I = GK.ICONS = {

    /* ═══ Klassiker ═══ */
    crown:
      s('M8 46 L4 16 L20 27 L32 8 L44 27 L60 16 L56 46 Z', 'url(#gkg-gold)') +
      s('M8 46 h48 v9 a3 3 0 0 1 -3 3 H11 a3 3 0 0 1 -3 -3 Z', 'url(#gkg-gold)') +
      '<circle cx="4" cy="14" r="4" fill="#ff2fd0" stroke="' + OUT + '" stroke-width="2"/>' +
      '<circle cx="32" cy="6" r="4.5" fill="#00e5ff" stroke="' + OUT + '" stroke-width="2"/>' +
      '<circle cx="60" cy="14" r="4" fill="#ff2fd0" stroke="' + OUT + '" stroke-width="2"/>' +
      '<circle cx="20" cy="51" r="2.4" fill="#20003f"/><circle cx="32" cy="51" r="2.4" fill="#20003f"/><circle cx="44" cy="51" r="2.4" fill="#20003f"/>',

    dragon:
      /* Kopf im Profil mit Horn, Kiefer und Zähnen */
      s('M6 40 C6 24 18 12 34 12 C44 12 52 17 55 25 L60 22 L58 31 C60 36 59 42 55 46 L58 54 L48 50 C42 53 34 54 27 52 L16 56 L19 47 C12 46 6 44 6 40 Z', 'url(#gkg-green)') +
      s('M34 12 L30 2 L41 9 Z', 'url(#gkg-orange)') +
      s('M45 12 L48 3 L53 13 Z', 'url(#gkg-orange)') +
      '<circle cx="44" cy="27" r="5.2" fill="#fff" stroke="' + OUT + '" stroke-width="2"/>' +
      '<ellipse cx="45.5" cy="27" rx="2" ry="4" fill="#20003f"/>' +
      '<path d="M55 40 L50 44 L46 40 L42 44 L38 40" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M12 30 q6 -4 12 0" fill="none" stroke="#1f8f16" stroke-width="3" stroke-linecap="round"/>',

    gem:
      s('M12 24 L22 10 L42 10 L52 24 L32 56 Z', 'url(#gkg-cyan)') +
      '<path d="M12 24 H52" stroke="' + OUT + '" stroke-width="2.2"/>' +
      '<path d="M22 10 L26 24 L32 56 L38 24 L42 10" fill="none" stroke="' + OUT + '" stroke-width="2.2"/>' +
      '<path d="M22 10 L26 24 L12 24 Z" fill="#ffffff" opacity=".38"/>',

    cherry:
      '<path d="M30 10 C38 6 50 8 56 16" fill="none" stroke="#2f7d1f" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M30 10 C24 18 20 28 20 36" fill="none" stroke="#2f7d1f" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M30 10 C36 20 40 30 42 38" fill="none" stroke="#2f7d1f" stroke-width="4" stroke-linecap="round"/>' +
      s('M30 8 C36 2 48 2 52 8 C46 12 36 13 30 8 Z', 'url(#gkg-green)') +
      '<circle cx="19" cy="44" r="12" fill="url(#gkg-red)" stroke="' + OUT + '" stroke-width="2.2"/>' +
      '<circle cx="44" cy="46" r="11" fill="url(#gkg-red)" stroke="' + OUT + '" stroke-width="2.2"/>' +
      '<ellipse cx="15" cy="40" rx="3.4" ry="2.4" fill="#fff" opacity=".65" transform="rotate(-30 15 40)"/>',

    clover:
      '<path d="M32 34 C32 44 30 52 26 58" fill="none" stroke="#2f7d1f" stroke-width="4" stroke-linecap="round"/>' +
      s('M32 32 C32 32 20 30 16 24 C12 18 18 10 26 13 C31 15 32 24 32 32 Z', 'url(#gkg-green)') +
      s('M32 32 C32 32 44 30 48 24 C52 18 46 10 38 13 C33 15 32 24 32 32 Z', 'url(#gkg-green)') +
      s('M32 32 C32 32 22 40 18 44 C13 49 19 57 26 53 C31 50 32 38 32 32 Z', 'url(#gkg-green)') +
      s('M32 32 C32 32 42 40 46 44 C51 49 45 57 38 53 C33 50 32 38 32 32 Z', 'url(#gkg-green)'),

    bell:
      s('M32 8 C20 8 14 18 14 30 C14 40 10 44 8 48 H56 C54 44 50 40 50 30 C50 18 44 8 32 8 Z', 'url(#gkg-gold)') +
      '<circle cx="32" cy="6" r="4" fill="url(#gkg-gold)" stroke="' + OUT + '" stroke-width="2.2"/>' +
      s('M25 48 a7 7 0 0 0 14 0 Z', 'url(#gkg-orange)') +
      '<path d="M22 22 q2 -8 9 -10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>',

    star:
      s('M32 4 L40 23 L61 25 L45 39 L50 59 L32 48 L14 59 L19 39 L3 25 L24 23 Z', 'url(#gkg-gold)') +
      '<path d="M32 14 L36 25 L47 26" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>',

    flame:
      s('M32 4 C36 16 48 20 48 34 C48 46 41 56 32 60 C23 56 16 46 16 34 C16 24 24 20 26 12 C28 18 32 18 32 4 Z', 'url(#gkg-orange)') +
      s('M32 28 C34 34 40 36 40 42 C40 50 36 55 32 57 C28 55 24 50 24 42 C24 36 30 34 32 28 Z', '#ffe66a'),

    coin:
      '<circle cx="32" cy="32" r="27" fill="url(#gkg-gold)" stroke="' + OUT + '" stroke-width="2.6"/>' +
      '<circle cx="32" cy="32" r="20" fill="none" stroke="#a35b00" stroke-width="2.4" opacity=".65"/>' +
      s('M20 38 L18 22 L26 28 L32 18 L38 28 L46 22 L44 38 Z', '#ffeb9c') +
      '<ellipse cx="22" cy="18" rx="5" ry="3.4" fill="#fff" opacity=".55" transform="rotate(-35 22 18)"/>',

    /* ═══ Spielhallen-Kacheln ═══ */
    slotmachine:
      s('M8 18 h48 a4 4 0 0 1 4 4 v34 a4 4 0 0 1 -4 4 H8 a4 4 0 0 1 -4 -4 V22 a4 4 0 0 1 4 -4 Z', 'url(#gkg-purple)') +
      s('M10 8 h44 l-4 10 H14 Z', 'url(#gkg-pink)') +
      '<rect x="10" y="26" width="14" height="16" rx="3" fill="#12002b" stroke="' + OUT + '" stroke-width="2"/>' +
      '<rect x="25" y="26" width="14" height="16" rx="3" fill="#12002b" stroke="' + OUT + '" stroke-width="2"/>' +
      '<rect x="40" y="26" width="14" height="16" rx="3" fill="#12002b" stroke="' + OUT + '" stroke-width="2"/>' +
      '<circle cx="17" cy="34" r="4" fill="#ffd12e"/><circle cx="32" cy="34" r="4" fill="#ff2fd0"/><circle cx="47" cy="34" r="4" fill="#00e5ff"/>' +
      '<rect x="14" y="48" width="36" height="6" rx="3" fill="#12002b" opacity=".6"/>',

    roulettewheel:
      '<circle cx="32" cy="34" r="26" fill="#20003f" stroke="url(#gkg-gold)" stroke-width="4"/>' +
      '<path d="M32 34 L32 8 A26 26 0 0 1 50 15 Z" fill="#c81b3c"/>' +
      '<path d="M32 34 L50 15 A26 26 0 0 1 56 40 Z" fill="#171021"/>' +
      '<path d="M32 34 L56 40 A26 26 0 0 1 36 59 Z" fill="#c81b3c"/>' +
      '<path d="M32 34 L36 59 A26 26 0 0 1 12 50 Z" fill="#171021"/>' +
      '<path d="M32 34 L12 50 A26 26 0 0 1 32 8 Z" fill="#0f8a3c"/>' +
      '<circle cx="32" cy="34" r="8" fill="url(#gkg-gold)" stroke="' + OUT + '" stroke-width="2"/>' +
      '<circle cx="44" cy="18" r="3.4" fill="#fff" stroke="' + OUT + '" stroke-width="1.6"/>',

    cards:
      s('M14 20 l16 -8 18 32 -16 10 Z', '#e8ecfa', ' transform="rotate(-12 32 32)"') +
      s('M22 14 h24 a3 3 0 0 1 3 3 v34 a3 3 0 0 1 -3 3 H22 a3 3 0 0 1 -3 -3 V17 a3 3 0 0 1 3 -3 Z', '#ffffff') +
      '<path d="M34 22 c-5 6 -10 9 -10 14 a5 5 0 0 0 10 2 a5 5 0 0 0 10 -2 c0 -5 -5 -8 -10 -14 Z" fill="#20003f"/>' +
      '<rect x="30" y="40" width="8" height="7" rx="2" fill="#20003f"/>',

    dice:
      s('M12 12 h40 a6 6 0 0 1 6 6 v28 a6 6 0 0 1 -6 6 H12 a6 6 0 0 1 -6 -6 V18 a6 6 0 0 1 6 -6 Z', '#f4f7ff') +
      '<circle cx="19" cy="21" r="4.2" fill="#20003f"/><circle cx="45" cy="21" r="4.2" fill="#20003f"/>' +
      '<circle cx="32" cy="32" r="4.2" fill="#ff2fd0"/>' +
      '<circle cx="19" cy="43" r="4.2" fill="#20003f"/><circle cx="45" cy="43" r="4.2" fill="#20003f"/>',

    rocket:
      s('M32 2 C42 12 46 24 46 34 L40 46 H24 L18 34 C18 24 22 12 32 2 Z', 'url(#gkg-steel)') +
      s('M18 30 L6 44 L18 42 Z', 'url(#gkg-red)') +
      s('M46 30 L58 44 L46 42 Z', 'url(#gkg-red)') +
      '<circle cx="32" cy="24" r="7" fill="url(#gkg-cyan)" stroke="' + OUT + '" stroke-width="2.2"/>' +
      s('M25 46 C27 54 29 58 32 62 C35 58 37 54 39 46 Z', 'url(#gkg-orange)') +
      '<path d="M30 50 C31 54 31 56 32 58 C33 56 33 54 34 50 Z" fill="#ffe66a"/>',

    fortune:
      '<circle cx="32" cy="36" r="25" fill="#20003f" stroke="url(#gkg-gold)" stroke-width="4"/>' +
      '<path d="M32 36 L32 11 A25 25 0 0 1 53 24 Z" fill="#ff2fd0"/>' +
      '<path d="M32 36 L53 24 A25 25 0 0 1 49 53 Z" fill="#ffd12e"/>' +
      '<path d="M32 36 L49 53 A25 25 0 0 1 15 53 Z" fill="#00e5ff"/>' +
      '<path d="M32 36 L15 53 A25 25 0 0 1 11 24 Z" fill="#7cff3b"/>' +
      '<path d="M32 36 L11 24 A25 25 0 0 1 32 11 Z" fill="#8b3bff"/>' +
      '<circle cx="32" cy="36" r="6" fill="url(#gkg-gold)" stroke="' + OUT + '" stroke-width="2"/>' +
      s('M32 2 L38 12 H26 Z', 'url(#gkg-red)'),

    plinko:
      '<circle cx="32" cy="10" r="6" fill="url(#gkg-gold)" stroke="' + OUT + '" stroke-width="2.2"/>' +
      '<g fill="#00e5ff">' +
      '<circle cx="32" cy="24" r="3.4"/><circle cx="22" cy="34" r="3.4"/><circle cx="42" cy="34" r="3.4"/>' +
      '<circle cx="12" cy="44" r="3.4"/><circle cx="32" cy="44" r="3.4"/><circle cx="52" cy="44" r="3.4"/></g>' +
      '<rect x="4" y="54" width="16" height="8" rx="2" fill="#ff3b6b" stroke="' + OUT + '" stroke-width="2"/>' +
      '<rect x="24" y="54" width="16" height="8" rx="2" fill="#7cff3b" stroke="' + OUT + '" stroke-width="2"/>' +
      '<rect x="44" y="54" width="16" height="8" rx="2" fill="#ff3b6b" stroke="' + OUT + '" stroke-width="2"/>',

    ticket:
      s('M6 18 h52 a2 2 0 0 1 2 2 v8 a5 5 0 0 0 0 10 v8 a2 2 0 0 1 -2 2 H6 a2 2 0 0 1 -2 -2 v-8 a5 5 0 0 0 0 -10 v-8 a2 2 0 0 1 2 -2 Z', 'url(#gkg-gold)') +
      '<path d="M24 20 v24" stroke="' + OUT + '" stroke-width="2.4" stroke-dasharray="4 4"/>' +
      s('M40 24 L43 31 L50 32 L45 37 L46 44 L40 40 L34 44 L35 37 L30 32 L37 31 Z', '#fff6b0'),

    /* Rubbellos mit neun Feldern — die Diagonale ist schon frei gerubbelt */
    ticket9:
      s('M7 9 h50 a4 4 0 0 1 4 4 v38 a4 4 0 0 1 -4 4 H7 a4 4 0 0 1 -4 -4 V13 a4 4 0 0 1 4 -4 Z', 'url(#gkg-cyan)') +
      '<g stroke="' + OUT + '" stroke-width="1.8">' +
        '<rect x="10" y="14" width="13" height="12" rx="3" fill="url(#gkg-gold)"/>' +
        '<rect x="25.5" y="14" width="13" height="12" rx="3" fill="#1c0138"/>' +
        '<rect x="41" y="14" width="13" height="12" rx="3" fill="#1c0138"/>' +
        '<rect x="10" y="27.5" width="13" height="12" rx="3" fill="#1c0138"/>' +
        '<rect x="25.5" y="27.5" width="13" height="12" rx="3" fill="url(#gkg-gold)"/>' +
        '<rect x="41" y="27.5" width="13" height="12" rx="3" fill="#1c0138"/>' +
        '<rect x="10" y="41" width="13" height="12" rx="3" fill="#1c0138"/>' +
        '<rect x="25.5" y="41" width="13" height="12" rx="3" fill="#1c0138"/>' +
        '<rect x="41" y="41" width="13" height="12" rx="3" fill="url(#gkg-gold)"/>' +
      '</g>' +
      '<path d="M16 20 L32 33.5 L47.5 47" fill="none" stroke="#fff6b0" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>',

    /* Mysterien-Maske: Goldrand, glühende Augenschlitze, Stein auf der Stirn */
    mask:
      s('M15 11 L7 1 L21 7 Z', 'url(#gkg-gold)') +
      s('M49 11 L57 1 L43 7 Z', 'url(#gkg-gold)') +
      s('M32 6 C47 6 58 13 58 24 C58 41 46 55 32 61 C18 55 6 41 6 24 C6 13 17 6 32 6 Z', 'url(#gkg-gold)') +
      s('M32 12 C44 12 52 17 52 25 C52 39 43 49 32 54 C21 49 12 39 12 25 C12 17 20 12 32 12 Z', '#2b0a4d') +
      '<path d="M17 28 q7 -9 15 -3 q-7 9 -15 3 Z" fill="url(#gkg-cyan)" stroke="' + OUT + '" stroke-width="1.8"/>' +
      '<path d="M47 28 q-7 -9 -15 -3 q7 9 15 3 Z" fill="url(#gkg-cyan)" stroke="' + OUT + '" stroke-width="1.8"/>' +
      '<circle cx="32" cy="18" r="3.6" fill="#ff2fd0" stroke="' + OUT + '" stroke-width="1.8"/>' +
      '<path d="M25 41 q7 6 14 0" fill="none" stroke="#ff2fd0" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M32 45 v5" stroke="#ff2fd0" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>',

    /* Ganzes Pferd im Profil. Der Körper nimmt currentColor an,
       damit jedes Pferd im Rennen seine eigene Farbe bekommt. */
    horse:
      /* Schweif */
      '<path d="M15 26 C6 23 3 34 8 44" fill="none" stroke="#2a170a" stroke-width="6" stroke-linecap="round"/>' +
      /* hintere Beinpaare, etwas abgedunkelt */
      '<g fill="currentColor" opacity=".55" stroke="#2a170a" stroke-width="2">' +
        '<path d="M19 36 h7 v20 h-7 Z"/><path d="M37 36 h7 v20 h-7 Z"/></g>' +
      /* Rumpf */
      s('M14 27 C14 21 19 17 27 17 L38 17 C44 17 48 21 48 27 L48 36 C48 40 45 42 40 42 L21 42 C16 42 14 39 14 34 Z', 'currentColor') +
      /* Hals */
      s('M39 25 L45 8 L55 12 L50 30 Z', 'currentColor') +
      /* Kopf mit Maul */
      s('M45 8 C49 3 57 3 60 8 L63 15 C63 18 60 20 57 19 L49 16 Z', 'currentColor') +
      /* Ohr */
      s('M47 7 L46 1 L52 5 Z', 'currentColor') +
      /* Mähne */
      '<path d="M43 7 C47 12 49 20 49 29" fill="none" stroke="#2a170a" stroke-width="5" stroke-linecap="round"/>' +
      '<circle cx="55" cy="11" r="2.1" fill="#2a170a"/>' +
      /* vordere Beinpaare */
      '<g fill="currentColor" stroke="#2a170a" stroke-width="2.2">' +
        '<path d="M23 38 h7 v20 h-7 Z"/><path d="M41 38 h7 v20 h-7 Z"/></g>' +
      /* Hufe */
      '<g fill="#2a170a">' +
        '<rect x="18" y="53" width="9" height="5" rx="2"/><rect x="36" y="53" width="9" height="5" rx="2"/>' +
        '<rect x="22" y="55" width="9" height="5" rx="2"/><rect x="40" y="55" width="9" height="5" rx="2"/></g>',

    bear:
      /* Eisbär-Kopf */
      '<circle cx="15" cy="16" r="8" fill="url(#gkg-ice)" stroke="' + OUT + '" stroke-width="2.2"/>' +
      '<circle cx="49" cy="16" r="8" fill="url(#gkg-ice)" stroke="' + OUT + '" stroke-width="2.2"/>' +
      '<circle cx="32" cy="34" r="24" fill="url(#gkg-ice)" stroke="' + OUT + '" stroke-width="2.4"/>' +
      '<ellipse cx="32" cy="44" rx="13" ry="10" fill="#ffffff" stroke="' + OUT + '" stroke-width="2"/>' +
      '<circle cx="23" cy="30" r="3.2" fill="#20003f"/><circle cx="41" cy="30" r="3.2" fill="#20003f"/>' +
      '<ellipse cx="32" cy="40" rx="5" ry="3.6" fill="#20003f"/>' +
      '<path d="M32 44 v5 M32 49 q-4 3 -7 1 M32 49 q4 3 7 1" fill="none" stroke="' + OUT + '" stroke-width="2.2" stroke-linecap="round"/>',

    floe:
      s('M6 40 L14 20 L34 14 L52 22 L58 42 L40 54 L16 52 Z', 'url(#gkg-ice)') +
      '<path d="M14 20 L28 32 L52 22 M28 32 L24 52 M28 32 L52 42" fill="none" stroke="#7fb4dd" stroke-width="2.4"/>',

    wave:
      s('M2 34 q10 -14 20 0 t20 0 t20 0 v20 H2 Z', 'url(#gkg-deep)') +
      '<path d="M2 44 q10 -10 20 0 t20 0 t20 0" fill="none" stroke="#8fd0ff" stroke-width="3" opacity=".7"/>',

    /* ═══ Tiefsee ═══ */
    fish:
      s('M8 32 C16 18 34 16 44 24 L58 14 L54 32 L58 50 L44 40 C34 48 16 46 8 32 Z', 'url(#gkg-cyan)') +
      '<circle cx="22" cy="28" r="4" fill="#fff" stroke="' + OUT + '" stroke-width="1.8"/>' +
      '<circle cx="22.8" cy="28" r="1.9" fill="#20003f"/>' +
      '<path d="M32 20 q4 12 0 24" fill="none" stroke="#0d7fa8" stroke-width="3" opacity=".7"/>',

    reeffish:
      s('M6 32 C14 16 34 14 46 22 L58 12 L55 32 L58 52 L46 42 C34 50 14 48 6 32 Z', 'url(#gkg-orange)') +
      '<path d="M20 20 q4 12 0 24" fill="none" stroke="#20003f" stroke-width="4"/>' +
      '<path d="M32 17 q4 15 0 30" fill="none" stroke="#fff" stroke-width="4"/>' +
      '<path d="M42 21 q4 11 0 22" fill="none" stroke="#20003f" stroke-width="4"/>' +
      '<circle cx="14" cy="29" r="3.6" fill="#fff" stroke="' + OUT + '" stroke-width="1.8"/>' +
      '<circle cx="14.6" cy="29" r="1.7" fill="#20003f"/>',

    shark:
      s('M2 40 C10 26 26 20 42 22 L36 8 L52 22 C58 24 62 30 62 34 C58 40 48 44 38 46 L44 58 L28 46 C16 46 6 44 2 40 Z', '#8fa4c4') +
      '<path d="M2 40 C10 34 30 32 62 34 C58 40 48 44 38 46 L44 58 L28 46 C16 46 6 44 2 40 Z" fill="#e6ecf7" stroke="' + OUT + '" stroke-width="2.2"/>' +
      '<circle cx="20" cy="32" r="3" fill="#20003f"/>' +
      '<path d="M6 38 L10 42 L14 38 L18 42 L22 38" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',

    octopus:
      s('M32 6 C46 6 54 16 54 28 C54 34 52 38 50 42 H14 C12 38 10 34 10 28 C10 16 18 6 32 6 Z', 'url(#gkg-pink)') +
      '<path d="M16 42 q-6 8 -2 16 M25 42 q-4 10 2 16 M39 42 q4 10 -2 16 M48 42 q6 8 2 16" fill="none" stroke="#ff2fd0" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M16 42 q-6 8 -2 16 M25 42 q-4 10 2 16 M39 42 q4 10 -2 16 M48 42 q6 8 2 16" fill="none" stroke="' + OUT + '" stroke-width="2" stroke-linecap="round" opacity=".5"/>' +
      '<circle cx="24" cy="26" r="6" fill="#fff" stroke="' + OUT + '" stroke-width="2"/>' +
      '<circle cx="42" cy="26" r="6" fill="#fff" stroke="' + OUT + '" stroke-width="2"/>' +
      '<circle cx="25" cy="27" r="2.8" fill="#20003f"/><circle cx="43" cy="27" r="2.8" fill="#20003f"/>',

    crab:
      s('M14 34 C14 26 22 20 32 20 C42 20 50 26 50 34 C50 42 42 46 32 46 C22 46 14 42 14 34 Z', 'url(#gkg-red)') +
      s('M14 30 C6 28 2 20 6 14 C10 10 18 12 18 20 L22 26 Z', 'url(#gkg-red)') +
      s('M50 30 C58 28 62 20 58 14 C54 10 46 12 46 20 L42 26 Z', 'url(#gkg-red)') +
      '<path d="M18 46 l-6 10 M26 47 l-3 11 M38 47 l3 11 M46 46 l6 10" fill="none" stroke="#b1002f" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="25" cy="16" r="4" fill="#fff" stroke="' + OUT + '" stroke-width="2"/>' +
      '<circle cx="39" cy="16" r="4" fill="#fff" stroke="' + OUT + '" stroke-width="2"/>' +
      '<circle cx="25" cy="16" r="1.9" fill="#20003f"/><circle cx="39" cy="16" r="1.9" fill="#20003f"/>' +
      '<path d="M23 32 q9 6 18 0" fill="none" stroke="' + OUT + '" stroke-width="2.4" stroke-linecap="round"/>',

    shell:
      s('M32 56 C12 56 4 40 8 26 C12 12 24 6 32 6 C40 6 52 12 56 26 C60 40 52 56 32 56 Z', 'url(#gkg-pink)') +
      '<path d="M32 8 V56 M20 10 C16 24 16 42 22 55 M44 10 C48 24 48 42 42 55 M11 20 C10 34 14 48 20 55 M53 20 C54 34 50 48 44 55" fill="none" stroke="' + OUT + '" stroke-width="2" opacity=".55"/>' +
      '<ellipse cx="32" cy="9" rx="7" ry="4" fill="#ffd7f5" stroke="' + OUT + '" stroke-width="2"/>',

    kelp:
      /* Tangbüschel: drei breite Wedel aus einem Wurzelballen. Gleich dicke
         Striche sähen aus wie Schläuche — deshalb geschlossene Blattformen
         mit gewellter Kante, Mittelrippe und Schwimmblasen. */
      s('M28 60 q-4 -7 -6 -12 q-5 -6 -6 -12 q-5 -7 -4 -13 q0 -6 4 -9 ' +
        'q6 8 6 17 q2 8 3 15 q2 7 3 14 Z', '#1f8f16') +
      s('M36 60 q4 -7 6 -12 q5 -6 6 -12 q5 -7 4 -13 q0 -6 -4 -9 ' +
        'q-6 8 -6 17 q-2 8 -3 15 q-2 7 -3 14 Z', '#2fbf20') +
      s('M32 59 q-7 -5 -6 -10 q-3 -6 -1 -11 q-4 -5 -3 -11 q-2 -7 2 -12 q2 -6 7 -11 ' +
        'q6 6 7 12 q4 6 2 12 q-1 6 -2 11 q0 6 -2 10 q1 5 -4 10 Z', 'url(#gkg-green)') +
      s('M20 55 q12 -5 24 0 q3 7 -4 7 H24 q-7 0 -4 -7 Z', '#155c10') +
      /* Mittelrippen bleiben innerhalb der Wedel — sonst schauen sie unten
         als graue Stiele aus dem Blatt heraus. */
      '<path d="M31 15 C30 27 33 40 32 51 M16 20 C17 27 19 34 22 42 M48 20 C47 27 45 34 42 42" ' +
        'fill="none" stroke="#e6ffd0" stroke-width="2" opacity=".4" stroke-linecap="round"/>' +
      /* Schwimmblasen: helle Beulen an der Blattkante, bewusst ohne dunkle
         Kontur — mit Rand sehen sie aus wie Augen. */
      '<ellipse cx="27" cy="25" rx="2.2" ry="2.9" fill="#e4ffc4" opacity=".8"/>' +
      '<ellipse cx="29" cy="39" rx="1.9" ry="2.5" fill="#e4ffc4" opacity=".65"/>' +
      '<ellipse cx="43" cy="31" rx="1.7" ry="2.3" fill="#e4ffc4" opacity=".6"/>',

    pearl:
      s('M6 44 C6 30 18 22 32 22 C46 22 58 30 58 44 C48 52 16 52 6 44 Z', '#f0d5ff') +
      '<circle cx="32" cy="30" r="16" fill="url(#gkg-pearl)" stroke="' + OUT + '" stroke-width="2.2"/>' +
      '<ellipse cx="26" cy="24" rx="5" ry="3.4" fill="#fff" opacity=".85" transform="rotate(-30 26 24)"/>' +
      '<path d="M14 44 q18 6 36 0" fill="none" stroke="' + OUT + '" stroke-width="2" opacity=".5"/>',

    trident:
      /* Schaft liegt hinten, darüber die Gabel als eine Silhouette */
      s('M28.5 30 h7 v30 a3.5 3.5 0 0 1 -7 0 Z', 'url(#gkg-gold)') +
      s('M32 2 L36.5 15 L36.5 26 L43 26 L43 14 L47.5 4 L52 14 L52 28 ' +
        'Q52 36 44 36 L20 36 Q12 36 12 28 L12 14 L16.5 4 L21 14 L21 26 ' +
        'L27.5 26 L27.5 15 Z', 'url(#gkg-gold)') +
      '<rect x="24.5" y="37" width="15" height="7" rx="3.5" fill="url(#gkg-gold)" stroke="' + OUT + '" stroke-width="2.2"/>' +
      '<path d="M16.5 8 L16.5 22 M32 7 L32 22 M47.5 8 L47.5 22" fill="none" stroke="#fff6b0" stroke-width="2" opacity=".55" stroke-linecap="round"/>',

    penguin:
      /* Frontal, Flossen seitlich, Füße unten */
      s('M13 30 C7 36 7 47 12 52 L18 40 Z', '#243055') +
      s('M51 30 C57 36 57 47 52 52 L46 40 Z', '#243055') +
      '<ellipse cx="24" cy="57" rx="7" ry="4" fill="url(#gkg-orange)" stroke="' + OUT + '" stroke-width="2"/>' +
      '<ellipse cx="40" cy="57" rx="7" ry="4" fill="url(#gkg-orange)" stroke="' + OUT + '" stroke-width="2"/>' +
      s('M32 6 C20 6 14 17 14 30 C14 46 21 57 32 57 C43 57 50 46 50 30 C50 17 44 6 32 6 Z', '#2b3a66') +
      s('M32 20 C25 20 21 28 21 38 C21 49 26 55 32 55 C38 55 43 49 43 38 C43 28 39 20 32 20 Z', '#f4f8ff') +
      '<circle cx="25" cy="24" r="4.6" fill="#fff" stroke="' + OUT + '" stroke-width="1.8"/>' +
      '<circle cx="39" cy="24" r="4.6" fill="#fff" stroke="' + OUT + '" stroke-width="1.8"/>' +
      '<circle cx="26" cy="25" r="2.1" fill="#20003f"/><circle cx="40" cy="25" r="2.1" fill="#20003f"/>' +
      s('M26 31 H38 L32 39 Z', 'url(#gkg-orange)'),

    poker:
      /* Zwei Karten im Fächer, davor ein Chip */
      s('M16 14 h22 a5 5 0 0 1 5 5 v30 a5 5 0 0 1 -5 5 H16 a5 5 0 0 1 -5 -5 V19 a5 5 0 0 1 5 -5 Z',
        'url(#gkg-steel)', ' transform="rotate(-20 27 34)"') +
      s('M24 8 h22 a5 5 0 0 1 5 5 v34 a5 5 0 0 1 -5 5 H24 a5 5 0 0 1 -5 -5 V13 a5 5 0 0 1 5 -5 Z',
        '#f6f9ff', ' transform="rotate(7 35 30)"') +
      '<path d="M38 18 C32 24 28 27 28 32 C28 36 32 38 35 35 L33 42 H43 L41 35 C44 38 48 36 48 32 ' +
        'C48 27 44 24 38 18 Z" fill="#20003f" transform="rotate(7 35 30)"/>' +
      '<circle cx="20" cy="47" r="13" fill="url(#gkg-gold)" stroke="' + OUT + '" stroke-width="2.2"/>' +
      '<circle cx="20" cy="47" r="6.5" fill="none" stroke="' + OUT + '" stroke-width="2" opacity=".55"/>' +
      '<path d="M20 35 v4.5 M20 54.5 v4.5 M8 47 h4.5 M27.5 47 h4.5" stroke="' + OUT +
        '" stroke-width="2.6" stroke-linecap="round"/>',

    chest:
      s('M6 30 C6 18 16 10 32 10 C48 10 58 18 58 30 Z', 'url(#gkg-wood)') +
      s('M6 30 h52 v22 a4 4 0 0 1 -4 4 H10 a4 4 0 0 1 -4 -4 Z', 'url(#gkg-wood)') +
      '<rect x="4" y="27" width="56" height="7" rx="3" fill="url(#gkg-gold)" stroke="' + OUT + '" stroke-width="2.2"/>' +
      '<rect x="26" y="30" width="12" height="14" rx="3" fill="url(#gkg-gold)" stroke="' + OUT + '" stroke-width="2.2"/>' +
      '<circle cx="32" cy="37" r="2.6" fill="#20003f"/>' +
      '<circle cx="16" cy="20" r="4" fill="#ffd12e" opacity=".8"/><circle cx="48" cy="20" r="4" fill="#ffd12e" opacity=".8"/>',

    /* ═══ Zubehör ═══ */
    lock:
      s('M18 28 v-6 a14 14 0 0 1 28 0 v6', 'none') +
      '<path d="M18 28 v-6 a14 14 0 0 1 28 0 v6" fill="none" stroke="' + OUT + '" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M18 28 v-6 a14 14 0 0 1 28 0 v6" fill="none" stroke="#c9d3ea" stroke-width="3" stroke-linecap="round"/>' +
      s('M12 28 h40 a4 4 0 0 1 4 4 v22 a4 4 0 0 1 -4 4 H12 a4 4 0 0 1 -4 -4 V32 a4 4 0 0 1 4 -4 Z', 'url(#gkg-gold)') +
      '<circle cx="32" cy="41" r="5" fill="#20003f"/><rect x="30" y="41" width="4" height="9" rx="2" fill="#20003f"/>',

    trophy:
      s('M18 8 h28 v14 c0 10 -6 16 -14 16 C24 38 18 32 18 22 Z', 'url(#gkg-gold)') +
      '<path d="M18 12 H10 c0 10 4 14 9 15 M46 12 h8 c0 10 -4 14 -9 15" fill="none" stroke="' + OUT + '" stroke-width="3.4" stroke-linecap="round"/>' +
      s('M28 38 h8 v10 h-8 Z', 'url(#gkg-gold)') +
      s('M18 48 h28 v8 H18 Z', 'url(#gkg-gold)') +
      '<path d="M32 16 l2 5 h5 l-4 4 1 5 -4 -3 -4 3 1 -5 -4 -4 h5 Z" fill="#fff6b0"/>',

    skull:
      s('M32 6 C18 6 8 16 8 30 C8 38 12 44 18 47 v7 a3 3 0 0 0 3 3 h22 a3 3 0 0 0 3 -3 v-7 c6 -3 10 -9 10 -17 C56 16 46 6 32 6 Z', '#eef2fb') +
      '<circle cx="22" cy="30" r="6.5" fill="#20003f"/><circle cx="42" cy="30" r="6.5" fill="#20003f"/>' +
      '<path d="M32 38 l-4 7 h8 Z" fill="#20003f"/>' +
      '<path d="M25 50 v7 M32 50 v7 M39 50 v7" stroke="' + OUT + '" stroke-width="2.4"/>',

    question:
      '<circle cx="32" cy="32" r="26" fill="url(#gkg-purple)" stroke="' + OUT + '" stroke-width="2.6"/>' +
      '<path d="M23 24 a9 9 0 1 1 12 9 v5" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>' +
      '<circle cx="35" cy="46" r="4" fill="#fff"/>',

    key:
      '<circle cx="22" cy="18" r="11" fill="none" stroke="' + OUT + '" stroke-width="9"/>' +
      '<circle cx="22" cy="18" r="11" fill="none" stroke="url(#gkg-gold)" stroke-width="6"/>' +
      s('M19 17 h6 v39 a3 3 0 0 1 -6 0 Z', 'url(#gkg-gold)') +
      '<rect x="25" y="43" width="9" height="6" rx="1.6" fill="url(#gkg-gold)" stroke="' + OUT + '" stroke-width="2"/>' +
      '<rect x="25" y="52" width="11" height="6" rx="1.6" fill="url(#gkg-gold)" stroke="' + OUT + '" stroke-width="2"/>' +
      '<ellipse cx="18" cy="14" rx="2.6" ry="1.8" fill="#fff" opacity=".6" transform="rotate(-30 18 14)"/>',

    potion:
      s('M27 4 h10 v11 l9 15 a15 15 0 1 1 -28 0 L27 15 Z', 'url(#gkg-cyan)') +
      s('M25 4 h14 a2.5 2.5 0 0 1 0 5 H25 a2.5 2.5 0 0 1 0 -5 Z', 'url(#gkg-steel)') +
      '<path d="M18 40 a14 14 0 0 0 28 0 Z" fill="#8b3bff" opacity=".55"/>' +
      '<circle cx="26" cy="38" r="2.6" fill="#fff" opacity=".75"/><circle cx="37" cy="45" r="1.8" fill="#fff" opacity=".65"/>' +
      '<circle cx="32" cy="34" r="2.1" fill="#fff" opacity=".6"/>',

    bomb:
      '<circle cx="28" cy="38" r="20" fill="#2b2b3d" stroke="' + OUT + '" stroke-width="2.4"/>' +
      '<rect x="38" y="12" width="10" height="10" rx="2" fill="#5a5a72" stroke="' + OUT + '" stroke-width="2" transform="rotate(35 43 17)"/>' +
      '<path d="M48 14 C56 8 58 4 56 2" fill="none" stroke="#ff8a00" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="57" cy="2" r="4" fill="#ffd12e"/>' +
      '<ellipse cx="20" cy="30" rx="6" ry="4" fill="#fff" opacity=".28" transform="rotate(-35 20 30)"/>'
  };

  /* Vom Nutzer gestellte Drachenköpfe — Rasterbilder statt Vektor, deshalb
     getrennt vom `I`-Set. Vier Farben, damit jedes Drachen-Spiel sein
     eigenes Gesicht bekommt statt überall dasselbe Symbol zu zeigen. */
  var DRAGON_IMGS = {
    dragonred:    'assets/dragons/red.webp',
    dragonblue:   'assets/dragons/blue.webp',
    dragongreen:  'assets/dragons/green.webp',
    dragonpurple: 'assets/dragons/purple.webp'
  };

  /* Das gemalte Symbolset. Wo ein Name hier steht, gewinnt das Bild gegen das
     gezeichnete SVG weiter unten — so wandern die Artworks in einem Rutsch in
     alle Spiele, Kacheln und Gewinntabellen. Namen ohne Bild (Schädel,
     Fragezeichen, Rad …) bleiben Vektor. */
  var SYMBOLS = ('baccarat bar bear bear2 bell candles cards cherry chest chip clover club coins crab crown ' +
    'diamondsuit dice dices dragon dragonhead fish flame fortune gem gift heart horse1 horse2 horse3 horse4 horse5 ' +
    'horsehead horseshoe iceberg kelp melon moneybag octopus pearl penguin penguin2 ' +
    'party partychip plinko plum poker reeffish rocket roulettewheel seven shark shell shield slotmachine spade star ticket trident trophy ' +
    'floe').split(' ');

  var SYMBOL_IMGS = {};
  SYMBOLS.forEach(function (n) { SYMBOL_IMGS[n] = 'assets/symbols/' + n + '.webp'; });
  /* Die Münze bekommt den Münzstapel unter ihrem bisherigen Namen. */
  SYMBOL_IMGS.coin = 'assets/symbols/coins.webp';
  /* Der Vogel wohnt bei seinen eigenen Bildern, nicht im Symbolordner —
     dort liegt das ganze Blatt aus assets/bird beieinander. */
  SYMBOL_IMGS.vogel = 'assets/bird/vogel.webp';
  /* Ebenso der Held aus dem Endlos-Sprung. */
  SYMBOL_IMGS.held = 'assets/jump/held.webp';

  /* Verläufe einmal ins Dokument hängen */
  var injected = false;
  function injectDefs() {
    if (injected || !document.body) return;
    var holder = document.createElementNS(NS, 'svg');
    holder.setAttribute('width', '0');
    holder.setAttribute('height', '0');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    holder.innerHTML = '<defs>' + DEFS + '</defs>';
    document.body.appendChild(holder);
    injected = true;
  }

  /** Icon als String — praktisch für innerHTML. */
  GK.iconHTML = function (name, cls) {
    var img = DRAGON_IMGS[name] || SYMBOL_IMGS[name];
    if (img) {
      /* Nur die Drachenkoepfe sind Portraits und wollen rund beschnitten
         werden. Bei den gemalten Symbolen kappt ein runder Zuschnitt die
         Ecken — der Raketenspitze fehlte so die Nase. */
      var round = DRAGON_IMGS[name] ? ' gk-round' : '';
      /* Fehlt die Datei noch, blendet sich das Bild aus statt als kaputtes
         Symbol stehenzubleiben — ein leerer Platz faellt weniger auf. */
      return '<img class="gk-ic' + round + ' ' + (cls || '') + '" src="' + img +
             '" alt="" draggable="false" onerror="this.style.display=\'none\'">';
    }
    var body = I[name];
    if (!body) return '';
    return '<svg class="gk-ic ' + (cls || '') + '" viewBox="0 0 64 64" aria-hidden="true">' + body + '</svg>';
  };

  /** Icon als DOM-Element. */
  GK.icon = function (name, cls) {
    injectDefs();
    var wrap = document.createElement('span');
    wrap.className = 'gk-icon ' + (cls || '');
    wrap.innerHTML = GK.iconHTML(name);
    return wrap;
  };

  GK.hasIcon = function (name) { return !!I[name] || !!DRAGON_IMGS[name] || !!SYMBOL_IMGS[name]; };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectDefs);
  else injectDefs();

})(window.GK = window.GK || {});
