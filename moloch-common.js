const bouncer = new Bouncer("wss://bouncer-server.herokuapp.com/");
const MOLOCH = "<b>MOLOCH</b>";
var currentGame;
var scores = {};
scores[MOLOCH] = 0;
var cachedScores = {};
cachedScores[MOLOCH] = 0;
var playerRanking = [MOLOCH];
const nicknames = {};
var gameStartedTimestamp = -1;
var endingTime = 0;
const HALF_LIFE = 60000;
var lastEvent;
var interval = null;
var events = {};

function fillGameName() {
  let param = window.location.search.substr(1);
  if (param) {
    document.getElementById("gameName").value = param;
  }
}

function joinGame() {
  let gameNameInput = document.getElementById("gameName").value.toLowerCase();
  if (!gameNameInput) {return;}
  let gameName = GAME_PREFIX + gameNameInput;
  if (gameName === currentGame) {return;}
  let username = document.getElementById("username").value;
  if (!username) {return;}
  if (currentGame) { bouncer.quit(currentGame); }
  currentGame = gameName;
  while (!bouncer.isConnected()) { /* block */ }
  scores = {};
  scores[MOLOCH] = 0;
  events = {};
  lastEvent = null;
  bouncer.join(gameName);
  if (username) { bouncer.send({username: username}, gameName); }
  document.getElementById("gameView").style.display = "block";
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  gameStartedTimestamp = -1;
  bouncer.hello((msg) => {
    if (msg.uid === bouncer.uid) {return}
    if (gameStartedTimestamp === -1 || msg.timestamp < gameStartedTimestamp) {
      scores[msg.uid] = 0;
      if (username) { bouncer.send({username: username}, gameName); }
      bouncer.members(currentGame, (response) => {
        response.members.forEach((member) => {scores[member] = 0;})
        updatePlayersList();
      });
    } else {
      bouncer.send({playersInProgress: Object.keys(scores)}, currentGame);
    }
  });
  bouncer.members(currentGame, (response) => {
    response.members.forEach((member) => {scores[member] = 0;})
    updatePlayersList();
  });
  bouncer.goodbye( (msg) => {
    delete scores[msg.uid];
    updatePlayersList();
  } );
}

function startGame() {
  if (currentGame && bouncer.isConnected()) {
    let endingTimeToSend = Math.ceil(HALF_LIFE * -Math.log(Math.random()));
    bouncer.send({start: true, endingTime: endingTimeToSend}, currentGame);
  }
}

function showModal() {
  document.getElementById("modalContainer").classList.remove("invisible");
}

function hideModal() {
  document.getElementById("modalContainer").classList.add("invisible");
}

function computeScores(gameOver) {
  if (gameStartedTimestamp === -1) {return}
  let now = gameOver ? gameStartedTimestamp+gameOver : new Date() - 0;
  let duration = now - lastEvent;
  let newScores = {};
  for (let player in scores) {newScores[player] = 0;}
  findScoresForDuration(getHistory(), newScores, duration);
  for (let player in scores) {
    scores[player] = cachedScores[player] + newScores[player];
  }
  if (!gameOver && endingTime && endingTime < now - gameStartedTimestamp) {
    clearInterval(interval);
    interval = null;
    computeCachedScores(endingTime);
    updatePlayersList();
    gameStartedTimestamp = -1;
    showModal();
  }
}


bouncer.receive((msg) => {
  if (msg.payload.start && (!interval || msg.timestamp < gameStartedTimestamp)) {
    if (gameStartedTimestamp === -1) {
      events = {};
      clearHistory();
    }
    gameStartedTimestamp = msg.timestamp;
    lastEvent = gameStartedTimestamp;
    computeCachedScores();
    updatePlayersList(true/*forceRedraw*/);
    endingTime = msg.payload.endingTime;
    interval = setInterval(function(){
      computeScores();
      updatePlayersList();
    }, 100);
  } else if (msg.payload.username) {
    nicknames[msg.sender] = msg.payload.username;
    updatePlayersList();
  } else if (msg.payload.playersInProgress &&
      msg.channel === currentGame &&
      msg.sender !== bouncer.uid && 
      msg.payload.playersInProgress.indexOf(bouncer.uid) === -1) {
    if (interval) {clearInterval(interval)}
    interval = null;
    gameStartedTimestamp = -1;
    bouncer.quit(currentGame);
    currentGame = "";
    scores = {};
    scores[MOLOCH] = 0;
    updatePlayersList();
    alert("You can't join this game because it is already in progress");
  } else if (msg.payload.move) {
    lastEvent = Math.max(lastEvent, msg.timestamp);
    events[msg.timestamp] = {move: msg.payload.move, player: msg.sender, to: msg.payload.to};
    computeCachedScores();
  }
});

