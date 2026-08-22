/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Netzwerk
   Spricht mit server.js. Läuft der Server nicht (index.html
   direkt geöffnet), fällt alles automatisch auf localStorage
   zurück — dann ist das Leaderboard eben nur lokal.
   ═══════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';

  var SKEY = 'gambaking:session';

  var Net = GK.net = {
    online: false,
    token: null,          // Admin-Token, nur im Speicher — Reload = ausgeloggt
    session: null,        // Spieler-Sitzung, gilt bis der Tab geschlossen wird
    pending: 0,           // laufende Operationen
    chain: Promise.resolve(),
    lastError: 0
  };

  /* Die Sitzung liegt im sessionStorage: Reload im selben Tab bleibt
     angemeldet, ein neuer Besuch verlangt wieder Name und Passwort. */
  function loadSession() {
    try { Net.session = sessionStorage.getItem(SKEY) || null; } catch (e) { Net.session = null; }
  }
  function storeSession(t) {
    Net.session = t || null;
    try {
      if (t) sessionStorage.setItem(SKEY, t);
      else sessionStorage.removeItem(SKEY);
    } catch (e) {}
  }
  loadSession();

  function api(path, options) {
    return fetch(path, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    }, options || {})).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok) {
          var err = new Error(body.error || ('HTTP ' + r.status));
          err.status = r.status;
          err.state = body.state;
          throw err;
        }
        return body;
      });
    });
  }

  /** Einmalig beim Start: Gibt es einen Server? */
  Net.probe = function () {
    if (location.protocol === 'file:') return Promise.resolve(false);
    return api('api/state').then(function (s) {
      Net.online = true;
      GK.adoptState(s);
      return true;
    }).catch(function () {
      Net.online = false;
      return false;
    });
  };

  /** Frischer Stand vom Server (Leaderboard anderer Spieler). */
  Net.pull = function () {
    if (!Net.online || Net.pending > 0) return Promise.resolve(false);
    return api('api/state').then(function (s) {
      if (Net.pending > 0) return false;   // zwischenzeitlich lokal weitergespielt
      var changed = GK.adoptState(s);
      if (changed) GK.emit('player-changed');
      return changed;
    }).catch(function () { return false; });
  };

  /**
   * Operation an den Server schicken. Die Änderung ist lokal schon
   * passiert — die Antwort ist die verbindliche Wahrheit.
   */
  /**
   * Statistik holen (nur Admin).
   *
   * Geht bewusst nicht ueber Net.op: die Auswertung veraendert nichts und
   * soll sich nicht in die Kette der Schreibvorgaenge stellen.
   */
  Net.stats = function (frage) {
    if (!Net.online) return Promise.resolve(null);
    var body = Object.assign({}, frage || {});
    if (Net.token) body.token = Net.token;
    if (Net.session) body.session = Net.session;
    return api('api/stats', { method: 'POST', body: JSON.stringify(body) });
  };

  /**
   * Protokoll beendeter Partys (nur Admin).
   *
   * Ohne `id` kommt die schlanke Liste, mit `id` der ganze Datensatz —
   * geht wie die Statistik am Schreibvorgang vorbei, weil nichts geändert
   * wird.
   */
  Net.partys = function (id) {
    if (!Net.online) return Promise.resolve(null);
    var body = {};
    if (id) body.id = id;
    if (Net.token) body.token = Net.token;
    if (Net.session) body.session = Net.session;
    return api('api/partys', { method: 'POST', body: JSON.stringify(body) });
  };

  /** Rohdaten der Statistik holen (nur Admin) — für die Ausfuhr als Datei. */
  Net.statExport = function () {
    if (!Net.online) return Promise.resolve(null);
    var body = {};
    if (Net.token) body.token = Net.token;
    if (Net.session) body.session = Net.session;
    return api('api/statexport', { method: 'POST', body: JSON.stringify(body) });
  };

  Net.op = function (type, payload) {
    if (!Net.online) return Promise.resolve(null);
    var body = Object.assign({ type: type }, payload || {});
    if (Net.token) body.token = Net.token;
    if (Net.session) body.session = Net.session;

    Net.pending++;
    Net.chain = Net.chain.then(function () {
      return api('api/op', { method: 'POST', body: JSON.stringify(body) })
        .then(function (out) {
          Net.pending--;
          if (Net.pending === 0 && out && out.state) {
            GK.adoptState(out.state);
            GK.updateHUD();
            GK.emit('player-changed');
          }
          return out;
        })
        .catch(function (err) {
          Net.pending--;
          // Server hat abgelehnt (z.B. zu wenig Chips): seinen Stand übernehmen
          if (err.state && Net.pending === 0) {
            GK.adoptState(err.state);
            GK.updateHUD();
            GK.emit('player-changed');
          }
          if (err.status === 401) {
            storeSession(null);
            GK.state.currentId = null;
            GK.toast('Sitzung abgelaufen — bitte neu anmelden', 'bad', '🔒');
            GK.emit('logged-out');
          } else if (err.status === 403) {
            Net.token = null;
            GK.state.admin = false;
            GK.toast('Admin-Sitzung abgelaufen — bitte neu einloggen', 'bad', '🔒');
          } else if (Date.now() - Net.lastError > 8000) {
            Net.lastError = Date.now();
            GK.toast('Server nicht erreichbar: ' + err.message, 'bad', '📡');
          }
          return null;
        });
    });
    return Net.chain;
  };

  /* ─────────────── Konto & Anmeldung ─────────────── */

  function adopt(out) {
    storeSession(out.session || Net.session);
    if (out.state) GK.adoptState(out.state);
    GK.state.currentId = out.playerId;
    GK.save();
    GK.updateHUD();
    GK.emit('player-changed');
    return { ok: true, playerId: out.playerId };
  }
  function fail(err) {
    return { ok: false, error: err && err.message ? err.message : 'Server nicht erreichbar' };
  }

  /** Neues Konto anlegen. */
  Net.register = function (name, password, avatar) {
    return api('api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: name, password: password, avatar: avatar })
    }).then(adopt, fail);
  };

  /** Anmelden. */
  Net.login = function (name, password) {
    return api('api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ name: name, password: password })
    }).then(adopt, fail);
  };

  /** Beim Start: gilt die gespeicherte Sitzung noch? */
  Net.resume = function () {
    if (!Net.online || !Net.session) return Promise.resolve({ ok: false });
    return api('api/auth/me', { method: 'POST', body: JSON.stringify({ session: Net.session }) })
      .then(adopt, function () { storeSession(null); return { ok: false }; });
  };

  Net.logout = function () {
    var t = Net.session;
    storeSession(null);
    Net.token = null;
    GK.state.admin = false;
    GK.state.currentId = null;
    GK.save();
    if (!Net.online || !t) return Promise.resolve();
    return api('api/auth/logout', { method: 'POST', body: JSON.stringify({ session: t }) })
      .catch(function () {});
  };

  /** Eigenes Passwort ändern. */
  Net.changePassword = function (oldPw, newPw) {
    return api('api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ session: Net.session, oldPassword: oldPw, newPassword: newPw })
    }).then(function () { return { ok: true }; }, fail);
  };

  /** Admin-Login gegen den Server. Gibt true/false zurück. */
  Net.adminLogin = function (pin) {
    if (!Net.online) {
      return Promise.resolve(pin === GK.state.settings.adminPin);
    }
    return api('api/admin/login', { method: 'POST', body: JSON.stringify({ pin: pin }) })
      .then(function (out) { Net.token = out.token; return true; })
      .catch(function () { return false; });
  };

  /** Regelmäßig den Stand der anderen holen (nur in der Lobby). */
  Net.startPolling = function (isLobbyVisible) {
    setInterval(function () {
      if (!Net.online) return;
      if (document.hidden) return;
      if (!isLobbyVisible()) return;
      Net.pull();
    }, 6000);
  };

})(window.GK);
