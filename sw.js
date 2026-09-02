/* ══════════════════════════════════════════════════════════════════════
   GAMBAKING — DIENSTARBEITER (Service Worker)
   ══════════════════════════════════════════════════════════════════════

   Er macht aus der Seite eine App: einmal geladen startet sie auch dann,
   wenn das Netz gerade nichts hergibt, und sie startet schneller, weil
   Bilder und Klänge nicht jedes Mal neu über die Leitung müssen.

   Drei Regeln, mehr nicht:

   1. Alles unter /api/ geht immer ans Netz. Chips, Spielstände und der
      Multiplayer dürfen niemals aus der Konserve kommen — ein zwei
      Minuten alter Kontostand wäre schlimmer als gar keiner.
   2. Seiten, Skripte und Stilvorlagen: erst das Netz, die Konserve nur
      als Rettung. Sonst spielte jemand nach einer Aktualisierung noch
      tagelang die alte Fassung.
   3. Alles unter /assets/ (Bilder, Klänge, Karten, Filme): erst die
      Konserve, im Hintergrund wird nachgeladen. Diese Dateien ändern
      sich praktisch nie, und sie machen den Löwenanteil der Ladezeit aus.

   Die Fassungsnummer unten schaltet den Speicher um. Wer etwas an den
   Regeln ändert, zählt sie hoch — dann räumt der Arbeiter beim nächsten
   Start alles Alte weg. */

var FASSUNG = 'gk-v1';
var SPEICHER = FASSUNG + '-alles';

/* Das Nötigste für einen Kaltstart ohne Netz. Fehlt eine Datei, soll die
   Einrichtung trotzdem durchgehen — darum jede für sich und mit
   abgefangenem Fehler statt addAll(), das beim ersten Loch alles hinwirft. */
var GRUNDSTOCK = [
  '/', '/index.html',
  '/css/style.css', '/css/games.css', '/css/skins.css',
  '/js/core.js', '/js/app.js',
  '/assets/logo.svg', '/assets/favicon.svg',
  '/assets/app/icon-192.png', '/assets/app/icon-512.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(SPEICHER).then(function (c) {
      return Promise.all(GRUNDSTOCK.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () { /* egal */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(namen.map(function (n) {
        return n.indexOf(FASSUNG) === 0 ? null : caches.delete(n);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Eine Nachricht aus der Seite: „räum alles weg". Steht im Einstellungs-
   fenster als letzte Rettung, wenn jemand eine kaputte Fassung erwischt. */
self.addEventListener('message', function (ev) {
  if (ev.data === 'gk:leeren') {
    caches.keys().then(function (n) { n.forEach(function (x) { caches.delete(x); }); });
  }
});

function ausDemNetz(anfrage) {
  return fetch(anfrage).then(function (antwort) {
    /* Nur was wirklich angekommen ist, wandert in die Konserve.
       Teilantworten (206) kann der Speicher nicht, und Umleitungen
       gehören dem Netz. */
    if (antwort && antwort.status === 200 && antwort.type === 'basic') {
      var kopie = antwort.clone();
      caches.open(SPEICHER).then(function (c) { c.put(anfrage, kopie); });
    }
    return antwort;
  });
}

self.addEventListener('fetch', function (ev) {
  var anfrage = ev.request;
  if (anfrage.method !== 'GET') return;

  var u;
  try { u = new URL(anfrage.url); } catch (e) { return; }
  if (u.origin !== self.location.origin) return;        // Schriften, fremde Bilder
  if (u.pathname.indexOf('/api/') === 0) return;        // Regel 1

  // Regel 3 — Dateien, die sich nie ändern
  if (u.pathname.indexOf('/assets/') === 0) {
    ev.respondWith(
      caches.match(anfrage).then(function (treffer) {
        var frisch = ausDemNetz(anfrage).catch(function () { return treffer; });
        return treffer || frisch;
      })
    );
    return;
  }

  // Regel 2 — alles andere
  ev.respondWith(
    ausDemNetz(anfrage).catch(function () {
      return caches.match(anfrage).then(function (treffer) {
        if (treffer) return treffer;
        /* Ohne Netz und ohne Treffer: bei einem Seitenaufruf wenigstens
           das Haus ausliefern, damit die App startet statt zu scheitern. */
        if (anfrage.mode === 'navigate') return caches.match('/index.html');
        return new Response('', { status: 504, statusText: 'Kein Netz' });
      });
    })
  );
});
