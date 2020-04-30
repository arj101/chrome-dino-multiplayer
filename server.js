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

io.sockets.on("connection", (socket) => {
  console.log(`We have a client ${socket.id} !`);
  socket.on("disconnect", () => {
    console.log(`Client disconnected `);
  });
});
