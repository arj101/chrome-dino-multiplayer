let dino;

let obstacles = [];

let dino_speed = 8;

let min_spacing = 400;

let uImg;

function preload() {
  uImg = loadImage("./assets/unicorn.png");
}

function setup() {
  createCanvas(800, 500);
  dino = new Dino(100, height - 200, 100);
  obstacles.push(new Obstacle(width + 500, height - 175, 75));
}

function draw() {
  background(230);

  constrain(min_spacing, 400, 600);

  min_spacing = dino_speed * 50;

  if (
    random(1) < 0.05 &&
    width + 100 - obstacles[obstacles.length - 1].pos.x > min_spacing
  ) {
    obstacles.push(new Obstacle(width + 100, height - 175, 75));
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
  rect(0, height - 100, width, height);
  pop();

  for (let obstacle of obstacles) {
    if (dino.collided(obstacle)) {
      noLoop();
      gameOver();
      console.log("Game Over");
    }
  }
}

function keyPressed(event) {
  if (event.key == "ArrowUp" || event.key == " ") dino.jump();
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
  pop();
}
