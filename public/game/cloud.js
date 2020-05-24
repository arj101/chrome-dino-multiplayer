class Cloud {
  constructor(x, y, h, texture) {
    this.pos = createVector(x, y);
    this.texture = texture;
    this.h = h;
    this.w = (this.texture.width / this.texture.height) * this.h;
  }

  show() {
    image(this.texture, this.pos.x, this.pos.y, this.w, this.h);
  }

  update(speed) {
    this.speed = speed;
    this.pos.x += this.speed;
  }
}
