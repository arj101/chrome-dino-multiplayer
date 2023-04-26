import { TextureMap } from "./texture-map";
import { spriteUrl, Sprite } from "./sprites";
import Player from "./player";
import type { GameEvent } from "./ws-de-serialize";
import type { RectBox2D } from "./game";
import type { PhysicsConfig } from "./physics";

interface GameRenderData {
    score: number;
    vel: number;
    xPos: number;
}

enum SpriteAlign {
    TopLeft,
    BottomLeft,
}

interface SpriteResources {
    sprite: Sprite;
    isPrimitive: boolean;
    id: SpriteId;
    x: number;
    y: number;
    width: number;
    height: number;
    className: string;
    parallaxCoeff: number; // is this really necessary?
    scalingFactor: number;
}

interface SpriteData {
    res: SpriteResources;
    preRender: (
        sprite: SpriteResources,
        ctx: CanvasRenderingContext2D,
        deltaTime: number
    ) => boolean; // does not render if this returns false
    postRender: (
        sprite: SpriteResources,
        ctx: CanvasRenderingContext2D,
        deltaTime: number
    ) => void;
}

type SpriteId = { name: string; zIndex: number };

type RenderList = Map<number, Map<string, SpriteData>>;

class RendererResources {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    textureMap: TextureMap; //this is where we get the textures from. Basically Map<SpriteName, Texture>
    renderListStack: Array<RenderList> = [new Map()];
    renderList: RenderList = this.renderListStack[0];
    zIndices: Array<number> = [];
    deltaTime: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d")!;
        this.textureMap = new TextureMap();
    }
}

class FullScreenRenderer {
    res: RendererResources;

    constructor(canvas: HTMLCanvasElement) {
        this.res = new RendererResources(canvas);

        this.res.ctx.imageSmoothingEnabled = false;
        this.res.ctx.globalCompositeOperation = "source-in";

        this.res.canvas.style.position = "absolute";
        this.res.canvas.style.left = "0";
        this.res.canvas.style.top = "0";
        this.res.canvas.width = window.innerWidth;
        this.res.canvas.height = window.innerHeight;

        window.addEventListener("resize", () => {
            this.res.canvas.width = window.innerWidth;
            this.res.canvas.height = window.innerHeight;
        });

        for (const spriteName of spriteUrl.keys()) {
            this.res.textureMap.loadTexture(
                spriteName,
                spriteUrl.get(spriteName) as string
            );
        }
    }

    getRenderObject({ zIndex, name }: SpriteId): SpriteData | undefined {
        return this.res.renderList.get(zIndex)?.get(name);
    }

    pushRenderList() {
        this.res.renderListStack.push(new Map());
        this.res.renderList =
            this.res.renderListStack[this.res.renderListStack.length - 1];
        this.updateZIndices();
    }

    popRenderList(): boolean {
        if (this.res.renderListStack.length <= 0) {
            console.error("Cannot pop out of empty render list stack!");
            return false;
        }

        this.res.renderListStack.pop();
        this.res.renderList =
            this.res.renderListStack[this.res.renderListStack.length - 1];
        this.updateZIndices();
        return true;
    }

    updateZIndices() {
        this.res.zIndices = [];
        for (const key of this.res.renderList.keys()) {
            if ((this.res.renderList.get(key)?.size || 0) < 0) continue;
            this.res.zIndices.push(key);
        }
        this.res.zIndices.sort();
    }

    removeRenderObject(idName: string, zIndex: number): SpriteData | undefined {
        const sprite = this.res.renderList.get(zIndex)?.get(idName);
        if (this.res.renderList.get(zIndex)?.delete(idName)) {
            this.updateZIndices();
        }
        return sprite;
    }

    withRenderObject(
        idName: string,
        zIndex: number,
        fn: (sprite: SpriteData) => void
    ) {
        const sprite = this.res.renderList.get(zIndex)?.get(idName);
        if (sprite) fn(sprite);
    }

