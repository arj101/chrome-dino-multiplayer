const socket = io();

//? const redirected = sessionStorage.getItem("redirected");

let game; // will be an object

let userName;

socket.emit("query", { type: "game" }, (reply) => {
  game = reply;
  if (game.status == "no_games") {
    document.querySelector("#game_status").innerHTML =
      "No games are curretly playing.<br/>You can create a new game anytime you want!";
    document.querySelector("#game_status").style.color = "#333333";
    document.querySelector("#play").textContent = "Create new game!";
  }
  console.log(reply);
});

// if (redirected) {
//   socket.emit("game", { redirect: true, status: "failed", username: null });
//   sessionStorage.removeItem("redirected");
// }

let clickfirst = true;
document.addEventListener("click", (event) => {
  //how do i convert this to jQuery?
  if (!event.target.closest("#entry_popup") && clickfirst == false) {
    document.querySelector("#entry_popup").style.opacity = 0;
    document.querySelector("#entry_popup").style.display = "none";
    document.querySelector("#play").style.opacity = 1;
    document.querySelector("#play").style.pointerEvents = "all";
  }
  clickfirst = false;
});

document.querySelector("#play").addEventListener("click", () => {
  //   window.location.href = window.location.href + "game/";
  //   prompt("Enter your name (doesn't have to be your real name) ;)");]

  document.querySelector("#entry_popup").style.opacity = 1;
  document.querySelector("#entry_popup").style.display = "flex";

  document.querySelector("#play").style.opacity = 0.5;
  document.querySelector("#play").style.pointerEvents = "none";

  clickfirst = true;

  const username_cache = sessionStorage.getItem("username_cache");

  if (username_cache) {
    document.querySelector("#name_input").value = username_cache;
  }

  //change this to check username availability and game waiting to happen in here

  document.querySelector("#name_submit").addEventListener("click", () => {
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
            game.timer = 10;
            game.status = "game_timing";
            socket.emit("game", game);
          } else
            socket.emit("query", { type: "game" }, (reply) =>
              console.log(reply)
            );
          // window.location.href += "game/";
        })
        .catch((reply) => {
          alert(
            `Somebody has already taken the username that you want, ${name.value}.\nTry something else ; ).`
          );
          console.log("from catch");
          console.log(reply);
        });
    } else alert("Name must be atleast 4 characters long :)");
  });
});

socket.on("game", (data) => {
  game = data;

  if (data.status == "game_started") {
    document.querySelector("#game_status").textContent = "A game has started";
  }

  if (data.status == "game_timing") {
    document.querySelector(
      "#game_status"
    ).innerHTML = `A new has been set by ${game.created_by}`;
    document.querySelector("#play").textContent = "Join";
  }

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
      if (reply.username_available) resolve(reply);
      else reject(reply);
    });
  });
}
