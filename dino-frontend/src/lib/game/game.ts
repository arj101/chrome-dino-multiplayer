// import { run } from './_game'
import * as PIXI from 'pixi.js'
import { Dino } from './dino'
import { Ground } from './ground'
import { ws, userId } from '../../lib/store'
import { Map } from './map'
import { KeyboardEventWrapper } from './keyboard-event-wrapper'

class Game {
    id: string

    app: PIXI.Application
    dino: Dino
    ground: Ground
    map: Map
    pixelRatio: number
    baseY: number

    gravity: number
    acc: number
    speed: number
    xPos: number

    running: boolean

    constructor(parent: Element, id: string) {
        this.id = id;
        this.map = new Map()

        this.app = new PIXI.Application({
            backgroundColor: 0x141414, resizeTo: window 
        })
        parent.appendChild(this.app.view)

        this.pixelRatio = this.calcPixelRatio()
        this.baseY = window.innerHeight * 3 / 4

        this.dino = new Dino(this.toPixels(1))
        this.ground = new Ground()
        this.app.stage.addChild(this.ground.sprite, this.dino.sprite)
        this.running = false

        this.xPos = 0
        this.speed = this.toPixels(50);
        this.acc = this.toPixels(10);

        this.ground.pos = {
            x: this.toPixels(0) + this.toPixels(this.ground.pos.x),
            y: this.baseY - this.ground.sprite.height
        }

        this.dino.sprite.play()

        this.gravity = this.toPixels(-60);

        ws.update(ws => {
            ws.onOpen(() => ws.send({type: 'Map', sessionId: this.id, userId: '00000000-0000-0000-0000-000000000000', index: this.map.mapIdx}))
            ws.onMessage(msg => this.map.appendMap(msg, this.app))
            return ws
        })

        let keyboard = new KeyboardEventWrapper();
        keyboard.onKeyDown(e => {
            if (e.code === 'ArrowUp') {
                this.dino.vel.y = this.toPixels(1.5);
                this.dino.isJumping = true;
                this.dino.wasJumping = true;
                this.dino.applyJumpTexture();
            }
        })
        
        this.app.ticker.add(delta => {
            if (!this.running) return

            this.dino.computedPos = {
                x: this.toPixels(2),
                y: this.baseY - this.dino.sprite.height - this.toPixels(this.dino.pos.y)
            }

            if (this.dino.pos.y > 0 || this.dino.vel.y > 0) {
                this.dino.vel.y += (delta / 1000) * this.gravity
                this.dino.pos.y += (delta / 1000) * this.dino.vel.y;
                if (this.dino.pos.y < 0) this.dino.pos.y = 0
            } else if (this.dino.pos.y <= 0) {
                this.dino.isJumping = false;
                this.dino.vel.y = 0;
                this.dino.pos.y = 0;
            }

            if (!this.dino.isJumping && this.dino.wasJumping) {
                this.dino.applyRunTexture();
                this.dino.isJumping = false;
                this.dino.wasJumping = false;
            }

            this.speed += (delta / 1000) * this.acc;
            this.ground.pos.x -= (delta / 1000) * this.speed;
            this.xPos += (delta / 1000) * this.speed;

            if (this.ground.pos.x + this.ground.sprite.width <= 1024 * 2) {
                this.ground.pos.x = 0;
            }

            let renderables = this.map.getRenderable(this.toRel(this.xPos), this.toRel(window.innerWidth));

            if (!this.map.mapReqSent && this.map.needsMoreMap) {
                console.log(`next map index: ${this.map.mapIdx}`)
                this.map.mapReqSent = true;
                ws.update(ws => {
                    ws.onOpen(() => ws.send({type: 'Map', sessionId: this.id, userId: '00000000-0000-0000-0000-000000000000', index: this.map.mapIdx}))
                    this.map.mapIdx += 1;
                    return ws
                })
            }

            for (let i = 0; i < renderables.length; i++) {
                let grouping = renderables[i];
                let x = grouping[0];
                let xOffset = 0;
                for (let j = 0; j < grouping[1].length; j++) {
                    let object = grouping[1][j];
                    object.sprite.visible = true;
                    object.sprite.y = this.baseY - object.sprite.height;
                    object.sprite.x = this.toPixels(x) - this.xPos + xOffset;
                    xOffset += object.sprite.width;
                } 
            } 

            // this.dino.sprite.animationSpeed = 0.4 * this.toPixels(1) / this.speed
            
            this.dino.sprite.x = this.dino.computedPos.x
            this.dino.sprite.y = this.dino.computedPos.y
    
            this.ground.sprite.x = this.ground.pos.x
            this.ground.sprite.y = this.ground.pos.y
        })
    }

    calcPixelRatio(): number {
        return window.innerHeight / 6
    }

    toPixels(rel: number): number {
        return rel * this.pixelRatio
    }

    toRel(pixels: number): number {
        return pixels / this.pixelRatio
    }

    start() {
        this.running = true
    }

    stop() {
        this.running = false
    }
}

export { Game }