class KeyboardEventWrapper {
    keys: any //bruh
    keyDownCaller: (event: KeyboardEvent) => void
    keyUpCaller: (event: KeyboardEvent) => void
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

    onKeyDown(f: (event: KeyboardEvent) => void) {
        this.keyDownCaller = f
    }

    onKeyUp(f: (event: KeyboardEvent) => void) {
        this.keyUpCaller = f
    }
}

export { KeyboardEventWrapper }