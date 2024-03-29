import { serialize, deserialize, GameEvent } from "./ws-de-serialize";
import type { TxData, RxData } from "./ws-de-serialize";
import Game from "../components/Game.svelte";

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
        this.onMessageCallers = [];

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
                caller(msgDeserialized);
            }
            for (const caller of this.nextMessageCallers) {
                caller(msgDeserialized);
            }
            this.nextMessageCallers = [];
        };

        this.socket.onclose = (event) => {
            console.log(`${this.socket.url} just closed connection`);
            if (this.socketOpen) this.socket = new WebSocket(this.socket.url);
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
        return this.onMessageCallers.length - 1;
    }

    deleteMsgCaller(idx: number) {
        this.onMessageCallers.splice(idx, 1);
    }

    onClose(f: (event: Event) => void) {
        this.onCloseCaller = f;
    }

    close() {
        this.socketOpen = false;
        this.socket.close();
    }

    onNextMsg(f: (msg: RxData) => void) {
        this.nextMessageCallers.push(f);
    }

    send(msg: TxData): boolean {
        try {
            if (!this.socketOpen) return false;
            this.socket.send(serialize(msg));
        } catch (e) {}
        return this.socketOpen;
    }
}

interface MapData {
    mapIdx: number;
    mapRequestSent: boolean;
}

interface PhysicsConfig {
    initalSpeed: number;
    xAcceleration: number;

    gravity: number;
    jumpSpeed: number;
}

// enum GameState {
//     Initial = "Initial",
//     Waiting = "Waiting",
//     Countdown = "Countdown",
//     Active = "Active",
//     Ended = "Ended",
// }

type GameState = "Initial" | "Waiting" | "Countdown" | "Active" | "Ended";

interface GameData {
    map: MapData;
    physics: PhysicsConfig;

    startTime?: Date;
    countdownDuration?: number;

    state: GameState;
    stateTimer?: number;

    userId?: string;
    sessionId?: string;

    userName?: string;
    sessionName?: string;
}

//Abstracts over SocketClient
class ServerBridge {
    socketClient: SocketClient | null;
    serverAddr: string;
    socketOpenCallers: Array<(event: Event) => void>;

    gameData: GameData;
    broadcastBuffer: Array<RxData>;
    tick: number = 0;

