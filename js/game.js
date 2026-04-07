const GameState = {
  IDLE: 'idle',
  BETTING: 'betting',
  DEALING: 'dealing',
  PLAYER_TURN: 'player_turn',
  DEALER_TURN: 'dealer_turn',
  ROUND_OVER: 'round_over',
};

let state = {
  deck: [],
  dealerHand: [],
  playerHands: [],
  activeHandIndex: 0,
  chips: 1000,
  currentBet: 0,
  betThisRound: 0,
  gameState: GameState.IDLE,
  insuranceBet: 0,
  message: '',
  handResults: [],
};

// -- Deck Management --

function initDeck() {
  state.deck = shuffleDeck(createDeck());
}

/**
 * Draws the next card from the shoe. Auto-reshuffles if fewer than 52 cards remain
 * @param {boolean} [faceDown=false]
 * @returns {{ suit: string, value: string, faceDown: boolean }}
 */
function dealCard(faceDown = false) {
  if (state.deck.length < 52) initDeck();
  const card = state.deck.shift();
  card.faceDown = faceDown;
  return card;
}

// -- Betting --

function placeBet(amount) {
  if (state.gameState !== GameState.BETTING) return;
  if (amount > state.chips) {
    setMessage("Not enough chips!");
    return;
  }
  state.currentBet += amount;
  state.chips -= amount;
  updateUI();
}

function clearBet() {
  if (state.gameState !== GameState.BETTING) return;
  state.chips += state.currentBet;
  state.currentBet = 0;
  updateUI();
}

function allIn() {
  if (state.gameState !== GameState.BETTING) return;
  state.currentBet += state.chips;
  state.chips = 0;
  updateUI();
}

// -- Round Flow --

function startRound() {
  if (state.currentBet === 0) {
    setMessage("Place a bet to start!");
    return;
  }
  state.gameState = GameState.DEALING;
  state.betThisRound = state.currentBet;
  state.insuranceBet = 0;
  state.handResults = [];

  const p1 = dealCard();
  const d1 = dealCard();
  const p2 = dealCard();
  const d2 = dealCard(true); //dealer hole card

  state.dealerHand = [d1, d2];
  state.playerHands = [[p1, p2]];
  state.activeHandIndex = 0;

  state.gameState = GameState.PLAYER_TURN;
  updateUI();
  checkForImmediateBlackjack();
}

function checkForImmediateBlackjack() {
  const playerHand = state.playerHands[0];
  const dealerUpCard = state.dealerHand[0];

  if (dealerUpCard.value === 'A') {
    offerInsurance();
    return;
  }

  if (isBlackjack(playerHand)) {
    revealDealerCard();
    endRound();
  }
}

function offerInsurance() {
  setMessage("Dealer shows Ace. Take insurance?");
  showInsuranceUI(true);
}

/**
 * Places an insurance side bet at half the current bet (pays 2:1 if dealer has blackjack)
 */
function takeInsurance() {
  const maxInsurance = Math.floor(state.betThisRound / 2);
  if (state.chips < maxInsurance) {
    setMessage("Not enough chips for insurance!");
    return;
  }
  state.insuranceBet = maxInsurance;
  state.chips -= maxInsurance;
  showInsuranceUI(false);
  checkPlayerBlackjackAfterInsurance();
}

function declineInsurance() {
  showInsuranceUI(false);
  checkPlayerBlackjackAfterInsurance();
}

