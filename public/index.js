const socket = io();

//? const redirected = sessionStorage.getItem("redirected");

document.documentElement.requestFullscreen();

let game; // will be an object

let userName;

let game_timer;

let loggedIn = false;

mdc.ripple.MDCRipple.attachTo(document.querySelector("#name_submit"));
mdc.ripple.MDCRipple.attachTo(document.querySelector("#play"));

socket.emit("query", { type: "game" }, (reply) => {
  game = reply;
  if (game.status == "no_games") {
    document.querySelector("#game_status").innerHTML =
      "No games are curretly playing.<br/>You can create a new game anytime you want!";
    document.querySelector("#game_status").style.color = "#333333";
    document.querySelector("#play span").textContent = "Create new game!";
    document.querySelector("#play").disabled = false;
    setPadding(document.querySelector("#play"), "1.7rem");
  }

  if (reply.status == "game_started") {
    document.querySelector("#game_status").textContent = "A game has started";
    document.querySelector("#play span").textContent = "Join";
    document.querySelector("#play").disabled = true;
    setPadding(document.querySelector("#play"), "1.7rem");
  }

  if (reply.status == "game_timing") {
    document.querySelector(
      "#game_status"
    ).innerHTML = `A new game has been set by ${game.created_by}`;
    document.querySelector("#play span").textContent = "Join";
    document.querySelector("#play").disabled = false;
    setPadding(document.querySelector("#play"), "1.7rem");

    document.querySelector("#game_timer").textContent = `${(
      game.timer / 60
    ).toFixed(0)}:${game.timer % 60}`;

    game_timer = setInterval(function () {
      game.timer--;
      if (game.timer < 0) {
        clearInterval(game_timer);
        console.log("timing finshed");
      } else {
        document.querySelector("#game_timer").textContent = `${Math.floor(
          game.timer / 60
        )}:${game.timer % 60}`;
      }
    }, 1000);
  }

  document.querySelector("#game_players").innerHTML = "";

  game.players.forEach((player) => {
    const player_div = document.createElement("div");
    player_div.className = "player_div";
    const player_name = document.createElement("p");
    player_name.className = "player_name";
    player_name.textContent = player.username;
    player_div.append(player_name);
    document.querySelector("#game_players").append(player_div);
  });

  console.log(reply);
});

let clickfirst = true;
document.addEventListener("click", (event) => {
  if (!event.target.closest("#entry_popup") && clickfirst == false) {
    document.querySelector("#entry_popup").style.opacity = 0;
    document.querySelector("#entry_popup").style.display = "none";
    setTimeout(function () {
      if (!loggedIn) {
        document.querySelector("#play").disabled = false;
      }
    }, 75);
  }
  if (clickfirst) {
    setTimeout(function () {
      document.querySelector("#play").disabled = true;
    }, 75);
  }

  clickfirst = false;
});

document.querySelector("#play").addEventListener("click", (play_click) => {
  document.querySelector("#entry_popup").style.opacity = 1;
  document.querySelector("#entry_popup").style.display = "flex";

  if (game.status == "no_games") {
    document.querySelector("#timing_input").style.display = "block";
    document.querySelector("#timing_input").style.pointerEvents = "all";
  } else {
    document.querySelector("#timing_input").style.display = "none";
    document.querySelector("#timing_input").style.pointerEvents = "none";
  }

  clickfirst = true;

  document.querySelector("#play").disabled = true;

  const username_cache = sessionStorage.getItem("username_cache");

  if (username_cache) {
    document.querySelector("#name_input").value = username_cache;
  }

  //change this to check username availability and game waiting to happen in here

  document.querySelector("#name_submit").addEventListener("click", (event) => {
    const name = document.querySelector("#name_input");

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
            let timerValue = document.querySelector("#timing_input").value;
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
          document.querySelector("#entry_popup").style.opacity = 0;
          document.querySelector("#entry_popup").style.display = "none";

          loggedIn = true;
          document.querySelector("#play").disabled = true;
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
    document.querySelector("#game_status").textContent = "A game has started";
    document.querySelector("#play").disabled = true;
    setPadding(document.querySelector("#play"), "1.7rem");
  }

  if (data.status == "no_games") {
    document.querySelector("#game_status").innerHTML =
      "No games are curretly playing.<br/>You can create a new game anytime you want!";
    document.querySelector("#play span").textContent = "Create new game!";
    if (!loggedIn) {
      document.querySelector("#play").disabled = false;
    }
    setPadding(document.querySelector("#play"), "1.7rem");
  }

  if (data.status == "game_timing") {
    document.querySelector(
      "#game_status"
    ).innerHTML = `A new game has been set by ${game.created_by}`;
    document.querySelector("#play span").textContent = "Join";
    if (!loggedIn) {
      document.querySelector("#play").disabled = false;
    }
    setPadding(document.querySelector("#play"), "1.7rem");

    document.querySelector("#game_timer").textContent = `${(
      game.timer / 60
    ).toFixed(0)}:${game.timer % 60}`;

    game_timer = setInterval(function () {
      game.timer--;
      if (game.timer < 0) {
        clearInterval(game_timer);
        console.log("timing finshed");
      } else {
        document.querySelector("#game_timer").textContent = `${Math.floor(
          game.timer / 60
        )}:${game.timer % 60}`;
      }
    }, 1000);
  }

  document.querySelector("#game_players").innerHTML = "";

  game.players.forEach((player) => {
    const player_div = document.createElement("div");
    player_div.className = "player_div";
    const player_name = document.createElement("p");
    player_name.className = "player_name";
    player_name.textContent = player.username;
    player_div.append(player_name);
    document.querySelector("#game_players").append(player_div);
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
