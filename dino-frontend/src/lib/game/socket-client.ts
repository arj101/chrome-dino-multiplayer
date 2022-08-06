import { serialize, deserialize } from './ws-de-serialize'
import type { TxData, RxData } from './ws-de-serialize'

class SocketClient {
	socket: WebSocket;
	socketOpen: boolean;

	onMessageCaller?: (msg: RxData) => void;
	onOpenCaller?: (event: Event) => void;
	onCloseCaller?: (event: Event) => void;

	nextMessageCallers: Array<(msg: RxData) => void>;
	onOpenCallers: Array<() => void>

	constructor(socketAddr: string, onOpen?: (event: Event) => void, onClose?: (event: Event) => void) {
		this.socket = new WebSocket(socketAddr);
		this.onOpenCaller = onOpen;
		this.onCloseCaller = onClose;
		this.socketOpen = false;
		this.onOpenCallers = [];
		this.nextMessageCallers = [];

		this.socket.onopen = (event) => {
			console.log(`Succesfully opened connection to ${this.socket.url}`);
			this.socketOpen = true;
			if (typeof this.onOpenCaller !== 'undefined') this.onOpenCaller(event);
			for (const f of this.onOpenCallers) {
				f()
			}
			this.onOpenCallers = []
		};

		this.socket.onmessage = (msg) => {
			let msgDeserialized = deserialize(msg.data);
			if (typeof this.onMessageCaller !== 'undefined') this.onMessageCaller(msgDeserialized);
			for (const caller of this.nextMessageCallers) {
				caller(msgDeserialized)
			}
			this.nextMessageCallers = []
		};

		this.socket.onclose = (event) => {
			console.log(`${this.socket.url} just closed connection`);
			this.socketOpen = false;
			if (typeof this.onCloseCaller !== 'undefined') this.onCloseCaller(event);
		};

		this.socket.onerror = (err) => {
			console.error(`Socket error: ${err}`);
		};
	}

	onOpen(f: () => void) {
		if (this.socketOpen) {
			f()
		} else {
			this.onOpenCallers.push(f)
		}
	}

	onMessage(f: (msg: RxData) => void) {
		this.onMessageCaller = f;
	}

	onClose(f: (event: Event) => void) {
		this.onCloseCaller = f;
	}

	onNextMsg(f: (msg: RxData) => void) {
		this.nextMessageCallers.push(f)
	}

	send(msg: TxData): boolean {
		try { if (this.socketOpen) this.socket.send(serialize(msg)) } catch (e) {}
		return this.socketOpen
	}
}

export { SocketClient };
