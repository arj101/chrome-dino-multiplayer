import type { GameStateBuilderData, GlobalGameResources } from "../game";
import type { GameState } from "../socket-client";
import { NoiseFunction2D, createNoise2D } from "simplex-noise";

type Vec2 = { x: number; y: number };

type Cloud = { pos: Vec2; size: number };

type StateResourceType = {
    isFinalCountdown: boolean;
    countdownVal: number;
    isRunning: boolean;
    countdownTextSize: number;
    lastSpriteSwitch: number;
    pos: Vec2;
    vel: Vec2;
    acc: Vec2;
    jumpVel: number;
    gravity: number;

    map: {
        obstacles: Array<[[number, number], Array<string>]>; //Array<[[x, y], [obstacles]]
    };

    clouds: Array<Cloud>;
    noise: NoiseFunction2D;
};

export const activeGameState: GameStateBuilderData = {
    state: "Active",

    res: {
        isFinalCountdown: false,
        countdownVal: 1,
        isRunning: false,
        countdownTextSize: 200,
        lastSpriteSwitch: 0,

        jumpVel: 500,
        gravity: -300,

        pos: {
            x: 0,
            y: 0,
        },

        vel: {
            x: 0,
            y: 0,
        },

        acc: {
            x: 0,
            y: 0,
        },

        clouds: [],
        noise: createNoise2D(),

        map: { obstacles: [] },
    },

    onEnter: function (sres: StateResourceType, gres: GlobalGameResources) {
        console.log(`Entering ${this.state} state`);

        sres.jumpVel = gres.unitLength * 15;
        sres.gravity = gres.unitLength * -60;

        sres.acc.x = gres.unitLength * 0.3;
        sres.vel.x = gres.unitLength * 8;
        window.addEventListener("recalc-responsive", function () {
            sres.jumpVel = gres.unitLength * 15;
            sres.gravity = gres.unitLength * -60;

            sres.acc.x = gres.unitLength * 0.3;
            // sres.vel.x = gres.unitLength * 8
        });

        function startCountdown(duration: number) {
            sres.isFinalCountdown = true;
            sres.countdownVal = duration;
            sres.countdownTextSize = 200;
            const countdownTimer = setInterval(function () {
                sres.countdownVal -= 1;
                sres.countdownTextSize = 200;
                if (sres.countdownVal <= 0) {
                    sres.countdownVal = 0;

                    clearInterval(countdownTimer);
                }
            }, 1000);
        }

        gres.server.onCountdownStart(function (duration) {
            gres.renderer.removeRenderObject("info-text", 5);

            startCountdown(duration - 1);
        });
        gres.server.onGameStart(function () {
            sres.isFinalCountdown = false;
            sres.isRunning = true;
            window.dispatchEvent(new Event("game-start"));
            sres.countdownVal = 0;
            setTimeout(
                () => gres.renderer.removeRenderObject("countdown-timer", 5),
                700
            );
        });

        gres.server.requestMap().then((map) => {
            console.log(map);
            sres.map.obstacles = sres.map.obstacles.concat(
                map as Array<[[number, number], Array<string>]>
            );
        });

        gres.renderer.addPrimitiveRenderer("obstacles", 1, function (_, ctx) {
            for (let i = sres.map.obstacles.length - 1; i >= 0; i--) {
                const obstacles = sres.map.obstacles[i];
                if (obstacles[0][0] === null) continue; //FIXME: figure out why its null (backend)
                let xOffset = 0;

                sprite_loop: for (const obstacleSprite of obstacles[1]) {
                    const spriteName =
                        obstacleSprite.charAt(0).toLowerCase() +
                        obstacleSprite.substring(1);

                    const spriteSize =
                        gres.renderer.res.textureMap.getTexureDimensions(
                            spriteName,
                            gres.spriteScalingFactor
                        );
                    if (spriteSize == null) continue sprite_loop;
                    const image =
                        gres.renderer.res.textureMap.getTexture(spriteName)!;

                    ctx.drawImage(
                        image,
                        obstacles[0][0] * gres.unitLength -
                            sres.pos.x +
                            xOffset,
                        gres.groundHeight -
                            spriteSize.h -
                            obstacles[0][1] * gres.unitLength,
                        spriteSize.w,
                        spriteSize.h
                    );
                    xOffset += spriteSize.w;
                }

                if (
                    obstacles[0][0] * gres.unitLength - sres.pos.x <=
                    -xOffset
                ) {
                    sres.map.obstacles.splice(i, 1);
                }
            }

            if (
                sres.map.obstacles.length <= 5 &&
                !gres.server.gameData.map.mapRequestSent
            ) {
                console.log("Requesting map...");
                gres.server
                    .requestMap()
                    .then(
                        (map) =>
                            (sres.map.obstacles = sres.map.obstacles.concat(
                                map as Array<[[number, number], Array<string>]>
                            ))
                    );
            }

            return false;
        });

        gres.renderer.removeRenderObject("bg", -1);

        gres.renderer.addPrimitiveRenderer("bg", -1, function (_, ctx) {
            ctx.restore();
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.save();
            ctx.translate(gres.dinoImageHeight * 1.5, gres.groundHeight);
            ctx.rotate(
                0.02 *
                    sres.noise(
                        (sres.pos.x / gres.unitLength) * 0.01,
                        (sres.pos.y / gres.unitLength) * 0.01 +
                            (sres.vel.y / gres.unitLength) * 0.0001
                    )
            );
            ctx.translate(
                -gres.dinoImageHeight * 1.5,
                -gres.groundHeight +
                    sres.pos.y * 0.25 +
                    gres.unitLength * 0.5 -
                    gres.unitLength *
                        sres.noise(
                            (sres.pos.x / gres.unitLength) * 0.01 + 0.1,
                            (sres.pos.y / gres.unitLength) * 0.01
                        )
            );
            return true;
        });

        gres.renderer.addPrimitiveRenderer("clouds", 2, function (_, ctx) {
            if (!sres.isRunning) return false;
            ctx.save();

            if (sres.clouds.length < 5) {
                const addCount = 5 + Math.random() * 5;
                for (let i = 0; i < addCount; i++) {
                    sres.clouds.push({
                        pos: {
                            x:
                                ctx.canvas.width +
                                Math.random() * ctx.canvas.width * 2,
                            y: 2.75 + Math.random() * 3,
                        },
                        size: 1 - 0.85 * Math.random(),
                    });
                }
            }

            for (let i = sres.clouds.length - 1; i >= 0; i--) {
                const cloud = sres.clouds[i];
                const textureSize =
                    gres.renderer.res.textureMap.getTexureDimensions(
                        "cloud",
                        cloud.size * gres.spriteScalingFactor * 1.5
                    )!;
                const texture =
                    gres.renderer.res.textureMap.getTexture("cloud")!;
                cloud.pos.x -=
                    sres.vel.x *
                    gres.deltaTime *
                    0.001 *
                    cloud.size *
                    cloud.size;
                if (cloud.pos.x < -textureSize.w) {
                    sres.clouds.splice(i, 1);
                    continue;
                }
                ctx.drawImage(
                    texture,
                    cloud.pos.x,
                    gres.groundHeight - cloud.pos.y * gres.unitLength,
                    textureSize.w,
                    textureSize.h
                );
            }

            ctx.restore();
            return false;
        });

        gres.renderer.addPrimitiveRenderer(
            "countdown-timer",
            5,
            function (_, ctx) {
                if (!sres.isFinalCountdown) return false;

                ctx.font = `${sres.countdownTextSize}px monospace`;
                ctx.fillStyle = "white";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(
                    sres.countdownVal.toString(),
                    ctx.canvas.width / 2,
                    ctx.canvas.height / 2
                );
                ctx.fill();

                sres.countdownTextSize -= gres.deltaTime * 0.1;

                return false;
            }
        );

        gres.renderer.addSprite(
            "dino",
            3,
            "dinoRun1",
            {
                x: gres.unitLength * 1.5,
                y:
                    gres.groundHeight -
                    gres.dinoImageHeight * gres.spriteScalingFactor,
            },
            "",
            gres.spriteScalingFactor
        );
        gres.renderer.addSprite(
            "ground1",
            0,
            "ground",
            {
                x: 0,
                y: gres.groundHeight - 10,
            },
            "ground",
            gres.spriteScalingFactor
        );
        gres.renderer.addSprite(
            "ground2",
            0,
            "ground",
            {
                x: 0,
                y: gres.groundHeight - 10,
            },
            "ground",
            gres.spriteScalingFactor
        );

        // window.addEventListener("recalc-responsive", function () {
        gres.renderer.withRenderObject("dino", 3, function (sprite) {
            sprite.preRender = function (sprite) {
                sprite.x = gres.unitLength * 1.5;
                sprite.y = gres.groundHeight - sprite.height - sres.pos.y;
                sprite.scalingFactor = gres.spriteScalingFactor;
                return true;
            };
        });

        gres.renderer.withRenderObject("ground1", 0, function (sprite) {
            sprite.preRender = function (sprite) {
                sprite.y = gres.groundHeight - sprite.height * 0.65;
                sprite.scalingFactor = gres.spriteScalingFactor;
                return true;
            };
        });
        gres.renderer.withRenderObject("ground2", 0, function (sprite) {
            sprite.res.x = sprite.res.width;
            sprite.preRender = function (sprite) {
                sprite.y = gres.groundHeight - sprite.height * 0.65;
                sprite.scalingFactor = gres.spriteScalingFactor;

                return true;
            };
        });

        window.addEventListener("keydown", function (event) {
            switch (event.key) {
                case "ArrowUp":
                case " ":
                    sres.vel.y = sres.jumpVel;

                    break;
            }
        });

        gres.renderer.addPrimitiveRenderer("score", 10, function (sprite, ctx) {
            ctx.font = "28px monospace";
            ctx.textAlign = "right";
            ctx.fillStyle = "white";
            ctx.fillText(
                `${Math.round(sres.pos.x / gres.unitLength)}`,
                ctx.canvas.width * 0.9,
                ctx.canvas.height * 0.2
            );
            ctx.fill();

            return false;
        });

        window.addEventListener("click", (event) => {
            event.stopPropagation();
            event.preventDefault();
            sres.vel.y = sres.jumpVel;
        });

        window.addEventListener("game-start", function () {
            gres.renderer.withRenderObject("dino", 3, function (sprite) {
                sprite.postRender = function (sprite) {
                    sres.lastSpriteSwitch += gres.deltaTime;
                    if (sres.lastSpriteSwitch > 150) {
                        sres.lastSpriteSwitch = 0;
                        if (sprite.sprite == "dinoRun1")
                            sprite.sprite = "dinoRun2";
                        else sprite.sprite = "dinoRun1";
                    }

                    sres.pos.y += sres.vel.y * gres.deltaTime * 0.001;
                    if (sres.pos.y > 0) {
                        sres.vel.y += sres.gravity * gres.deltaTime * 0.001;
                        sprite.sprite = "dinoJump";
                    } else if (sres.pos.y < 0) sres.pos.y = 0;
                };
            });

            gres.renderer.withRenderObject("ground1", 0, function (sprite) {
                sprite.preRender = function (sprite) {
                    sprite.y = gres.groundHeight - sprite.height * 0.65;
                    sprite.scalingFactor = gres.spriteScalingFactor;

                    sprite.x =
                        sprite.width -
                        (sres.pos.x % (sprite.width * sprite.scalingFactor));

                    return true;
                };
            });
            gres.renderer.withRenderObject("ground2", 0, function (sprite) {
                sprite.res.x = sprite.res.width;
                sprite.preRender = function (sprite) {
                    sprite.y = gres.groundHeight - sprite.height * 0.65;
                    sprite.scalingFactor = gres.spriteScalingFactor;

                    sprite.x = -(
                        sres.pos.x %
                        (sprite.width * sprite.scalingFactor)
                    );

                    return true;
                };
            });
        });
        // });

        gres.renderer.res.canvas.addEventListener("game-start", function () {});

        //on countdown begin:
        // gres.renderer.removeRenderObject("info-text", 5);
    },

    preRender: function (sres: StateResourceType, gres: GlobalGameResources) {
        if (!sres.isRunning) return;

        sres.vel.x += sres.acc.x * gres.deltaTime * 0.001;
        sres.pos.x += sres.vel.x * gres.deltaTime * 0.001;
    },

    onLeave: function (sres: StateResourceType, gres: GlobalGameResources) {
        console.log(`Leaving ${this.state} state`);
    },
};