    addSprite(
        idName: string,
        zIndex: number,
        sprite: Sprite,
        position: { x: number; y: number },
        className: string = "",
        scalingFactor: number = 1
    ): boolean {
        if (this.res.renderList.get(zIndex)?.has(idName)) return false;

        const dimensions = this.res.textureMap.getTexureDimensions(sprite);

        const spriteData: SpriteData = {
            res: {
                id: { name: idName, zIndex },
                x: position.x,
                y: position.y,
                width: (dimensions?.w ?? 0) * scalingFactor,
                height: (dimensions?.h ?? 0) * scalingFactor,
                sprite,
                className,
                isPrimitive: false,
                parallaxCoeff: 1,
                scalingFactor,
            },
            postRender(_sprite) {},
            preRender(_sprite) {
                return true;
            },
        };
        if (!this.res.renderList.has(zIndex))
            this.res.renderList.set(zIndex, new Map());

        this.res.renderList.get(zIndex)!.set(idName, spriteData);
        this.updateZIndices();
        return true;
    }

    addPrimitiveRenderer(
        idName: string,
        zIndex: number,
        renderFirstPass: (
            sprite: SpriteResources,
            ctx: CanvasRenderingContext2D,
            deltaTime: number
        ) => boolean,
        renderSecondPass: (
            sprite: SpriteResources,
            ctx: CanvasRenderingContext2D,
            deltaTime: number
        ) => void = () => {},
        position: { x: number; y: number } = { x: 0, y: 0 },
        size: { width: number; height: number } = { width: 0, height: 0 },
        className: string = "",
        scalingFactor: number = 1
    ): boolean {
        if (this.res.renderList.get(zIndex)?.has(idName)) return false;

        const spriteData: SpriteData = {
            res: {
                id: { name: idName, zIndex },
                x: position.x,
                y: position.y,
                width: size.width * scalingFactor,
                height: size.height * scalingFactor,
                sprite: "none",
                className,
                isPrimitive: true,
                parallaxCoeff: 1,
                scalingFactor,
            },
            preRender: renderFirstPass,
            postRender: renderSecondPass,
        };

        if (!this.res.renderList.has(zIndex))
            this.res.renderList.set(zIndex, new Map());

        this.res.renderList.get(zIndex)!.set(idName, spriteData);
        this.updateZIndices();
        return true;
    }

    render(deltaTime: number) {
        let renderConfirmation = true;
        this.res.deltaTime = deltaTime;
        for (const zIndex of this.res.zIndices) {
            const layer = this.res.renderList.get(zIndex)!;

            sprite_loop: for (const [_id, sprite] of layer) {
                renderConfirmation = sprite.preRender(
                    sprite.res,
                    this.res.ctx,
                    deltaTime
                ); //FIXME: this copied 'sprite'
                if (!renderConfirmation) continue sprite_loop;
                if (!sprite.res.isPrimitive) {
                    const { w, h } = this.res.textureMap.getTexureDimensions(
                        sprite.res.sprite,
                        sprite.res.scalingFactor
                    ) !;
                    sprite.res.width = w;
                    sprite.res.height = h;
                    const spriteImage = this.res.textureMap.getTexture(
                        sprite.res.sprite
                    )!;

                    this.res.ctx.drawImage(
                        spriteImage,
                        sprite.res.x,
                        sprite.res.y,
                        w,
                        h
                    );
                }
                sprite.postRender(sprite.res, this.res.ctx, deltaTime); //FIXME: this copied 'sprite'
            }
        }
    }
}

