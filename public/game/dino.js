class Dino {
  constructor(x, y, s, textures) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);

    this.normalH = s;
    this.textures = textures;
    this.h = s;
    this.w = this.h * (this.textures[0].width / this.textures[0].height);
    this.baseY = y - this.h;
    this.normalY = this.baseY;
    this.currTexIndex = 0;
    this.lastTextureChange = 0; //in frame count
    this.gameOver = false;
  }

  update() {
    this.pos.add(this.vel);
    if (this.pos.y > this.baseY) {
      this.pos.y = this.baseY;
      this.vel.y = 0;
    }
    if (this.pos.y < 0) this.pos.y = 0;
  }

  show() {
    if (frameCount - this.lastTextureChange > 1 / (dino_speed / 128)) {
      if (this.pos.y >= this.baseY - 0.01) {
        this.lastTextureChange = frameCount;
        if (this.currTexIndex) this.currTexIndex = 0;
        else this.currTexIndex = 1;
      } else this.currTexIndex = 2;
    }

    if (this.gameOver) this.currTexIndex = 3;

    push();
    fill(10, 20, 200, 200);
    noStroke();
    stroke(255);
    noFill();
    // image(uImg, this.pos.x, this.pos.y, this.w, this.h);
    const currTexture = this.textures[this.currTexIndex];

    image(currTexture, this.pos.x, this.pos.y, this.w, this.h);

    // stroke(50);
    // noFill();
    // rect(this.pos.x, this.pos.y, 5, 5);
    // rect(100, this.basey, 5, 5);

    // stroke(100, 100);
    // rect(this.pos.x, this.pos.y, this.w, this.h);
    // ellipse(
    //   this.pos.x + this.w / 2,
    //   this.pos.y + this.h / 2,
    //   (this.w / 1.5) * 2
    // );
    pop();
  }

  gravity() {
    if (this.pos.y < this.baseY) this.vel.y += 1.5;
  }
  jump() {
    if (this.vel.y == 0) {
      const vel_y = 25;
      this.vel.y -= vel_y;
      jumpSound.play();
    }
  }
  duck() {
    /// also makes you snap downwards
    this.h = this.normalH / 3;
    this.pos.y = this.normalY + 2 * this.h;
    this.baseY = this.normalY + 2 * this.h;
  }
  unDuck() {
    this.h = this.normalH;
    this.pos.y = this.normalY;
    this.baseY = this.normalY;
  }
  collided(other) {
    let point1 = createVector(this.pos.x, this.pos.y);
    let point2 = createVector(0, 0);

    if (this.pos.x < other.pos.x && this.pos.y + this.w > other.pos.y) {
      point2.x = other.pos.x;
      point2.y = this.pos.y;

      return dist(point1.x, point1.y, point2.x, point2.y) <= this.w;
    }

    if (
      this.pos.x > other.pos.x &&
      this.pos.x < other.pos.x + other.w &&
      this.pos.y < other.pos.y
    ) {
      point2.x = this.pos.x;
      point2.y = other.pos.y;

      return dist(point1.x, point1.y, point2.x, point2.y) <= this.w;
    }

    if (this.pos.x > other.pos.x && this.pos.y > other.pos.y) {
      point2.x = other.pos.x;
      point2.y = this.pos.y;
      console.log(3);
      return dist(point1.x, point2.y, point2.x, point2.y) <= this.w + other.w;
    }
  }
}
