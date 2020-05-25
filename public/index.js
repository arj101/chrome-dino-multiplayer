const socket = io();

//? const redirected = sessionStorage.getItem("redirected");

// document.documentElement.requestFullscreen();

//HTML elements------------------------

const playButton = document.querySelector("#play");
const playButtonLabel = document.querySelector("#play span");
const gameStatusH3 = document.querySelector("#game_status");
const gameTimerP = document.querySelector("#game_timer");
const nameSubmitButton = document.querySelector("#name_submit");
const gamePlayersDiv = document.querySelector("#game_players");
const entryPopupDiv = document.querySelector("#entry_popup");
const timingInput = document.querySelector("#timing_input");
const nameInput = document.querySelector("#name_input");

//-------------------------------------

let game = {}; // will be an object

let userName;

let game_timer;

let loggedIn = false;

mdc.ripple.MDCRipple.attachTo(nameSubmitButton);
mdc.ripple.MDCRipple.attachTo(playButton);

// fixSize(entryPopupDiv);

socket.emit("query", { type: "game" }, (reply) => {
  game = reply;
  if (game.status == "no_games") {
    gameStatusH3.innerHTML =
      "No games are curretly playing.<br/>You can create a new game anytime you want!";
    gameStatusH3.style.color = "#333333";
    playButtonLabel.textContent = "Create new game!";
    playButton.disabled = false;
    setPadding(playButton, "1.7rem");
  }

  if (reply.status == "game_started") {
    gameStatusH3.textContent = "A game has started";
    playButtonLabel.textContent = "Join";
    playButton.disabled = true;
    setPadding(playButton, "1.7rem");
  }

  if (reply.status == "game_timing") {
    document.querySelector(
      "#game_status"
    ).innerHTML = `A new game has been set by ${game.created_by}`;
    playButtonLabel.textContent = "Join";
    playButton.disabled = false;
    setPadding(playButton, "1.7rem");

    gameTimerP.textContent = `${formatTime(game.timer)}`;

    game_timer = setInterval(function () {
      game.timer--;
      if (game.timer < 0) {
        clearInterval(game_timer);
        console.log("timing finshed");
      } else {
        gameTimerP.textContent = `${formatTime(game.timer)}`;
      }
    }, 1000);
  }

  gamePlayersDiv.innerHTML = "";

  game.players.forEach((player) => {
    const player_div = document.createElement("div");
    player_div.className = "player_div";
    const player_name = document.createElement("p");
    player_name.className = "player_name";
    player_name.textContent = player.username;
    player_div.append(player_name);
    gamePlayersDiv.append(player_div);
  });

  console.log(reply);
});

let clickfirst = true;
document.addEventListener("click", (event) => {
  clickRipple(event.pageX, event.pageY);

  if (!event.target.closest("#entry_popup") && clickfirst == false) {
    entryPopupDiv.style.opacity = 0;
    entryPopupDiv.style.display = "none";
    setTimeout(function () {
      if (!loggedIn) {
        playButton.disabled = false;
      }
    }, 75);
  }

  if (clickfirst) {
    setTimeout(function () {
      playButton.disabled = true;
    }, 75);
  }

  clickfirst = false;
});

playButton.addEventListener("click", (play_click) => {
  entryPopupDiv.style.opacity = 1;
  entryPopupDiv.style.display = "flex";
  // fixPosition(entryPopupDiv);
  // fixSize(entryPopupDiv);

  if (game.status == "no_games") {
    timingInput.style.display = "block";
    timingInput.style.pointerEvents = "all";
  } else {
    timingInput.style.display = "none";
    timingInput.style.pointerEvents = "none";
  }

  clickfirst = true;

  playButton.disabled = true;

  const username_cache = sessionStorage.getItem("username_cache");

  if (username_cache) {
    nameInput.value = username_cache;
  }

  //change this to check username availability and game waiting to happen in here

  nameSubmitButton.addEventListener("click", (event) => {
    const name = nameInput;

    if (name.value.length >= 4) {
      login(name.value)
        .then((reply) => {
          console.log("from then");
          console.log(reply);
          sessionStorage.setItem("username", name.value);
          sessionStorage.setItem("user_id", reply.id);
          sessionStorage.setItem("username_cache", name.value);
          if (game.status == "no_games") {
            game.created_by = name.value;
            let timerValue = timingInput.value;
            if (!timerValue) timerValue = 30;
            if (timerValue > 120) {
              alert(
                "Game can't be delayed more than 2 minutes(setting timer to 2 minutes)"
              );
              timerValue = 120;
            } else if (timerValue < 0) {
              alert(
                "Game can't be delayed less than 0 seconds(setting timer to 0 seconds)"
              );
              timerValue = 0;
            }
            game.timer = timerValue; //! game timer <<<<< <<<<<< <<<<<<<<< <<<<<<<<< <<<<<<< <<<<<<<< <<<<<<<< <<<<<<
            game.status = "game_timing";
            socket.emit("game", game);
          } else {
            socket.emit("query", { type: "game" }, (reply) =>
              console.log(reply)
            );
          }
          entryPopupDiv.style.opacity = 0;
          entryPopupDiv.style.display = "none";

          loggedIn = true;
          playButton.disabled = true;
        })
        .catch((error) => {
          console.log("from catch");
          alert(
            `Somebody has already taken the username that you want, ${name.value}.\nTry something else ; ).`
          );
          console.log(error);
        });
    } else alert("Name must be atleast 4 characters long :)");
    event.stopImmediatePropagation();
  });
});

