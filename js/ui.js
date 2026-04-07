'use strict';

// -- Card Rendering --

function createCardElement(card, isNew = false) {
  const el = document.createElement('div');
  const hasDealDelay   = card.dealDelay    !== undefined;
  const willFlip       = !!card.justRevealed;
  const shouldAnimate  = hasDealDelay || (isNew && !card._rendered);

  el.className = [
    'card',
    card.faceDown  ? 'face-down'    : '',
    shouldAnimate  ? 'deal-animation' : '',
    willFlip       ? 'flip-reveal'  : '',
  ].filter(Boolean).join(' ');

  if (hasDealDelay) {
    el.style.animationDelay = `${card.dealDelay}ms`;
    delete card.dealDelay;
  }
  if (willFlip) delete card.justRevealed;
  card._rendered = true;

  if (card.faceDown) {
    el.innerHTML = `<div class="card-back"><div class="card-back-pattern"></div></div>`;
    return el;
  }

  const color  = isRedSuit(card.suit) ? 'red' : 'black';
  const symbol = getSuitSymbol(card.suit);
  const val    = card.value;

  el.innerHTML = `
    <div class="card-inner ${color}">
      <div class="card-corner top-left">
        <span class="card-value">${val}</span>
        <span class="card-suit">${symbol}</span>
      </div>
      <div class="card-center">${symbol}</div>
      <div class="card-corner bottom-right">
        <span class="card-value">${val}</span>
        <span class="card-suit">${symbol}</span>
      </div>
    </div>`;
  return el;
}

function renderHand(container, cards, label = '', score = null, result = null, isActive = false) {
  container.innerHTML = '';

  if (label) {
    const labelEl = document.createElement('div');
    labelEl.className   = 'hand-label';
    labelEl.textContent = label;
    container.appendChild(labelEl);
  }

  const cardsRow = document.createElement('div');
  cardsRow.className = `cards-row${isActive ? ' active-hand' : ''}`;

  cards.forEach((card, i) => {
    //isNew = last card AND not yet rendered AND no pre-set deal delay
    const isNew  = i === cards.length - 1 && !card._rendered && card.dealDelay === undefined;
    cardsRow.appendChild(createCardElement(card, isNew));
  });
  container.appendChild(cardsRow);

  if (score !== null) {
    const el = document.createElement('div');
    el.className   = 'hand-score';
    el.textContent = score;
    container.appendChild(el);
  }

  if (result) {
    const el = document.createElement('div');
    el.className   = `hand-result result-${result.result}`;
    el.textContent = {
      win:       '✓ WIN',
      lose:      '✗ LOSE',
      push:      '~ PUSH',
      bust:      '✗ BUST',
      blackjack: '★ BLACKJACK',
    }[result.result] || result.result.toUpperCase();
    container.appendChild(el);
  }
}

// -- Main Update --

function updateUI() {
  updateChipsDisplay();
  updateBetDisplay();
  updateDealerArea();
  updatePlayerArea();
  updateButtons();
  updateMessage();
  updateHintDisplay();
  updateStatsDisplay();
  updateBetStack();
}

function updateChipsDisplay() {
  document.getElementById('chips-amount').textContent = `$${state.chips.toLocaleString()}`;
}

function updateBetDisplay() {
  const el = document.getElementById('bet-amount');
  if (state.gameState === GameState.BETTING || state.gameState === GameState.IDLE) {
    el.textContent = `$${state.currentBet.toLocaleString()}`;
  } else {
    const total = state.playerHands.reduce((s, h) => s + h.bet, 0);
    el.textContent = `$${total.toLocaleString()}`;
  }
}

function updateDealerArea() {
  const container = document.getElementById('dealer-hand');
  if (state.dealerHand.length === 0) {
    container.innerHTML = '<div class="empty-hand">Dealer</div>';
    return;
  }
  const showFull   = state.gameState !== GameState.PLAYER_TURN;
  const score      = showFull ? getHandScore(state.dealerHand) : getHandScore([state.dealerHand[0]]);
  const scoreLabel = !showFull && state.dealerHand.some(c => c.faceDown) ? `${score} + ?` : score;
  renderHand(container, state.dealerHand, '', scoreLabel);
}

function updatePlayerArea() {
  const container = document.getElementById('player-hands');
  container.innerHTML = '';

  if (state.playerHands.length === 0) {
    container.innerHTML = '<div class="empty-hand">Player</div>';
    return;
  }

  state.playerHands.forEach((hand, i) => {
    const div      = document.createElement('div');
    const isActive = i === state.activeHandIndex && state.gameState === GameState.PLAYER_TURN;
    div.className  = 'player-hand-container';

    if (hand.result === 'win' || hand.result === 'blackjack') div.classList.add('hand-win');
    if (hand.result === 'lose' || hand.result === 'bust')     div.classList.add('hand-lose');

    const label  = state.playerHands.length > 1 ? `Hand ${i + 1}  ·  $${hand.bet.toLocaleString()}` : '';
    const score  = getHandScore(hand.cards);
    const result = hand.result ? { result: hand.result } : null;
    renderHand(div, hand.cards, label, score, result, isActive);
    container.appendChild(div);
  });
}

function updateButtons() {
  const gs         = state.gameState;
  const insVisible = document.getElementById('insurance-controls').style.display !== 'none';

  setVisible('bet-controls',   gs === GameState.BETTING || gs === GameState.IDLE);
  setVisible('deal-btn',       gs === GameState.BETTING);
  setVisible('new-round-btn',  gs === GameState.ROUND_OVER);
  setVisible('action-buttons', gs === GameState.PLAYER_TURN && !insVisible);

  if (gs === GameState.PLAYER_TURN && !insVisible) {
    document.getElementById('btn-double').disabled = !canDoubleDown();
    document.getElementById('btn-split').disabled  = !canSplitHand();
  }
}

