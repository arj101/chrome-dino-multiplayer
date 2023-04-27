import { ServerBridge } from "./socket-client";
import type { GameState } from "./socket-client";
import {
    GameRenderData,
    Renderer,
    MultiplayerRenderer,
    SpriteAlign,
    FullScreenRenderer,
} from "./renderer";
import { Sprite, spriteUrl } from "./sprites";
import { createNoise2D } from "simplex-noise";
import type { PhysicsConfig } from "./physics";
import Game from "../components/Game.svelte";
import { initialGameState } from "./states/initial-state";
import { countdownGameState } from "./states/countdown-state";
import { activeGameState } from "./states/active-state";

// enum GameState {
//     Uninitialised,
//     Countdown,
//     Playing,
//     Over,
// }

type GlobalGameResources = {
    deltaTime: number;
    switchState: (newState: GameState) => void;
    pushState: (newState: GameState) => void;
    popState: () => void;
    renderer: FullScreenRenderer;
    isRunning: boolean;
    server: ServerBridge;
    // startRunning: () => boolean;
    endRunning: () => void;

    dinoImageHeight: number;
    unitLength: number;
    spriteScalingFactor: number;
    groundHeight: number;
};

type GameStateResources = any;

interface GameStateData {
    state: GameState;
    res: GameStateResources;
    onEnter: (res: GameStateResources, globalRes: GlobalGameResources) => void;
    preRender: (
        res: GameStateResources,
        globalRes: GlobalGameResources
    ) => void;
    postRender: (
        res: GameStateResources,
        globalRes: GlobalGameResources
    ) => void;
    onLeave: (res: GameStateResources, globalRes: GlobalGameResources) => void;
}

interface GameStateBuilderData {
    state: GameState;
    res?: Object;
    onEnter?: (res: GameStateResources, globalRes: GlobalGameResources) => void;
    preRender?: (
        res: GameStateResources,
        globalRes: GlobalGameResources
    ) => void;
    postRender?: (
        res: GameStateResources,
        globalRes: GlobalGameResources
    ) => void;
    onLeave?: (res: GameStateResources, globalRes: GlobalGameResources) => void;
}

class GameStateManager {
    res: GlobalGameResources;
    stateData: Map<GameState, GameStateData> = new Map();
    state: GameState = "Initial";
    stateResourceRef: GameStateData;
    stateStack: Array<GameState> = [];

    constructor(renderer: FullScreenRenderer, server: ServerBridge) {
        //<populate with a default inital state>----------------------------
        this.stateData.set("Initial", {
            state: "Initial",
            res: {},
            onEnter() {},
            preRender() {},
            postRender() {},
            onLeave() {},
        });
        this.stateResourceRef = this.stateData.get("Initial")!;
        this.stateStack.push("Initial");
        //</populate with a default inital state>----------------------------

        this.res = {
            deltaTime: 0,
            dinoImageHeight: 0, //these are global since they are shared by multiple states
            unitLength: 0,
            spriteScalingFactor: 0,
            groundHeight: 0,

            renderer,
            server,
            isRunning: false,

            endRunning: () => this.end(),
            pushState: (state) => this.pushState(state),
            popState: () => this.popState(),
            switchState: (state) => this.setState(state),
        };
    }

    setState(state: GameState): boolean {
        this.popState();
        return this.pushState(state);
    }

    buildState(data: GameStateBuilderData) {
        if (this.stateData.has(data.state)) {
            console.warn(`Overwriting state data: ${data.state}`);
        }

        const stateData: GameStateData = {
            state: data.state,
            res: data.res ?? {},
            onEnter: data.onEnter ?? function () {},
            preRender: data.preRender ?? function () {},
            postRender: data.postRender ?? function () {},
            onLeave: data.onLeave ?? function () {},
        };

        this.stateData.set(data.state, stateData);
    }

