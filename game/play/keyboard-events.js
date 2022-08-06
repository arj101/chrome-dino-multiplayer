class KeyboardEventWrapper {
    constructor() {
        this.keys = {}
        this.keyDownCaller = () => {}
        this.keyUpCaller = () => {}
                
        document.addEventListener('keydown', event => {
            if (this.keys[event.code] === true) return
            this.keys[event.code] = true
            this.keyDownCaller(event)
        })

        document.addEventListener('keyup', event => {
            this.keys[event.code] = false
            this.keyUpCaller(event)
        })
    }

    /**
     * 
     * @param {(event: KeyboardEvent) => void} f 
     */
    onKeyDown(f) {
        this.keyDownCaller = f
    }

    /**
     * 
     * @param {(event: KeyboardEvent) => void} f 
     */
    onKeyUp(f) {
        this.keyUpCaller = f
    }
}
