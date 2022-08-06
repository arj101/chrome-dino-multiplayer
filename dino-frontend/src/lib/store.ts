import { browser } from "$app/env"
import { writable  } from "svelte/store"
import { SocketClient } from "./game/socket-client"

const ws = writable((() => { if (browser) return new SocketClient('ws://127.0.0.1:8080') })())
const userId = writable('')

export { ws, userId }