function setVisible(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? 'flex' : 'none';
}

function updateMessage() {
  const el = document.getElementById('message-area');
  el.textContent   = state.message || '';
  el.style.opacity = state.message ? '1' : '0';
}

function showInsuranceUI(show) {
  setVisible('insurance-controls', show);
  if (show) {
    setVisible('action-buttons', false);
  } else if (state.gameState === GameState.PLAYER_TURN) {
    setVisible('action-buttons', true);
  }
}

function showRoundResult() {
  const hands = state.playerHands;
  if (!hands.length) return;

  let msg;
  if (hands.length === 1) {
    const h      = hands[0];
    const profit = h.winAmount - h.bet;
    msg = ({
      blackjack: `★ Blackjack! Paid 3:2  (+$${profit.toLocaleString()})`,
      win:       `You win $${profit.toLocaleString()}!`,
      lose:      `Dealer wins — you lost $${h.bet.toLocaleString()}.`,
      bust:      `Bust! You lost $${h.bet.toLocaleString()}.`,
      push:      `Push — bet returned.`,
    })[h.result] || 'Round over.';
  } else {
    const labels = { win: 'wins', lose: 'loses', bust: 'busts', push: 'pushes', blackjack: 'Blackjack!' };
    msg = hands.map((h, i) => `Hand ${i + 1} ${labels[h.result] || h.result}`).join('  ·  ');
  }
  setMessage(msg);
  updateMessage();

  //Table ambient glow by outcome
  const felt = document.querySelector('.table-felt');
  felt.classList.remove('glow-win', 'glow-blackjack', 'glow-lose');
  if      (hands.some(h => h.result === 'blackjack'))                    felt.classList.add('glow-blackjack');
  else if (hands.some(h => h.result === 'win'))                          felt.classList.add('glow-win');
  else if (hands.every(h => h.result === 'lose' || h.result === 'bust')) felt.classList.add('glow-lose');
  setTimeout(() => felt.classList.remove('glow-win', 'glow-blackjack', 'glow-lose'), 2200);
}

// -- Chip Buttons --

function buildChipButtons() {
  const denominations = [5, 10, 25, 50, 100, 500];
  const colors = {
    5: '#b71c1c', 10: '#1a237e', 25: '#1b5e20',
    50: '#4a148c', 100: '#e65100', 500: '#880e4f',
  };
  const container = document.getElementById('chip-buttons');
  container.innerHTML = '';
  denominations.forEach(val => {
    const btn = document.createElement('button');
    btn.className = 'chip-btn';
    btn.style.setProperty('--chip-color', colors[val]);
    btn.innerHTML = `<span>$${val}</span>`;
    btn.dataset.value = val;
    btn.addEventListener('click', () => placeBet(val));
    container.appendChild(btn);
  });
}

// -- Bet Stack --

function updateBetStack() {
  const container = document.getElementById('bet-stack');
  if (!container) return;
  container.innerHTML = '';
  if (state.currentBet <= 0) return;

  //Show 1–3 stacked chip layers based on bet magnitude
  const layers = state.currentBet >= 200 ? 3 : state.currentBet >= 50 ? 2 : 1;
  for (let i = 0; i < layers; i++) {
    const chip = document.createElement('div');
    chip.className = 'bet-chip-visual';
    chip.style.bottom  = `${i * 7}px`;
    chip.style.zIndex  = i + 1;
    chip.style.opacity = i < layers - 1 ? '0.65' : '1';
    if (i === layers - 1) chip.textContent = `$${state.currentBet.toLocaleString()}`;
    container.appendChild(chip);
  }
}

function animateBetPulse() {
  const el = document.getElementById('bet-amount');
  if (!el) return;
  el.classList.remove('bet-pulse');
  void el.offsetWidth; //force reflow to restart animation
  el.classList.add('bet-pulse');
}

// -- Hint Display --

function updateHintDisplay() {
  const el = document.getElementById('hint-display');
  if (!el) return;
  const hint = getCurrentHint();
  if (hint) {
    el.textContent = `Strategy: ${hint}`;
    el.className   = `hint-display hint-${hint.toLowerCase()} visible`;
  } else {
    el.className   = 'hint-display';
    el.textContent = '';
  }
}

// -- Stats Display --

function updateStatsDisplay() {
  const panel = document.getElementById('stats-panel');
  if (!panel || !panel.classList.contains('visible')) return;

  const winRate  = stats.handsPlayed > 0 ? Math.round((stats.wins / stats.handsPlayed) * 100) : 0;
  const sign     = stats.currentStreak > 0 ? '+' : '';

  document.getElementById('stat-hands').textContent   = stats.handsPlayed;
  document.getElementById('stat-wins').textContent    = stats.wins;
  document.getElementById('stat-bj').textContent      = stats.blackjacks;
  document.getElementById('stat-winrate').textContent = stats.handsPlayed > 0 ? `${winRate}%` : '—';

  const streakEl    = document.getElementById('stat-streak');
  streakEl.textContent = `${sign}${stats.currentStreak}`;
  streakEl.className   = `stat-value${stats.currentStreak > 0 ? ' positive' : stats.currentStreak < 0 ? ' negative' : ''}`;
}
