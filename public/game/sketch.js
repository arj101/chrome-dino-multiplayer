let dino;

let obstacles = [];

let dino_speed = 8;

let min_spacing = 400;

const socket = io();

let unidentifiedUser = true;

let score = 0;

const userName = localStorage.getItem("dino_multiplayer_userName");
if (!userName) {
  localStorage.setItem("redirected", true);
  window.location.href = window.location.href + "../";
} else {
  socket.emit("game", {
    redirect: false,
    status: "success",
    username: userName,
  });
}

socket.on("username_availability", (data) => {
  if (data == false) {
    alert(
      "Somebody has already taken your username.\nYou will be redirected to our homepage"
    );
    window.location.href = window.location.href + "../";
  } else unidentifiedUser = false;
});

window.addEventListener("beforeunload", (event) => {
  if (!unidentifiedUser) {
    localStorage.removeItem("dino_multiplayer_userName");
    socket.emit("leaving", { username: userName, leaving: true });
    localStorage.setItem("username_cache", userName);

    event.preventDefault(); // having some trouble with these two lines
    event.returnValue = "";

    // username will be deleted in the server is this lines exists and the user clicked cancel on confirmation 😬

    // console.log(event);
  }
});

function setup() {
  createCanvas(displayWidth, window.innerHeight);
  dino = new Dino(
    100,
    (window.innerHeight * 13.5) / 16,
    window.innerHeight * 0.17
  );
  obstacles.push(
    new Obstacle(
      width + 500,
      (window.innerHeight * 13.5) / 16,
      window.innerHeight * 0.15
    )
  );
}

function draw() {
  background(230);
  push();
  textSize(20);
  fill(10, 200);
  textFont("sans-serif");
  textAlign(CORNER, CORNER);
  text(`Hi, ${userName}!`, 10, 30);
  pop();

  constrain(min_spacing, 400, 600);

  min_spacing = dino_speed * 50;

  if (
    random(1) < 0.05 &&
    width + 100 - obstacles[obstacles.length - 1].pos.x > min_spacing
  ) {
    obstacles.push(
      new Obstacle(
        width + 100,
        (window.innerHeight * 13.5) / 16,
        window.innerHeight * 0.15
      )
    );
  }

  dino_speed += 0.01;
  constrain(dino_speed, 8, 20);

  for (let obstacle of obstacles) {
    obstacle.update();
    obstacle.show();
  }

  dino.gravity();
  dino.update();
  dino.show();

  push();
  noStroke();
  fill(20, 240, 25, 200);
  rect(0, (window.innerHeight * 13.5) / 16, width, height);
  pop();

  for (let obstacle of obstacles) {
    if (dino.collided(obstacle)) {
      noLoop();
      gameOver();
      console.log("Game Over");
    }
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    if (obstacles[i].pos.x < 0 - obstacles[i].w && obstacles.length > 1) {
      obstacles.splice(i, 1);
    }
  }

  score += dino_speed / 128;

  push();
  textSize(32);
  noStroke();
  fill(100);
  textAlign(RIGHT, TOP);
  text(`Score: ${score.toFixed(0)}`, width - 30, 20);
  pop();
}

function keyPressed(event) {
  if (event.key == "ArrowUp" || event.key == " ") dino.jump();
}

function mousePressed() {
  dino.jump();
}

function gameOver() {
  push();
  noStroke();
  fill(255, 200);
  rectMode(CENTER);
  rect(width / 2, height / 2, 500, 100, 5);
  fill(255, 0, 0);
  textAlign(CENTER, CENTER);
  textSize(25);
  textStyle(BOLD);
  text("GAME OVER!", width / 2, height / 2);
  textStyle(NORMAL);
  fill(20, 200);
  textSize(23);
  text(`Your score: ${score.toFixed(0)}`, width / 2, height / 2 + 37);
  pop();
}
