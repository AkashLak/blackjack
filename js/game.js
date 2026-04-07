'use strict';

const GameState = {
  IDLE:        'idle',
  BETTING:     'betting',
  DEALING:     'dealing',
  PLAYER_TURN: 'player_turn',
  DEALER_TURN: 'dealer_turn',
  ROUND_OVER:  'round_over',
};

//Each hand: (cards, bet, result, isDone, winAmount)
let state = {
  deck:             [],
  dealerHand:       [],
  playerHands:      [],
  activeHandIndex:  0,
  chips:            1000,
  currentBet:       0,
  initialBet:       0,   //pre-split/double bet amount (for insurance computation)
  gameState:        GameState.IDLE,
  insuranceBet:     0,
  hintsEnabled:     false,
  message:          '',
};

let stats = {
  handsPlayed:   0,
  wins:          0,
  losses:        0,
  blackjacks:    0,
  currentStreak: 0,
  bestStreak:    0,
};

function createHand(cards, bet) {
  return { cards, bet, result: null, isDone: false, winAmount: 0 };
}

// -- Persistence --

function saveToStorage() {
  try {
    localStorage.setItem('bj_chips', state.chips);
    localStorage.setItem('bj_stats', JSON.stringify(stats));
  } catch (_) {}
}

function loadFromStorage() {
  try {
    const chips = localStorage.getItem('bj_chips');
    if (chips !== null) {
      const parsed = parseInt(chips, 10);
      if (!isNaN(parsed) && parsed >= 0) state.chips = parsed;
    }
    const s = localStorage.getItem('bj_stats');
    if (s) stats = { ...stats, ...JSON.parse(s) };
  } catch (_) {}
}

// -- Deck --

function initDeck() {
  state.deck = shuffleDeck(createDeck());
}

//Auto-reshuffles when fewer than 52 cards remain
function dealCard(faceDown = false) {
  if (state.deck.length < 52) initDeck();
  const card = state.deck.shift();
  card.faceDown = faceDown;
  return card;
}

// -- Betting --

function placeBet(amount) {
  if (state.gameState !== GameState.BETTING) return;
  if (amount > state.chips) { setMessage('Not enough chips!'); updateUI(); return; }
  state.currentBet += amount;
  state.chips      -= amount;
  updateUI();
  animateBetPulse();
}

function clearBet() {
  if (state.gameState !== GameState.BETTING) return;
  state.chips      += state.currentBet;
  state.currentBet  = 0;
  updateUI();
}

function allIn() {
  if (state.gameState !== GameState.BETTING) return;
  state.currentBet += state.chips;
  state.chips       = 0;
  updateUI();
}

// -- Round Flow --

function startRound() {
  if (state.currentBet === 0) { setMessage('Place a bet to start!'); updateUI(); return; }

  state.gameState    = GameState.DEALING;
  state.initialBet   = state.currentBet;
  state.insuranceBet = 0;

  //Assign staggered deal delays for animation (consumed on first render)
  const p1 = dealCard();      p1.dealDelay = 0;
  const d1 = dealCard();      d1.dealDelay = 180;
  const p2 = dealCard();      p2.dealDelay = 360;
  const d2 = dealCard(true);  d2.dealDelay = 540; // hole card

  state.dealerHand      = [d1, d2];
  state.playerHands     = [createHand([p1, p2], state.currentBet)];
  state.activeHandIndex = 0;
  state.currentBet      = 0;

  state.gameState = GameState.PLAYER_TURN;
  updateUI();
  setTimeout(checkForImmediateBlackjack, 700);
}

//Checks the actual card values regardless of faceDown status.
//isBlackjack() uses getHandScore() which skips face-down cards,
//so it cannot be used to peek at the hole card.
function dealerHasBlackjack() {
  const [c1, c2] = state.dealerHand;
  return (c1.value === 'A' && getCardValue(c2) === 10) ||
         (c2.value === 'A' && getCardValue(c1) === 10);
}

function checkForImmediateBlackjack() {
  const hand        = state.playerHands[0];
  const dealerUpCard = state.dealerHand[0];

  // Offer insurance when dealer shows Ace
  if (dealerUpCard.value === 'A') {
    offerInsurance();
    return;
  }

  //Dealer peeks for blackjack on 10-value up-card.
  //Must use dealerHasBlackjack()
  if (getCardValue(dealerUpCard) === 10 && dealerHasBlackjack()) {
    revealDealerCard();
    endRound();
    return;
  }

  if (isBlackjack(hand.cards)) {
    revealDealerCard();
    endRound();
  }
}

