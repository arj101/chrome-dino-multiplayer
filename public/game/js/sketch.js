let dino;
let obstacles = [];
let clouds = [];
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
let collided = false;

let ack_pressed = false;

let otherPlayers = {};

//*dino assets--------------------------
let jumpSound;
let dinoRunTexture1;
let dinoRunTexture2;
let dinoJumpTexture;
let dinoGameOverTexture;
//*--------------------------------------

//*ground texture------------------------
let groundTexture;
//*--------------------------------------

//*cloud texture-------------------------
let cloudTexture;
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
    // let playerFound = false;
    reciveGameData(data);
  } else if (data.type == "end") {
    noLoop();
    alert("Game has ended (max. time: 20 minutes)");
    sessionStorage.removeItem("user_id");
    sessionStorage.removeItem("username");
    window.location.href += "../";
  } else if (data.type == "obstacle") {
    addObstacle(obstacles);
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
  dinoGameOverTexture = loadImage("assets/sprites/dino-game-over-2.png");
  cloudTexture = loadImage("assets/sprites/cloud.png");
}

function setup() {
  canvas = createCanvas(displayWidth, window.innerHeight);
  canvas.id("canvas");
  canvas.drawingContext.imageSmoothingEnabled = false;

  document.querySelector("#loader-bg").style.opacity = 0;
  document.querySelector("#loader-bg").style.pointerEvents = "none";
  // document.querySelector("#loader-bg").style.display = "none";

  dino = new Dino(
    100,
    (window.innerHeight * 13.8) / 16,
    window.innerHeight * 0.17,
    [dinoRunTexture1, dinoRunTexture2, dinoJumpTexture, dinoGameOverTexture]
  );

  // addObstacle(obstacles);

  ground = new Ground(0, (window.innerHeight * 13.5) / 16, groundTexture);

  //  obstacles.push(
  //    new Obstacle(
  //      width + 500,
  //      (window.innerHeight * 13.5) / 16,
  //      window.innerHeight * 0.15
  //    )
  //  );
  socket.emit("gameplay", {
    type: "obstacle_acknowledge",
    acknowledg: true,
    id: sessionStorage.getItem("user_id"),
    name: userName,
  });

  clouds.push(
    new Cloud(
      width + width * 0.1,
      height * random(0.1, 0.3),
      height * 0.075,
      cloudTexture
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

  if (!collided) ground.update();

  ground.show();

  min_spacing = constrain(min_spacing, 300, 450);

  min_spacing = dino_speed * 50;

  if (obstacles.length >= 1) {
    if (
      random(1) < 0.1 &&
      width + 100 - obstacles[obstacles.length - 1].pos.x > min_spacing
    ) {
      // addObstacle(obstacles);
      socket.emit("gameplay", {
        type: "obstacle_acknowledge",
        acknowledg: true,
        id: sessionStorage.getItem("user_id"),
        name: userName,
      });
    }
  }

  dino_speed += 0.01;
  dino_speed = constrain(dino_speed, 8, 50);

  for (let obstacle of obstacles) {
    if (!collided) obstacle.update();
    obstacle.show();
  }

  if (clouds.length < 3) {
    const lastCloud = clouds[clouds.length - 1];

    if (
      dist(lastCloud.pos.x, lastCloud.pos.y, width, height * 0.2) >=
      width * random(0.3, 0.5)
    ) {
      clouds.push(
        new Cloud(
          width + width * random(0.1, 0.5),
          height * random(0.1, 0.3),
          height * 0.075,
          cloudTexture
        )
      );
    }
  }

  clouds.forEach((cloud) => {
    cloud.update(-dino_speed / 8);
    cloud.show();
  });

  if (clouds.length) {
    for (let i = clouds.length - 1; i >= 0; i--) {
      if (clouds[i]) {
        if (clouds[i].pos.x + clouds[i].w < 0) {
          clouds.splice(1, i);
        }
      }
    }
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
  if (!collided) {
    dino.gravity();
    dino.update();
  }

  const otherPlayerName = Object.keys(otherPlayers);

  otherPlayerName.forEach((player) => {
    drawOtherPlayer(otherPlayers[player]);
    if (otherPlayers[player].gameover) {
      console.log("player out " + player);
      setTimeout(function () {
        delete otherPlayers[player];
      }, 7000);
    }
  });

  dino.show();

  if (!collided) score += dino_speed / 128;

  if (score >= last_scoreReached + 100) {
    last_scoreReached = score;
    scoreReached.play();
  }

  sendGameData();

  // otherPlayers.forEach((player) => {
  //   push();
  //   fill(0);
  //   if (player.over == true) {
  //     fill(255, 0, 0);
  //   }
  //   noStroke();
  //   textSize(18);
  //   text(player.name, 100, player.position * height - 20);
  //   fill(50, 100);
  //   if (player.over == true) {
  //     fill(255, 0, 0, 50);
  //   }
  //   rect(
  //     100,
  //     player.position * height,
  //     (window.innerHeight * 0.17 * 3) / 4,
  //     window.innerHeight * 0.17
  //   );
  //   pop();
  // });

  if (collided) {
    noLoop();
    gameOver();
  }

  for (let obstacle of obstacles) {
    if (dino.collided(obstacle)) {
      collided = true;
      dino.gameOver = true; //changing texture
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
  //TODO if (event.key == "ArrowDown") dino.duck();
  if (keyCode == keyCodes[codePos]) {
    codePos++;
  } else {
    codePos = 0;
  }
  if (codePos == keyCodes.length) {
    debug = true;
  }
}

function keyReleased(event) {
  //TODO if (event.key == "ArrowDown") dino.unDuck();
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

  // socket.emit("gameplay", {
  //   type: "gameover",
  //   name: userName,
  // });
  sendGameData();
  socket.emit("leaving", { username: userName, leaving: true });
  gameOverSound.play();
}

function addObstacle(array) {
  // let r = floor(random(1, 6));
  // switch (r) {
  //   case 2:
  //   case 3:
  //   case 4:
  //   case 5:
  //     array.push(
  //       new Obstacle(
  //         width + 500,
  //         (window.innerHeight * 13.5) / 16 -
  //           window.innerHeight * 0.15 +
  //           ((r - 1) * dino.normalH) / 3,
  //         window.innerHeight * 0.15,
  //         dino.normalH / 3
  //       )
  //     );
  //     break;
  //   default:
  //     array.push(
  //       new Obstacle(
  //         width + 500,
  //         (window.innerHeight * 13.5) / 16,
  //         window.innerHeight * 0.15
  //       )
  //     );
  // }

  // let r = random(1);

  array.push(
    new Obstacle(
      width + 500,
      (window.innerHeight * 13.8) / 16,
      window.innerHeight * 0.15
      // dino.normalH / 3
    )
  );
}

function sendGameData() {
  socket.emit("gameplay", {
    type: "live",
    position: dino.pos.y / height,
    name: userName,
    score: score,
    gameover: collided,
    textureindex: dino.currTexIndex,
  });
  socket.emit("gameplay", {
    type: "obstacleposition",
    pos: obstacles[obstacles.length - 1]
      ? obstacles[obstacles.length - 1].pos.x / width
      : 0,
    speed: dino_speed,
    spacing: min_spacing / width,
  }); //send last obstacle position
}

function reciveGameData(data) {
  if (Object.keys(otherPlayers).includes(data.name)) {
    otherPlayers[data.name].position = data.position;
    otherPlayers[data.name].score = data.score;
    otherPlayers[data.name].gameover = data.gameover;
    otherPlayers[data.name].textureindex = data.textureindex;
  } else {
    otherPlayers[data.name] = {
      name: data.name,
      position: data.position,
      score: data.score,
      gameover: data.gameover,
      textureindex: data.textureindex,
    };
  }
}

function drawOtherPlayer(player) {
  push();
  tint(255, 100);
  if (player.gameover) tint(255, 100, 100, 50);
  switch (player.textureindex) {
    case 0:
      image(dinoRunTexture1, 100, player.position * height, dino.w, dino.h);
      break;
    case 1:
      image(dinoRunTexture2, 100, player.position * height, dino.w, dino.h);
      break;
    case 2:
      image(dinoJumpTexture, 100, player.position * height, dino.w, dino.h);
      break;
    case 3:
      image(dinoGameOverTexture, 100, player.position * height, dino.w, dino.h);
  }

  fill(0);
  if (player.gameover) fill(255, 0, 0);
  textSize(18);
  text(player.name, 100, player.position * height - 20);
  pop();
}
