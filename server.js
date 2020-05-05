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

let users = [];

let game = {
  status: "no_games",
  timer: null,
  timer_timing: null,
  players: [],
  created_by: null,
};

io.sockets.on("connection", (socket) => {
  console.log(`We have a client ${socket.id} !`);

  socket.on("game", (data) => {
    if (data.status == "game_timing") {
      game.status = "game_timing";
      game.timer = data.timer;
      game.timer_timing = setInterval(() => {
        if (game.timer > 0) {
          game.timer--;
          console.log(`timer reached ${game.timer}`);
        } else {
          clearInterval(game.timer_timing);
          game.status = "game_started";
          socket.emit("game", game);
          console.log("game started!");
        }
      }, 1000);
    }
  });

  socket.on("query", (query, reply) => {
    if (query.type === "game") reply(game);
  });

  socket.on("leaving", (data) => {
    const leave_game = data.leaving;
    const leaving_user = data.username;

    let leaver_index = undefined;

    users.forEach((user, i) => {
      if (user.username == leaving_user) {
        leaver_index = i;
        console.log("found " + user.username);
      }
    });

    if (leave_game) {
      users.splice(leaver_index, 1);
      console.log(users[leaver_index]);
      console.log(users);
    }

    console.log(`user leaving ${data.username}`);
    console.table(users);
  });

  //* new function for loging in and username availability checking :)   (below)
  socket.on("login", (login_username, reply) => {
    let available = true;

    users.forEach((user) => {
      if (user.username === login_username) available = false;
    });

    if (available) {
      users.push({ username: login_username, id: socket.id });
      console.log(`new user ${login_username} id: ${socket.id}`);
      console.table(users);
    }

    reply({ username_available: available, id: socket.id });
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected `);
  });
});
