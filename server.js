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

io.sockets.on("connection", (socket) => {
  console.log(`We have a client ${socket.id} !`);

  socket.on("game", (data) => {
    console.log(data);
    if (!data.redirect) {
      let nameAvailble = true;

      if (users.length > 0)
        users.forEach((user) => {
          if (user.username == data.username)
            nameAvailble = nameAvailble = false;
        });

      if (nameAvailble) {
        users.push({ username: data.username, id: socket.id });
        socket.emit("username_availability", true);
        console.log("yup!");
      } else {
        console.log("name not availbale");
        socket.emit("username_availability", false);
        console.log("nope!");
      }
      console.log(users);
    } else console.log("redirected " + socket.id);

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
    });
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected `);
  });
});
