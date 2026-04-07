document.addEventListener('DOMContentLoaded', () => {
  //Initialize deck
  initDeck();

  //Build chip buttons
  buildChipButtons();

  // Set initial game state
  state.gameState = GameState.BETTING;
  state.chips = 1000;
  setMessage("Place your bet to begin!");
  updateUI();

  // -- Button Event Listeners --

  document.getElementById('deal-btn').addEventListener('click', startRound);
  document.getElementById('new-round-btn').addEventListener('click', newRound);

  document.getElementById('btn-hit').addEventListener('click', hit);
  document.getElementById('btn-stand').addEventListener('click', stand);
  document.getElementById('btn-double').addEventListener('click', doubleDown);
  document.getElementById('btn-split').addEventListener('click', split);

  document.getElementById('btn-insurance-yes').addEventListener('click', takeInsurance);
  document.getElementById('btn-insurance-no').addEventListener('click', declineInsurance);

  document.getElementById('clear-bet-btn').addEventListener('click', clearBet);
  document.getElementById('allin-btn').addEventListener('click', allIn);

  // -- Keyboard Shortcuts --

  document.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
      case 'h': hit(); break;
      case 's': stand(); break;
      case 'd': doubleDown(); break;
      case 'p': split(); break;
      case 'enter':
        if (state.gameState === GameState.BETTING) startRound();
        else if (state.gameState === GameState.ROUND_OVER) newRound();
        break;
    }
  });
});