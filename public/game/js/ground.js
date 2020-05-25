class Ground {
  constructor(x, y, texture) {
    this.pos1 = createVector(x, y);
    this.textures = [texture, texture];
    this.textures.forEach((texture) => {
      // const newWidth = width * 2;
      texture.width = width * 2;
      texture.height = (texture.height / texture.width) * width * 2;
    });
    this.pos2 = createVector(this.pos1.x + this.textures[0].width, this.pos1.y);
  }

  update() {
    if (this.pos1.x + this.textures[0].width <= 0)
      this.pos1.x = this.pos2.x + this.textures[1].width;
    if (this.pos2.x + this.textures[1].width <= 0)
      this.pos2.x = this.pos1.x + this.textures[0].width;

    this.pos1.x -= dino_speed;
    this.pos2.x -= dino_speed;
  }

  show() {
    image(
      this.textures[0],
      this.pos1.x,
      this.pos1.y - this.textures[0].height / 2
    );
    image(
      this.textures[1],
      this.pos2.x,
      this.pos2.y - this.textures[1].height / 2
    );
  }
}
