let dino;
let obstacles = [];
let ground;

let dino_speed = 8;
let min_spacing = 400;

let debug = false;
let keyCodes = [13, 13, 13, 13];
let codePos = 0;

const socket = io();
let unidentifiedUser = true;
let score = 0;
let canvas;
let started = false;
let game_start_timer;
let start_time = 60;

let ack_pressed = false;

let otherPlayers = [];

//*dino assets--------------------------
let jumpSound;
let dinoRunTexture1;
let dinoRunTexture2;
let dinoJumpTexture;
//*--------------------------------------

//*ground texture------------------------
let groundTexture;
//*--------------------------------------

//*game over sound-----------------------
let gameOverSound;
//*--------------------------------------

//*score reached sound-------------------
let scoreReached;
//*--------------------------------------

let last_scoreReached = 0;

mdc.ripple.MDCRipple.attachTo(document.querySelector("#homepage_redirect"));
mdc.ripple.MDCRipple.attachTo(document.querySelector("#game_start_ack"));

let userName = sessionStorage.getItem("username");
let userId = sessionStorage.getItem("user_id");
if (!userName || !userId || userName.length < 4) {
  sessionStorage.setItem("redirected", true);
  window.location.href = window.location.href + "../";
}

window.addEventListener("load", () => {
  console.log("loading");
  const w = document.querySelector("#game_start").offsetWidth;
  const h = document.querySelector("#game_start").offsetHeight;
  const l = (window.innerWidth - w) / 2;
  const t = (window.innerHeight - h) / 2;
  document.querySelector("#game_start").style.left = l + "px";
  document.querySelector("#game_start").style.top = t + "px";
  document.querySelector("#game_start").style.opacity = 1;
  document.querySelector("#game_start").style.pointerEvents = "all";
});

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

socket.on("gameplay", (data) => {
  if (data.type == "start") {
    started = true;

    try {
      loop();
    } catch {
      console.warn("function draw not found!");
    }
  } else if (data.type == "live") {
    let playerFound = false;

    otherPlayers.forEach((player, index) => {
      if (data.name == player.name) {
        player.position = data.position;
        playerFound = true;

        setTimeout(function () {
          otherPlayers = otherPlayers.splice(1, index);
        }, 10000);
      }
    });

    if (!playerFound) {
      otherPlayers.push(data);
    }
  } else if (data.type == "gameover") {
    let playerFound = false;

    otherPlayers.forEach((player, index) => {
      if (data.name == player.name) {
        playerFound = true;
        player.over = true;
      }
    });

    if (!playerFound) {
      console.warn("No user named " + data.name);
    }
  } else if (data.type == "end") {
    noLoop();
    alert("Game has ended (max. time: 20 minutes)");
    sessionStorage.removeItem("user_id");
    sessionStorage.removeItem("username");
    window.location.href += "../";
  }
});

document.querySelector("#game_start_ack").addEventListener("click", () => {
  if (!started) {
    if (!ack_pressed) {
      ack_pressed = true;
    }

    if (ack_pressed) {
      document.querySelector("#game_start_ack").setAttribute("disabled", true);
      document.querySelector("#game_start").style.width =
        document.querySelector("#game_start").offsetWidth + "px";
      document.querySelector("#game_start h2").textContent =
        "Waiting for other players..";
    }

    setTimeout(() => {
      socket.emit("gameplay", {
        type: "ready",
        id: sessionStorage.getItem("user_id"),
      });
    }, 300);
  }
});

//preload() - loading assets before game starts -----------------

function preload() {
  loadFont("assets/font/PressStart2P-Regular.ttf"); // loading the font
  jumpSound = loadSound("assets/audio/button-press.mp3");
  gameOverSound = loadSound("assets/audio/hit.mp3");
  scoreReached = loadSound("assets/audio/score-reached.mp3");
  dinoRunTexture1 = loadImage("assets/sprites/dino-run-1.png");
  dinoRunTexture2 = loadImage("assets/sprites/dino-run-2.png");
  dinoJumpTexture = loadImage("assets/sprites/dino-jump.png");
  groundTexture = loadImage("assets/sprites/ground.png");
}

