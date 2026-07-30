/* ═══════════ 3. ROYAL BLACKJACK ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  var SUITS = [
    { s: '♠', red: false }, { s: '♥', red: true },
    { s: '♦', red: true }, { s: '♣', red: false }
  ];
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function newShoe() {
    var shoe = [];
    for (var d = 0; d < 6; d++)
      SUITS.forEach(function (su) {
        RANKS.forEach(function (r) { shoe.push({ r: r, s: su.s, red: su.red }); });
      });
    for (var i = shoe.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = shoe[i]; shoe[i] = shoe[j]; shoe[j] = t;
    }
    return shoe;
  }

  function handValue(hand) {
    var total = 0, aces = 0;
    hand.forEach(function (c) {
      if (c.r === 'A') { aces++; total += 11; }
      else if (['J', 'Q', 'K'].indexOf(c.r) >= 0) total += 10;
      else total += Number(c.r);
    });
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  function cardEl(c, hidden) {
    if (hidden) return el('div', { class: 'card back' });
    return el('div', { class: 'card' + (c.red ? ' red' : '') }, [
      el('div', { class: 'top', text: c.r + c.s }),
      el('div', { class: 'mid', text: c.s }),
      el('div', { class: 'bot', text: c.r + c.s })
    ]);
  }

  GK.registerGame({
    id: 'blackjack',
    name: 'Royal Blackjack',
    emoji: '🃏',
    blurb: 'Komm auf 21 — oder so nah wie möglich. Der Dealer zieht bis 17. Nerven aus Stahl nötig.',
    badge: '3:2',
    color: '#7cff3b',
    rules: [
      'Ziel: näher an <b>21</b> als der Dealer, ohne zu überkaufen.',
      'Ein <b>Blackjack</b> (Ass + Bild/10) zahlt <b>3:2</b>.',
      'Der Dealer zieht bis <b>17</b> und bleibt dann stehen.',
      '<b>Doppeln</b>: Einsatz verdoppeln, genau eine Karte, dann automatisch stehen.',
      'Gleichstand = <b>Push</b>, du bekommst deinen Einsatz zurück.'
    ],
    mount: function (root) {
      var stopped = false;
      var shoe = newShoe();
      var player = [], dealer = [], stake = 0, phase = 'bet', hideHole = true;

      var bet = GK.betPanel({ start: 25 });
      var dealerHand = el('div', { class: 'hand' });
      var playerHand = el('div', { class: 'hand' });
      var dealerScore = el('span', { class: 'bj-score', text: '—' });
      var playerScore = el('span', { class: 'bj-score', text: '—' });
      var resultBox = GK.resultBox();

      var dealBtn = el('button', { class: 'btn btn-gold btn-full', text: '🃏 KARTEN GEBEN' });
      var hitBtn = el('button', { class: 'btn', text: '🎯 HIT' });
      var standBtn = el('button', { class: 'btn btn-ghost', text: '✋ STAND' });
      var dblBtn = el('button', { class: 'btn btn-lime', text: '💰 DOPPELN' });
      var actions = el('div', { class: 'bj-actions' }, [hitBtn, standBtn, dblBtn]);

      var felt = el('div', { class: 'bj-felt' }, [
        el('div', { class: 'bj-side' }, [
          el('h4', {}, ['🤵 DEALER', dealerScore]),
          dealerHand
        ]),
        el('div', { class: 'bj-side' }, [
          el('h4', {}, ['🧑 DU', playerScore]),
          playerHand
        ])
      ]);

      var stage = el('div', { class: 'stage split' }, [
        felt,
        GK.panel([
          bet.el,
          el('div', { style: 'height:14px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          dealBtn,
          el('div', { style: 'height:10px' }),
          actions,
          el('div', { style: 'height:12px' }),
          el('p', { class: 'hint', html: '💡 6 Decks, Dealer bleibt auf <b>17</b> stehen. Blackjack zahlt <b>3:2</b>.' })
        ])
      ]);
      root.appendChild(stage);

      function draw() {
        if (shoe.length < 20) shoe = newShoe();
        return shoe.pop();
      }

      function render() {
        dealerHand.innerHTML = '';
        dealer.forEach(function (c, i) {
          dealerHand.appendChild(cardEl(c, hideHole && i === 1));
        });
        playerHand.innerHTML = '';
        player.forEach(function (c) { playerHand.appendChild(cardEl(c)); });

        playerScore.textContent = player.length ? handValue(player) : '—';
        if (!dealer.length) dealerScore.textContent = '—';
        else if (hideHole) dealerScore.textContent = handValue([dealer[0]]) + ' + ?';
        else dealerScore.textContent = handValue(dealer);
      }

      function setPhase(p) {
        phase = p;
        var playing = p === 'play';
        dealBtn.disabled = playing;
        hitBtn.disabled = !playing;
        standBtn.disabled = !playing;
        dblBtn.disabled = !playing || player.length !== 2 || !GK.canBet(stake);
        bet.disable(playing);
      }

      function isBJ(h) { return h.length === 2 && handValue(h) === 21; }

      function deal() {
        if (phase === 'play' || stopped) return;
        stake = bet.value();
        if (!GK.wager(stake, 'Blackjack')) return;

        player = []; dealer = []; hideHole = true;
        GK.setResult(resultBox, 'Viel Glück!', '');
        setPhase('play');

        var seq = [
          function () { player.push(draw()); },
          function () { dealer.push(draw()); },
          function () { player.push(draw()); },
          function () { dealer.push(draw()); }
        ];
        seq.forEach(function (fn, i) {
          setTimeout(function () {
            if (stopped) return;
            fn(); render(); GK.sfx('card');
            if (i === 3) {
              if (isBJ(player)) { setTimeout(settle, 450); }
              else setPhase('play');
            }
          }, i * 260);
        });
      }

      function hit() {
        if (phase !== 'play') return;
        player.push(draw());
        GK.sfx('card');
        render();
        dblBtn.disabled = true;
        if (handValue(player) > 21) { setTimeout(settle, 400); }
        else if (handValue(player) === 21) { setTimeout(stand, 400); }
      }

      function double() {
        if (phase !== 'play' || player.length !== 2) return;
        if (!GK.wager(stake, 'Blackjack')) return;
        stake *= 2;
        GK.sfx('chip');
        player.push(draw());
        GK.sfx('card');
        render();
        setTimeout(stand, 500);
      }

      function stand() {
        if (phase !== 'play') return;
        setPhase('dealer');
        hideHole = false;
        render();
        GK.sfx('card');

        function dealerStep() {
          if (stopped) return;
          if (handValue(player) <= 21 && handValue(dealer) < 17) {
            dealer.push(draw());
            GK.sfx('card');
            render();
            setTimeout(dealerStep, 620);
          } else {
            setTimeout(settle, 420);
          }
        }
        setTimeout(dealerStep, 620);
      }

      function settle() {
        if (stopped) return;
        hideHole = false;
        render();

        var pv = handValue(player), dv = handValue(dealer);
        var win = 0, msg, kind;

        if (pv > 21) { win = 0; msg = 'Überkauft mit ' + pv + '! 💥'; kind = 'lose'; }
        else if (isBJ(player) && !isBJ(dealer)) { win = Math.floor(stake * 2.5); msg = 'BLACKJACK! ' + pv + ' 🃏 3:2'; kind = 'win'; }
        else if (isBJ(dealer) && !isBJ(player)) { win = 0; msg = 'Dealer hat Blackjack 😤'; kind = 'lose'; }
        else if (dv > 21) { win = stake * 2; msg = 'Dealer überkauft mit ' + dv + '! 🎉'; kind = 'win'; }
        else if (pv > dv) { win = stake * 2; msg = pv + ' schlägt ' + dv + ' — gewonnen!'; kind = 'win'; }
        else if (pv < dv) { win = 0; msg = dv + ' schlägt deine ' + pv; kind = 'lose'; }
        else { win = stake; msg = 'Push bei ' + pv + ' — Einsatz zurück'; kind = 'push'; }

        GK.payout(win, { stake: stake });
        GK.logPlay('Royal Blackjack', stake, win);
        GK.setResult(resultBox, msg, kind);

        if (kind === 'win') GK.celebrate(win - stake, win / Math.max(1, stake));
        else if (kind === 'lose') { GK.sfx('lose'); GK.shake(felt); }
        else GK.sfx('coin');

        setPhase('bet');
      }

      dealBtn.addEventListener('click', function () { GK.sfx('click'); deal(); });
      hitBtn.addEventListener('click', function () { GK.sfx('click'); hit(); });
      standBtn.addEventListener('click', function () { GK.sfx('click'); stand(); });
      dblBtn.addEventListener('click', function () { GK.sfx('click'); double(); });

      setPhase('bet');
      render();
      return function () { stopped = true; };
    }
  });
})(window.GK);
