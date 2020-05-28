const express = require("express");
const socket = require("socket.io");

const app = express();
const port = process.env.PORT || 3000;

const serverResetCode = "resetdino33e6##";

console.log(`Starting server at port ${port}...`);

//checking if the protocol is http or http
// if it is https redirect to https
function checkHttps(req, res, next) {
  if (req.get("X-Forwarded-Proto").indexOf("https") != -1) return next();
  else {
    console.log("redirecting to http");
    res.redirect("https://" + req.hostname + req.url);
  }
}

if (port == process.env.PORT) app.all("*", checkHttps);

const server = app.listen(port, () => {
  console.log(`Listening at port ${port}!`);
});

app.use(express.static("public"));

const io = socket(server);

let game_timer;

let lastObstaclePosition = 0;
let obstacleStartingPosition = 1.5; //relative to screen width
let dino_speed = 0;
let min_spacing = 0;

let game = {
  status: "no_games",
  timer: null,
  players: [],
  created_by: null,
};

let obstacleAcknowledge = {};

io.sockets.on("connection", (socket) => {
  console.log(`We have a client ${socket.id} !`);

  socket.on("game", (data) => {
    if (data.status == "game_timing") {
      game.status = "game_timing";
      console.log("timer setting");
      game.timer = data.timer;
      game.created_by = data.created_by;
      console.log(
        `A new game has beem created by ${game.created_by} on ${Date.now()}`
      );

      game_timer = setInterval(function () {
        if (game.timer > 0) {
          game.timer--;
          console.log(`Game timer at ${game.timer}`);
        } else {
          clearInterval(game_timer);
          game.status = "game_started";
          io.sockets.emit("game", game);
          sendGameInvitation();
          console.log("game started!");
        }
      }, 1000);
    }

    io.sockets.emit("game", game);
    console.log(socket.id);
    console.log("sent game");
  });

  socket.on("query", (query, reply) => {
    if (query.type === "game") reply(game);
  });

  socket.on("leaving", (data) => {
    const leave_game = data.leaving;
    const leaving_user = data.username;

    let leaver_index = undefined;

    game.players.forEach((user, i) => {
      if (user.username == leaving_user) {
        leaver_index = i;
        console.log("found " + user.username);
      }
    });

    if (leave_game) {
      game.players.splice(leaver_index, 1);
      delete obstacleAcknowledge[data.username];
      console.log(game.players[leaver_index]);
      console.log(game.players);
    }

    console.log(`user leaving ${data.username}`);
    console.table(game.players);

    if (game.players.length < 1) {
      console.log("Game finsihed/everybody left");
      game.status = "no_games";
      game.created_by = null;
      game.timer = null;
      game_timer = undefined;
      io.sockets.emit("game", game);
    }
  });

  //* new function for loging in and username availability checking :)   (below)
  socket.on("login", (login_username, reply) => {
    let available = true;

    game.players.forEach((user) => {
      if (user.username === login_username) available = false;
    });

    if (available) {
      game.players.push({ username: login_username, id: socket.id });
      console.log(`new user ${login_username} id: ${socket.id}`);
      // console.table(game.players);
      obstacleAcknowledge[login_username] = {
        acknowledg: false,
        id: socket.id,
      };
      // console.log(obstacleAcknowledge);

      io.sockets.emit("game", game);
    }

    reply({ username_available: available, id: socket.id });
  });

  socket.on("gameplay", (data) => {
    if (data.type == "ready") {
      let allReady = true;

      game.players.forEach((player, i) => {
        if (player.id == data.id) {
          player.status = "ready";
        }
        if (player.status != "ready") allReady = false;
      });

      if (allReady) {
        io.sockets.emit("gameplay", { type: "start" });
        console.log("all ready!");

        // gameLoop();
        // gameLoop(200);
        gameEndTimer = setTimeout(function () {
          //ending game after 20 minutes
          io.sockets.emit("gameplay", { type: "end" });
          game.status = "no_games"; //reset game
          game.timer = null;
          game.created_by = null;
          game.players = [];
        }, 60000 * 20);
      } else {
        setTimeout(function () {
          //starting game after 60 seconds automatically
          io.sockets.emit("gameplay", { type: "start" });
        }, 60000);
      }
    }

    if (data.type == "live" || data.type == "gameover") {
      socket.broadcast.emit("gameplay", data);
    } else if (data.type == "obstacleposition") {
      if (lastObstaclePosition < data.pos) lastObstaclePosition = data.pos;
      if (dino_speed < data.speed) dino_speed = data.speed;
      if (min_spacing < data.spacing) min_spacing = data.spacing;
    } else if (data.type == "obstacle_acknowledge") {
      if (obstacleAcknowledge[data.name]) {
        if (data.id == obstacleAcknowledge[data.name].id) {
          obstacleAcknowledge[data.name].acknowledge = true;

          let allAcknowleged = true;

          Object.keys(obstacleAcknowledge).forEach((player) => {
            if (player.acknowledg == false) allAcknowleged = false;
          });
          if (allAcknowleged)
            io.sockets.emit("gameplay", { type: "obstacle", name: "cactus" });
        } else
          console.log(
            "Request info for obstacle acknowledge cannot be matched with server data"
          );
      } else console.log("Cannot find user in the server");
    }
  });

  socket.on("reset", (data) => {
    if (data.resetcode == serverResetCode) {
      console.log(`Server reset requested by ${data.name}`);
      console.log("Reseting server....");
      resetServer();
      socket.emit("reset", { status: "success" });
    } else {
      console.log(`Reset attempt by ${data.name} failed!`);
      console.log(`Failed reset code is: ${data.resetcode}`);
      socket.emit("reset", { status: "failed" });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected `);
  });
});

//~ game invitation

function sendGameInvitation() {
  game.players.forEach((player) => {
    io.to(player.id).emit("game_invitation", {
      invited: true,
      username: player.username,
    });
    console.log(player);
    console.log(`sent invitation to ${player.username}`);
  });
}

function resetServer() {
  game = {
    status: "no_games",
    timer: null,
    players: [],
    created_by: null,
  };
  game_timer = undefined;
  console.log("Successfully reset the server!");
}

// function gameLoop() {
//   if (1.5 - lastObstaclePosition > dino_speed / 58.1) {
//     io.sockets.emit("gameplay", { type: "obstacle", name: "cactus" });
//     console.log("sent obstacle");
//   }
//   console.log(min_spacing);
//   console.log(lastObstaclePosition);

//   if (game.status == "game_started") {
//     setTimeout(gameLoop, 200);
//   }
// }