function offerInsurance() {
  setMessage('Dealer shows Ace — Take Insurance?');
  showInsuranceUI(true);
  updateUI();
}

function takeInsurance() {
  const max = Math.floor(state.initialBet / 2);
  if (state.chips < max) { setMessage('Not enough chips for insurance!'); updateUI(); return; }
  state.insuranceBet  = max;
  state.chips        -= max;
  showInsuranceUI(false);
  checkPlayerBlackjackAfterInsurance();
}

function declineInsurance() {
  showInsuranceUI(false);
  checkPlayerBlackjackAfterInsurance();
}

function checkPlayerBlackjackAfterInsurance() {
  if (dealerHasBlackjack() || isBlackjack(state.playerHands[0].cards)) {
    revealDealerCard();
    endRound();
  } else {
    updateUI();
  }
}

// -- Player Actions --

function hit() {
  if (state.gameState !== GameState.PLAYER_TURN) return;
  const hand = state.playerHands[state.activeHandIndex];
  hand.cards.push(dealCard());
  updateUI();

  if (isBust(hand.cards)) {
    hand.result = 'bust';
    hand.isDone = true;
    setMessage(state.playerHands.length > 1
      ? `Hand ${state.activeHandIndex + 1} busts!`
      : 'Bust!');
    setTimeout(nextHandOrDealerTurn, 800);
  } else if (getHandScore(hand.cards) === 21) {
    hand.isDone = true;
    nextHandOrDealerTurn();
  }
}

function stand() {
  if (state.gameState !== GameState.PLAYER_TURN) return;
  state.playerHands[state.activeHandIndex].isDone = true;
  nextHandOrDealerTurn();
}

function doubleDown() {
  if (state.gameState !== GameState.PLAYER_TURN) return;
  const hand = state.playerHands[state.activeHandIndex];
  if (hand.cards.length !== 2) { setMessage('Can only double on first two cards!'); updateUI(); return; }
  if (state.chips < hand.bet)  { setMessage('Not enough chips to double down!');    updateUI(); return; }
  state.chips -= hand.bet;
  hand.bet    *= 2;
  hand.cards.push(dealCard());
  hand.isDone = true;
  //Must check bust here - endRound() skips hands where result === 'bust',
  //but if this is left null a busted score like 22 can pass playerScore > dealerScore.
  if (isBust(hand.cards)) {
    hand.result = 'bust';
    setMessage(state.playerHands.length > 1 ? `Hand ${state.activeHandIndex + 1} busts!` : 'Bust!');
  }
  updateUI();
  setTimeout(nextHandOrDealerTurn, 450);
}

function split() {
  if (state.gameState !== GameState.PLAYER_TURN) return;
  const hand = state.playerHands[state.activeHandIndex];
  if (!canSplit(hand.cards))         { setMessage('Can only split matching cards!');   updateUI(); return; }
  if (state.playerHands.length >= 4) { setMessage('Cannot split more than 4 hands!'); updateUI(); return; }
  if (state.chips < hand.bet)        { setMessage('Not enough chips to split!');       updateUI(); return; }

  state.chips -= hand.bet;
  const card2  = hand.cards.pop();
  hand.cards.push(dealCard());

  const newHand = createHand([card2, dealCard()], hand.bet);
  state.playerHands.splice(state.activeHandIndex + 1, 0, newHand);

  //Split Aces: one card each, no further player action
  if (hand.cards[0].value === 'A') {
    hand.isDone    = true;
    newHand.isDone = true;
    nextHandOrDealerTurn();
  } else {
    updateUI();
  }
}

function nextHandOrDealerTurn() {
  state.activeHandIndex++;
  //Skip hands already finished (Ex: split aces)
  while (
    state.activeHandIndex < state.playerHands.length &&
    state.playerHands[state.activeHandIndex].isDone
  ) { state.activeHandIndex++; }

  if (state.activeHandIndex < state.playerHands.length) {
    state.gameState = GameState.PLAYER_TURN;
    updateUI();
  } else if (state.playerHands.every(h => h.result === 'bust')) {
    //All hands busted - dealer has already won, no draw needed
    endRound();
  } else {
    dealerTurn();
  }
}

// -- Dealer Turn --

function dealerTurn() {
  state.gameState = GameState.DEALER_TURN;
  revealDealerCard();

  function drawNext() {
    if (getHandScore(state.dealerHand) < 17 || isDealerSoft17()) {
      state.dealerHand.push(dealCard());
      updateUI();
      setTimeout(drawNext, 700);
    } else {
      endRound();
    }
  }
  setTimeout(drawNext, 900);
}

