/* ═══════════ 4. DRACHENMÜNZE (Coinflip) ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  GK.registerGame({
    id: 'coinflip',
    name: 'Drachenmünze',
    emoji: '🪙',
    icon: 'coin',
    blurb: 'Krone oder Drache. 50/50, keine Ausreden. Serien geben fette Bonus-Multiplikatoren.',
    badge: '2× + SERIE',
    color: '#ffd12e',
    rules: [
      'Wähle <b>Krone</b> oder <b>Drache</b> und wirf die Münze.',
      'Richtig getippt zahlt <b>2×</b> deinen Einsatz.',
      'Ab <b>3 Siegen in Folge</b> gibt es feste <b>Bonus-Chips</b>: 50, 100, 200, 400, 700, 1200 …',
      'Ein Fehlschlag setzt die Serie zurück auf null.'
    ],
    mount: function (root) {
      var stopped = false, flipping = false, rot = 0, side = 'crown', streak = 0;
      var history = [];

      var bet = GK.betPanel({ start: 20 });

      var coin = el('div', { class: 'coin' }, [
        el('div', { class: 'coin-face coin-front', html: GK.iconHTML('crown') }),
        el('div', { class: 'coin-face coin-back', html: GK.iconHTML('dragongreen') })
      ]);

      var crownBtn = el('button', { class: 'side-btn sel' }, [
        el('span', { class: 'e', html: GK.iconHTML('crown') }), el('span', { class: 't', text: 'KRONE' })
      ]);
      var dragonBtn = el('button', { class: 'side-btn' }, [
        el('span', { class: 'e', html: GK.iconHTML('dragongreen') }), el('span', { class: 't', text: 'DRACHE' })
      ]);

      var streakBar = el('div', { class: 'streak-bar' });
      var multBox = el('div', { class: 'info-box' }, [
        el('b', { text: '2×' }), el('span', { text: 'Auszahlung' })
      ]);
      var streakBox = el('div', { class: 'info-box' }, [
        el('b', { text: '0' }), el('span', { text: 'Serie' })
      ]);
      var bonusBox = el('div', { class: 'info-box' }, [
        el('b', { text: '–' }), el('span', { text: 'Nächster Bonus' })
      ]);
      var resultBox = GK.resultBox();
      var flipBtn = el('button', { class: 'btn btn-gold btn-full', text: '🪙 MÜNZE WERFEN' });

      // Ein fairer 50/50-Wurf zahlt bei 2× im Kern genau 100 % zurück — die
      // Serien-Bonis kommen obendrauf. Damit liegt Drachenmünze bewusst über
      // dem Haus-Durchschnitt, dafür ohne den Nervenkitzel einer echten Quote.
      var MULT = 2;
      // Feste Bonus-Chips statt Multiplikator: sonst könnte man mit 1 Chip eine
      // Serie aufbauen und dann All-In gehen — das wäre astronomisch über 100%.
      var STREAK_BONUS = { 3: 50, 4: 100, 5: 200, 6: 400, 7: 700, 8: 1200 };
      function bonusFor(s) { return STREAK_BONUS[s] || (s > 8 ? 2000 : 0); }

      function syncUI() {
        crownBtn.classList.toggle('sel', side === 'crown');
        dragonBtn.classList.toggle('sel', side === 'dragon');
        multBox.querySelector('b').textContent = MULT + '×';
        streakBox.querySelector('b').textContent = streak;
        var nb = bonusFor(streak + 1);
        bonusBox.querySelector('b').textContent = nb ? '+' + GK.fmt(nb) : '–';
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
          el('div', { class: 'info-grid' }, [multBox, streakBox, bonusBox]),
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
        if (!GK.wager(stake, 'Coinflip')) return;

        flipping = true;
        flipBtn.disabled = true;
        bet.disable(true);
        GK.setResult(resultBox, 'Die Münze fliegt…', '');
        GK.sfx('whoosh');

        var win = GK.luckRoll(0.5);
        var landed = win ? side : (side === 'crown' ? 'dragon' : 'crown');
        /* Seite und Serienbonus stehen fest, sobald die Muenze fliegt. */
        GK.commitResult(win ? Math.floor(stake * MULT) + bonusFor(streak + 1) : 0, stake);

        var base = rot - (rot % 360);
        rot = base + 360 * 5 + (landed === 'dragon' ? 180 : 0);
        coin.style.transform = 'rotateY(' + rot + 'deg) rotateX(' + GK.rndInt(-14, 14) + 'deg)';

        setTimeout(function () {
          if (stopped) return;
          GK.sfx('coin');
          var bonus = 0;
          if (win) { streak++; bonus = bonusFor(streak); }
          var payout = win ? Math.floor(stake * MULT) + bonus : 0;
          GK.payout(payout, { stake: stake });
          GK.logPlay('Drachenmünze', stake, payout);
          history.push(win);
          if (history.length > 40) history.shift();

          if (win) {
            GK.setResult(resultBox, (landed === 'crown' ? 'KRONE' : 'DRACHE') + ' — richtig! +' + GK.fmt(payout - stake) +
              (bonus ? '  (inkl. ' + GK.fmt(bonus) + ' Serien-Bonus)' : ''), 'win');
            GK.celebrate(payout - stake, MULT);
            if (bonus) {
              GK.toast(streak + 'er Serie! +' + GK.fmt(bonus) + ' Bonus-Chips 🔥', 'gold', '🔥');
              GK.emojiRain(['🔥', '🪙'], 16);
            }
          } else {
            streak = 0;
            GK.setResult(resultBox, (landed === 'crown' ? 'KRONE' : 'DRACHE') + ' — daneben!', 'lose');
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
