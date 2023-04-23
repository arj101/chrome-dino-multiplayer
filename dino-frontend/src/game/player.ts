import type { GameEvent } from "./ws-de-serialize"
import type { PhysicsConfig } from "./physics";
import { jumpHeightAtX, jumpDistance } from "./physics"; 

class Player {
    id: string;
    pos: number;
    vel: number;

    lastJumpPos: number;
    
    isDucking: boolean;
    lastDuckStartPos: number;
    lastDuckEndPos: number;

    lastStatUpdateTime: number;

    constructor(id: string, physics: PhysicsConfig) {
        this.id = id;
        this.pos = 0.0;
        this.vel = physics.initialXVel;
        this.lastJumpPos = -Infinity;
        this.isDucking = false;
        this.lastDuckEndPos = 0.0;
        this.lastDuckStartPos = 0.0;
        this.lastStatUpdateTime = new Date().getTime();

        console.log(this)
    }


    readEvent(event: GameEvent) {
        if (event.type == 'Jump' && this.lastJumpPos <= event.pos) {
            this.lastJumpPos = event.pos;
        } else if (event.type == 'DuckStart' && this.lastDuckEndPos <= event.pos && !this.isDucking) {
            this.lastDuckStartPos = event.pos;
            this.isDucking = true;
        } else if (event.type == 'DuckEnd' && this.isDucking && this.lastDuckStartPos <= event.pos) {
            this.lastDuckEndPos = event.pos;
            this.isDucking = false;
        } else if (event.type == 'StatusUpdate') {
            this.pos = event.pos;
            this.lastStatUpdateTime = new Date().getTime();
        }
    }


    isJumping(physics: PhysicsConfig): boolean {
        return this.pos < this.lastJumpPos + jumpDistance(physics, this.lastJumpPos)
    }

    calcJumpY(physics: PhysicsConfig): number {
        return Math.max(0.0, jumpHeightAtX(physics, this.lastJumpPos, this.pos));
    }

    currentXPos(): number {
        return this.pos; 
    }

    currentYPos(physics: PhysicsConfig): number {
        if (!this.isJumping(physics)) {
            return 0.0;
        } else {
            return this.calcJumpY(physics);
        }
    }

    update(physics: PhysicsConfig, dt: number) {
        this.vel += physics.xAccel * dt / 1000.0;
        this.pos += this.vel * dt / 1000.0;
    }
}

export default Player; 
