import bird1 from "/sprites/bird-1.png";
import bird2 from "/sprites/bird-2.png";
import cactusbig1 from "/sprites/cactus-big-1.png";
import cactusbig2 from "/sprites/cactus-big-2.png";
import cactusbigpair from "/sprites/cactus-big-pair.png";
import cactusbigsmall from "/sprites/cactus-big-small.png";
import cactussmall1 from "/sprites/cactus-small-1.png";
import cactussmall2 from "/sprites/cactus-small-2.png";
import cactussmall3 from "/sprites/cactus-small-3.png";
import cactussmall4 from "/sprites/cactus-small-4.png";
import cactussmall5 from "/sprites/cactus-small-5.png";
import cactussmall6 from "/sprites/cactus-small-6.png";
import cloud from "/sprites/cloud.png";
import dinoduck1 from "/sprites/dino-duck-1.png";
import dinoduck2 from "/sprites/dino-duck-2.png";
import dinogameover1 from "/sprites/dino-game-over-1.png";
import dinogameover2 from "/sprites/dino-game-over-2.png";
import dinojump from "/sprites/dino-jump.png";
import dinorun1 from "/sprites/dino-run-1.png";
import dinorun2 from "/sprites/dino-run-2.png";
import ground from "/sprites/ground.png";

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
