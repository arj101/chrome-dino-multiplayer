const express = require("express");
const socket = require("socket.io");

const app = express();
const port = process.env.PORT || 3000;

console.log(`Starting server at port ${port}...`);

const server = app.listen(port, () => {
  console.log(`Listening at port ${port}!`);
});
