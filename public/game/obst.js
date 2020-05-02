class Obstacle {
  constructor(x, y, s) {
    this.h = s;
    this.pos = createVector(x, y - this.h);
    this.w = (this.h * 3) / 4;
  }

  update() {
    this.pos.x -= dino_speed;
  }

  show() {
    push();
    fill(255, 50, 50);
    noStroke();
    rect(this.pos.x, this.pos.y, this.w, this.h);
    pop();
  }
}
