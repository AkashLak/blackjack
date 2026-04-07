const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const NUM_DECKS = 6;

/**
 * Builds a fresh unshuffled shoe of NUM_DECKS standard decks
 * @returns {{ suit: string, value: string, faceDown: boolean }[]}
 */
function createDeck() {
  const deck = [];
  for (let d = 0; d < NUM_DECKS; d++) {
    for (const suit of SUITS) {
      for (const value of VALUES) {
        deck.push({ suit, value, faceDown: false });
      }
    }
  }
  return deck;
}

/**
 * Shuffles a deck in-place using the Fisher-Yates algorithm
 * @param {object[]} deck
 * @returns {object[]}
 */
function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Returns a card's numeric blackjack value.
 * Face cards = 10, Aces = 11 (bust reduction handled in getHandScore)
 * @param {{ value: string }} card
 * @returns {number}
 */
function getCardValue(card) {
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  if (card.value === 'A') return 11;
  return parseInt(card.value);
}

/**
 * Calculates the best score for a hand without busting.
 * Aces drop from 11 to 1 as needed. Skips face-down cards
 * @param {{ value: string, faceDown: boolean }[]} hand
 * @returns {number}
 */
function getHandScore(hand) {
  let score = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.faceDown) continue;
    score += getCardValue(card);
    if (card.value === 'A') aces++;
  }
  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }
  return score;
}

function isBust(hand) {
  return getHandScore(hand) > 21;
}

function isBlackjack(hand) {
  return hand.length === 2 && getHandScore(hand) === 21;
}

function isSoftHand(hand) {
  let score = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.faceDown) continue;
    score += getCardValue(card);
    if (card.value === 'A') aces++;
  }
  return aces > 0 && score <= 21 && (score - 10) !== getHandScore(hand) === false;
}

/**
 * Returns true if both cards share the same blackjack value (split eligible)
 * @param {{ value: string }[]} hand
 * @returns {boolean}
 */
function canSplit(hand) {
  return hand.length === 2 && getCardValue(hand[0]) === getCardValue(hand[1]);
}

/**
 * Returns the image asset path for a card. Face-down cards get the back image
 * @param {{ suit: string, value: string, faceDown: boolean }} card
 * @returns {string}
 */
function getCardImagePath(card) {
  if (card.faceDown) return 'assets/images/back.svg';
  return `assets/images/${card.value}_of_${card.suit}.svg`;
}

function getCardDisplayValue(card) {
  return card.value;
}

/**
 * Maps a suit name to its Unicode symbol.
 * @param {string} suit - 'hearts' | 'diamonds' | 'clubs' | 'spades'
 * @returns {string} ♥ ♦ ♣ ♠
 */
function getSuitSymbol(suit) {
  const symbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  return symbols[suit];
}

function isRedSuit(suit) {
  return suit === 'hearts' || suit === 'diamonds';
}