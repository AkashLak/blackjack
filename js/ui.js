// -- Card Rendering --

/**
 * Builds and returns a DOM element representing a single playing card.
 * Face-down cards render as a decorative back. New cards trigger a deal animation
 * @param {{ suit: string, value: string, faceDown: boolean }} card
 * @param {boolean} [isNew=false] - Applies deal-in CSS animation if true
 * @returns {HTMLElement}
 */
function createCardElement(card, isNew = false) {
  const el = document.createElement('div');
  el.className = `card ${card.faceDown ? 'face-down' : ''} ${isNew ? 'deal-animation' : ''}`;

  if (card.faceDown) {
    el.innerHTML = `<div class="card-back"><div class="card-back-pattern"></div></div>`;
    return el;
  }

  const color = isRedSuit(card.suit) ? 'red' : 'black';
  const symbol = getSuitSymbol(card.suit);
  const val = card.value;

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
    </div>
  `;
  return el;
}

/**
 * Renders a hand of cards into a container element, including optional
 * label, score, result badge, and active-hand highlight.
 * @param {HTMLElement} container
 * @param {object[]} hand
 * @param {string} [label='']
 * @param {number|string|null} [score=null]
 * @param {{ result: string }|null} [result=null]
 * @param {boolean} [isActive=false]
 */
function renderHand(container, hand, label = '', score = null, result = null, isActive = false) {
  container.innerHTML = '';

  if (label) {
    const labelEl = document.createElement('div');
    labelEl.className = 'hand-label';
    labelEl.textContent = label;
    container.appendChild(labelEl);
  }

  const cardsRow = document.createElement('div');
  cardsRow.className = `cards-row ${isActive ? 'active-hand' : ''}`;

  hand.forEach((card, i) => {
    const cardEl = createCardElement(card, i === hand.length - 1);
    cardsRow.appendChild(cardEl);
  });

  container.appendChild(cardsRow);

  if (score !== null) {
    const scoreEl = document.createElement('div');
    scoreEl.className = 'hand-score';
    scoreEl.textContent = `Score: ${score}`;
    container.appendChild(scoreEl);
  }

  if (result) {
    const resultEl = document.createElement('div');
    resultEl.className = `hand-result result-${result.result}`;
    const labels = {
      win: '✓ WIN',
      lose: '✗ LOSE',
      push: '~ PUSH',
      bust: '✗ BUST',
      blackjack: '★ BLACKJACK!'
    };
    resultEl.textContent = labels[result.result] || result.result.toUpperCase();
    container.appendChild(resultEl);
  }
}

// -- Main UI Update --

function updateUI() {
  updateChipsDisplay();
  updateBetDisplay();
  updateDealerArea();
  updatePlayerArea();
  updateButtons();
  updateMessage();
}

function updateChipsDisplay() {
  document.getElementById('chips-amount').textContent = `$${state.chips.toLocaleString()}`;
}

function updateBetDisplay() {
  document.getElementById('bet-amount').textContent = `$${state.currentBet.toLocaleString()}`;
  if (state.gameState === GameState.PLAYER_TURN || state.gameState === GameState.DEALER_TURN || state.gameState === GameState.ROUND_OVER) {
    document.getElementById('bet-amount').textContent = `$${state.betThisRound.toLocaleString()}`;
  }
}

function updateDealerArea() {
  const container = document.getElementById('dealer-hand');
  if (state.dealerHand.length === 0) {
    container.innerHTML = '<div class="empty-hand">Dealer</div>';
    return;
  }
  const score = state.gameState === GameState.PLAYER_TURN
    ? getHandScore([state.dealerHand[0]])
    : getHandScore(state.dealerHand);
  const scoreLabel = state.gameState === GameState.PLAYER_TURN && state.dealerHand.some(c => c.faceDown)
    ? `${score}+?`
    : score;
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
    const handContainer = document.createElement('div');
    handContainer.className = 'player-hand-container';
    const score = getHandScore(hand);
    const isActive = i === state.activeHandIndex && state.gameState === GameState.PLAYER_TURN;
    const label = state.playerHands.length > 1 ? `Hand ${i + 1}` : '';
    const result = state.handResults[i] || null;
    renderHand(handContainer, hand, label, score, result, isActive);
    container.appendChild(handContainer);
  });
}

/**
 * Shows or hides action/bet buttons based on the current game state.
 * Also disables Double and Split when the player doesn't meet the conditions
 */
function updateButtons() {
  const gs = state.gameState;

  setVisible('bet-controls', gs === GameState.BETTING || gs === GameState.IDLE);
  setVisible('deal-btn', gs === GameState.BETTING);
  setVisible('new-round-btn', gs === GameState.ROUND_OVER);
  setVisible('action-buttons', gs === GameState.PLAYER_TURN);

  if (gs === GameState.PLAYER_TURN) {
    document.getElementById('btn-double').disabled = !canDoubleDown();
    document.getElementById('btn-split').disabled = !canSplitHand();
  }
}

/**
 * Toggles visibility of a DOM element by id using display:flex / none
 * @param {string} id
 * @param {boolean} visible
 */
function setVisible(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? 'flex' : 'none';
}

function updateMessage() {
  const el = document.getElementById('message-area');
  if (state.message) {
    el.textContent = state.message;
    el.style.opacity = '1';
  } else {
    el.style.opacity = '0';
  }
}

function showInsuranceUI(show) {
  setVisible('insurance-controls', show);
  setVisible('action-buttons', !show);
}

/**
 * Determines the overall round outcome across all hands and displays a summary message.
 * Handles mixed results (Ex: one hand won, one lost) from splits
 */
function showRoundResult() {
  const results = state.handResults;
  if (results.length === 0) return;

  const hasBlackjack = results.some(r => r.result === 'blackjack');
  const allWin = results.every(r => r.result === 'win' || r.result === 'blackjack');
  const allLose = results.every(r => r.result === 'lose' || r.result === 'bust');
  const allPush = results.every(r => r.result === 'push');

  let msg = '';
  if (hasBlackjack) msg = '★ BLACKJACK! 3:2 Payout!';
  else if (allWin) msg = '🎉 You Win!';
  else if (allLose) msg = '💸 Dealer Wins';
  else if (allPush) msg = '🤝 Push — Bet Returned';
  else msg = 'Round Over';

  setMessage(msg);
  updateMessage();
}

// -- Chip Buttons --

function buildChipButtons() {
  const chips = [5, 10, 25, 50, 100, 500];
  const container = document.getElementById('chip-buttons');
  container.innerHTML = '';
  chips.forEach(val => {
    const btn = document.createElement('button');
    btn.className = 'chip-btn';
    btn.textContent = `$${val}`;
    btn.dataset.value = val;
    btn.addEventListener('click', () => placeBet(val));
    container.appendChild(btn);
  });
}