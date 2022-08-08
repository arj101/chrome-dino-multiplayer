class TextureMap {
    textures: Map<string, HTMLImageElement>;
    constructor() {
        this.textures = new Map();
    }

    loadTexture(name: string, url: string, w?: number, h?: number) {
        return new Promise((resolve, reject) => {
            if (this.textures.has(name)) resolve({});
            const img = new Image(w, h);
            img.src = url;
            this.textures.set(name, img);
            img.onload = () => {
                console.log(`Loaded texture '${name}'`);
                resolve({});
            };
            img.onerror = (e) => {
                console.warn(`Error loading texture: ${e}`);
                reject(e);
            };
        });
    }

    getTexture(name: string): HTMLImageElement | null {
        if (!this.textures.has(name)) return null;

        return this.textures.get(name) as HTMLImageElement;
    }

    getTexureDimensions(
        name: string,
        scalingFactor: number = 1
    ): { w: number; h: number } | null {
        if (!this.textures.has(name)) return null;
        const texture = this.getTexture(name) as HTMLImageElement;

        return {
            w: texture.width * scalingFactor,
            h: texture.height * scalingFactor,
        };
    }
}

export { TextureMap };
