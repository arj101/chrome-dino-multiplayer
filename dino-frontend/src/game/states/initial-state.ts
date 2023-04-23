import type { GameStateBuilderData, GlobalGameResources } from "../game";
import { GameState } from "../socket-client";

type StateResourceType = { offset: number; dir: number };

export const initialGameState: GameStateBuilderData = {
    state: GameState.Initial,

    res: { offset: 0, dir: 1 },

    onEnter: function (sres: StateResourceType, gres: GlobalGameResources) {
        console.log(`Entering ${this.state} state`);
        setTimeout(() => {
            gres.switchState(GameState.Countdown);
        }, 2000);
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

                ctx.fillStyle = "rgb(50, 100, 155)";
                ctx.fillRect(
                    30 + sres.offset / 3,
                    30 + sres.offset / 2,
                    50 + sres.offset,
                    50 + sres.offset
                );
                ctx.fill();

                ctx.font = "20px monospace";
                ctx.fillStyle = "white";
                ctx.fillText(
                    `${this.state} state. Offset: ${Math.round(sres.offset)}`,
                    60 + sres.offset / 3,
                    80 + sres.offset / 2
                );
                ctx.fill();
                ctx.closePath();

                sres.offset += sres.dir * gres.deltaTime * 0.1;
                if (sres.offset >= 100) sres.dir *= -1;
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
