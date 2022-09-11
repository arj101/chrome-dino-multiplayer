import { TextureMap } from "./texture-map";
import { spriteUrl, Sprite } from "./sprites";
import type { RectBox2D } from "./game";

interface GameRenderData {
    score: number;
    vel: number;
    xPos: number;
}

enum SpriteAlign {
    TopLeft,
    BottomLeft,
}

class Renderer {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    textureMap: TextureMap;
    bgColor: string;
    renderList: Array<[Sprite, { x: number; y: number }]>;
    animatedSprites: Map<
        number,
        [
            Array<[Sprite, { swapDelay: number }]>,
            {
                x: number;
                y: number;
                align: SpriteAlign;
                relY: boolean;
                gamePos: boolean;
                opacity?: number;
            },
            { lastSwap: number; currIdx: number }
        ]
    >;
    backgroundSprites: Array<
        [Sprite, { x: number; y: number; parallaxCoeff: number }]
    >;
    screenOffset: { x: number; y: number };
    relUnitLen: number;
    groundPos: number;
    scalingFactor: number;
    boundingBox: boolean;

    constructor(
        canvas: HTMLCanvasElement,
        dinoHeight: number,
        unitLength: number,
        bgColor?: string
    ) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.globalCompositeOperation = "source-in";
        this.canvas.style.position = "absolute";
        this.canvas.style.left = "0";
        this.canvas.style.top = "0";
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.textureMap = new TextureMap();
        this.renderList = [];
        this.animatedSprites = new Map();
        this.screenOffset = { x: 0, y: 0 };
        this.relUnitLen = unitLength;
        this.groundPos = this.canvas.height * 0.6;
        this.backgroundSprites = [];
        this.scalingFactor = unitLength / dinoHeight;
        this.boundingBox = window.localStorage.getItem("debug") != null;

        this.bgColor = bgColor ? bgColor : "rgba(30, 30, 30, 1)";

        this.drawBackground();