    pushState(state: GameState): boolean {
        if (!this.stateData.has(state)) {
            console.error(`No state data for ${state}`);
            return false;
        }

        this.stateStack.push(this.state);
        this.state = state;
        this.stateResourceRef = this.stateData.get(this.state)!;

        this.stateResourceRef.onEnter(this.stateResourceRef.res, this.res);

        return true;
    }

    popState(): GameState | undefined {
        if (this.stateStack.length <= 0) {
            console.error("No state to pop out of!");
            return;
        }

        this.stateResourceRef.onLeave(this.stateResourceRef.res, this.res);

        const prevState = this.stateStack.pop()!;
        this.state = prevState;
        this.stateResourceRef = this.stateData.get(this.state)!;

        return prevState;
    }

    start(initialState: GameState): boolean {
        this.res.isRunning = true;
        if (!this.setState(initialState)) return false;
        document.dispatchEvent(new Event("game-manager-start"));
        return true;
    }

    run(deltaTime: number) {
        this.res.deltaTime = deltaTime;
        if (!this.res.isRunning) return;

        this.stateResourceRef.preRender(this.stateResourceRef.res, this.res);
        this.res.renderer.render(deltaTime);
        this.stateResourceRef.postRender(this.stateResourceRef.res, this.res);
    }

    end() {
        this.res.isRunning = false;
        this.stateResourceRef.onLeave(this.stateResourceRef.res, this.res);
        document.dispatchEvent(new Event("game-manager-end"));
    }
}

async function main() {
    console.log("Hi :)");

    const serverAddr =
        window.localStorage.getItem("server-addr") || "ws://localhost:8080";
    // const sessionId = window.localStorage.getItem("session-id");
    // const userId = window.localStorage.getItem("user-id");
    // const username = window.localStorage.getItem("username");

    // if (!serverAddr || !sessionId || !userId || !username) {
    //     console.log("Credentials not found :(");
    //     return;
    // }

    const renderer = new FullScreenRenderer(
        document.getElementsByTagName("canvas")[0]
    );

    const server = new ServerBridge(serverAddr);
    // {
    //     let initSuccesfull = true;
    //     await server.initClient().catch(() => (initSuccesfull = false));
    //     if (!initSuccesfull) {
    //         console.error("Failed to initialise server-client bridge");
    //         alert("Something went wrong while establishing connection :(");
    //         return;
    //     }
    // }
    // if (!(await server.login(sessionId, userId, username))) {
    //     alert(`Login to ${sessionId} as ${userId} failed`);
    //     return;
    // }

    // console.log(`Succesfully logged in as '${username}'.`);

    const stateManager = new GameStateManager(renderer, server);
    stateManager.buildState(initialGameState);
    stateManager.buildState(countdownGameState);
    stateManager.buildState(activeGameState);

    let prevTimestamp = -1;
    let deltaTime = 0;
    function renderLoop(timestamp: number) {
        if (prevTimestamp == -1) prevTimestamp = timestamp; //to avoid accidentally passing in really large timestamps
        deltaTime = timestamp - prevTimestamp;

        prevTimestamp = timestamp;

        if (stateManager.res.isRunning) {
            requestAnimationFrame(renderLoop);
        } else {
            console.log(
                "stateManager.res.isRunning is set to false. Ending render loop..."
            );
            return;
        }
        stateManager.run(deltaTime);
    }

    document.addEventListener("game-manager-start", function () {
        console.log(
            "Received game-manager-start event. Starting render loop..."
        );
        requestAnimationFrame(renderLoop);
    });

    console.log("Starting game state manager...");
    stateManager.start("Initial");
}

