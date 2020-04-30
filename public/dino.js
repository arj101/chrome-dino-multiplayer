class Dino {
  constructor(x, y, s) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.h = s;
    this.w = s * (3 / 4);
    this.basey = y - this.h;
  }

  update() {
    this.pos.add(this.vel);
    if (this.pos.y > this.basey) {
      this.pos.y = this.basey;
      this.vel.y = 0;
    }
    if (this.pos.y < 0) this.pos.y = 0;
  }
  show() {
    push();
    fill(10, 20, 200, 200);
    noStroke();
    // stroke(255);
    // noFill();
    // image(uImg, this.pos.x, this.pos.y, this.w, this.h);
    rect(this.pos.x, this.pos.y, this.w, this.h);
    pop();
  }

  gravity() {
    if (this.pos.y < this.basey) this.vel.y += 1;
  }
  jump() {
    if (this.vel.y == 0) {
      const vel_y = window.innerHeight * 0.0305;
      this.vel.y -= vel_y;
    }
  }
  collided(other) {
    return (
      this.pos.x + this.w > other.pos.x &&
      this.pos.x < other.pos.x + other.w &&
      this.pos.y + this.h > other.pos.y &&
      this.pos.y < other.pos.y + other.w
    );
  }
}
