import type { GameStateBuilderData, GlobalGameResources } from "../game";
import type { GameState } from "../socket-client";
import { spriteUrl } from "../sprites";

type ProgressIndicatorStatus = "active" | "finished" | "failed";

type StateResourceType = {
    infoText: string;
    progressIndicatorSpeed: number;
    progressIndicatorAngle: number;
    progressIndicatorSize: number;
    progressIndicatorStatus: ProgressIndicatorStatus;
    desiredProgressIndicatorSize: number;
};

export const initialGameState: GameStateBuilderData = {
    state: "Initial",

    res: {
        infoText: "",
        progressIndicatorSpeed: 1,
        progressIndicatorAngle: 0,
        progressIndicatorSize: 0,
        progressIndicatorStatus: "active",
        desiredProgressIndicatorSize: 0,
    },

    onEnter: function (sres: StateResourceType, gres: GlobalGameResources) {
        //executed when enterin the state, ie just once when the game starts
        console.log(`Entering ${this.state} state`);

        gres.renderer.pushRenderList();

        sres.desiredProgressIndicatorSize = window.innerWidth / 4;
        sres.progressIndicatorSize = window.innerWidth / 4;

        gres.renderer.addPrimitiveRenderer("bg", -1, function (_, ctx) {
            //executed every frame (draws background)
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            return true;
        });

        sres.infoText = "Establishing connection...";
        gres.renderer.addPrimitiveRenderer("info-text", 5, function (_, ctx) {
            //executed every frame (draws the text)

            ctx.fillStyle = "white";
            ctx.font = "20px monospace";
            const textSize = ctx.measureText(sres.infoText);

            ctx.save();
            ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
            ctx.rotate(sres.progressIndicatorAngle);

            ctx.fill();

            switch (sres.progressIndicatorStatus) {
                case "active":
                    ctx.fillStyle = "rgba(50, 100, 155, 0.10)";
                    break;
                case "failed":
                    ctx.fillStyle = "rgba(155, 100, 50, 0.10)";
                    sres.progressIndicatorSpeed = 0;

                    break;
                case "finished":
                    ctx.fillStyle = "rgba(50, 155, 100, 0.10)";
                    break;
            }
            sres.desiredProgressIndicatorSize = textSize.width * 1.5;

            const boxSize =
                sres.progressIndicatorSize * 1.2 +
                sres.progressIndicatorSize *
                    0.4 *
                    Math.sin(sres.progressIndicatorAngle * 2);
            ctx.fillRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize);

            const animationFactor = gres.deltaTime * 0.8;
            const sizeDiff =
                sres.desiredProgressIndicatorSize - sres.progressIndicatorSize;
            if (Math.abs(sizeDiff) > animationFactor) {
                if (sizeDiff > 0) sres.progressIndicatorSize += animationFactor;
                else sres.progressIndicatorSize -= animationFactor;
            }

            sres.progressIndicatorAngle +=
                gres.deltaTime * 0.001 * sres.progressIndicatorSpeed;
            ctx.fill();
            ctx.restore();

            ctx.beginPath();

            ctx.textAlign = "center";
            ctx.textBaseline = "ideographic";
            ctx.fillText(
                sres.infoText,
                ctx.canvas.width / 2,
                ctx.canvas.height / 2
            ); //the displayed text changes when the code below changes `infoText`
            ctx.closePath();
            return true;
        });

        sres.infoText = "Checking credentials..."; //the rendered text also gets updated!

        const serverAddr = window.localStorage.getItem("server-addr");
        const sessionId = window.localStorage.getItem("session-id");
        const userId = window.localStorage.getItem("user-id");
        const username = window.localStorage.getItem("username");

        if (!serverAddr || !sessionId || !userId || !username) {
            sres.infoText = "Credentials not found :(";
            sres.progressIndicatorStatus = "failed";
            return;
        }
        let afterConnectingRan = false;
        const afterConnecting = async function () {
            if (afterConnectingRan) return;
            //executed once

            const loginPromise = gres.server.login(sessionId, userId, username);
            sres.infoText = "Logging in...";

            //======setup global state==========
            gres.unitLength = gres.renderer.res.canvas.height * 0.13;
            gres.groundHeight = gres.renderer.res.canvas.height * 0.6;

            const texturePromise = gres.renderer.res.textureMap.loadTexture(
                "dinoRun1",
                spriteUrl.get("dinoRun1")!
            );

            window.addEventListener("resize", function (event) {
                event.preventDefault();
                event.stopPropagation();
                gres.unitLength = gres.renderer.res.canvas.height * 0.13;
                gres.groundHeight = gres.renderer.res.canvas.height * 0.6;

                gres.dinoImageHeight =
                    gres.renderer.res.textureMap.getTexureDimensions(
                        "dinoRun1"
                    )!.h;
                gres.spriteScalingFactor =
                    gres.unitLength / gres.dinoImageHeight;
                window.dispatchEvent(new Event("recalc-responsive"));
            });

            let loginSucceeded = true;
            await loginPromise.catch(() => {
                loginSucceeded = false;
                sres.infoText = "Login failed :(";
                sres.progressIndicatorStatus = "failed";
            });
            if (!loginSucceeded) return;

            sres.infoText = "Loading a dino for scale..";
            await texturePromise;
            gres.dinoImageHeight =
                gres.renderer.res.textureMap.getTexureDimensions("dinoRun1")!.h;
            gres.spriteScalingFactor = gres.unitLength / gres.dinoImageHeight;

            sres.infoText = "Waiting for countdown...";
            sres.progressIndicatorStatus = "finished";

            //==================================

            if (loginSucceeded) gres.switchState("Countdown");
        };
        sres.infoText = "Establishing connection...";

        gres.server.initClient().then(afterConnecting);
    },
    onLeave: function (sres: StateResourceType, gres: GlobalGameResources) {
        // gres.renderer.popRenderList();
        console.log(`Leaving ${this.state} state`);
    },
};
