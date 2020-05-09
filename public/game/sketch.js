let dino;

let obstacles = [];

let dino_speed = 8;

let min_spacing = 400;

const socket = io();

let unidentifiedUser = true;

let score = 0;

const userName = sessionStorage.getItem("username");
if (!userName) {
  sessionStorage.setItem("redirected", true);
  window.location.href = window.location.href + "../";
}

// socket.on("username_availability", (data) => {
//   if (data == false) {
//     alert(
//       "Somebody has already taken your username.\nYou will be redirected to our homepage"
//     );
//     window.location.href = window.location.href + "../";
//   } else unidentifiedUser = false;
// });

window.addEventListener("beforeunload", (event) => {
  // f (!unidentifiedUser) {
  sessionStorage.removeItem("username");
  sessionStorage.removeItem("user_id");
  socket.emit("leaving", { username: userName, leaving: true });
  // sessionStorage.setItem("username_cache", userName); already done in in home page :)

  event.preventDefault(); // having some trouble with these two lines
  event.returnValue = "";

  // username will be deleted in the server is this lines exists and the user clicked cancel on confirmation 😬

  // console.log(event);
  // }
});

function preload() {
  loadFont("assets/PressStart2P-Regular.ttf"); // loading the font
}

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

  constrain(min_spacing, 300, 450);

  min_spacing = dino_speed * 50;

  if (
    random(1) < 0.1 &&
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

  score += dino_speed / 128;

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

  push();
  textSize(32);
  noStroke();
  fill(100);
  textFont("PressStart2P-Regular");
  textAlign(RIGHT, TOP);
  text(`score: ${score.toFixed(0)}`, width - 30, 20);
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
  rect(width / 2, height / 2, 500, 120, 5);
  fill(255, 30, 30);
  textAlign(CENTER, CENTER);
  textSize(30);
  textStyle(BOLD);
  textFont("PressStart2P-Regular");
  text("GAME OVER!", width / 2, height / 2 - 25);
  textStyle(NORMAL);
  fill(20, 200);
  textSize(23);
  text(`Your score: ${score.toFixed(0)}`, width / 2, height / 2 + 37);
  pop();
}
