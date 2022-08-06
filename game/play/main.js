
let app = new PIXI.Application({ width: 640, height: 360, backgroundColor: 0x141414, resizeTo: window });
document.body.appendChild(app.view);

const keyboard = new KeyboardEventWrapper();

let bird = new PIXI.AnimatedSprite([
    PIXI.Texture.from(spriteUrl.bird1),
    PIXI.Texture.from(spriteUrl.bird2),
]);

let dinoTextures = [
    PIXI.Texture.from(spriteUrl.dinoRun1),
    PIXI.Texture.from(spriteUrl.dinoRun2),
    
    PIXI.Texture.from(spriteUrl.dinoDuck1),
    PIXI.Texture.from(spriteUrl.dinoDuck2),
    
    PIXI.Texture.from(spriteUrl.dinoJump),

    PIXI.Texture.from(spriteUrl.dinoGameOver1),
    PIXI.Texture.from(spriteUrl.dinoGameOver2),
]

let dino = new PIXI.AnimatedSprite([
    dinoTextures[0], dinoTextures[1]
])

let cactusTextures = [
    PIXI.Texture.from(spriteUrl.cactusBig1),
    PIXI.Texture.from(spriteUrl.cactusBig2),
    PIXI.Texture.from(spriteUrl.cactusBigPair),
    PIXI.Texture.from(spriteUrl.cactusBigSmall),
    PIXI.Texture.from(spriteUrl.cactusSmall1),
    PIXI.Texture.from(spriteUrl.cactusSmall2),
    PIXI.Texture.from(spriteUrl.cactusSmall3),
    PIXI.Texture.from(spriteUrl.cactusSmall4),
    PIXI.Texture.from(spriteUrl.cactusSmall5),
]

let cactuses = [];
for (let i = 0; i < 400; i++) {
    let texture = cactusTextures[Math.round(Math.random() * (cactusTextures.length - 1))]
    let sprite = new PIXI.Sprite(texture)
    cactuses.push([i * 400 + (Math.random() * 200), sprite])
}

dino.x = 200;
dino.play();

bird.play();
bird.animationSpeed = 0.1

let ground = new PIXI.TilingSprite(PIXI.Texture.from(spriteUrl.ground), 4800, 20)
ground.y = window.innerHeight * 0.75 - 20;

app.stage.addChild(ground);

for (const c of cactuses) {
    c[1].visible = false;
    app.stage.addChild(c[1])
}

app.stage.addChild(bird, dino)

let elapsed = 0.0;

let gsStart = -7;
let gs = 0;
let acc = 0.1;

const g = -1.3;
let dinoVel = 0.0;
let dinoPos = 0.0;

let isJumpingPrev = false;
let isJumping = false;

let groundPos = 0.0;

app.ticker.add(delta => {
    elapsed += delta;
    bird.x = window.innerWidth / 2;
    bird.y = 100 + Math.cos(elapsed / 20.0) * 100.0;
   
    ground.x += delta * gs
    groundPos += delta * gs
    gs = gsStart - ((elapsed / 100) * acc)
    dino.animationSpeed = gs / 40;

    if (dinoPos > 0.0 || dinoVel > 0.0) {
        dinoVel += g * delta
        dinoPos += dinoVel * delta
        if (dinoPos < 0.0) { 
            dinoPos = 0.0
            dinoVel = 0.0
            isJumping = false
        }
    } else {
        dinoVel = 0.0
    }

    if (isJumping && !isJumpingPrev) {
        dino.textures = [dinoTextures[4]]
        isJumpingPrev = true
    } else if (!isJumping && isJumpingPrev) {
        dino.textures = [dinoTextures[0], dinoTextures[1]]
        dino.play()
        isJumpingPrev = false
    }

    for (let i = 0; i < cactuses.length; i++) {
        let c = cactuses[i];
        let pos = c[0] + groundPos;
        if (pos + c[1].width >= 0 && pos <= window.innerWidth) {
            c[1].x = pos
            c[1].y = window.innerHeight * 0.75 - c[1].height
            c[1].visible = true
        } else if (pos + c[1].width < 0) {
            c[1].destroy()
            c[1].visible = false
            cactuses.splice(i, 1)
            if (cactuses.length <= 0) {
                for (let j = 0; j < 400; j++) {
                    let texture = cactusTextures[Math.round(Math.random() * (cactusTextures.length - 1))]
                    let sprite = new PIXI.Sprite(texture)
                    cactuses.push([-groundPos + j * 400 + (Math.random() * 200), sprite])
                }
            }
        } else {
            c[1].visible = false
        }
    }

    dino.y = window.innerHeight * 0.75 - dino.textures[0].height - dinoPos;
    if (ground.x + ground.width <= 2400) {
        ground.x = 0;
    }
})

keyboard.onKeyDown(event => {
    switch (event.code) {
        case "Space":
        case "ArrowUp":
            if (isJumping) break;
            isJumping = true;
            dinoVel = 23;
            break;
        case "ArrowDown":
            if (isJumping) break;
            dino.textures = [dinoTextures[2], dinoTextures[3]]
            dino.play()
    }
})

keyboard.onKeyUp(event => {
    if (event.code == "ArrowDown") {
        dino.textures = [dinoTextures[0], dinoTextures[1]]
        dino.play()
    }
})
