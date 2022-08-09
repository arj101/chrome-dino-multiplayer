import { serialize, deserialize } from "./ws-de-serialize";
import type { TxData, RxData } from "./ws-de-serialize";

class SocketClient {
    socket: WebSocket;
    socketOpen: boolean;

    onMessageCallers: Array<(msg: RxData) => void>;
    onOpenCaller?: (event: Event) => void;
    onCloseCaller?: (event: Event) => void;

    nextMessageCallers: Array<(msg: RxData) => void>;
    onOpenCallers: Array<() => void>;

    constructor(
        socketAddr: string,
        onOpen?: (event: Event) => void,
        onClose?: (event: Event) => void
    ) {
        this.socket = new WebSocket(socketAddr);
        this.onOpenCaller = onOpen;
        this.onCloseCaller = onClose;
        this.socketOpen = false;
        this.onOpenCallers = [];
        this.nextMessageCallers = [];
        this.onMessageCallers = []

        this.socket.onopen = (event) => {
            console.log(`Succesfully opened connection to ${this.socket.url}`);
            this.socketOpen = true;
            if (typeof this.onOpenCaller !== "undefined")
                this.onOpenCaller(event);
            for (const f of this.onOpenCallers) {
                f();
            }
            this.onOpenCallers = [];
        };

        this.socket.onmessage = (msg) => {
            let msgDeserialized = deserialize(msg.data);
            for (const caller of this.onMessageCallers) {
                caller(msgDeserialized)
            }
            for (const caller of this.nextMessageCallers) {
                caller(msgDeserialized);
            }
            this.nextMessageCallers = [];
        };

        this.socket.onclose = (event) => {
            console.log(`${this.socket.url} just closed connection`);
            this.socketOpen = false;
            if (typeof this.onCloseCaller !== "undefined")
                this.onCloseCaller(event);
        };

        this.socket.onerror = (err) => {
            console.error(`Socket error: ${err}`);
        };
    }

    onOpen(f: () => void) {
        if (this.socketOpen) {
            f();
        } else {
            this.onOpenCallers.push(f);
        }
    }

    onMessage(f: (msg: RxData) => void): number {
        this.onMessageCallers.push(f);
        return this.onMessageCallers.length - 1
    }
    
    deleteMsgCaller(idx: number) {
        this.onMessageCallers.splice(idx, 1)
    }

    onClose(f: (event: Event) => void) {
        this.onCloseCaller = f;
    }

    onNextMsg(f: (msg: RxData) => void) {
        this.nextMessageCallers.push(f);
    }

    send(msg: TxData): boolean {
        try {
            if (this.socketOpen) this.socket.send(serialize(msg));
        } catch (e) {}
        return this.socketOpen;
    }
}

interface MapData {
    mapIdx: number,
    mapRequestSent: boolean,
}

interface PhysicsConfig {
    initalSpeed: number,
    xAcceleration: number,
    
    gravity: number,
    jumpSpeed: number,
}

enum GameState {
    Uninit,
    Waiting,
    Countdown,
    Active,
    Ended,
}

interface GameData {
    map: MapData,    
    physics: PhysicsConfig,
    
    startTime?: Date,
    countdownDuration?: number,
    
    state: GameState,
    
    userId?: string,
    sessionId?: string,
    
    userName?: string,
    sessionName?: string,
}

//Abstracts over SocketClient
class ServerBridge {
    
    socketClient: SocketClient | null;
    serverAddr: string;
    socketOpenCallers: Array<(event: Event) => void>
    
    gameData: GameData
    
    constructor(serverAddr: string) {        
        this.socketClient = null
        this.serverAddr = serverAddr
        this.socketOpenCallers = []
        this.gameData = {
            map: {
                mapIdx: 0,
                mapRequestSent: false,                
            },
            physics: {
                initalSpeed: 0,
                xAcceleration: 0,
                
                gravity: 0,
                jumpSpeed: 0,
            },
            state: GameState.Uninit,
        }
    }
    
    getSessionList(): Promise<Array<[string, string, string, Array<string>]>> {
        const getSessionList = (onRcv: (data: Array<[string, string, string, Array<string>]>) => void) => {
            this.socketClient?.send({
                type: 'Query',
                query: { type: 'Sessions' }
            })
            
            const callerIdx = this.socketClient?.onMessage(msg => {
                if (msg.type === 'QueryResponse' && msg.queryRes.type === 'Sessions') {
                    onRcv(msg.queryRes.sessions)           
                    this.socketClient?.deleteMsgCaller(callerIdx as number)
                }
            })
        }
        return new Promise((resolve, _reject) => {
            this.callOnOpenSocket(() => getSessionList(resolve))
        })
    }
    
    callOnOpenSocket(fn: () => void) {
        if (this.socketClient?.socketOpen) fn()
        else {
            this.socketClient?.onOpen(fn)
        }
    }
    
    createSession(sessionName: string, username: string): Promise<void> {
        const createSession = (onSuccess: (sessionName: string, username: string, sessionId: string, userId: string) => void, onUnable: () => void = () => {}) => {
            this.socketClient?.send({
                type: 'CreateSession',
                sessionName,
                username,
            })
            
            const callerIdx = this.socketClient?.onMessage(msg => {
                if (msg.type !== 'UserCreationResponse' && msg.type !== 'SessionCreationResponse') return;
                if (!msg.creationSucceeded) {
                    this.socketClient?.deleteMsgCaller(callerIdx as number)
                    onUnable()
                    return
                }
                if (msg.type === 'SessionCreationResponse') {
                    this.gameData.sessionId = msg.sessionId as string
                }
                if (msg.type === 'UserCreationResponse') {
                    this.gameData.userId = msg.userId as string
                }
                
                if (this.gameData.sessionId && this.gameData.userId){
                    this.socketClient?.deleteMsgCaller(callerIdx as number)
                    onSuccess(sessionName, username, this.gameData.sessionId, this.gameData.userId)
                }
            })
        }
        return new Promise((resolve, reject) => {
            createSession(() => resolve(), reject)
        })
    }
    
    joinSession(sessionId: string, username: string): Promise<void> {
        const joinSession = (onJoin: (username: string, userId: string, sessionId: string) => void, onUnable: () => void = () => {}) => {
            this.socketClient?.send({
                type: 'CreateUser',
                sessionId,
                username,
            })
             const callerIdx = this.socketClient?.onMessage(msg => {
                if (msg.type !== 'UserCreationResponse') return
                this.socketClient?.deleteMsgCaller(callerIdx as number)
                if (msg.creationSucceeded === true) onJoin(username, msg.userId as string, sessionId)
                else onUnable()
            })
        }
        return new Promise((resolve, reject) => {
            this.callOnOpenSocket(() => {
                joinSession((username, userId, sessionId) => {
                    this.gameData.userName = username
                    this.gameData.userId = userId
                    this.gameData.sessionId = sessionId
                    resolve()
                }, reject)
            })
        })
    } 
    
    onConnect(fn: (event: Event) => void) {
        this.socketOpenCallers.push(fn)
    }
    
    onDisconnect(fn: (event: Event) => void) {
        this.socketClient?.onClose(fn)
    }
    
    closeConnection(code?: number, reason?: string) {
        this.socketClient?.socket.close(code, reason)
    }
    
    initClient() {
        this.socketClient = new SocketClient(this.serverAddr, (evt) => {
            try {
                for (const openCaller of this.socketOpenCallers) {
                    openCaller(evt)
                }
            } catch (e) {console.error(e)}
        })
    }
    
    
}

export { SocketClient, ServerBridge };