    constructor(serverAddr: string) {
        this.socketClient = null;
        this.serverAddr = serverAddr;
        this.socketOpenCallers = [];
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
            state: "Initial",
        };
        this.broadcastBuffer = [];
    }

    getSessionList(): Promise<Array<[string, string, string, Array<string>]>> {
        const getSessionList = (
            onRcv: (
                data: Array<[string, string, string, Array<string>]>
            ) => void
        ) => {
            this.socketClient?.send({
                type: "Query",
                query: { type: "Sessions" },
            });

            const callerIdx = this.socketClient?.onMessage((msg) => {
                if (
                    msg.type === "QueryResponse" &&
                    msg.queryRes.type === "Sessions"
                ) {
                    this.socketClient?.deleteMsgCaller(callerIdx as number);
                    onRcv(msg.queryRes.sessions);
                }
            });
        };
        return new Promise((resolve, _reject) => {
            this.callOnOpenSocket(() => getSessionList(resolve));
        });
    }

    callOnOpenSocket(fn: () => void) {
        if (this.socketClient?.socketOpen) fn();
        else {
            this.socketClient?.onOpen(fn);
        }
    }

    createSession(
        sessionName: string,
        username: string,
        waitTime: number
    ): Promise<void> {
        const createSession = (
            onSuccess: (
                sessionName: string,
                username: string,
                sessionId: string,
                userId: string,
                waitTime: number
            ) => void,
            onUnable: () => void = () => {}
        ) => {
            this.socketClient?.send({
                type: "CreateSession",
                sessionName,
                username,
                waitTime,
            });

            const callerIdx = this.socketClient?.onMessage((msg) => {
                if (
                    msg.type !== "UserCreationResponse" &&
                    msg.type !== "SessionCreationResponse"
                )
                    return;
                if (!msg.creationSucceeded) {
                    this.socketClient?.deleteMsgCaller(callerIdx as number);
                    onUnable();
                    return;
                }
                if (msg.type === "SessionCreationResponse") {
                    this.gameData.sessionId = msg.sessionId as string;
                }
                if (msg.type === "UserCreationResponse") {
                    this.gameData.userId = msg.userId as string;
                }

                if (this.gameData.sessionId && this.gameData.userId) {
                    this.socketClient?.deleteMsgCaller(callerIdx as number);
                    this.gameData.state = "Waiting";
                    onSuccess(
                        sessionName,
                        username,
                        this.gameData.sessionId,
                        this.gameData.userId,
                        waitTime
                    );
                }
            });
        };
        return new Promise((resolve, reject) => {
            this.callOnOpenSocket(() => createSession(() => resolve(), reject));
        });
    }

    joinSession(sessionId: string, username: string): Promise<void> {
        const joinSession = (
            onJoin: (
                username: string,
                userId: string,
                sessionId: string
            ) => void,
            onUnable: () => void = () => {}
        ) => {
            this.socketClient?.send({
                type: "CreateUser",
                sessionId,
                username,
            });
            const callerIdx = this.socketClient?.onMessage((msg) => {
                if (msg.type !== "UserCreationResponse") return;
                this.socketClient?.deleteMsgCaller(callerIdx as number);
                if (msg.creationSucceeded === true) {
                    this.gameData.state = "Waiting";
                    onJoin(username, msg.userId as string, sessionId);
                } else onUnable();
            });
        };
        return new Promise((resolve, reject) => {
            this.callOnOpenSocket(() => {
                joinSession((username, userId, sessionId) => {
                    this.gameData.userName = username;
                    this.gameData.userId = userId;
                    this.gameData.sessionId = sessionId;
                    resolve();
                }, reject);
            });
        });
    }

    login(
        sessionId: string,
        userId: string,
        username: string
    ): Promise<boolean> {
        const login = (
            onLogin: (succeeded: boolean) => void,
            onErr: () => void
        ) => {
            this.socketClient?.send({ type: "Login", sessionId, userId });
            const callerIdx = this.socketClient?.onMessage((msg) => {
                if (msg.type !== "LoginResponse") return;
                this.socketClient?.deleteMsgCaller(callerIdx as number);
                if (msg.succeeded === true) {
                    if (this.gameData.state == "Initial")
                        this.gameData.state = "Waiting";
                    this.gameData.userName = username;
                    this.gameData.userId = userId;
                    this.gameData.sessionId = sessionId;
                    onLogin(msg.succeeded);
                } else {
                    onErr();
                }
            });
        };

        return new Promise((resolve, reject) => {
            this.callOnOpenSocket(() => login(resolve, reject));
        });
    }

    onCountdownStart(fn: (duration: number) => void): Promise<void> {
        const listenForCountdownStart = (
            onRecv: (duration: number) => void
        ) => {
            const callerIdx = this.socketClient?.onMessage((msg) => {
                if (msg.type !== "GameCountdownStart") return;
                this.socketClient?.deleteMsgCaller(callerIdx as number);
                this.gameData.countdownDuration = msg.duration;
                this.gameData.state = "Countdown";
                onRecv(msg.duration);
            });
        };

        return new Promise((resolve, _reject) => {
            listenForCountdownStart((duration) => {
                fn(duration);
                resolve();
            });
        });
    }

    onGameStart(fn: () => void): Promise<void> {
        const listenForGameLaunch = (onRecv: () => void) => {
            const callerIdx = this.socketClient?.onMessage((msg) => {
                if (msg.type !== "GameStart") return;
                this.socketClient?.deleteMsgCaller(callerIdx as number);
                this.gameData.state = "Active";
                onRecv();
            });
        };

        return new Promise((resolve, _reject) =>
            listenForGameLaunch(() => {
                fn();
                resolve();
            })
        );
    }

    requestGameLaunch() {
        const requestGameLaunch = () => {
            this.socketClient?.send({
                type: "LaunchGame",
                sessionId: this.gameData.sessionId || "",
                userId: this.gameData.userId || "",
            });
        };
        this.callOnOpenSocket(requestGameLaunch);
    }

    //This function assumes that socket connection is already open
    //MOST TIME SENSITIVE function
    broadcastData(relYPos: number, relXPos: number) {
        (this.socketClient as SocketClient).send({
            type: "BroadcastRequest",
            posY: relYPos,
            posX: relXPos,
            tick: this.tick,
        });
        this.tick++;
    }

    onRecvGameEvet(fn: (username: string, event: GameEvent) => void) {
        this.socketClient!.onMessage((msg) => {
            if (msg.type != "GameEvent") return;
            fn(msg.username, msg.event);
        });
    }

    broadcastUpdateEvt(relXPos: number, score: number) {
        this.socketClient!.send({
            type: "GameEvent",
            userId: this.gameData.userId!,
            event: { type: "StatusUpdate", pos: relXPos, score },
        });
    }

    broadcastGameEvt(event: GameEvent) {
        this.socketClient!.send({
            type: "GameEvent",
            userId: this.gameData.userId!,
            event,
        });
    }

    onRecvBroadcast(
        fn: (username: string, posX: number, posY: number) => void
    ) {
        (this.socketClient as SocketClient).onMessage((msg) => {
            if (msg.type !== "PlayerDataBroadcast") return;
            fn(msg.username, msg.posX, msg.posY);
        });
    }

    broadcastAvailable(): boolean {
        return this.broadcastBuffer.length > 0;
    }

    getBroadcast(): Array<RxData> {
        const data = [...this.broadcastBuffer];
        this.broadcastBuffer = [];
        return data;
    }

    broadcastGameOver() {
        //TODO: Listen for UserGameOver return message
        this.gameData.state = "Ended";
        (this.socketClient as SocketClient).send({
            type: "GameOver",
            sessionId: this.gameData.sessionId as string,
            userId: this.gameData.userId as string,
        });
    }

    onRecvGameOver(fn: (username: string, score: number) => void) {
        (this.socketClient as SocketClient).onMessage((msg) => {
            if (msg.type !== "UserGameOverBroadcast") return;
            fn(msg.username, msg.score);
        });
    }

    requestMap(): Promise<Array<[[number, number], Array<string>]>> {
        const requestMap = (
            onRecv: (map: Array<[[number, number], Array<string>]>) => void
        ) => {
            this.socketClient?.send({
                type: "Map",
                sessionId: this.gameData.sessionId as string,
                userId: this.gameData.userId as string,
                index: this.gameData.map.mapIdx,
            });
            this.gameData.map.mapRequestSent = true;

            const callerIdx = this.socketClient?.onMessage((msg) => {
                if (msg.type !== "Map") return;
                this.socketClient?.deleteMsgCaller(callerIdx as number);
                this.gameData.map.mapRequestSent = false;
                this.gameData.map.mapIdx += 1;
                onRecv(msg.map);
            });
        };

        return new Promise((resolve, reject) => {
            if (this.gameData.map.mapRequestSent) reject();
            this.callOnOpenSocket(() => requestMap(resolve));
        });
    }

    sessionStatus(
        sessionId: string,
        timeout: number = 10_000
    ): Promise<{ status: string; t: number }> {
        const sessionStatus = (
            onRecv: (status: { status: string; t: number }) => void
        ) => {
            this.socketClient?.send({
                type: "Query",
                query: {
                    type: "SessionStatus",
                    sessionId,
                },
            });

            const callerIdx = this.socketClient?.onMessage((msg) => {
                if (msg.type !== "QueryResponse") return;
                if (msg.queryRes.type !== "SessionStatus") return;
                this.socketClient?.deleteMsgCaller(callerIdx as number);
                onRecv({ status: msg.queryRes.status, t: msg.queryRes.time });
            });
        };

        return new Promise((resolve, reject) => {
            setTimeout(() => reject("Request timed out"), timeout);
            this.callOnOpenSocket(() => sessionStatus(resolve));
        });
    }

    onConnect(fn: (event: Event) => void) {
        this.socketOpenCallers.push(fn);
    }

    onDisconnect(fn: (event: Event) => void) {
        this.socketClient?.onClose(fn);
    }

    closeConnection(code?: number, reason?: string) {
        this.socketClient?.socket.close(code, reason);
    }

    syncState(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.gameData?.sessionId) {
                reject();
            }

            if (this.gameData?.sessionId)
                this.sessionStatus(this.gameData.sessionId).then(
                    ({ status, t }) => {
                        this.gameData.state = (() => {
                            switch (status) {
                                case "Active":
                                    return "Active";
                                case "Countdown":
                                    return "Countdown";
                                case "Ended":
                                    return "Ended";
                                case "Waiting":
                                    return "Waiting";
                                default:
                                    return "Initial";
                            }
                        })();
                        this.gameData.stateTimer = t;
                        resolve();
                    }
                );
        });
    }

    initClient(): Promise<void> {
        return new Promise((resolve, _) => {
            this.socketClient = new SocketClient(this.serverAddr, (evt) => {
                try {
                    for (const openCaller of this.socketOpenCallers) {
                        openCaller(evt);
                    }
                } catch (e) {
                    console.error(e);
                }
                //
                // this.socketClient?.onMessage((data) => {
                //     if (data.type == "PlayerDataBroadcast")
                //         this.broadcastBuffer.push(data);
                // });
                //
                this.syncState();
                // setInterval(() => this.syncState(), 1000);

                if (
                    this.gameData.userId &&
                    this.gameData.sessionId &&
                    this.gameData.userName
                ) {
                    this.login(
                        this.gameData.sessionId,
                        this.gameData.userId,
                        this.gameData.userName
                    )
                        .catch((_) => alert("Login failed :("))
                        .then((_) => resolve());
                } else {
                    resolve();
                }
            });
        });
    }
}

export { SocketClient, ServerBridge };
export type { GameState };
