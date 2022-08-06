import * as PIXI from 'pixi.js'
import type { RxData } from './ws-de-serialize'
import { spriteUrl } from './sprites'
import type { Sprite } from './sprites'

class Map {
    map: Array<[number, Array<Obstacle>]>
    mapIdx: number
    needsMoreMap: boolean
    mapReqSent: boolean

    constructor() {
        this.map = []
        this.mapIdx = 0
        this.needsMoreMap = true;
        this.mapReqSent = false;
    }

    appendMap(rxdata: RxData, app: PIXI.Application) {
        if (rxdata.type !== 'Map') return
        for (const [x, obstacles] of rxdata.map) {
            this.map.push([x, obstacles.map(name => new Obstacle(name, app))])
        }
        this.needsMoreMap = false;
        this.mapReqSent = true;
    }

    getRenderable(xPos: number, screenWidth: number): Array<[number, Array<Obstacle>]> {
        if (this.map.length <= 0) return []

        if (this.map.length >= 1 && this.map[0][0] < xPos) {
            let groupWidth = 0;
            for (const obj of this.map[0][1]) groupWidth += obj.sprite.width;
            if (this.map[0][0] + groupWidth < xPos) {
                this.map[0][1].forEach(o => o.sprite.destroy())
                this.map.shift()
            }
        }

        let endIdx = 0;
        while (this.map.length >= 1 && this.map[endIdx][0] <= xPos + screenWidth && endIdx + 1 < this.map.length) {
            endIdx++
        }

        if (this.map.length <= 50) {
            this.needsMoreMap = true;
            this.mapReqSent = false;
        }

        return this.map.slice(0, endIdx)
    }
}

class Obstacle {
    sprite: PIXI.Sprite | PIXI.AnimatedSprite
    type: Sprite

    constructor(name: string, app: PIXI.Application) {
        let head = name[0].toLowerCase();
        let tail = name.substring(1);
        let url = spriteUrl[head + tail];
        this.sprite = PIXI.Sprite.from(url);
        this.type = name as Sprite
        this.sprite.visible = false;
        app.stage.addChild(this.sprite);
    }
}

export { Map, Obstacle }