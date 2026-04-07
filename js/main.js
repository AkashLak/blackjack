'use strict';

document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  initDeck();
  buildChipButtons();

  //Show intro screen and game controls stay hidden until Start Game is clicked
  state.gameState = GameState.IDLE;
  updateUI();

  function showIntro() {
    const intro = document.getElementById('intro-screen');
    intro.style.display = 'flex';
    void intro.offsetWidth; //reflow so the transition fires
    intro.classList.remove('fade-out');
  }

  function hideIntro() {
    const intro = document.getElementById('intro-screen');
    intro.classList.add('fade-out');
    setTimeout(() => { intro.style.display = 'none'; }, 450);
  }

  document.getElementById('start-game-btn').addEventListener('click', () => {
    hideIntro();
    newRound(); //transitions to BETTING state
  });

  document.getElementById('exit-game-btn').addEventListener('click', () => {
    window.close();
    //Fallback if the browser blocked window.close()
    const tagline = document.querySelector('.intro-tagline');
    if (tagline) tagline.textContent = 'Thanks for playing — close this tab to exit.';
  });

  document.getElementById('in-game-exit-btn').addEventListener('click', () => {
    //Refund any bet currently in play so chips aren't silently lost
    if (state.gameState === GameState.BETTING) {
      state.chips += state.currentBet;
    } else if (
      state.gameState === GameState.DEALING ||
      state.gameState === GameState.PLAYER_TURN ||
      state.gameState === GameState.DEALER_TURN
    ) {
      state.chips += state.playerHands.reduce((s, h) => s + h.bet, 0);
      state.chips += state.insuranceBet;
    }

    //Reset all round state
    state.gameState       = GameState.IDLE;
    state.dealerHand      = [];
    state.playerHands     = [];
    state.activeHandIndex = 0;
    state.currentBet      = 0;
    state.initialBet      = 0;
    state.insuranceBet    = 0;
    state.message         = '';
    saveToStorage();
    updateUI();
    showIntro();
  });

  // -- Game action buttons --
  document.getElementById('deal-btn').addEventListener('click', startRound);
  document.getElementById('new-round-action-btn').addEventListener('click', newRound);

  document.getElementById('btn-hit').addEventListener('click', hit);
  document.getElementById('btn-stand').addEventListener('click', stand);
  document.getElementById('btn-double').addEventListener('click', doubleDown);
  document.getElementById('btn-split').addEventListener('click', split);

  document.getElementById('btn-insurance-yes').addEventListener('click', takeInsurance);
  document.getElementById('btn-insurance-no').addEventListener('click', declineInsurance);

  document.getElementById('clear-bet-btn').addEventListener('click', clearBet);
  document.getElementById('allin-btn').addEventListener('click', allIn);

  // -- Hints toggle --
  document.getElementById('hint-toggle').addEventListener('click', function () {
    state.hintsEnabled = !state.hintsEnabled;
    this.textContent = state.hintsEnabled ? 'Hints: ON' : 'Hints: OFF';
    this.classList.toggle('active', state.hintsEnabled);
    updateUI();
  });

  // -- Stats panel toggle --
  document.getElementById('stats-toggle').addEventListener('click', () => {
    document.getElementById('stats-panel').classList.toggle('visible');
    updateStatsDisplay();
  });

  // -- Keyboard shortcuts --
  //Disabled during insurance prompt to prevent accidental game actions
  document.addEventListener('keydown', e => {
    if (document.getElementById('insurance-controls').style.display !== 'none') return;
    switch (e.key.toLowerCase()) {
      case 'h':     hit();        break;
      case 's':     stand();      break;
      case 'd':     doubleDown(); break;
      case 'p':     split();      break;
      case 'enter':
        if (state.gameState === GameState.BETTING)    startRound();
        else if (state.gameState === GameState.ROUND_OVER) newRound();
        break;
    }
  });
});