socket.on("game", (data) => {
  game = data;

  if (data.status == "game_started") {
    gameStatusH3.textContent = "A game has started";
    playButton.disabled = true;
    setPadding(playButton, "1.7rem");
  }

  if (data.status == "no_games") {
    gameStatusH3.innerHTML =
      "No games are curretly playing.<br/>You can create a new game anytime you want!";
    playButtonLabel.textContent = "Create new game!";
    if (!loggedIn) {
      playButton.disabled = false;
    }
    setPadding(playButton, "1.7rem");
  }

  if (data.status == "game_timing") {
    document.querySelector(
      "#game_status"
    ).innerHTML = `A new game has been set by ${game.created_by}`;
    playButtonLabel.textContent = "Join";
    if (!loggedIn) {
      playButton.disabled = false;
    }
    setPadding(playButton, "1.7rem");

    gameTimerP.textContent = `${(game.timer / 60).toFixed(0)}:${
      game.timer % 60
    }`;

    game_timer = setInterval(function () {
      game.timer--;
      if (game.timer < 0) {
        clearInterval(game_timer);
        console.log("timing finshed");
      } else {
        gameTimerP.textContent = `${Math.floor(game.timer / 60)}:${
          game.timer % 60
        }`;
      }
    }, 1000);
  }

  gamePlayersDiv.innerHTML = "";

  game.players.forEach((player) => {
    const player_div = document.createElement("div");
    player_div.className = "player_div";
    const player_name = document.createElement("p");
    player_name.className = "player_name";
    player_name.textContent = player.username;
    player_div.append(player_name);
    gamePlayersDiv.append(player_div);
  });

  console.log(game);
});

socket.on("game_invitation", (data) => {
  if (data.invited && data.username == sessionStorage.getItem("username")) {
    window.location.href += "game/";
  }
});

function login(login_username) {
  return new Promise((resolve, reject) => {
    socket.emit("login", login_username, (reply) => {
      if (reply.username_available == true) {
        console.log(
          "%c Username available",
          "background:#00ff00;color:white;padding:0.3rem;font-size:1.1rem"
        );
        resolve(reply);
      } else {
        console.log(
          "%c Username unavailable",
          "background:#ff0000;color:white;padding:0.3rem;font-size:1.1rem"
        );
        reject(reply);
      }
    });
  });
}

//! only use for mdc-button
function setPadding(item, padding) {
  item.style.width = "fit-content";
  item.style.height = "fit-content";

  item.style.width = `calc(${item.offsetWidth + "px"} + ${padding})`;

  item.style.height = `calc(${item.offsetHeight + "px"} + ${padding})`;
}

function formatTime(secs) {
  const max = 24 * 60 * 60;
  if (secs > max) {
    return "24:00:00+";
  } else {
    let h = Math.floor(secs / (60 * 60));
    let m = Math.floor(secs / 60) - h * 60;
    let s = Math.floor(secs) - (h * 60 + m) * 60;
    let [hs, ms, ss] = [`${h}`, `${m}`, `${s}`];
    while (hs.length < 2) hs = `0${hs}`;
    while (ms.length < 2) ms = `0${ms}`;
    while (ss.length < 2) s = `0${ss}`;
    return [hs, ms, ss].join(":").slice(h != 0 ? 0 : 3, 8);
  }
}

function fixSize(element) {
  element.style.width = `${element.offsetWidth}px`;
  element.style.height = `${element.offsetHeight}px`;
}

function fixPosition(element) {
  element.style.position = "absolute";
  element.style.left = `${element.offsetLeft}px`;
  element.style.top = `${element.offsetTop}px`;
}

function clickRipple(x, y, durationTemp = 1) {
  let clickRippleElem = document.createElement("div");
  clickRippleElem.className = "click-ripple";
  // rippleElement.id = "ripple-elem";
  document.body.append(clickRippleElem);
  clickRippleElem.style.left = `${x}px`;
  clickRippleElem.style.top = `${y}px`;

  let duration = durationTemp;

  clickRippleElem.style.animation = `ripple ${duration}s cubic-bezier(0,0,.23,.95)`;

  setTimeout(function () {
    clickRippleElem.style.animation = "none";
    clickRippleElem.remove();
  }, duration * 1000);
}

// window.onorientationchange = function () {
//   entryPopupDiv.style.width = "50vw";
//   entryPopupDiv.style.height = "h";
// };
