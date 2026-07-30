/* ═══════════ 4. DRACHENMÜNZE (Coinflip) ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  GK.registerGame({
    id: 'coinflip',
    name: 'Drachenmünze',
    emoji: '🪙',
    blurb: 'Krone oder Drache. 50/50, keine Ausreden. Serien geben fette Bonus-Multiplikatoren.',
    badge: '1.95× +',
    color: '#ffd12e',
    rules: [
      'Wähle <b>Krone 👑</b> oder <b>Drache 🐉</b> und wirf die Münze.',
      'Richtig getippt zahlt <b>1,95×</b> deinen Einsatz.',
      'Ab <b>3 Siegen in Folge</b> steigt der Multiplikator um je <b>0,15×</b> (max. 3×).',
      'Ein Fehlschlag setzt die Serie zurück auf null.'
    ],
    mount: function (root) {
      var stopped = false, flipping = false, rot = 0, side = 'crown', streak = 0;
      var history = [];

      var bet = GK.betPanel({ start: 20 });

      var coin = el('div', { class: 'coin' }, [
        el('div', { class: 'coin-face coin-front', text: '👑' }),
        el('div', { class: 'coin-face coin-back', text: '🐉' })
      ]);

      var crownBtn = el('button', { class: 'side-btn sel' }, [
        el('span', { class: 'e', text: '👑' }), el('span', { class: 't', text: 'KRONE' })
      ]);
      var dragonBtn = el('button', { class: 'side-btn' }, [
        el('span', { class: 'e', text: '🐉' }), el('span', { class: 't', text: 'DRACHE' })
      ]);

      var streakBar = el('div', { class: 'streak-bar' });
      var multBox = el('div', { class: 'info-box' }, [
        el('b', { text: '1.95×' }), el('span', { text: 'Auszahlung' })
      ]);
      var streakBox = el('div', { class: 'info-box' }, [
        el('b', { text: '0' }), el('span', { text: 'Serie' })
      ]);
      var resultBox = GK.resultBox();
      var flipBtn = el('button', { class: 'btn btn-gold btn-full', text: '🪙 MÜNZE WERFEN' });

      function currentMult() {
        var m = 1.95 + Math.max(0, streak - 2) * 0.15;
        return Math.min(3, Math.round(m * 100) / 100);
      }

      function syncUI() {
        crownBtn.classList.toggle('sel', side === 'crown');
        dragonBtn.classList.toggle('sel', side === 'dragon');
        multBox.querySelector('b').textContent = currentMult() + '×';
        streakBox.querySelector('b').textContent = streak;
        streakBar.innerHTML = '';
        history.slice(-14).forEach(function (h) {
          streakBar.appendChild(el('div', { class: 'streak-dot ' + (h ? 'w' : 'l'), text: h ? 'W' : 'L' }));
        });
      }

      crownBtn.addEventListener('click', function () { side = 'crown'; syncUI(); GK.sfx('chip'); });
      dragonBtn.addEventListener('click', function () { side = 'dragon'; syncUI(); GK.sfx('chip'); });

      var stage = el('div', { class: 'stage split' }, [
        GK.panel([el('div', { class: 'coin-stage' }, [coin])]),
        GK.panel([
          el('div', { class: 'bet-label', text: 'DEINE SEITE' }),
          el('div', { style: 'height:8px' }),
          el('div', { class: 'side-pick' }, [crownBtn, dragonBtn]),
          el('div', { style: 'height:14px' }),
          bet.el,
          el('div', { style: 'height:12px' }),
          el('div', { class: 'info-grid' }, [multBox, streakBox]),
          el('div', { style: 'height:10px' }),
          streakBar,
          el('div', { style: 'height:10px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          flipBtn
        ])
      ]);
      root.appendChild(stage);
      syncUI();

      function flip() {
        if (flipping || stopped) return;
        var stake = bet.value();
        var mult = currentMult();
        if (!GK.wager(stake, 'Coinflip')) return;

        flipping = true;
        flipBtn.disabled = true;
        bet.disable(true);
        GK.setResult(resultBox, 'Die Münze fliegt…', '');
        GK.sfx('whoosh');

        var win = GK.luckRoll(0.5);
        var landed = win ? side : (side === 'crown' ? 'dragon' : 'crown');

        var base = rot - (rot % 360);
        rot = base + 360 * 5 + (landed === 'dragon' ? 180 : 0);
        coin.style.transform = 'rotateY(' + rot + 'deg) rotateX(' + GK.rndInt(-14, 14) + 'deg)';

        setTimeout(function () {
          if (stopped) return;
          GK.sfx('coin');
          var payout = win ? Math.floor(stake * mult) : 0;
          GK.payout(payout, { stake: stake });
          GK.logPlay('Drachenmünze', stake, payout);
          history.push(win);
          if (history.length > 40) history.shift();

          if (win) {
            streak++;
            GK.setResult(resultBox, (landed === 'crown' ? '👑 KRONE' : '🐉 DRACHE') + ' — richtig! +' + GK.fmt(payout - stake), 'win');
            GK.celebrate(payout - stake, mult);
            if (streak >= 5) GK.toast(streak + 'er Serie! Du bist unaufhaltsam 🔥', 'gold', '🔥');
          } else {
            streak = 0;
            GK.setResult(resultBox, (landed === 'crown' ? '👑 KRONE' : '🐉 DRACHE') + ' — daneben!', 'lose');
            GK.sfx('lose');
            GK.shake(coin.parentElement);
          }
          syncUI();
          flipping = false;
          flipBtn.disabled = false;
          bet.disable(false);
        }, 2500);
      }

      flipBtn.addEventListener('click', function () { GK.sfx('click'); flip(); });
      return function () { stopped = true; };
    }
  });
})(window.GK);
