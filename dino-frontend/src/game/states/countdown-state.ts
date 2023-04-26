import type { GameStateBuilderData, GlobalGameResources } from "../game";
import { GameState } from "../socket-client";

type StateResourceType = { offset: number; dir: number };

export const countdownGameState: GameStateBuilderData = {
    state: GameState.Countdown,

    res: { offset: 280, dir: -1 },

    onEnter: function (sres: StateResourceType, gres: GlobalGameResources) {
        console.log(`Entering ${this.state} state`);

        //on countdown begin:
        console.log("Forwarding to active state")
        gres.switchState(GameState.Active)
        // gres.renderer.removeRenderObject("info-text", 5);
    },
    onLeave: function (sres: StateResourceType, gres: GlobalGameResources) {
        console.log(`Leaving ${this.state} state`);
    },
};
