# Blackjack

A browser-based Blackjack game built with HTML, CSS, and JavaScript. No dependencies, no build step.

## Running

```
open index.html
```

Or serve locally:

```
python3 -m http.server
```

Then visit `http://localhost:8000`.

## Rules

- 6-deck shoe (auto-reshuffles when fewer than 52 cards remain)
- Dealer hits soft 17
- Blackjack pays 3:2
- Insurance at half the bet, pays 2:1
- Double down on first two cards only
- Split up to 4 hands; split Aces receive one card each

## Controls

| Action      | Button | Key     |
|-------------|--------|---------|
| Hit         | Hit    | `H`     |
| Stand       | Stand  | `S`     |
| Double Down | Double | `D`     |
| Split       | Split  | `P`     |
| Deal / Next | Deal   | `Enter` |

## Features

- **Hints** — toggle basic strategy hints during your turn
- **Stats panel** — tracks hands, wins, blackjacks, win %, and current streak
- **Chip persistence** — chip count and stats saved to `localStorage`
- **Animated dealing** — staggered card deal and animated dealer draw
- **All-in button** — bet your entire stack at once

## Project Structure

```
blackjack/
├── index.html              # Entry point; enforces script load order
├── css/
│   └── style.css           # All styles and animations
└── js/
    ├── deck.js             # Pure functions: card creation, shuffling, scoring
    ├── game.js             # All game state and logic (global `state` object)
    ├── ui.js               # DOM rendering; `updateUI()` is the single re-render entry point
    └── main.js             # Event listeners and keyboard shortcuts
```

Scripts must load in the order above. State machine: `IDLE → BETTING → DEALING → PLAYER_TURN → DEALER_TURN → ROUND_OVER → BETTING`
