
type PhysicsConfig = {
    initialXVel: number,
    xAccel: number,

    jumpYVel: number,
    gravity: number,
}

function jumpHeightAtX(config: PhysicsConfig, startX: number, currX: number): number {
    const px = currX - startX;
    const ux = Math.sqrt(2.0 * config.xAccel * startX);

    const t = (-ux + (ux * ux + 2.0 * config.xAccel * px)) / config.xAccel;

    return config.jumpYVel * t + 0.5 * config.gravity * t * t;
}

function jumpDistance(config: PhysicsConfig, posX: number): number {
    const t = (-2.0 * config.jumpYVel) / config.gravity;
    const ux = Math.sqrt(2.0 * config.xAccel * posX);

    return ux * t + 0.5 * config.xAccel * t * t
}

export type { PhysicsConfig }
export { jumpHeightAtX, jumpDistance }

