/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Netzwerk
   Spricht mit server.js. Läuft der Server nicht (index.html
   direkt geöffnet), fällt alles automatisch auf localStorage
   zurück — dann ist das Leaderboard eben nur lokal.
   ═══════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';

  var Net = GK.net = {
    online: false,
    token: null,          // Admin-Token, nur im Speicher — Reload = ausgeloggt
    pending: 0,           // laufende Operationen
    chain: Promise.resolve(),
    lastError: 0
  };

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
  Net.op = function (type, payload) {
    if (!Net.online) return Promise.resolve(null);
    var body = Object.assign({ type: type }, payload || {});
    if (Net.token) body.token = Net.token;

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
          if (err.status === 403) {
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