const main_ = async () => {
    const serverAddr = window.localStorage.getItem("server-addr");
    const sessionId = window.localStorage.getItem("session-id");
    const userId = window.localStorage.getItem("user-id");
    const username = window.localStorage.getItem("username");

    if (!serverAddr || !sessionId || !userId || !username) return;

    //=================================================================
    const server = new ServerBridge("ws://127.0.0.1:8080");
    server.initClient();

    if (!(await server.login(sessionId, userId, username))) {
        alert(`Login to ${sessionId} as ${userId} failed`);
        return;
    }

    //=================================================================

    const dinoImg = new Image();
    dinoImg.src = spriteUrl.get("dinoRun1") as string;
    await (() => {
        return new Promise((resolve, _reject) => {
            dinoImg.onload = resolve;
        });
    })();

    const renderer = new Renderer(
        document.getElementsByTagName("canvas")[0],
        dinoImg.height,
        window.innerHeight * 0.13
    );

    //=================================================================

    const appendMap = (map: Array<[[number, number], Array<string>]>) => {
        for (const item of map) {
            let [x, y] = item[0];
            const obs = item[1] as Array<string>;
            for (const ob of obs) {
                const obName = (ob.charAt(0).toLowerCase() +
                    ob.substring(1)) as Sprite;

                const obWidth = renderer.getSpriteDimensions(obName).w;
                if (obName.startsWith("bird")) {
                    renderer.registerAnimatedSpriteAtPos(
                        [
                            ["bird1", { swapDelay: 150 }],
                            ["bird2", { swapDelay: 150 }],
                        ],
                        { x, y },
                        SpriteAlign.BottomLeft
                    );
                    x += renderer.xToRelUnit(obWidth);
                    break; //obstacle grouping doesnt exist for birds
                }

                renderer.drawSpriteAtPos(obName, { x, y }, true);
                x += renderer.xToRelUnit(obWidth);
            }
        }
    };

    server
        .onCountdownStart((duration) => {
            let currCount = duration;
            console.log(currCount);
            const int = setInterval(() => {
                currCount -= 1;
                console.log(currCount, server.gameData.stateTimer);
                if (currCount <= 0) clearInterval(int);
            }, 1000);
        })
        .then(server.requestMap)
        .then(appendMap);

    server.onGameStart(() => {}); //sets game state to active internally

    // server.requestGameLaunch();
    //=================================================================

    const noise2d = createNoise2D();

    const renderData: GameRenderData = {
        score: 0,
        xPos: 0,
        vel: 0,
    };
    const config = {
        initialSpeed: renderer.xFromRelUnit(8),
        acc: renderer.xFromRelUnit(0.3),
        jumpVel: renderer.xFromRelUnit(15),
        gravity: renderer.xFromRelUnit(-60),
    };

    const physics: PhysicsConfig = {
        initialXVel: 0,
        xAccel: 0.3,
        jumpYVel: 15,
        gravity: -60,
    };

    let speed = config.initialSpeed;
    let prevTimestamp = new Date().getTime();
    let dinoTextureSwap = 500;
    const dinoIdx = renderer.registerAnimatedSprite(
        [
            ["dinoRun1", { swapDelay: dinoTextureSwap }],
            ["dinoRun2", { swapDelay: dinoTextureSwap }],
        ],
        { x: 2, y: 0 },
        SpriteAlign.BottomLeft,
        true
    );
    let xoff = 0;
    let yoff = 0;
    const keys: Map<
        String,
        { state: boolean; onPress?: () => void; onRelease?: () => void }
    > = new Map();

    const textureSwap = {
        dinoRunTexture: () => {
            renderer.animatedSprites.get(dinoIdx)![0][0][0] = "dinoRun1";
            renderer.animatedSprites.get(dinoIdx)![0][1][0] = "dinoRun2";
        },

        dinoDuckTexture: () => {
            renderer.animatedSprites.get(dinoIdx)![0][0][0] = "dinoDuck1";
            renderer.animatedSprites.get(dinoIdx)![0][1][0] = "dinoDuck2";
        },

        dinoJumpTexture: () => {
            renderer.animatedSprites.get(dinoIdx)![0][0][0] = "dinoJump";
            renderer.animatedSprites.get(dinoIdx)![0][1][0] = "dinoJump";
        },
    };

    const dino = {
        yPos: renderer.animatedSprites.get(dinoIdx)![1].y,
        yVel: 0,
    };

    let queuedJump = false;
    const jump = () => {
        if (Math.abs(dino.yPos - renderer.groundPos) < 20) queuedJump = true;
        if (dino.yPos != renderer.groundPos && !renderer.boundingBox) return;
        textureSwap.dinoJumpTexture();
        dino.yVel = -config.jumpVel;
        queuedJump = false;

        server.broadcastGameEvt({
            type: "Jump",
            pos: renderer.xToRelUnit(renderData.xPos),
        });
    };

    keys.set("ArrowUp", {
        state: false,
        onPress: jump,
    });

    keys.set(" ", {
        state: false,
        onPress: jump,
    });

    window.addEventListener("click", jump);

    keys.set("ArrowDown", {
        state: false,
        onPress: () => {
            textureSwap.dinoDuckTexture();
            speed *= 1.3;
            server.broadcastGameEvt({
                type: "DuckStart",
                pos: renderer.xToRelUnit(renderData.xPos),
            });
        },
        onRelease: () => {
            textureSwap.dinoRunTexture();
            speed *= 1 / 1.3;
            server.broadcastGameEvt({
                type: "DuckEnd",
                pos: renderer.xToRelUnit(renderData.xPos),
            });
        },
    });

    keys.set("ArrowRight", {
        state: false,
        onPress: () => {
            speed *= 1.5;
        },
        onRelease: () => {
            speed *= 1 / 1.5;
        },
    });

    setInterval(() => {
        renderer.drawBackgroundSpriteAtPos(
            "cloud",
            {
                x: renderer.xToRelUnit(
                    renderData.xPos + 1000 + Math.random() * 5000
                ),
                y: 2.5 - Math.random() / 2,
            },
            Math.random() * 3
        );
    }, 100);

    setInterval(() => {
        server.broadcastUpdateEvt(renderer.xToRelUnit(renderData.xPos), 0.0);
    }, 30 * 1000);

    let offDir = Math.random() * 2 * Math.PI;

    const testCanvas = document.createElement("canvas");
    const reductionCanvas = document.createElement("canvas");

    const multiplayerRenderer = new MultiplayerRenderer();

    server.onRecvGameEvet(function (username, event) {
        multiplayerRenderer.onBrodcastRecv(
            renderer,
            username,
            event,
            renderData.xPos,
            physics,
            dinoTextureSwap
        );
    });
    const loop = () => {
        requestAnimationFrame(loop);
        if (server.gameData.state !== "Active") return;
        const currTimestamp = new Date().getTime();
        const dt = currTimestamp - prevTimestamp;

        if (dino.yVel != 0 || dino.yPos < renderer.groundPos) {
            dino.yPos += (dino.yVel * dt) / 1000;
            dino.yVel -= (config.gravity * dt) / 1000;
            if (
                renderer.animatedSprites.get(dinoIdx)![1].y <=
                    renderer.groundPos &&
                dino.yPos >= renderer.groundPos
            ) {
                dino.yPos = renderer.groundPos;
                dino.yVel = 0;
                textureSwap.dinoRunTexture();
                if (queuedJump) jump();
            }
        }
        // multiplayerRenderer.onBrodcastRecv(
        //         renderer,
        //         broadcast.username,
        //         { x: broadcast.posX, y: broadcast.posY },
        //         broadcast.tick,
        //         renderData.xPos,
        //         dinoTextureSwap
        //     );
        // }
        //
        //
        //

        renderer.animatedSprites.get(dinoIdx)![1].y = dino.yPos;

        offDir +=
            ((noise2d(xoff, 0) / 1000 - 1 / 2000) * speed) /
            (renderer.relUnitLen * 30);
        let offMag = (noise2d(0, yoff) * speed) / renderer.relUnitLen;

        renderer.offsetScreen(
            offMag * Math.cos(offDir),
            offMag * Math.sin(offDir) + (renderer.groundPos - dino.yPos) / 4
        );

        // renderer.animatedSprites[dinoIdx][1].x = mouseX;
        // renderer.animatedSprites[dinoIdx][1].y = mouseY;
        const {
            x: dinoX,
            y: dinoY,
            relY: _relY,
            gamePos: _gamePos,
        } = renderer.animatedSprites.get(dinoIdx)![1];
        const { w, h } = renderer.getSpriteDimensions(
            renderer.animatedSprites.get(dinoIdx)![0][
                renderer.animatedSprites.get(dinoIdx)![2].currIdx
            ][0]
        );
        renderer.loop(renderData, currTimestamp, dt, (sprite, obj2, _) => {
            //Collission detection
            if (sprite === "cloud" || sprite.startsWith("dino")) return;
            const obj1 = { x: dinoX, y: dinoY - h, w, h };
            const obj2f = {
                x: obj2.x + (speed * dt) / 1000,
                y: obj2.y,
                w: obj2.w,
                h: obj2.h,
            };
            const collission = checkCollission(obj1, obj2, obj2f);
            if (!collission) return;

            const img1 = renderer.getSprite(
                renderer.animatedSprites.get(dinoIdx)![0][
                    renderer.animatedSprites.get(dinoIdx)![2].currIdx
                ][0]
            );

            const img2 = renderer.getSprite(sprite);

            const collissionPerPixel = isPixelOverlap(
                testCanvas,
                reductionCanvas,
                img1,
                obj1.x,
                obj1.y,
                obj1.w,
                obj1.h,
                img2,
                obj2.x,
                obj2.y,
                obj2.w,
                obj2.h
            );
            if (collissionPerPixel) {
                // isRunning = false;
                // if (!renderer.boundingBox) return;
                renderer.ctx.fillStyle = "rgba(200, 150, 50, 0.5)";
                renderer.ctx.fillRect(obj2.x, obj2.y, obj2.w, obj2.h);
                renderer.ctx.fill();
                return;
            }
        });

        if (
            renderer.renderList.length < 5 &&
            !server.gameData.map.mapRequestSent
        ) {
            server.requestMap().then(appendMap);
        }

        renderData.xPos += (speed * dt) / 1000;
        renderData.vel = speed;
        dinoTextureSwap = ((350 / speed) * 1000) / dt;
        renderer.animatedSprites.get(dinoIdx)![0][0][1].swapDelay =
            dinoTextureSwap;
        renderer.animatedSprites.get(dinoIdx)![0][1][1].swapDelay =
            dinoTextureSwap;

        multiplayerRenderer.update(
            renderer,
            physics,
            dt,
            renderData.xPos,
            dinoTextureSwap
        );

        speed += (config.acc * dt) / 1000;

        xoff += Math.min(0.15, speed * Math.pow(10, -5.5));
        yoff += Math.min(0.15, speed * Math.pow(10, -5.5));

        prevTimestamp = currTimestamp;

        server.broadcastData(
            (renderer.groundPos - dinoY) / renderer.relUnitLen,
            renderData.xPos / renderer.relUnitLen
        );
    };

    requestAnimationFrame(loop);

    window.addEventListener("keydown", (evt) => {
        if (!keys.has(evt.key)) return;

        const pressFn = keys.get(evt.key)?.onPress || (() => {});
        if (!keys.get(evt.key)?.state) pressFn();

        keys.get(evt.key)!.state = true;
    });
    window.addEventListener("keyup", (evt) => {
        if (!keys.has(evt.key)) return;

        const releaseFn = keys.get(evt.key)?.onRelease || (() => {});
        releaseFn();
        (keys.get(evt.key) || { state: true }).state = false;
    });
};

