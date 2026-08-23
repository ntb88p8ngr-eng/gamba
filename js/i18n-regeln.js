/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Spielregeln auf Englisch

   Die Regeln stehen als fertige HTML-Zeilen in den Spielen selbst; ein
   Wörterbuch aus ganzen Absätzen wäre hier zwar möglich, ginge aber bei
   jeder Zahl daneben, die zur Laufzeit eingesetzt wird (Freispiele,
   Zielröhren, Multiplikatoren). Deshalb liegt hier je Spiel eine eigene
   Liste — dieselbe Reihenfolge, dieselbe Anzahl.

   Die Anzahl ist die Sicherung: kommt in einem Spiel eine Regel dazu und
   hier nicht, passt die Länge nicht mehr und es bleibt bei der deutschen
   Fassung. Lieber ganz deutsch als halb übersetzt.
   ═══════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';

  var REGELN = {
    slots: [
      '<b>3 matching symbols</b> on the line pay the big multiplier.',
      '<b>2 matching symbols</b> give back only a part (0.5× to 3×) — usually less than your bet.',
      'The <b>crown</b> is the jackpot: 100× your bet.',
      'Payout = bet × multiplier.',
      '<b>3 stars</b> trigger <b>10 free spins</b>: they cost nothing, and every win counts <b>2×</b>.',
      'Three stars during a free spin <b>extend</b> the run by another 10.'
    ],
    roulette: [
      '<b>Red / black / even / odd / 1-18 / 19-36</b> pay <b>2.0×</b> — double your bet.',
      'A <b>dozen</b> (1-12, 13-24, 25-36) pays 2.8×.',
      'A <b>single number</b> pays 32×.',
      'You can cover <b>several fields at once</b> — every click adds another chip, right-click clears a field.',
      'Each field is settled on its own: your bet is the <b>sum of all chips</b>.',
      'The <b>green 0</b> beats every even-money bet — unless you backed it directly.'
    ],
    blackjack: [
      'Goal: get closer to <b>21</b> than the dealer without going bust.',
      'A <b>blackjack</b> (ace + face/10) pays <b>6:5</b>.',
      'The dealer draws to <b>17</b> and then stands.',
      '<b>Double</b>: double your bet, take exactly one card, then stand automatically.',
      'A tie is a <b>push</b> — you get your bet back.'
    ],
    baccarat: [
      'Both sides get two cards. Whoever is closer to <b>9</b> wins.',
      'Only the <b>last digit</b> counts: 7 + 8 = 15 → <b>5</b>. Faces and tens count zero, the ace counts one.',
      '<b>Player</b> and <b>banker</b> both pay 1:1, no commission. <b>Tie</b> pays 8:1.',
      'An <b>8 or 9</b> from the first two cards stands right away — that is a <b>natural</b>.',
      'Whether a third card comes is decided by the table, not by you. Sit back and watch.',
      'On a tie you get your bet on player or banker <b>back</b>.'
    ],
    coinflip: [
      'Pick <b>crown</b> or <b>dragon</b> and toss the coin.',
      'A correct call pays <b>2×</b> your bet.',
      'From <b>3 wins in a row</b> there are fixed <b>bonus chips</b>: 50, 100, 200, 400, 700, 1200 …',
      'One miss resets the streak to zero.'
    ],
    dice: [
      '<b>Duel:</b> your 2 dice against the dealer’s — the higher total wins (1.8×). A tie is a push.',
      '<b>Over 7 / under 7:</b> pays 2.15× if your total fits. An exact 7 loses here.',
      '<b>Exactly 7:</b> pays a fat 5.1× — but hits only once in six rolls.'
    ],
    crash: [
      'Place your chips and launch the rocket. The <b>multiplier</b> keeps climbing.',
      'Hit <b>CASH OUT</b> before it crashes — you get bet × multiplier.',
      'If it crashes first, the bet is gone. The crash can happen <b>at any moment</b>.',
      'With <b>auto cashout</b> you leave automatically at the multiplier you picked.'
    ],
    mines: [
      'Choose how many <b>dragons 🐉</b> hide in the 5×5 field — more dragons, higher multiplier.',
      'Every <b>gem 💎</b> you uncover raises your multiplier.',
      'You can <b>cash out at any time</b>. The multiplier counts from the first find.',
      'A dragon ends the round instantly — the bet is gone.'
    ],
    wheel: [
      'One click, one spin — the wheel lands on a <b>multiplier</b>.',
      'A <b>☠ skull</b> means the bet is gone — but only <b>5 of 24</b> slots are skulls.',
      '<b>0.5×</b> gets half back, <b>1×</b> exactly your bet — everything above is profit.',
      'The golden <b>5×</b> slot exists only once on the whole wheel.'
    ],
    plinko: [
      'The ball drops through <b>12 rows</b> of pins and lands in one of 13 slots.',
      'The slot’s multiplier is applied to your bet.',
      'The <b>edges</b> pay the most — but that is where the ball goes least often.',
      'Three risk levels: <b>Chill</b>, <b>Normal</b> and <b>Insane</b>. More risk = more extreme edges.',
      'You can drop several balls at the same time.'
    ],
    scratch: [
      'Buy a ticket and <b>scratch the three tiles</b> (hold the mouse down or swipe).',
      '<b>Three matching runes</b> pay that rune’s multiplier.',
      'Crown 20× · star 10× · jewel 5× · flame 3× · clover 2× · coin 1× (bet back)',
      'Anything else is a blank — but scratching is fun anyway.'
    ],
    horses: [
      'Back one of five horses — each has its own <b>odds</b>.',
      'If your horse wins you get <b>bet × odds</b>.',
      '<b>Lightning Hoof</b> wins most often and therefore pays the least.',
      '<b>Golden Mane</b> almost never wins — which is why she pays <b>11×</b>.',
      'The race runs live, changes of lead included.'
    ],
    icebear: [
      'The polar bear climbs up <b>floe by floe</b>. You pick one per row.',
      'Every safe floe raises the <b>multiplier</b>.',
      'In every row exactly one floe is <b>thin</b> — step on it and the bear falls into the water.',
      'After every step you can <b>cash out</b> and take the multiplier.',
      '<b>Death ice</b> is 50/50 per step, but pays over 230× at the top.'
    ],
    ocean: [
      '<b>5 reels of 5 symbols</b> and <b>15 paylines</b> — straights, zigzags, waves and stairs.',
      'Wins count <b>from the left</b>: from 3 matching symbols on one line.',
      'The <b>trident</b> is wild and substitutes for every symbol except the chest.',
      'The <b>treasure chest</b> is the scatter: 3 anywhere pay 1.2×, 4 pay 5×, 5 pay 28× and 6 even 120× — on the total bet.',
      'Your bet is spread evenly across the 15 lines.',
      '<b>3, 4, 5 or 6 chests</b> also bring <b>2, 3, 6 or 10 free spins</b> — they cost nothing and every win counts <b>2×</b>. On the big grid this happens far more often than it used to.',
      'Three chests during a free spin <b>extend</b> the run.'
    ],
    poker: [
      'Leaving the table <b>in the middle of a hand</b> folds it — the chips in the pot stay there.',
      'Texas hold’em: two cards of your own, five face up in the middle — the best <b>five out of seven</b> wins.',
      'Your bet is the <b>base bet</b> (big blind). The dealer button moves every hand.',
      'Four rounds: <b>preflop, flop, turn, river</b>. Raises cost 1× the base bet before the turn, 2× after it.',
      '<b>At most two raises</b> per round — a hand can never get more expensive than 13× your base bet.',
      'The house keeps <b>8 % rake</b> from a won pot — but only if a flop was dealt at all.',
      'Folding costs nothing beyond what is already in the pot. <b>Fold well and you win.</b>'
    ],
    penguin: [
      'The penguin hops from left to right across <b>12 floes</b>.',
      'Every hop succeeds with <b>75 %</b> — the further right, the higher the multiplier.',
      'After every successful hop you can <b>cash out</b> and take the current multiplier.',
      'If the floe breaks, the bet is gone. The last floe pays <b>27.5×</b> and cashes out automatically.',
      'You can hop with the button <b>or by tapping the next floe</b>.',
      'No hop is safe — not even the first one.'
    ],
    scratch9: [
      'Nine tiles to scratch — hold the mouse down or swipe.',
      '<b>Eight lines</b> count: three across, three down, two diagonal.',
      'Every line of <b>three matching runes</b> pays its multiplier. <b>Several lines add up.</b>',
      'Crown 50× · star 12× · jewel 5× · flame 2.5× · clover 1.5× · coin 1×',
      'Below sits the <b>bonus rune</b>: usually empty, sometimes an instant win up to <b>20×</b> — with no line at all.'
    ],
    mystery: [
      'There are <b>16 pedestals</b> on the altar. On the call the first souls settle on them — each with its own value.',
      'After that the summoning runs in rounds: if <b>at least one new soul</b> settles, all <b>three candles</b> burn again.',
      'If no soul arrives in a round, <b>one candle goes out</b>. When all three are out, the ritual ends.',
      'What is paid out is the <b>sum of all soul values</b> — not the highest one, all of them together.',
      'A <b>full altar</b> also pays the grand bonus: 5× on Veil of Mist, 18× on Blood Moon, 60× in the Abyss. The bigger the bonus, the rarer the souls — in the Abyss a full altar is pure legend.',
      'If <b>not a single</b> soul settles on the call, the summoning is over right away.',
      'Three rituals to choose from: many small souls, balanced — or rare and brutal.'
    ],
    flappy: [
      'Place your chips and start the flight. <b>Tap, click or press space</b> to make the bird flap — otherwise it drops.',
      'Every pipe you pass raises the multiplier. The first one only brings <b>+2 %</b>, after that the gain grows with every pipe: the fifth brings <b>+14 %</b>, the tenth <b>+29 %</b>, from the 21st it is <b>+60 %</b>. Leaving early is barely worth it — the money is far in the back.',
      'With <b>CASH OUT</b> or the <b>S</b> key you secure bet × multiplier at any moment — mid-air included.',
      'Hitting a pipe or the ground costs the whole bet. The ceiling is soft, nothing happens up there.',
      'With every pipe the <b>gap gets tighter</b>, the pace faster and the spacing shorter. After <b>25 pipes</b> the flight is home and cashes out by itself — that puts <b>1800×</b> on the clock.',
      'Going back to the lobby mid-flight pays out the standing multiplier.'
    ],
    jump: [
      'The hero jumps by himself. You only steer left and right: on a computer with <b>A</b> and <b>D</b> (the arrow keys work too), on a phone with the two buttons on the field.',
      'Off one edge you come back in on the other — as an endless jump should.',
      '<b>Click or tap</b> to shoot a fireball towards the pointer. It clears bats out of the way.',
      '<b>Touching a bat costs your bet</b> — unless you land on it from above, then it bursts and you jump on.',
      'Every <b>340 metres</b> of height the multiplier rises. The first level brings <b>+3 %</b>, the tenth <b>+23 %</b>, from the 27th it is <b>+60 %</b>.',
      'With <b>CASH OUT</b> you secure bet × multiplier at any moment. After <b>25 levels</b> you reach the sky and it cashes out by itself.',
      'From <b>level 6</b> the bats spit purple fireballs — those cost your bet too.',
      'Red springs launch you more than twice as high. Crumbling platforms hold for exactly one jump.',
      'Drop off the bottom of the screen and the bet is gone. Going back to the lobby mid-run pays out the standing multiplier.'
    ],
    smaugcave: [
      'Every round you get a <b>spare tile</b>: turn it and push it into one of the three marked rows/columns — the whole maze shifts. If your figure stands on that row/column it travels along and reappears on the other side.',
      'After that you can walk up to <b>5 tiles</b> to any reachable spot. One click is enough, the adventurer walks by himself.',
      'Gold, gems and pearls raise your <b>multiplier</b>. Stars double the next find, potions shield you briefly from suspicion, fish distract Smaug.',
      'Traps and fire chambers cost some treasure and wake Smaug up noticeably.',
      'The <b>dragon alertness</b> at the top shows how dangerous it is. Before <b>“HUNTING!”</b> you can flee at any time and bank the treasure.',
      'Three <b>keys</b> open Smaug’s hoard in the middle — a risky extra haul waits there.',
      'If Smaug wakes up fully he hunts you through the maze. Push rows/columns to block his path and reach the <b>exit</b> before he does — otherwise he burns you together with your treasure.'
    ]
  };

  /* Die drei Regelsätze aus dem Mehrspieler-Bereich. Sie stehen nicht an
     einem Spiel, sondern am Tisch — deshalb eigene Schlüssel. */
  var MP_REGELN = {
    watten: [
      '<b>Bavarian Watten</b> for four: seats 1 and 3 against seats 2 and 4.',
      'Everyone gets five cards. The <b>forehand</b> calls the <b>Schlag</b> (the rank), the <b>dealer</b> calls the <b>trump suit</b>.',
      'From the top: <b>Max</b> (king of hearts), <b>Belli</b> (seven of bells), <b>Spitz</b> (seven of acorns) — then the <b>Rechte</b> (the Schlag in the trump suit), then the remaining <b>Schläge</b>, then the rest of the trumps.',
      'All other Schläge are equally strong: the one <b>played first</b> beats the later ones.',
      '<b>No obligation to follow suit</b> — you may always play whatever you like.',
      'Whoever takes <b>three of five</b> tricks wins the hand.',
      'A hand is worth <b>2 points</b>. With <b>raise</b> you push it up; the other side <b>goes along</b> or <b>drops out</b> and then pays the value so far.',
      'Every point costs the losers the table stake — the money goes straight to the other team.',
      'The German suits sit on the familiar deck: <b>acorns ♣ · leaves ♠ · hearts ♥ · bells ♦</b>, and <b>Unter = jack, Ober = queen, Sau = ace</b>.'
    ],
    poker: [
      '<b>Texas hold’em</b> against real people: two cards of your own, five face up in the middle.',
      '<b>Knocking</b> means: bet nothing and pass to the next player. That only works while no bet is outstanding — otherwise you have to call, raise or fold. At a real table you knock on the felt for it.',
      'The blinds move around. The <b>D</b> button shows who is dealing.',
      'You have <b>30 seconds</b> per move. If the time runs out, it checks or folds for you.',
      'Betting more than someone else can cover creates a <b>side pot</b> — you never win more than you risked yourself.',
      'Your stack is yours: when you <b>stand up</b> everything goes back to your account.',
      'Leaving in the middle of a hand counts as folding — what you already bet stays in the pot.'
    ],
    flip: [
      '<b>One against one.</b> Both stake the same amount, the coin decides.',
      'Whoever picks first gets their side — the second one gets the other.',
      'If you do not pick in time, the free side is assigned to you.'
    ]
  };

  /** Englische Regeln für einen Mehrspieler-Tisch. */
  GK.regelnMpEn = function (art, deutsch) {
    var r = MP_REGELN[art];
    if (!r) return null;
    if (deutsch && deutsch.length !== r.length) return null;
    return r;
  };

  /**
   * Englische Regeln eines Spiels — oder null, wenn es keine gibt.
   *
   * `deutsch` ist die Originalliste: stimmt die Länge nicht überein, hat
   * jemand eine Regel ergänzt, ohne die Übersetzung nachzuziehen. Dann
   * lieber alles deutsch zeigen als eine Liste mit Lücke.
   */
  GK.regelnEn = function (id, deutsch) {
    var r = REGELN[id];
    if (!r) return null;
    if (deutsch && deutsch.length !== r.length) return null;
    return r;
  };
})(window.GK);
