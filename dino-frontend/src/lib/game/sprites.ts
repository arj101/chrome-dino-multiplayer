import bird1  from '/sprites/bird-1.png'
import bird2 from '/sprites/bird-2.png'
import cactusbig1 from '/sprites/cactus-big-1.png'
import cactusbig2 from '/sprites/cactus-big-2.png'
import cactusbigpair from '/sprites/cactus-big-pair.png'
import cactusbigsmall from '/sprites/cactus-big-small.png'
import cactussmall1 from '/sprites/cactus-small-1.png'
import cactussmall2 from '/sprites/cactus-small-2.png'
import cactussmall3 from '/sprites/cactus-small-3.png'
import cactussmall4 from '/sprites/cactus-small-4.png'
import cactussmall5 from '/sprites/cactus-small-5.png'
import cactussmall6 from '/sprites/cactus-small-6.png'
import cloud from '/sprites/cloud.png'
import dinoduck1 from '/sprites/dino-duck-1.png'
import dinoduck2 from '/sprites/dino-duck-2.png'
import dinogameover1 from '/sprites/dino-game-over-1.png'
import dinogameover2 from '/sprites/dino-game-over-2.png'
import dinojump from '/sprites/dino-jump.png'
import dinorun1 from '/sprites/dino-run-1.png'
import dinorun2 from '/sprites/dino-run-2.png'
import ground from '/sprites/ground.png'

const spriteUrl = {
    bird1: bird1,
    bird2: bird2,
    cactusBig1: cactusbig1,
    cactusBig2: cactusbig2,
    cactusBigPair: cactusbigpair,
    cactusBigSmall: cactusbigsmall,
    cactusSmall1: cactussmall1,
    cactusSmall2: cactussmall2,
    cactusSmall3: cactussmall3,
    cactusSmall4: cactussmall4,
    cactusSmall5: cactussmall5,
    cactusSmall6: cactussmall6,
    cloud: cloud,
    dinoDuck1: dinoduck1,
    dinoDuck2: dinoduck2,
    dinoGameOver1: dinogameover1,
    dinoGameOver2: dinogameover2,
    dinoJump: dinojump,
    dinoRun1: dinorun1,
    dinoRun2: dinorun2,
    ground: ground,
}


type Sprite = 
    | 'Bird1'
    | 'Bird2'
    | 'CactusBig1'
    | 'CactusBig2'
    | 'CactusBigPair'
    | 'CactusBigSmall'
    | 'CactusSmall1'
    | 'CactusSmall2'
    | 'CactusSmall3'
    | 'CactusSmall4'
    | 'CactusSmall5'
    | 'CactusSmall6'
    | 'Cloud'
    | 'DinoDuck1'
    | 'DinoDuck2'
    | 'DinoGameOver1'
    | 'DinoGameOver2'
    | 'DinoJump'
    | 'DinoRun1'
    | 'DinoRun2'
    | 'Ground'

export type { Sprite }
export { spriteUrl }