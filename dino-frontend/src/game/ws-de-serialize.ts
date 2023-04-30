type QueryResponse =
    | { type: "Sessions"; sessions: Array<[string, string, string, [string]]> }
    | {
          type: "LeaderBoard";
          sessionId: string;
          scores: Array<[string, number]>;
      }
    | { type: "None" }
    | { type: "SessionStatus"; status: string; time: number };

type RxData =
    | { type: "QueryResponse"; queryRes: QueryResponse }
    | {
          type: "SessionCreationResponse";
          creationSucceeded: boolean;
          sessionId?: string;
      }
    | {
          type: "UserCreationResponse";
          creationSucceeded: boolean;
          userId?: string;
      }
    | {
          type: "PlayerDataBroadcast";
          username: string;
          posY: number;
          posX: number;
          tick: number;
      }
    | { type: "LoginResponse"; succeeded: boolean }
    | { type: "GameCountdownStart"; duration: number }
    | { type: "GameStart" }
    | { type: "Map"; map: [[[number, number], [any]]] }
    | { type: "UserGameOverBroadcast"; username: string; score: number }
    | { type: "UserGameOver"; score: number; userId: string }
    | { type: "InvalidationNotice" }
    | { type: "GameEvent"; username: string; event: GameEvent }
    | { type: "None" };

type QueryType =
    | { type: "Sessions" }
    | { type: "LeaderBoard"; sessionId: string }
    | { type: "SessionStatus"; sessionId: string };

type MoveDir = "None" | "Up" | "Down";

type GameEvent =
    | { type: "StatusUpdate"; pos: number; score: number }
    | { type: "Jump"; pos: number }
    | { type: "DuckStart"; pos: number }
    | { type: "DuckEnd"; pos: number };

type TxData =
    | { type: "Query"; query: QueryType }
    | { type: "CreateSession"; username: string; sessionName: string }
    | { type: "CreateUser"; sessionId: string; username: string }
    | { type: "LaunchGame"; sessionId: string; userId: string }
    | {
          type: "BroadcastRequest";
          posY: number;
          posX: number;
          tick: number;
      }
    | {
          type: "ValidationData";
          sessionId: string;
          userId: string;
          posX: number;
          score: number;
          timestamp: number;
          moveDir: MoveDir;
      }
    | { type: "GameEvent"; userId: string; event: GameEvent }
    | { type: "Map"; sessionId: string; userId: string; index: number }
    | { type: "Login"; sessionId: string; userId: string }
    | { type: "GameEvent"; userId: string; event: GameEvent }
    | { type: "GameOver"; sessionId: string; userId: string };

function deserialize(jsonStr: string): RxData {
    let json = JSON.parse(jsonStr);

    // hopefully theres a less verbose way...
    switch (json["type"]) {
        case "GameEvent": {
            if (!validateKeys(json, { username: "", event: {} }))
                return { type: "None" };
            return {
                type: "GameEvent",
                username: json["username"],
                event: json["event"],
            } as RxData;
        }
        case "QueryResponse":
            if (!validateKeys(json, { queryRes: {} })) return { type: "None" };
            return {
                type: "QueryResponse",
                queryRes: parseQueryResponse(json["queryRes"]),
            };
        case "SessionCreationResponse":
            if (!validateKeys(json, { creationSucceeded: true }))
                return { type: "None" };
            {
                const dezerd: RxData = {
                    type: "SessionCreationResponse",
                    creationSucceeded: json["creationSucceeded"],
                };
                if (dezerd.creationSucceeded)
                    dezerd.sessionId = json["sessionId"];
                return dezerd;
            }
        case "UserCreationResponse":
            if (!validateKeys(json, { creationSucceeded: true }))
                return { type: "None" };
            {
                const dezerd: RxData = {
                    type: "UserCreationResponse",
                    creationSucceeded: json["creationSucceeded"],
                };
                if (dezerd.creationSucceeded) dezerd.userId = json["userId"];
                return dezerd;
            }
        case "PlayerDataBroadcast":
            if (!validateKeys(json, { username: "", posY: 0, posX: 0 }))
                return { type: "None" };
            return {
                type: "PlayerDataBroadcast",
                username: json["username"],
                posY: json["posY"],
                posX: json["posX"],
                tick: json["tick"],
            };
        case "GameCountdownStart":
            if (!validateKeys(json, { duration: 0 })) return { type: "None" };
            return { type: "GameCountdownStart", duration: json["duration"] };
        case "GameStart":
            return { type: "GameStart" };
        case "Map":
            if (!validateKeys(json, { map: [] })) return { type: "None" };
            return { type: "Map", map: json["map"] };
        case "UserGameOverBroadcast":
            if (!validateKeys(json, { username: "", score: 0 }))
                return { type: "None" };
            return {
                type: "UserGameOverBroadcast",
                username: json["username"],
                score: json["score"],
            };
        case "LoginResponse":
            if (!validateKeys(json, { succeeded: true }))
                return { type: "None" };
            return {
                type: "LoginResponse",
                succeeded: json["succeeded"],
            };
        case "UserGameOver":
            if (!validateKeys(json, { score: 0, userId: "" }))
                return { type: "None" };
            return {
                type: "UserGameOver",
                score: json["score"],
                userId: json["userId"],
            };
        case "InvalidationNotice":
            return { type: "InvalidationNotice" };
        default:
            return { type: "None" };
    }
}

function parseQueryResponse(json: any): QueryResponse {
    switch (json["type"]) {
        case "SessionStatus":
            if(!validateKeys(json, {status: '', time: 0})) return { type: "None" };
            return { type: "SessionStatus", status: json["status"], time: json["t"]}
        case "Sessions":
            if (!validateKeys(json, { sessions: [] })) return { type: "None" };
            return { type: "Sessions", sessions: json["sessions"] };
        case "LeaderBoard":
            if (!validateKeys(json, { sessionId: "", scores: [] }))
                return { type: "None" };
            return {
                type: "LeaderBoard",
                sessionId: json["sessionId"],
                scores: json["scores"],
            };
        default:
            return { type: "None" };
    }
}

function serialize(data: TxData): string {
    // yeah, thats it lol
    return JSON.stringify(data);
}

//probably the worst way to runtime type check
function validateKeys(msg: any, ref: any): boolean {
    const msgKeys = Object.keys(msg);
    const refKeys = Object.keys(ref);

    let validated = true;

    for (const key of refKeys) {
        let refType = typeof ref[key];
        if (msgKeys.includes(key)) {
            // cannot be recursively checked due to nested types (like QueryResponse)
            // if (refType === typeof msg[key]) {
            // 	validated = refType === 'object' ? validateKeys(msg[key], ref[key]) : true
            // 	if (!validated) return false
            // } else {
            // 	return false
            // }
            let validated = refType === typeof msg[key];
            if (!validated) return false; // no need to spend more time in the loop
        } else {
            return false;
        }
    }
    return validated;
}

export type { RxData, TxData, GameEvent };
export { serialize, deserialize };
