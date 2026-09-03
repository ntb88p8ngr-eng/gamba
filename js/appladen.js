/* ══════════════════════════════════════════════════════════════════════
   GAMBAKING AUFS HANDY LADEN
   ══════════════════════════════════════════════════════════════════════

   Was hier passiert und was nicht:

   GambaKing wird als App auf dem Home-Bildschirm installiert und startet
   dann ohne Adressleiste, mit eigenem Symbol, im App-Modus (siehe
   css/app.css). Technisch ist es weiterhin dieselbe Seite — nur eben als
   App verpackt. Das ist auf dem iPhone der einzige Weg, der ohne den
   App Store auskommt.

   Der Haken dabei ist Apples: auf dem iPhone darf keine Seite die
   Installation selbst auslösen. Sie läuft immer über das Teilen-Menü in
   Safari, „Zum Home-Bildschirm". Wir können also nur zeigen, wie es
   geht — und genau das tut das Fenster hier. Auf Android gibt es dagegen
   einen echten Knopf, dort meldet der Browser sich vorher mit
   beforeinstallprompt.

   Dazu kommt eine kleine Notiz: wer die Seite zum ersten Mal auf einem
   Handy öffnet, bekommt einen kurzen Hinweis, dass es die App gibt.
   Einmal weggetippt, kommt sie nicht wieder. */