function setup() {
  canvas = createCanvas(displayWidth, window.innerHeight);
  canvas.id("canvas");
  dino = new Dino(
    100,
    (window.innerHeight * 13.8) / 16,
    window.innerHeight * 0.17,
    [dinoRunTexture1, dinoRunTexture2, dinoJumpTexture]
  );

  ground = new Ground(0, (window.innerHeight * 13.5) / 16, groundTexture);

  obstacles.push(
    new Obstacle(
      width + 500,
      (window.innerHeight * 13.5) / 16,
      window.innerHeight * 0.15
    )
  );
}

//draw() main game loop --------------------------

function draw() {
  if (!started) {
    document.querySelector("#start_timer").textContent = start_time;
    game_start_timer = setInterval(() => {
      if (start_time <= 0) {
        clearInterval(game_start_timer);
        socket.emit("gameplay", {
          type: "ready",
          id: sessionStorage.getItem("user_id"),
        });
        started = true;
      } else {
        start_time--;
        document.querySelector("#start_timer").textContent = start_time;
      }
    }, 1000);

    noLoop();
  } else {
    document.querySelector("#game_start").style.opacity = 0;
    document.querySelector("#game_start").style.pointerEvents = "none";
  }

  if (frameCount % 2 == 0) {
    userName = sessionStorage.getItem("username");
    userId = sessionStorage.getItem("user_id");
    if (!userName || !userId || userName.length < 4) {
      noLoop();
      alert(
        "We could not figure out who you are!\nPlease reload the page/go back."
      );
    }
  }

  background(255);
  push();
  textSize(20);
  fill(10, 200);
  textFont("sans-serif");
  textAlign(CORNER, CORNER);
  text(`Hi, ${userName}!`, 10, 30);
  pop();

  push();
  noStroke();
  // fill(20, 240, 25, 200);
  // noFill();
  // stroke(100);
  // strokeWeight(2);
  // rect(width * -0.1, (window.innerHeight * 13.5) / 16, width * 1.1, height);
  // pop();

  ground.update();

  min_spacing = constrain(min_spacing, 300, 450);

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
  dino_speed = constrain(dino_speed, 8, 50);

  for (let obstacle of obstacles) {
    obstacle.update();
    obstacle.show();
  }

  //--------//
  if (debug) {
    let currOs = obstacles.filter((a) => a.pos.x - dino.pos.x >= a.w);
    currOs = currOs.sort((a, b) => a.pos.x - b.pos.x);
    if (currOs.length > 0) {
      if (
        currOs[0].pos.x - (dino.pos.x + dino.w) <=
        map(dino_speed, 8, 20, 50, (50 * 20) / 8)
      ) {
        dino.jump();
      }
    }
  }
  //--------//

  dino.gravity();
  dino.update();
  dino.show();

  score += dino_speed / 128;

  if (score >= last_scoreReached + 100) {
    last_scoreReached = score;
    scoreReached.play();
  }

  socket.emit("gameplay", {
    type: "live",
    position: dino.pos.y / height,
    name: sessionStorage.getItem("username"),
  });

  otherPlayers.forEach((player) => {
    push();
    fill(0);
    if (player.over == true) {
      fill(255, 0, 0);
    }
    noStroke();
    textSize(18);
    text(player.name, 100, player.position * height - 20);
    fill(50, 100);
    if (player.over == true) {
      fill(255, 0, 0, 50);
    }
    rect(
      100,
      player.position * height,
      (window.innerHeight * 0.17 * 3) / 4,
      window.innerHeight * 0.17
    );
    pop();
  });

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
  text(score.toFixed(0), width - 30, 20);
  pop();
}
// manual reset
function keyPressed(event) {
  if (event.key == "ArrowUp" || event.key == " ") dino.jump();
  if (keyCode == keyCodes[codePos]) {
    codePos++;
  } else {
    codePos = 0;
  }
  if (codePos == keyCodes.length) {
    debug = true;
  }
}

function mousePressed() {
  dino.jump();
}

function gameOver() {
  document.querySelector("#game_over").style.pointerEvents = "all";
  document.querySelector("#game_over").style.opacity = 1;
  document.querySelector("#score").textContent = score.toFixed(0);
  document.querySelector("#homepage_redirect").addEventListener("click", () => {
    setTimeout(() => {
      window.location.href += "../";
    }, 200);
  });

  socket.emit("gameplay", {
    type: "gameover",
    name: sessionStorage.getItem("username"),
  });
  socket.emit("leaving", { username: userName, leaving: true });

  gameOverSound.play();
}
