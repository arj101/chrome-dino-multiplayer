import bird1 from "/sprites/bird-1.png?url";
import bird2 from "/sprites/bird-2.png?url";
import cactusbig1 from "/sprites/cactus-big-1.png?url";
import cactusbig2 from "/sprites/cactus-big-2.png?url";
import cactusbigpair from "/sprites/cactus-big-pair.png?url";
import cactusbigsmall from "/sprites/cactus-big-small.png?url";
import cactussmall1 from "/sprites/cactus-small-1.png?url";
import cactussmall2 from "/sprites/cactus-small-2.png?url";
import cactussmall3 from "/sprites/cactus-small-3.png?url";
import cactussmall4 from "/sprites/cactus-small-4.png?url";
import cactussmall5 from "/sprites/cactus-small-5.png?url";
import cactussmall6 from "/sprites/cactus-small-6.png?url";
import cloud from "/sprites/cloud.png?url";
import dinoduck1 from "/sprites/dino-duck-1.png?url";
import dinoduck2 from "/sprites/dino-duck-2.png?url";
import dinogameover1 from "/sprites/dino-game-over-1.png?url";
import dinogameover2 from "/sprites/dino-game-over-2.png?url";
import dinojump from "/sprites/dino-jump.png?url";
import dinorun1 from "/sprites/dino-run-1.png?url";
import dinorun2 from "/sprites/dino-run-2.png?url";
import ground from "/sprites/ground.png?url";

const spriteUrl: Map<string, string> = new Map();
spriteUrl.set("bird1", bird1), spriteUrl.set("bird2", bird2);
spriteUrl.set("cactusBig1", cactusbig1);
spriteUrl.set("cactusBig2", cactusbig2);
spriteUrl.set("cactusBigPair", cactusbigpair);
spriteUrl.set("cactusBigSmall", cactusbigsmall);
spriteUrl.set("cactusSmall1", cactussmall1);
spriteUrl.set("cactusSmall2", cactussmall2);
spriteUrl.set("cactusSmall3", cactussmall3);
spriteUrl.set("cactusSmall4", cactussmall4);
spriteUrl.set("cactusSmall5", cactussmall5);
spriteUrl.set("cactusSmall6", cactussmall6);
spriteUrl.set("cloud", cloud);
spriteUrl.set("dinoDuck1", dinoduck1);
spriteUrl.set("dinoDuck2", dinoduck2);
spriteUrl.set("dinoGameOver1", dinogameover1);
spriteUrl.set("dinoGameOver2", dinogameover2);
spriteUrl.set("dinoJump", dinojump);
spriteUrl.set("dinoRun1", dinorun1);
spriteUrl.set("dinoRun2", dinorun2);
spriteUrl.set("ground", ground);

type Sprite =
    | "bird1"
    | "bird2"
    | "cactusBig1"
    | "cactusBig2"
    | "cactusBigPair"
    | "cactusBigSmall"
    | "cactusSmall1"
    | "cactusSmall2"
    | "cactusSmall3"
    | "cactusSmall4"
    | "cactusSmall5"
    | "cactusSmall6"
    | "cloud"
    | "dinoDuck1"
    | "dinoDuck2"
    | "dinoGameOver1"
    | "dinoGameOver2"
    | "dinoJump"
    | "dinoRun1"
    | "dinoRun2"
    | "ground";

export type { Sprite };
export { spriteUrl };