function checkPlayerBlackjackAfterInsurance() {
  const playerHand = state.playerHands[0];
  if (isBlackjack(playerHand)) {
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
  hand.push(dealCard());
  updateUI();

  if (isBust(hand)) {
    setMessage(`Hand ${state.activeHandIndex + 1} busts!`);
    nextHandOrDealerTurn();
  } else if (getHandScore(hand) === 21) {
    nextHandOrDealerTurn();
  }
}

function stand() {
  if (state.gameState !== GameState.PLAYER_TURN) return;
  nextHandOrDealerTurn();
}

/**
 * Doubles the bet and deals exactly one more card, then ends the player's turn.
 * Only allowed on the first two cards of a non-split hand
 */
function doubleDown() {
  if (state.gameState !== GameState.PLAYER_TURN) return;
  const hand = state.playerHands[state.activeHandIndex];
  if (hand.length !== 2) {
    setMessage("Can only double down on first two cards!");
    return;
  }
  if (state.chips < state.betThisRound) {
    setMessage("Not enough chips to double down!");
    return;
  }
  state.chips -= state.betThisRound;
  state.betThisRound *= 2;
  hand.push(dealCard());
  updateUI();
  nextHandOrDealerTurn();
}

/**
 * Splits the active hand into two separate hands, each receiving a new second card.
 * Split Aces receive only one card each per casino rules. Max 4 hands allowed
 */
function split() {
  if (state.gameState !== GameState.PLAYER_TURN) return;
  const hand = state.playerHands[state.activeHandIndex];

  if (!canSplit(hand)) {
    setMessage("Can only split matching cards!");
    return;
  }
  if (state.playerHands.length >= 4) {
    setMessage("Cannot split more than 4 hands!");
    return;
  }
  if (state.chips < state.betThisRound) {
    setMessage("Not enough chips to split!");
    return;
  }

  state.chips -= state.betThisRound;

  const card2 = hand.pop();
  hand.push(dealCard());

  const newHand = [card2, dealCard()];
  state.playerHands.splice(state.activeHandIndex + 1, 0, newHand);

  if (hand[0].value === 'A') {
    nextHandOrDealerTurn();
  } else {
    updateUI();
  }
}

function nextHandOrDealerTurn() {
  state.activeHandIndex++;
  if (state.activeHandIndex < state.playerHands.length) {
    state.gameState = GameState.PLAYER_TURN;
    updateUI();
  } else {
    dealerTurn();
  }
}

// -- Dealer Turn --

/**
 * Runs the dealer's turn. Reveals the hole card, then draws with time delay
 * delay between cards until the dealer must stand or busts
 */
function dealerTurn() {
  state.gameState = GameState.DEALER_TURN;
  revealDealerCard();

  function dealerDraw() {
    const score = getHandScore(state.dealerHand);
    if (score < 17 || isDealerSoft17()) {
      state.dealerHand.push(dealCard());
      updateUI();
      setTimeout(dealerDraw, 600);
    } else {
      endRound();
    }
  }

  setTimeout(dealerDraw, 600);
}

/**
 * Returns true if the dealer holds a soft 17 (Ace counted as 11, total = 17).
 * The dealer must hit on soft 17 per official casino rules
 * @returns {boolean}
 */
function isDealerSoft17() {
  const hand = state.dealerHand;
  let score = 0;
  let aces = 0;
  for (const card of hand) {
    score += getCardValue(card);
    if (card.value === 'A') aces++;
  }
  return aces > 0 && score === 17;
}

function revealDealerCard() {
  state.dealerHand.forEach(card => card.faceDown = false);
  updateUI();
}

// -- Round Resolution --

/**
 * Resolves all player hands against the dealer, applies payouts, and updates chips.
 * Blackjack pays 3:2. Insurance pays 2:1. Pushes return the original bet
 */
function endRound() {
  state.gameState = GameState.ROUND_OVER;
  const dealerScore = getHandScore(state.dealerHand);
  const dealerBJ = isBlackjack(state.dealerHand);
  let totalWinnings = 0;
  state.handResults = [];

  if (state.insuranceBet > 0 && dealerBJ) {
    totalWinnings += state.insuranceBet * 3; //2:1 payout + stake returned
  }

  for (let i = 0; i < state.playerHands.length; i++) {
    const hand = state.playerHands[i];
    const playerScore = getHandScore(hand);
    const playerBJ = isBlackjack(hand) && state.playerHands.length === 1;

    let result = '';
    let winAmount = 0;

    if (isBust(hand)) {
      result = 'bust';
    } else if (playerBJ && !dealerBJ) {
      result = 'blackjack';
      winAmount = Math.floor(state.betThisRound * 2.5); //3:2
    } else if (playerBJ && dealerBJ) {
      result = 'push';
      winAmount = state.betThisRound;
    } else if (dealerBJ) {
      result = 'lose';
    } else if (isBust(state.dealerHand) || playerScore > dealerScore) {
      result = 'win';
      winAmount = state.betThisRound * 2;
    } else if (playerScore === dealerScore) {
      result = 'push';
      winAmount = state.betThisRound;
    } else {
      result = 'lose';
    }

    totalWinnings += winAmount;
    state.handResults.push({ result, winAmount });
  }

  state.chips += totalWinnings;
  state.currentBet = 0;

  updateUI();
  showRoundResult();

  if (state.chips === 0) {
    setTimeout(() => {
      setMessage("Out of chips! Game reset.");
      state.chips = 1000;
      updateUI();
    }, 2000);
  }
}

// -- New Round --

function newRound() {
  state.gameState = GameState.BETTING;
  state.dealerHand = [];
  state.playerHands = [];
  state.activeHandIndex = 0;
  state.currentBet = 0;
  state.betThisRound = 0;
  state.insuranceBet = 0;
  state.handResults = [];
  setMessage("Place your bet!");
  updateUI();
}

// -- Helpers --

function setMessage(msg) {
  state.message = msg;
}

function getActiveHand() {
  return state.playerHands[state.activeHandIndex] || [];
}

/**
 * Returns true if the player can double down on their current hand.
 * Requires exactly 2 cards, sufficient chips, and no active split
 * @returns {boolean}
 */
function canDoubleDown() {
  const hand = getActiveHand();
  return hand.length === 2 && state.chips >= state.betThisRound && state.playerHands.length === 1;
}

/**
 * Returns true if the current hand is eligible to split.
 * Requires matching card values, sufficient chips, and fewer than 4 hands
 * @returns {boolean}
 */
function canSplitHand() {
  const hand = getActiveHand();
  return canSplit(hand) && state.chips >= state.betThisRound && state.playerHands.length < 4;
}