type RectBox2D = { x: number; y: number; w: number; h: number };

/**
 * obj2 is assumed to be moving in the negative x direction
 * @param obj1
 * @param obj2i
 * @param obj2f
 * @returns
 */
function checkCollission(
    obj1: RectBox2D,
    obj2i: RectBox2D,
    obj2f: RectBox2D
): boolean {
    if (obj1.x + obj1.w < obj2i.x && obj1.x + obj1.w < obj2f.x) return false;
    if (obj1.x > obj2f.x + obj2f.w && obj1.x > obj2i.x + obj2i.w) return false;

    if (obj1.y > obj2f.y + obj2f.h && obj1.y > obj2i.y + obj2i.h) return false;
    if (obj1.y + obj2f.h < obj2f.y && obj1.y + obj1.h < obj2i.y) return false;

    return true;
}

// returns true if any pixels are overlapping
// https://stackoverflow.com/questions/40952985/how-to-perform-per-pixel-collision-test-for-transparent-images
// Have no idea how this works
function isPixelOverlap(
    pixCanvas: HTMLCanvasElement,
    pixCanvas1: HTMLCanvasElement,
    img1: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    img2: HTMLImageElement,
    x1: number,
    y1: number,
    w1: number,
    h1: number
) {
    // function to check if any pixels are visible
    function checkPixels(
        context: CanvasRenderingContext2D,
        w: number,
        h: number
    ) {
        const imageData = new Uint32Array(
            context.getImageData(0, 0, w, h).data.buffer
        );
        let i = 0;
        // if any pixel is not zero then there must be an overlap
        while (i < imageData.length) {
            if (imageData[i++] !== 0) {
                return true;
            }
        }
        return false;
    }

    // check if they overlap (redundant)
    if (x > x1 + w1 || x + w < x1 || y > y1 + h1 || y + h < y1) {
        return false; // no overlap
    }
    // size of overlapping area
    // find left edge
    const ax = x < x1 ? x1 : x;
    let aw = x + w < x1 + w1 ? x + w - ax : x1 + w1 - ax;
    // do the same for top and bottom
    const ay = y < y1 ? y1 : y;
    let ah = y + h < y1 + h1 ? y + h - ay : y1 + h1 - ay;

    // Create a canvas to do the masking on
    pixCanvas.width = aw;
    pixCanvas.height = ah;
    const ctx = pixCanvas.getContext("2d") as CanvasRenderingContext2D;

    // draw the first image relative to the overlap area
    ctx.drawImage(img1, x - ax, y - ay, w, h);

    // set the composite operation to destination-in
    ctx.globalCompositeOperation = "destination-in"; // this means only pixels
    // will remain if both images
    // are not transparent
    ctx.drawImage(img2, x1 - ax, y1 - ay, w1, h1);
    ctx.globalCompositeOperation = "source-over";

    // now draw over its self to amplify any pixels that have low alpha
    try {
        for (let i = 0; i < 32; i++) {
            ctx.drawImage(pixCanvas, 0, 0);
        }
    } catch (_) {
        return false;
    }
    // create a second canvas 1/8th the size but not smaller than 1 by 1
    if (!pixCanvas) pixCanvas = document.createElement("canvas");
    const ctx1 = pixCanvas1.getContext("2d") as CanvasRenderingContext2D;
    // reduced size rw, rh
    let rw = (pixCanvas1.width = Math.max(1, Math.floor(aw / 8)));
    let rh = (pixCanvas1.height = Math.max(1, Math.floor(ah / 8)));
    // repeat the following untill the canvas is just 64 pixels
    while (rw > 8 && rh > 8) {
        // draw the mask image several times
        for (let i = 0; i < 32; i++) {
            ctx1.drawImage(
                pixCanvas,
                0,
                0,
                aw,
                ah,
                Math.random(),
                Math.random(),
                rw,
                rh
            );
        }
        // clear original
        ctx.clearRect(0, 0, aw, ah);
        // set the new size
        aw = rw;
        ah = rh;
        // draw the small copy onto original
        ctx.drawImage(pixCanvas1, 0, 0);
        // clear reduction canvas
        ctx1.clearRect(0, 0, pixCanvas1.width, pixCanvas1.height);
        // get next size down
        rw = Math.max(1, Math.floor(rw / 8));
        rh = Math.max(1, Math.floor(rh / 8));
    }

    // check for overlap
    return checkPixels(ctx, aw, ah);
}
export { main };
export type {
    RectBox2D,
    GameStateBuilderData,
    GlobalGameResources,
    GameStateResources,
};
