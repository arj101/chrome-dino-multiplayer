const socket = io();

const redirected = localStorage.getItem("redirected");

let game;

let userName;

socket.emit("query", { type: "game" }, (reply) => {
  game = reply;
  if (game.status == "no_games") {
    $("#game_status").html(
      "No games are curretly playing.<br/>You can create a new game anytime you want!"
    );
    $("#game_status").css("color", "#333333");
    $("#play").text("Create new game!");
  }
});

// if (redirected) {
//   socket.emit("game", { redirect: true, status: "failed", username: null });
//   localStorage.removeItem("redirected");
// }

let clickfirst = true;
document.addEventListener("click", (event) => {
  //how do i convert this to jQuery?
  if (!event.target.closest("#entry_popup") && clickfirst == false) {
    $("#entry_popup").css("opacity", 0);
    $("#entry_popup").css("display", "none");
    $("#play").css("opacity", 1);
    $("#play").css("pointer-events", "all");
  }
  clickfirst = false;
});

$("#play").click(() => {
  //   window.location.href = window.location.href + "game/";
  //   prompt("Enter your name (doesn't have to be your real name) ;)");]

  $("#entry_popup").css("opacity", 1); //style.opacity = 1;
  $("#entry_popup").css("display", "flex"); //style.display = "flex";

  $("#play").css("opacity", 0.5);
  $("#play").css("pointer-events", "none");

  clickfirst = true;

  const username_cache = localStorage.getItem("username_cache");

  if (username_cache) {
    document.querySelector("#name_input").value = username_cache;
  }

  //change this to check username availability and game waiting to happen in here

  $("#name_submit").click(() => {
    const name = document.querySelector("#name_input");
    if (name.value.length >= 4) {
      login(name.value)
        .then((reply) => {
          console.log("from then");
          console.log(reply);
          localStorage.setItem("username", name.value);
          localStorage.setItem("user_id", reply.id);
          localStorage.setItem("username_cache", name.value);
          if (game.status == "no_games") {
            game.created_by = name.value;
            game.timer = 30;
            game.status = "game_timing";
            socket.emit("game", game);
          }
          // window.location.href += "game/";
        })
        .catch((reply) => {
          alert(
            `Somebody has already taken the username you want, ${name.value}.\nTry something else ; ).`
          );
          console.log("from catch");
          console.log(reply);
        });
    } else alert("Name must be atleast 4 characters long :)");
  });
});

socket.on("game", (data) => {
  console.log(data)
  if (data.status == "game_started") {
    $("#game_status").text("A game has started!");
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
