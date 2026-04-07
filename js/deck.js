'use strict';

const SUITS  = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const NUM_DECKS = 6;

function createDeck() {
  const deck = [];
  for (let d = 0; d < NUM_DECKS; d++)
    for (const suit of SUITS)
      for (const value of VALUES)
        deck.push({ suit, value, faceDown: false });
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function getCardValue(card) {
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  if (card.value === 'A') return 11;
  return parseInt(card.value, 10);
}

function getHandScore(hand) {
  let score = 0, aces = 0;
  for (const card of hand) {
    if (card.faceDown) continue;
    score += getCardValue(card);
    if (card.value === 'A') aces++;
  }
  while (score > 21 && aces > 0) { score -= 10; aces--; }
  return score;
}

function isBust(hand) { return getHandScore(hand) > 21; }

function isBlackjack(hand) {
  return hand.length === 2 && getHandScore(hand) === 21;
}

function isSoftHand(hand) {
  let score = 0, aces = 0;
  for (const card of hand) {
    if (card.faceDown) continue;
    score += getCardValue(card);
    if (card.value === 'A') aces++;
  }
  while (score > 21 && aces > 0) { score -= 10; aces--; }
  return aces > 0 && score <= 21;
}

function canSplit(hand) {
  return hand.length === 2 && getCardValue(hand[0]) === getCardValue(hand[1]);
}

function getSuitSymbol(suit) {
  return { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[suit];
}

function isRedSuit(suit) {
  return suit === 'hearts' || suit === 'diamonds';
}

function getCardImagePath(card) {
  return card.faceDown
    ? 'assets/images/back.svg'
    : `assets/images/${card.value}_of_${card.suit}.svg`;
}

//Basic Strategy (6-deck, dealer hits soft 17)
//Returns: 'Hit' | 'Stand' | 'Double' | 'Split'
//Falls back if actions unavailable:
// - Double -> Stand (soft 18 vs 2–6), else Hit
// - Split -> evaluate as normal hand
function getBasicStrategyHint(playerCards, dealerUpCard, { allowDouble = true, allowSplit = true } = {}) {
  const d     = getCardValue(dealerUpCard); // 2–10, or 11 for Ace
  const score = getHandScore(playerCards);
  const soft  = isSoftHand(playerCards);
  const pair  = canSplit(playerCards);

  // -- Pairs --
  //Only enter pair logic when splits are legal. If not, fall through to
  //the soft/hard section which scores the hand as a normal total.
  if (pair && allowSplit) {
    const v = getCardValue(playerCards[0]);
    if (v === 11) return 'Split';
    if (v === 10) return 'Stand';
    if (v === 9)  return (d === 7 || d >= 10) ? 'Stand' : 'Split';
    if (v === 8)  return 'Split';
    if (v === 7)  return d <= 7 ? 'Split' : 'Hit';
    if (v === 6)  return d <= 6 ? 'Split' : 'Hit';
    //5,5 treated as hard 10 below when allowSplit is false; keep Double when allowed
    if (v === 5)  return (allowDouble && d <= 9) ? 'Double' : 'Hit';
    if (v === 4)  return (d === 5 || d === 6) ? 'Split' : 'Hit';
    return d <= 7 ? 'Split' : 'Hit'; // 2s, 3s
  }

  //Soft totals
  if (soft) {
    if (score >= 19) return 'Stand';
    if (score === 18) {
      //Soft 18 vs 2–6: Double if allowed; otherwise Stand (never Hit)
      if (d >= 2 && d <= 6) return allowDouble ? 'Double' : 'Stand';
      if (d === 7 || d === 8) return 'Stand';
      return 'Hit';
    }
    //Soft 17 (A,6): Double vs 3–6, else Hit; no-double fallback is Hit
    if (score === 17) return (allowDouble && d >= 3 && d <= 6) ? 'Double' : 'Hit';
    //Soft 15–16 (A,4–A,5): Double vs 4–6
    if (score === 16 || score === 15) return (allowDouble && d >= 4 && d <= 6) ? 'Double' : 'Hit';
    //Soft 13–14 (A,2–A,3): Double vs 5–6
    return (allowDouble && (d === 5 || d === 6)) ? 'Double' : 'Hit';
  }

  //Hard totals
  if (score >= 17) return 'Stand';
  if (score >= 13) return (d >= 2 && d <= 6) ? 'Stand' : 'Hit';
  if (score === 12) return (d >= 4 && d <= 6) ? 'Stand' : 'Hit';
  if (score === 11) return (allowDouble && d <= 10) ? 'Double' : 'Hit';
  if (score === 10) return (allowDouble && d >= 2 && d <= 9) ? 'Double' : 'Hit';
  if (score === 9)  return (allowDouble && d >= 3 && d <= 6) ? 'Double' : 'Hit';
  return 'Hit';
}
