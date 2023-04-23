import type { GameStateBuilderData, GlobalGameResources } from "../game";
import { GameState } from "../socket-client";

type StateResourceType = { offset: number; dir: number };

export const countdownGameState: GameStateBuilderData = {
    state: GameState.Countdown,

    res: { offset: 280, dir: -1 },

    onEnter: function (sres: StateResourceType, gres: GlobalGameResources) {
        console.log(`Entering ${this.state} state`);
        setTimeout(() => {
            gres.switchState(GameState.Initial);
        }, 1000);
        gres.renderer.pushRenderList();
        gres.renderer.addPrimitiveRenderer(
            "sick-background",
            -1,
            (spriteRes, ctx) => {
                ctx.clearRect(
                    0,
                    0,
                    gres.renderer.res.canvas.width,
                    gres.renderer.res.canvas.height
                );

                ctx.beginPath();
                ctx.fillStyle = "rgb(155,155, 0)";

                ctx.ellipse(
                    gres.renderer.res.canvas.width / 2,
                    gres.renderer.res.canvas.height / 2,
                    (50 + sres.offset) / 2,
                    (50 + sres.offset) / 2,
                    1,
                    0,
                    2 * Math.PI
                );

                ctx.fill();

                ctx.closePath();
                ctx.beginPath();

                ctx.font = "20px monospace";
                ctx.fillStyle = "white";
                ctx.fillText(
                    `${this.state} state. Offset: ${Math.round(sres.offset)}`,
                    gres.renderer.res.canvas.width / 2 + (30 + sres.offset) / 2,
                    gres.renderer.res.canvas.height / 2 +
                        (-30 + sres.offset) / 2
                );
                ctx.fill();
                ctx.closePath();

                sres.offset += sres.dir * gres.deltaTime * 0.1;
                if (sres.offset >= 300) sres.dir *= -1;
                if (sres.offset < 0) sres.dir *= -1;
                return true;
            }
        );
    },
    onLeave: function (sres: StateResourceType, gres: GlobalGameResources) {
        gres.renderer.popRenderList();
        console.log(`Leaving ${this.state} state`);
    },
};
