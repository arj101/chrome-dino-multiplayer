class TextureMap {
    textures: Map<string, HTMLImageElement>;
    constructor() {
        this.textures = new Map();
    }

    loadTexture(name: string, url: string, w?: number, h?: number) {
        const img = new Image(w, h);
        img.src = url;
        img.onload = () => {
            console.log(`Loaded texture '${name}'`);
        };
        img.onerror = (e) => {
            console.warn(`Error loading texture: ${e}`);
        };
        this.textures.set(name, img);
    }

    getTexture(name: string): HTMLImageElement | null {
        if (!this.textures.has(name)) return null;

        return this.textures.get(name) as HTMLImageElement;
    }
}

export { TextureMap };