class Renderer {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    textureMap: TextureMap;
    bgColor: string;
    renderList: Array<SpriteData>;
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
            { lastSwap: number; currIdx: number },
            string
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
        rel?: boolean,
        className?: string
    ): number {
        let x = pos.x;
        let y = pos.y;
        if (rel) {
            x = this.xFromRelUnit(x);
            y = this.yFromRelUnit(y);
        }
        this.animatedSprites.set(this.animatedSprites.size, [
            sprites,
            { x, y, align, gamePos: false, relY: false },
            { lastSwap: new Date().getTime(), currIdx: 0 },
            className ?? "",
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
        this.animatedSprites.set(this.animatedSprites.size, [
            sprites,
            { x, y, align, gamePos: true, relY: false },
            { lastSwap: new Date().getTime(), currIdx: 0 },
            "",
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
        // this.drawBackground();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

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
            this.ctx.save();
            this.ctx.globalAlpha = sprite[1].opacity || 1;
            this.drawSprite(sprite[0][sprite[2].currIdx][0], {
                x,
                y,
            });
            this.ctx.restore();
            if (!this.boundingBox || sprite[3] == "otherPlayer") continue;
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
            predrawFn(
                spriteName,
                {
                    x: pos.x - xPos,
                    y: pos.y - sprite.height * this.scalingFactor,
                    w,
                    h,
                },
                gameData.vel
            );
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
    players: Map<string, Player>;
    playerSprites: Map<string, number>;
    constructor() {
        this.players = new Map();
        this.playerSprites = new Map();
    }

    onBrodcastRecv(
        renderer: Renderer,
        name: string,
        event: GameEvent,
        gamePos: number,
        physics: PhysicsConfig,
        textureSwapT: number
    ) {
        if (
            !this.players.has(name) ||
            !this.playerSprites.has(name) ||
            !renderer.animatedSprites.has(this.playerSprites.get(name)!)
        ) {
            this.playerSprites.set(
                name,
                renderer.registerAnimatedSprite(
                    [
                        ["dinoRun1", { swapDelay: textureSwapT }],
                        ["dinoRun2", { swapDelay: textureSwapT }],
                    ],
                    { x: 2, y: 0.0 },
                    SpriteAlign.BottomLeft,
                    true,
                    "otherPlayer"
                )
            );
            console.log(this.playerSprites.get(name), renderer.animatedSprites);
            renderer.animatedSprites.get(
                this.playerSprites.get(name)
            )![1].opacity = 0.5;

            this.players.set(name, new Player(name, physics));
        }

        const player: Player = this.players.get(name)!;

        const wasJumping = player.isJumping(physics);
        const wasDucking = player.isDucking;

        player.readEvent(event);

        const isDucking = player.isDucking;
        const isJumping = player.isJumping(physics);

        const spriteIdx = this.playerSprites.get(name)!;

        //console.log(this.playerSprites.get(name));

        const spriteObj = renderer.animatedSprites.get(spriteIdx)!;
        spriteObj[1].x = renderer.xFromRelUnit(2 + player.currentXPos());
        spriteObj[1].y = renderer.yFromRelUnit(player.currentYPos(physics));

        if (!wasJumping && isJumping) {
            spriteObj[0] = [
                ["dinoJump", { swapDelay: 10000 }],
                ["dinoJump", { swapDelay: 10000 }],
            ];
        } else if ((wasJumping || wasDucking) && !isDucking && !isJumping) {
            spriteObj[0] = [
                ["dinoRun1", { swapDelay: textureSwapT }],
                ["dinoRun2", { swapDelay: textureSwapT }],
            ];
        } else if (!wasDucking && isDucking) {
            spriteObj[0] = [
                ["dinoDuck1", { swapDelay: textureSwapT }],
                ["dinoDuck2", { swapDelay: textureSwapT }],
            ];
        }

        if (isJumping) {
            for (const sprite of spriteObj[0]) {
                sprite[1].swapDelay = textureSwapT;
            }
        }
    }

    update(
        renderer: Renderer,
        physics: PhysicsConfig,
        dt: number,
        gamePos: number,
        textureSwapT: number
    ) {
        for (const [name, player] of this.players) {
            const wasJumping = player.isJumping(physics);
            const wasDucking = player.isDucking;

            player.update(physics, dt);
            console.log(renderer.xFromRelUnit(player.pos), gamePos);

            const isDucking = player.isDucking;
            const isJumping = player.isJumping(physics);

            const spriteIdx = this.playerSprites.get(name)!;
            //console.log(this.playerSprites.get(name));

            const spriteObj = renderer.animatedSprites.get(spriteIdx)!;
            spriteObj[1].x = renderer.xFromRelUnit(2 + player.currentXPos());
            spriteObj[1].y = renderer.yFromRelUnit(player.currentYPos(physics));

            if (!wasJumping && isJumping) {
                spriteObj[0] = [
                    ["dinoJump", { swapDelay: 10000 }],
                    ["dinoJump", { swapDelay: 10000 }],
                ];
            } else if ((wasJumping || wasDucking) && !isDucking && !isJumping) {
                spriteObj[0] = [
                    ["dinoRun1", { swapDelay: textureSwapT }],
                    ["dinoRun2", { swapDelay: textureSwapT }],
                ];
            } else if (!wasDucking && isDucking) {
                spriteObj[0] = [
                    ["dinoDuck1", { swapDelay: textureSwapT }],
                    ["dinoDuck2", { swapDelay: textureSwapT }],
                ];
            }

            if (isJumping) {
                for (const sprite of spriteObj[0]) {
                    sprite[1].swapDelay = textureSwapT;
                }
            }
        }
    }
}

export { Renderer, MultiplayerRenderer, SpriteAlign, FullScreenRenderer };
export type {
    GameRenderData,
    SpriteData,
    SpriteId,
    SpriteResources,
    RendererResources,
};