(function (GK) {
  'use strict';
  if (!GK) return;

  var el = GK.el;
  var SCHLUESSEL = 'gambaking:appnotiz';     // Notiz schon gesehen?

  /* Der Browser meldet sich, wenn er die App installieren könnte. Das
     Ereignis kommt genau einmal und muss aufgehoben werden — später
     lässt es sich nicht mehr herbeirufen. */
  var angebot = null;

  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();
    angebot = ev;
    knopfZeigen();
  });
  window.addEventListener('appinstalled', function () {
    angebot = null;
    try { localStorage.setItem(SCHLUESSEL, 'installiert'); } catch (e) {}
    GK.toast('GambaKing liegt jetzt auf deinem Startbildschirm', 'good', '📱');
  });

  /* ── Wer schaut da zu? ── */

  function appLaeuft() {
    /* Die Klasse hängt index.html noch vor dem ersten Anstrich ans <html>,
       aus denselben Merkmalen — und zusätzlich aus ?app=1, mit dem die
       Startadresse der App arbeitet. Ohne diese Zeile bot die App sich
       selbst noch einmal zum Installieren an, sobald sie über ihre
       Startadresse und nicht über den Systemschalter erkannt wurde. */
    if (document.documentElement.classList.contains('app-modus')) return true;
    try {
      return window.matchMedia('(display-mode: standalone)').matches ||
             window.navigator.standalone === true;
    } catch (e) { return false; }
  }
  function istApple() {
    var ua = navigator.userAgent || '';
    /* Ein iPad meldet sich seit iPadOS 13 als Mac. Der Unterschied ist
       der Finger: ein echter Mac hat keinen Berührungsschirm. */
    return /iPhone|iPad|iPod/.test(ua) ||
           (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }
  function istSafari() {
    var ua = navigator.userAgent || '';
    /* Auf dem iPhone sind Chrome und Firefox nur andere Anstriche über
       derselben Maschine — erkennbar an ihrem Kürzel im Kennwort. */
    return istApple() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  }
  function istHandy() {
    return istApple() || /Android/i.test(navigator.userAgent || '');
  }

  /* ── Das Fenster ── */

  function schritt(nr, text) {
    return el('li', { class: 'appschritt' }, [
      el('span', { class: 'as-nr', text: String(nr) }),
      el('span', { class: 'as-text', html: text })
    ]);
  }

  GK.appLaden = function () {
    if (appLaeuft()) {
      GK.modal({
        emoji: '📱',
        title: 'Läuft schon',
        text: 'Du spielst gerade in der App — sie liegt bereits auf deinem Startbildschirm.'
      });
      return;
    }

    var teile = [];
    var text;

    if (angebot) {
      /* Android und Desktop-Chrome: hier geht es wirklich auf Knopfdruck. */
      text = 'Auf den Startbildschirm legen, mit eigenem Symbol und ohne Adressleiste. ' +
             'Ein Tipp genügt.';
      var knopf = el('button', { class: 'btn btn-mega btn-full', text: '📲 JETZT INSTALLIEREN' });
      knopf.addEventListener('click', function () {
        knopf.disabled = true;
        angebot.prompt();
        angebot.userChoice.then(function (w) {
          angebot = null;
          GK.closeModal();
          if (!w || w.outcome !== 'accepted') {
            GK.toast('Kein Problem — der Knopf bleibt in der Lobby', '', '📱');
          }
        });
      });
      teile.push(knopf);

    } else if (istApple() && istSafari()) {
      text = 'Eigenes Symbol, kein Safari drumherum. <b>Apple lässt das keine Seite ' +
             'selbst tun</b> — einmal drei Schritte von Hand:';
      teile.push(el('ol', { class: 'appschritte' }, [
        schritt(1, 'Unten in der Mitte auf <b>Teilen</b> tippen — das Kästchen mit dem Pfeil nach oben.'),
        schritt(2, 'In der Liste nach unten wischen bis <b>„Zum Home-Bildschirm"</b>.'),
        schritt(3, 'Oben rechts <b>Hinzufügen</b> — fertig, die Krone liegt auf dem Startbildschirm.')
      ]));

    } else if (istApple()) {
      text = 'Auf dem iPhone kann nur <b>Safari</b> eine App auf den Startbildschirm legen — ' +
             'Chrome und Firefox dürfen das dort nicht. ' +
             'Öffne diese Seite in Safari und tipp dort wieder auf <b>APP LADEN</b>.';

    } else if (istHandy()) {
      text = 'Im Menü deines Browsers (die drei Punkte) steht <b>„App installieren"</b> ' +
             'oder <b>„Zum Startbildschirm hinzufügen"</b>. Danach startet GambaKing ' +
             'mit eigenem Symbol und ohne Adressleiste.';

    } else {
      text = 'Die App ist fürs Handy gedacht: <b>öffne diese Seite auf dem iPhone</b> und tipp ' +
             'dort in der Lobby auf <b>APP LADEN</b>. In Chrome am Rechner geht es auch — ' +
             'dort erscheint rechts in der Adressleiste ein kleines Installieren-Symbol.';
    }

    teile.push(el('p', { class: 'hint', html:
      '💡 In der App wird viel weniger gescrollt, und dein Konto bleibt dasselbe — ' +
      'du meldest dich einfach an. ⚠️ Weiterhin <b>kein echtes Geld</b>.' }));

    GK.modal({ emoji: '📱', title: 'GambaKing aufs Handy', text: text, nodes: teile });
  };

  /* ── Der Knopf in der Lobby ── */

  function knopfZeigen() {
    var k = document.getElementById('btn-app');
    if (!k) return;
    /* Nur dort, wo die App auch etwas nützt: auf einem Handy, und solange
       sie nicht ohnehin schon läuft. Am Rechner stand der Knopf zwischen
       den fünf Knöpfen der Lobby und führte zu einem Fenster, das im
       Kern „mach das auf dem Handy" sagt. Wer am Rechner doch
       installieren will, hat dafür das kleine Symbol rechts in der
       Adressleiste seines Browsers — GK.appLaden() bleibt aufrufbar. */
    k.hidden = appLaeuft() || !istHandy();
  }

  /* ── Die kleine Notiz beim ersten Besuch ── */

  function notizZeigen() {
    if (appLaeuft()) return;
    if (!istHandy()) return;
    try { if (localStorage.getItem(SCHLUESSEL)) return; } catch (e) { return; }

    var jaKnopf = el('button', { class: 'btn btn-mega btn-full', text: '📱 ZEIG MIR WIE' });
    var neinKnopf = el('button', { class: 'btn btn-ghost btn-full', text: 'Später' });
    function merken() {
      try { localStorage.setItem(SCHLUESSEL, 'gesehen'); } catch (e) {}
    }
    jaKnopf.addEventListener('click', function () { merken(); GK.closeModal(); GK.appLaden(); });
    neinKnopf.addEventListener('click', function () { merken(); GK.closeModal(); });

    GK.modal({
      emoji: '👑',
      title: 'Als App aufs Handy?',
      text: 'GambaKing lässt sich auf den Startbildschirm legen — dann startet es ' +
            'wie eine App: eigenes Symbol, keine Adressleiste und deutlich ' +
            'weniger Gescrolle.',
      nodes: [jaKnopf, el('div', { style: 'height:8px' }), neinKnopf],
      /* Wer das Fenster wegtippt, hat es auch gesehen. */
      onClose: merken
    });
  }

  /* ── Lobby aufräumen, wenn die App läuft ──

     Auf der Website steht in der Lobby alles untereinander: Spielhalle,
     Rangliste, Verlauf, Fußzeile. Auf einem iPhone waren das gemessene
     6609 Punkte, also zehn Bildschirme. Zwei Handgriffe dagegen:

     1. Rangliste und Verlauf klappen zu. Beide sind Nachschlagewerke,
        keine Startseite — wer sie sucht, tippt die Überschrift an, und
        die App merkt sich das.
     2. Die Fußzeile steht außerhalb des scrollenden Teils und läge
        deshalb als fester Streifen am unteren Rand. Der Hinweis, dass
        hier kein echtes Geld liegt, gehört trotzdem hin — er wandert als
        eine Zeile ans Ende der Lobby und scrollt mit. */

  function klappenBauen() {
    var titel = document.querySelectorAll('#view-lobby .section-title');
    /* Die erste Überschrift ist die Spielhalle — die bleibt offen. */
    [[titel[1], document.querySelector('#view-lobby .board-wrap')],
     [titel[2], document.querySelector('#view-lobby .feed')]].forEach(function (paar, i) {
      var kopf = paar[0], inhalt = paar[1];
      if (!kopf || !inhalt) return;
      var name = 'gambaking:klapp' + i;
      var offen = false;
      try { offen = localStorage.getItem(name) === 'auf'; } catch (e) {}

      var pfeil = el('span', { class: 'klapp-pfeil', text: '▾' });
      kopf.appendChild(pfeil);
      kopf.classList.add('klappbar');
      kopf.setAttribute('role', 'button');
      kopf.setAttribute('tabindex', '0');

      function setzen(auf) {
        offen = auf;
        inhalt.classList.toggle('zu', !auf);
        kopf.classList.toggle('zu', !auf);
        kopf.setAttribute('aria-expanded', auf ? 'true' : 'false');
        try { localStorage.setItem(name, auf ? 'auf' : 'zu'); } catch (e) {}
      }
      setzen(offen);
      kopf.addEventListener('click', function () { GK.sfx('click'); setzen(!offen); });
      kopf.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setzen(!offen); }
      });
      /* Der LEADERBOARD-Knopf im Vorspann springt hierher — zugeklappt
         wäre das ein Sprung ins Leere. */
      if (i === 0) {
        var sprung = document.getElementById('btn-goto-board');
        if (sprung) sprung.addEventListener('click', function () { setzen(true); });
      }
    });
  }

  function fusszeileUmhaengen() {
    var fuss = document.querySelector('.footer p');
    var lobby = document.getElementById('view-lobby');
    if (!fuss || !lobby || document.querySelector('.app-fuss')) return;
    var zeile = el('p', { class: 'app-fuss', html: fuss.innerHTML });
    lobby.appendChild(zeile);
  }

  /* ── Dienstarbeiter anmelden ──
     Er macht die App offline-fähig und ist auf Android Bedingung dafür,
     dass der Browser die Installation überhaupt anbietet. Ohne
     sicheren Kontext (https oder localhost) gibt es ihn nicht — dann
     bleibt es bei der normalen Seite, ohne Fehler. */
  function arbeiterAnmelden() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').catch(function (e) {
      console.warn('[gambaking] Dienstarbeiter nicht angemeldet:', e && e.message);
    });
  }

  function los() {
    var k = document.getElementById('btn-app');
    if (k) {
      k.addEventListener('click', function () { GK.sfx('click'); GK.appLaden(); });
      knopfZeigen();
    }
    arbeiterAnmelden();
    if (document.documentElement.classList.contains('app-modus')) {
      klappenBauen();
      fusszeileUmhaengen();
    }
    /* Erst wenn die Lobby steht — sonst legt sich die Notiz über das
       Anmeldefenster, und das ist das Erste, was ein neuer Gast sieht. */
    setTimeout(function () {
      if (!document.getElementById('modal-root').hidden) return;
      notizZeigen();
    }, 4000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los);
  else los();
})(window.GK);
