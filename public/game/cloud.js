class Cloud {
  constructor(x, y, h, texture, speed) {
    this.pos = createVector(x, y);
    this.texture = texture;
    this.h = h;
    this.w = (this.texture.width / this.texture.height) * this.h;
    this.speed = speed;
  }

  show() {
    image(this.texture, this.pos.x, this.pos.y, this.w, this.h);
  }

  update() {
    this.pos.x += this.speed;
  }
}
