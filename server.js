const express = require("express");
const socket = require("socket.io");

const app = express();
const port = process.env.PORT || 3000;

console.log(`Starting server at port ${port}...`);

const server = app.listen(port, () => {
  console.log(`Listening at port ${port}!`);
});

app.use(express.static("public"));

const io = socket(server);

let game_timer;

let game = {
  status: "no_games",
  timer: null,
  players: [],
  created_by: null,
};

io.sockets.on("connection", (socket) => {
  console.log(`We have a client ${socket.id} !`);

  socket.on("game", (data) => {
    if (data.status == "game_timing") {
      game.status = "game_timing";
      game.timer = data.timer;
      game.created_by = data.created_by;
      console.log(
        `A new game has beem created by ${game.created_by} on ${Date.now()}`
      );

      game_timer = setInterval(() => {
        if (game.timer > 0) {
          game.timer--;
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
      console.log(game.players[leaver_index]);
      console.log(game.players);
    }

    console.log(`user leaving ${data.username}`);
    console.table(game.players);
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
      console.table(game.players);
      socket.emit("game", game);
    }

    reply({ username_available: available, id: socket.id });
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected `);
  });
});

//** game invitation

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