        document.body.onresize = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.groundPos = this.canvas.height * 0.6;
        };

        for (const spriteName of spriteUrl.keys()) {
            this.textureMap.loadTexture(
                spriteName,
                spriteUrl.get(spriteName) as string
            );
        }
    }

    xFromRelUnit(x: number) {
        return x * this.relUnitLen;
    }

    xToRelUnit(x: number) {
        return x / this.relUnitLen;
    }

    yFromRelUnit(y: number) {
        return this.groundPos - this.relUnitLen * y;
    }

    getSprite(sprite: Sprite): HTMLImageElement {
        return this.textureMap.getTexture(sprite) as HTMLImageElement;
    }

    getSpriteDimensions(sprite: Sprite): { w: number; h: number } {
        const dimensions = this.textureMap.getTexureDimensions(
            sprite,
            this.scalingFactor
        );
        return { w: dimensions?.w || 0, h: dimensions?.h || 0 };
    }

    drawBackground() {
        this.ctx.fillStyle = this.bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fill();
    }

    drawBackgroundSpriteAtPos(
        sprite: Sprite,
        gamePos: { x: number; y: number },
        parallaxCoeff: number
    ) {
        let x = gamePos.x;
        let y = gamePos.y;
        x = this.xFromRelUnit(x);
        y = this.yFromRelUnit(y);
        this.backgroundSprites.push([sprite, { x, y, parallaxCoeff }]);
    }

    drawSprite(sprite: Sprite, pos: { x: number; y: number }, rel?: boolean) {
        let x = pos.x;
        let y = pos.y;
        if (rel) {
            x = this.xFromRelUnit(x);
            y = this.yFromRelUnit(y);
        }
        const spriteObj = this.getSprite(sprite);
        const w = spriteObj.width * this.scalingFactor;
        const h = spriteObj.height * this.scalingFactor;
        this.ctx.drawImage(
            this.getSprite(sprite) as HTMLImageElement,
            x,
            y,
            w,
            h
        );
    }

    drawSpriteScaled(
        sprite: Sprite,
        pos: { x: number; y: number },
        scale: number
    ) {
        const x = pos.x;
        const y = pos.y;
        const spriteObj = this.getSprite(sprite) as HTMLImageElement;
        const w = spriteObj.width * scale * this.scalingFactor;
        const h = spriteObj.height * scale * this.scalingFactor;
        this.ctx.drawImage(spriteObj, x, y, w, h);
    }

    registerAnimatedSprite(
        sprites: Array<[Sprite, { swapDelay: number }]>,
        pos: { x: number; y: number },
        align: SpriteAlign,
        rel?: boolean
    ): number {
        let x = pos.x;
        let y = pos.y;
        if (rel) {
            x = this.xFromRelUnit(x);
            y = this.yFromRelUnit(y);
        }
        this.animatedSprites.set(this.animatedSprites.size,[
            sprites,
            { x, y, align, gamePos: false, relY: false },
            { lastSwap: new Date().getTime(), currIdx: 0 },
        ]);
        return this.animatedSprites.size - 1;
    }

    registerAnimatedSpriteAtPos(
        sprites: Array<[Sprite, { swapDelay: number }]>,
        pos: { x: number; y: number },
        align: SpriteAlign
    ) {
        let x = pos.x;
        let y = pos.y;
        x = this.xFromRelUnit(x);
        y = this.yFromRelUnit(y);
        this.animatedSprites.set(this.animatedSprites.size,[
            sprites,
            { x, y, align, gamePos: true, relY: false },
            { lastSwap: new Date().getTime(), currIdx: 0 },
        ]);
        return this.animatedSprites.size - 1;
    }

    drawSpriteAtPos(
        sprite: Sprite,
        gamePos: { x: number; y: number },
        rel?: boolean
    ) {
        let x = gamePos.x;
        let y = gamePos.y;
        if (rel) {
            x = this.xFromRelUnit(x);
            y = this.yFromRelUnit(y);
        }
        this.renderList.push([sprite, { x, y }]);
    }

    offsetScreen(x: number, y: number) {
        this.screenOffset = { x, y };
    }

    /**
     * use requestAnimationFrame to run this loop
     */
    loop(
        gameData: GameRenderData,
        t: number,
        _dt: number,
        predrawFn: (sprite: Sprite, obj2: RectBox2D, xVel: number) => void = (
            _,
            __,
            ___
        ) => {}
    ) {
        const xPos = gameData.xPos;
        this.drawBackground();

        //PARALLAX LEVEL 2 (Background)
        for (let i = this.backgroundSprites.length - 1; i >= 0; i--) {
            const sprite = this.backgroundSprites[i];
            const realX =
                sprite[1].x - gameData.xPos / (14 * sprite[1].parallaxCoeff);
            if (realX > this.canvas.width) continue;
            if (realX < -this.canvas.width * 0.2) {
                //FIXME
                this.backgroundSprites.splice(i, 1);
                continue;
            }
            const xOff = this.screenOffset.x / (14 * sprite[1].parallaxCoeff);
            const yOff = this.screenOffset.y / (14 * sprite[1].parallaxCoeff);
            this.ctx.save();
            this.ctx.translate(xOff, yOff);
            const scaleFactor = Math.min(
                1.5,
                Math.max(0.2, 1 / sprite[1].parallaxCoeff)
            );
            const spriteImg = this.getSprite(sprite[0]) as HTMLImageElement;
            this.ctx.globalAlpha = 1.2 / sprite[1].parallaxCoeff;
            const realY = sprite[1].y - spriteImg.height * this.scalingFactor;
            this.drawSpriteScaled(
                sprite[0],
                {
                    x: realX,
                    y: realY,
                },
                scaleFactor
            );
            this.ctx.restore();
        }

        //PARALLAX LEVEL 1
        this.ctx.save();
        this.ctx.translate(this.screenOffset.x / 4, this.screenOffset.y / 4);
        const scoreText = `SCORE: ${Math.round(this.xToRelUnit(xPos))}`;
        this.ctx.fillStyle = "rgb(200, 200, 200)";
        this.ctx.font = "38px Bungee";
        this.ctx.fillText(
            scoreText,
            this.canvas.width - 150 - this.ctx.measureText(scoreText).width,
            this.canvas.height * 0.15
        );
        this.ctx.restore();

        //PARALLAX LEVEL 0
        this.ctx.save();
        this.ctx.translate(this.screenOffset.x, this.screenOffset.y);
        this.ctx.fill();
        this.bgColor = `rgba(30, 30, 30, ${Math.max(
            0.4,
            1 / Math.exp(gameData.vel / 10000) // motion blur
        )})`;
        const groundLength =
            (this.getSprite("ground")?.width as number) * this.scalingFactor;
        const groundX = xPos % groundLength;
        this.drawSprite("ground", {
            x: groundLength - groundX,
            y: this.groundPos - 20 * this.scalingFactor,
        });
        this.drawSprite("ground", {
            x: 0 * groundLength - groundX,
            y: this.groundPos - 20 * this.scalingFactor,
        });
        
        for (const [i, sprite] of this.animatedSprites.entries()) {
            if (sprite[1].gamePos && sprite[1].x - xPos > this.canvas.width)
                continue;
            if (
                sprite[1].gamePos &&
                sprite[1].x - xPos < -this.canvas.width * 0.2
            ) {
                this.animatedSprites.delete(i);
                continue;
            } //FIXME
            if (
                t - sprite[2].lastSwap >=
                sprite[0][sprite[2].currIdx][1].swapDelay
            ) {
                sprite[2].currIdx = (sprite[2].currIdx + 1) % sprite[0].length;
                sprite[2].lastSwap = t;
            }
            let y = sprite[1].y;
            let x = sprite[1].x;
            if (sprite[1].relY) y = this.groundPos - y;
            if (sprite[1].align == SpriteAlign.BottomLeft) {
                y -=
                    this.getSprite(sprite[0][sprite[2].currIdx][0]).height *
                    this.scalingFactor;
            }

            if (sprite[1].gamePos) x -= xPos;
            const spriteName = sprite[0][sprite[2].currIdx][0];
            const { w, h } = this.getSpriteDimensions(spriteName);
            predrawFn(spriteName, { x, y, w, h }, gameData.vel);
            this.ctx.save()
            this.ctx.globalAlpha = sprite[1].opacity || 1;
            this.drawSprite(sprite[0][sprite[2].currIdx][0], {
                x,
                y,
            });
            this.ctx.restore()
            if (!this.boundingBox) continue;
            this.ctx.strokeStyle = "rgb(200, 80, 30)";
            this.ctx.strokeRect(x, y, w, h);
            this.ctx.stroke();
        }

        for (let i = this.renderList.length - 1; i >= 0; i--) {
            const pos = this.renderList[i][1];
            if (pos.x - xPos > this.canvas.width) continue;

            const sprite = this.getSprite(
                this.renderList[i][0]
            ) as HTMLImageElement;
            if (pos.x + sprite.width * this.scalingFactor - xPos < -5) {
                this.renderList.splice(i, 1);
                continue;
            }
            const realX = pos.x - xPos;
            const realY = pos.y - sprite.height * this.scalingFactor;
            const spriteName = this.renderList[i][0];
            const { w, h } = this.getSpriteDimensions(spriteName);
            predrawFn(spriteName, { x: realX, y: realY, w, h }, gameData.vel);
            this.drawSprite(this.renderList[i][0], {
                x: realX,
                y: realY,
            });
            if (!this.boundingBox) continue;
            this.ctx.strokeStyle = "rgb(80, 200, 30)";
            this.ctx.strokeRect(realX, realY, w, h);
            this.ctx.stroke();
        }
        this.ctx.restore();
    }
}

