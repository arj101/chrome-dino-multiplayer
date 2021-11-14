import { writable } from 'svelte/store'
import { browser } from '$app/env'
import { WebSocket as Ws } from 'ws';

export const socket = writable((function(){
  if (browser) {
    return new WebSocket('ws://127.0.0.1:8080')
  } else {
    return new Ws('ws://127.0.0.1:8080')
  }
})());

