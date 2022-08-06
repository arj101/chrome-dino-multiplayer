import * as PIXI from 'pixi.js'
import { spriteUrl } from './sprites'

class Ground {
    sprite: PIXI.TilingSprite
    pos: { x: number, y: number }
    constructor() {
        this.sprite = new PIXI.TilingSprite(PIXI.Texture.from(spriteUrl.ground), 2400 * 3, 20)
        this.pos = { x: null, y: null }
    }

}

export { Ground }