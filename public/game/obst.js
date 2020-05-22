class Obstacle {
  constructor(x, y, s, h=undefined) {
    if (h !== undefined){
      this.h = h;
    }else{
      this.h = s;
    }
    this.pos = createVector(x, y - this.h);
    this.w = (this.s * 3) / 4;
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