//Correct soft-17: score is exactly 17 AND an Ace is still counting as 11
function isDealerSoft17() {
  return getHandScore(state.dealerHand) === 17 && isSoftHand(state.dealerHand);
}

function revealDealerCard() {
  state.dealerHand.forEach(card => {
    if (card.faceDown) card.justRevealed = true;
    card.faceDown = false;
  });
  updateUI();
}

// -- Round Resolution --

function endRound() {
  state.gameState = GameState.ROUND_OVER;
  const dealerScore = getHandScore(state.dealerHand);
  const dealerBJ    = isBlackjack(state.dealerHand);
  let totalWinnings = 0;

  //Insurance pays 2:1 if dealer has blackjack
  if (state.insuranceBet > 0 && dealerBJ) {
    totalWinnings += state.insuranceBet * 3;
  }

  const soloHand = state.playerHands.length === 1;

  for (const hand of state.playerHands) {
    if (hand.result === 'bust') continue;

    const playerScore = getHandScore(hand.cards);
    const playerBJ   = isBlackjack(hand.cards) && soloHand;
    let result, winAmount = 0;

    if (playerBJ && !dealerBJ) {
      result    = 'blackjack';
      winAmount = Math.floor(hand.bet * 2.5); //3:2 payout
    } else if (playerBJ && dealerBJ) {
      result    = 'push';
      winAmount = hand.bet;
    } else if (dealerBJ) {
      result = 'lose';
    } else if (isBust(state.dealerHand) || playerScore > dealerScore) {
      result    = 'win';
      winAmount = hand.bet * 2;
    } else if (playerScore === dealerScore) {
      result    = 'push';
      winAmount = hand.bet;
    } else {
      result = 'lose';
    }

    hand.result    = result;
    hand.winAmount = winAmount;
    totalWinnings += winAmount;
  }

  state.chips += totalWinnings;
  recordStats();
  saveToStorage();
  updateUI();
  showRoundResult();

  if (state.chips <= 0) {
    setTimeout(() => {
      //Safety: if the player already clicked New Round before this fired,
      if (state.gameState !== GameState.ROUND_OVER) return;
      setMessage('Out of chips — resetting to $1,000.');
      state.chips = 1000;
      saveToStorage();
      updateUI();
    }, 2500);
  }
}

function recordStats() {
  let anyWin = false, anyLoss = false;
  for (const hand of state.playerHands) {
    stats.handsPlayed++;
    if (hand.result === 'blackjack') { stats.blackjacks++; stats.wins++; anyWin = true; }
    else if (hand.result === 'win')  { stats.wins++;  anyWin  = true; }
    else if (hand.result === 'lose' || hand.result === 'bust') { stats.losses++; anyLoss = true; }
  }
  if (anyWin && !anyLoss) {
    stats.currentStreak = stats.currentStreak > 0 ? stats.currentStreak + 1 : 1;
  } else if (anyLoss && !anyWin) {
    stats.currentStreak = stats.currentStreak < 0 ? stats.currentStreak - 1 : -1;
  } else {
    stats.currentStreak = 0; // push or mixed
  }
  stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
}

// -- New Round --

function newRound() {
  //Edge case: player clicks New Round before the 2500ms reset timeout fires.
  //Silently restore chips so they are never stuck in betting with $0.
  if (state.chips <= 0) {
    state.chips = 1000;
    saveToStorage();
  }
  state.gameState       = GameState.BETTING;
  state.dealerHand      = [];
  state.playerHands     = [];
  state.activeHandIndex = 0;
  state.currentBet      = 0;
  state.initialBet      = 0;
  state.insuranceBet    = 0;
  setMessage('Place your bet!');
  updateUI();
}

// -- Helpers --

function setMessage(msg) { state.message = msg; }

function canDoubleDown() {
  const hand = state.playerHands[state.activeHandIndex];
  return !!hand && hand.cards.length === 2 && state.chips >= hand.bet;
}

function canSplitHand() {
  const hand = state.playerHands[state.activeHandIndex];
  return !!hand && canSplit(hand.cards) && state.chips >= hand.bet && state.playerHands.length < 4;
}

function getCurrentHint() {
  if (!state.hintsEnabled || state.gameState !== GameState.PLAYER_TURN) return null;
  const hand = state.playerHands[state.activeHandIndex];
  if (!hand || hand.isDone) return null;
  return getBasicStrategyHint(hand.cards, state.dealerHand[0], {
    allowDouble: canDoubleDown(),
    allowSplit:  canSplitHand(),
  });
}