class MultiplayerRenderer {
    players: Map<string, { x: number; y: number; t: number }>;
    playerSprites: Map<string, number>;
    constructor() {
        this.players = new Map();
        this.playerSprites = new Map();
    }

    onBrodcastRecv(
        renderer: Renderer,
        name: string,
        pos: { x: number; y: number },
        gamePos: number,
        textureSwapT: number
    ) {
        const currT = new Date().getTime();

        if (!this.players.has(name)) {
            this.playerSprites.set(
                name,
                renderer.registerAnimatedSprite(
                    [
                        ["dinoRun1", { swapDelay: textureSwapT }],
                        ["dinoRun2", { swapDelay: textureSwapT }],
                    ],
                    { x: 2 + pos.x, y: pos.y },
                    SpriteAlign.BottomLeft,
                    true
                )
            );
            renderer.animatedSprites.get(this.playerSprites.get(name)!)![1].opacity = 0.5;
        }

        const spriteIdx = this.playerSprites.get(name)!;
        const prevPlayerData = this.players.get(name)!;
        this.players.set(name, { x: 2 + pos.x, y: pos.y, t: currT });
        //console.log(this.playerSprites.get(name));

        renderer.animatedSprites.get(spriteIdx)![1].x =
            renderer.xFromRelUnit( 2 + pos.x ) - gamePos;
        renderer.animatedSprites.get(spriteIdx)![1].y = renderer.yFromRelUnit(pos.y);

        if (pos.y > 0 && prevPlayerData.y <= 0) {
            renderer.animatedSprites.get(spriteIdx)![0] = [
                ["dinoJump", { swapDelay: 10000 }],
                ["dinoJump", { swapDelay: 10000 }],
            ];
        } else if (pos.y <= 0 && prevPlayerData.y > 0) {
            renderer.animatedSprites.get(spriteIdx)![0] = [
                ["dinoRun1", { swapDelay: textureSwapT }],
                ["dinoRun2", { swapDelay: textureSwapT }],
            ];
        }

        if (pos.y <= 0 && prevPlayerData) {
            // const vel =
            //     (pos.x - prevPlayerData.x) / (currT - prevPlayerData.t);
            for (const sprite of renderer.animatedSprites.get(spriteIdx)![0]) {
                sprite[1].swapDelay = textureSwapT;
            }
        }
    }
}

export { Renderer, MultiplayerRenderer, SpriteAlign };
export type { GameRenderData };
