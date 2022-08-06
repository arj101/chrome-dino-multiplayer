import { SocketClient } from "./socket-client";
import { GameRenderData, Renderer, SpriteAlign } from "./renderer";
import { navigateTo } from "./main";
import { CanvasUI } from "./canvas-ui";
import { Sprite } from "./sprites";
import { createNoise2D } from "simplex-noise";

const main = async () => {
    const wsclient = new SocketClient(
        "ws://127.0.0.1:8080",
        (_) => {
            console.log(`Socket connection opened at ${wsclient.socket.url}`);
        },
        (_) => {
            console.log("Socket connection closed.");
        }
    );

    wsclient.onOpen(() => {
        wsclient.send({
            type: "Query",
            query: {
                type: "Sessions",
            },
        });
        wsclient.send({
            type: "CreateSession",
            username: "jhsfhfsh",
            sessionName: "kfjfhjf",
        });
    });

    wsclient.onMessage((msg) => {
        console.log(`Recieved a message: `);
        console.log(msg);
    });

    const renderer = new Renderer(
        document.getElementsByTagName("canvas")[0],
        250
    );

    const noise2d = createNoise2D();

    const renderData: GameRenderData = {
        score: 0,
        xPos: 0,
        vel: 0,
    };
    const cactuses: Array<Sprite> = [
        "cactusBig1",
        "cactusBig2",
        "cactusBigPair",
        "cactusBigSmall",
        "cactusSmall1",
        "cactusSmall5",
    ];
    const config = {
        initialSpeed: renderer.xFromRelUnit(1),
        acc: renderer.xFromRelUnit(0.1),
        jumpVel: renderer.xFromRelUnit(7),
        gravity: renderer.xFromRelUnit(-30),
    };
    let speed = config.initialSpeed;
    let prevTimestamp = new Date().getTime();
    const dinoIdx = renderer.registerAnimatedSprite(
        [
            ["dinoRun1", { swapDelay: 500 }],
            ["dinoRun2", { swapDelay: 500 }],
        ],
        { x: 1, y: 0 },
        SpriteAlign.BottomLeft,
        true
    );
    let xoff = 0;
    let yoff = 0;
    const keys: Map<
        String,
        { state: boolean; onPress?: () => void; onRelease?: () => void }
    > = new Map();
    keys.set(" ", { state: false });

    const textureSwap = {
        dinoRunTexture: () => {
            renderer.animatedSprites[dinoIdx][0][0][0] = "dinoRun1";
            renderer.animatedSprites[dinoIdx][0][1][0] = "dinoRun2";
        },

        dinoDuckTexture: () => {
            renderer.animatedSprites[dinoIdx][0][0][0] = "dinoDuck1";
            renderer.animatedSprites[dinoIdx][0][1][0] = "dinoDuck2";
        },

        dinoJumpTexture: () => {
            renderer.animatedSprites[dinoIdx][0][0][0] = "dinoJump";
            renderer.animatedSprites[dinoIdx][0][1][0] = "dinoJump";
        },
    };

    const dino = {
        yPos: renderer.animatedSprites[dinoIdx][1].y,
        yVel: 0,
    };

    keys.set("ArrowUp", {
        state: false,
        onPress: () => {
            if (dino.yPos != renderer.groundPos) return;
            textureSwap.dinoJumpTexture();
            dino.yVel = -config.jumpVel;
        },
    });

    keys.set("ArrowDown", {
        state: false,
        onPress: () => {
            textureSwap.dinoDuckTexture();
            speed += 5 + Math.random() * 5;
        },
        onRelease: () => {
            textureSwap.dinoRunTexture();
            speed -= 10 - Math.random() * 5;
        },
    });

    setInterval(() => {
        if (Math.random() > 0.9) {
            renderer.drawSpriteAtPos(
                cactuses[Math.round(Math.random() * (cactuses.length - 1))],
                {
                    x: renderer.xToRelUnit(
                        renderData.xPos + 1000 + Math.random() * 10000
                    ),
                    y: 0,
                },
                true
            );
        }
        if (Math.random() > 0.96) {
            renderer.registerAnimatedSpriteAtPos(
                [
                    ["bird1", { swapDelay: 150 }],
                    ["bird2", { swapDelay: 150 }],
                ],
                {
                    x: renderer.xToRelUnit(
                        renderData.xPos + 1000 + Math.random() * 1000
                    ),
                    y: 0.18,
                },
                SpriteAlign.BottomLeft
            );
        }
        if (Math.random() > 0.85) {
            renderer.drawBackgroundSpriteAtPos(
                "cloud",
                {
                    x: renderer.xToRelUnit(
                        renderData.xPos + 1000 + Math.random() * 5000
                    ),
                    y: 1.5 - Math.random() / 2,
                },
                Math.random() * 3
            );
        }
    }, 100);

    const loop = () => {
        requestAnimationFrame(loop);
        const currTimestamp = new Date().getTime();
        const dt = currTimestamp - prevTimestamp;

        if (dino.yVel != 0 || dino.yPos < renderer.groundPos) {
            dino.yPos += (dino.yVel * dt) / 1000;
            dino.yVel -= (config.gravity * dt) / 1000;
            if (
                renderer.animatedSprites[dinoIdx][1].y <= renderer.groundPos &&
                dino.yPos >= renderer.groundPos
            ) {
                dino.yPos = renderer.groundPos;
                dino.yVel = 0;
                textureSwap.dinoRunTexture();
            }
        }

        renderer.animatedSprites[dinoIdx][1].y = dino.yPos;

        const offDir = noise2d(xoff, 0) * Math.PI * 2;
        let offMag =
            (renderer.canvas.height * 0.1 * noise2d(0, yoff) * speed) /
            4 /
            renderer.relUnitLen;
        if (Math.abs(offMag) > 140) offMag = Math.sign(offMag) * 140;

        renderer.offsetScreen(
            offMag * Math.cos(offDir),
            offMag * Math.sin(offDir) + (renderer.groundPos - dino.yPos) / 4
        );

        renderer.loop(renderData, currTimestamp, dt);

        renderData.xPos += (speed * dt) / 1000;
        renderData.vel = speed;
        const dinoTextureSwap = ((350 / speed) * 1000) / dt;
        renderer.animatedSprites[dinoIdx][0][0][1].swapDelay = dinoTextureSwap;
        renderer.animatedSprites[dinoIdx][0][1][1].swapDelay = dinoTextureSwap;
        speed += (config.acc * dt) / 1000;

        xoff += 0.001;
        yoff += ((speed / 1000 / renderer.relUnitLen) * dt) / 50;

        prevTimestamp = currTimestamp;
    };

    requestAnimationFrame(loop);

    window.addEventListener("keydown", (evt) => {
        if (!keys.has(evt.key)) return;

        const pressFn = keys.get(evt.key)?.onPress || (() => {});
        if (!keys.get(evt.key)?.state) pressFn();

        keys.get(evt.key).state = true;
    });
    window.addEventListener("keyup", (evt) => {
        if (!keys.has(evt.key)) return;

        const releaseFn = keys.get(evt.key)?.onRelease || (() => {});
        releaseFn();
        keys.get(evt.key).state = false;
    });
};

export { main };
