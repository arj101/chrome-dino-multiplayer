
class OtherDino{
    constructor(x,y,h,name,textures){
        this.pos = createVector(x,y);
        this.h = h;
        this.name = name;
        this.textures = textures;//array of 3 png images [run1,run2,jump,gameover]
        this.w = this.h * (this.textures[0].width / this.textures[0].height);
        this.textureIndex = 2;
        this.score = 0;
        this.gameover = false;
    }

    update(yPosition,score,textureIndex,gameover = false,){
        this.y = yPosition;
        this.score = score;
        this.textureIndex = textureIndex;
        this.gameover = gameover;
    }

    show(){
        push();
        noStroke();
        fill(200);
        text(this.name,this.pos.x,this.pos.y);
        image(this.textures[this.textureIndex],this.pos.x,this.pos.y,this.w,this.h)
        pop();
    }

}