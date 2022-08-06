import * as PIXI from 'pixi.js'
import { spriteUrl } from './sprites'

class Dino {
    sprite: PIXI.AnimatedSprite
    textures: Array<PIXI.Texture>
    pos: { y: number }
    vel: { y: number }
    computedPos: { x: number, y: number }
    aspectRatio: number
    wasJumping: boolean
    isJumping: boolean

    constructor(realHeight: number) {
        this.textures = [
            PIXI.Texture.from(spriteUrl.dinoRun1),
            PIXI.Texture.from(spriteUrl.dinoRun2),
            
            PIXI.Texture.from(spriteUrl.dinoDuck1),
            PIXI.Texture.from(spriteUrl.dinoDuck2),
            
            PIXI.Texture.from(spriteUrl.dinoJump),
            
            PIXI.Texture.from(spriteUrl.dinoGameOver1),
            PIXI.Texture.from(spriteUrl.dinoGameOver2),
        ]

        this.sprite = new PIXI.AnimatedSprite([
            this.textures[0], this.textures[1]
        ])

        this.aspectRatio = this.sprite.width / this.sprite.height
        this.sprite.height = realHeight
        this.sprite.width = this.aspectRatio * this.sprite.height

        this.pos = { y: 0.0 }
        this.vel = { y: 0.0 }
        this.sprite.stop()
        this.computedPos = { x: null, y: null }

        this.isJumping = false;
        this.wasJumping = false;
    }

    applyRunTexture() {
        this.sprite.textures = [ this.textures[0], this.textures[1] ]
        this.sprite.play()
    }

    applyJumpTexture() {
        this.sprite.textures = [ this.textures[4] ]
        this.sprite.stop()
    }
}

export { Dino }