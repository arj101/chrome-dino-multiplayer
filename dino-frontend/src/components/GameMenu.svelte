<script>
    import { ServerBridge } from "../game/socket-client";
    import { fly, fade } from "svelte/transition";
    import { clickOutside } from "../clickOutside.js";

    let serverAddr = "ws://127.0.0.1:8080";
    /**
     * @type {ServerBridge} server
     */
    let server = new ServerBridge(serverAddr);
    let sessions = [];
    let sessionId;
    let username;
    let sessionName;
    let waitTime;

    let login;
    let leaderboard;
    let newSession;
    let leaderboardUpdateInterval;
    let leaderboardData = [];

    setInterval(() => server.getSessionList().then((s) => (sessions = s)), 500);

    function scrollIntoView({ target }) {
		const el = document.querySelector(target.getAttribute('href'));
		if (!el) return;
        el.scrollIntoView({
            behavior: 'smooth'
        });
    }

    function closeConnection() {
        server.socketClient?.socket.close();
        server.socketClient = undefined;
        server = server;
        sessions = [];
    }

    function initConnection() {
        if (server.socketClient?.socketOpen) {
            closeConnection();
            return;
        }
        server.serverAddr = serverAddr;
        server.initClient();
        server = server;
        server.onConnect(() => (server = server));
        server.socketClient.onMessage((msg) => {
            if (
                msg.type == "QueryResponse" &&
                msg.queryRes.type == "LeaderBoard"
            )
                leaderboardData = msg.queryRes.scores;
        });
        setTimeout(
            () => server.getSessionList().then((s) => (sessions = s)),
            500
        );
    }

    function showJoinMenu(sid) {
        sessionId = sid;
        login = true;
        leaderboard = false;
        newSession = false;
    }

    function postJoinFn() {
        window.localStorage.setItem("server-addr", serverAddr);
        window.localStorage.setItem("session-id", server.gameData.sessionId);
        window.localStorage.setItem("user-id", server.gameData.userId);
        window.localStorage.setItem("username", server.gameData.userName);
        window.localStorage.setItem("wait-time", waitTime);
        if (window.location.href.endsWith("/")) window.location.href += "play";
        else window.location.href += "/play";
    }

    function joinSession() {
        server
            .joinSession(sessionId, username)
            .then(postJoinFn)
            .catch((e) => alert(`Error joining session: ${e}`));
    }

    function showLeaderboard(sid) {
        sessionId = sid;
        login = false;
        leaderboard = true;
        newSession = false;
        clearInterval(leaderboardUpdateInterval);
        leaderboardUpdateInterval = setInterval(() => {
            server.socketClient.send({
                type: "Query",
                query: { type: "LeaderBoard", sessionId: sid },
            });
        }, 200);
    }

    function closeLeaderboard(sid) {
        clearInterval(leaderboardUpdateInterval);
        leaderboard = false;
    }
    function showCreateSession() {
        leaderboard = false;
        login = false;
        newSession = true;
    }

    function createSession() {
        server
            .createSession(sessionName, username, waitTime)
            .catch((e) => alert(`Creating session failed: ${e}`))
            .then(postJoinFn);
    }
</script>

<main>
    <div class="items-start justify-items-stretch flex-col">
        <label for="server-addr">Server Address</label>
        <input
            type="text"
            name="server-addr"
            spellcheck="false"
            bind:value={serverAddr}
            on:input={closeConnection}
        />

        <button on:click={initConnection}>
            {#if !server.socketClient?.socketOpen || !server.socketClient}
                Connect
            {:else if server.socketClient.socket.readyState == 0}
                Connecting
            {:else if server.socketClient.socket.readyState == 1}
                Disconnect
            {:else if server.socketClient.socket.readyState == 2 || server.socketClient.socket.readyState == 3}
                [Closed]
            {/if}
        </button>
    </div>

    <div class="items-stretch justify-stretch flex-col lg:flex-row w-full">
        {#if sessionId && login}
            <div
                class="items-start justify-around flex-col h-fit p-10"
                use:clickOutside
                on:click_outside={() => (sessionId = null)}
                transition:fly={{ y: -50, x: 0, duration: 100 }}
            >
                <h1 class="text-white">
                    {sessions.filter((s) => s[0] == sessionId)[0][1]}
                </h1>
                <label for="user-name">Username</label>
                <input
                    type="text"
                    name="user-name"
                    spellcheck="false"
                    bind:value={username}
                />

                <button on:click={joinSession}> Continue </button>
            </div>
        {/if}
        {#if sessionId && leaderboard}
            <div
                class="items-start justify-around flex-col h-fit p-10"
                use:clickOutside
                on:click_outside={closeLeaderboard}
                transition:fly={{ y: -50, x: 0, duration: 100 }}
            >
                <h1 class="text-white">Leaderboard</h1>
                {#each leaderboardData as player}
                    <p>{player[0]} : {player[1]}</p>
                {/each}
            </div>
        {/if}
        {#if newSession}
            <div
                class="items-start justify-around flex-col h-fit p-10"
                use:clickOutside
                on:click_outside={() => (newSession = false)}
                transition:fly={{ y: -50, x: 0, duration: 100 }}
            >
                <h1 class="text-white">New Session</h1>
                <label for="user-name">Username</label>
                <input
                    type="text"
                    name="user-name"
                    spellcheck="false"
                    bind:value={username}
                />
                <label for="session-name">Session Name</label>
                <input
                    type="text"
                    name="session-name"
                    spellcheck="false"
                    bind:value={sessionName}
                />

                <label for="wait-time">Wait Time</label>
                <input
                    type="number"
                    name="wait-time"
                    spellcheck="false"
                    bind:value={waitTime}
                />

                <button on:click={createSession}> Continue </button>
            </div>
        {/if}
        <div class="items-stretch justify-start flex-col w-full lg:w-1/2 transition-all">
            {#if (sessions && sessions.length > 0) || server.socketClient?.socketOpen}
                <div
                    class="justify-around items-center border-blue-200 border-0 border-b-2 border-opacity-10"
                    transition:fade={{ duration: 200 }}
                >
                    <button on:click={showCreateSession}>
                        Create New<span class="material-symbols-outlined">
                            add
                        </span>
                    </button>
                </div>
            {/if}
            {#each sessions as session, i}
                <div
                    class="justify-between px-3 items-center border-blue-200 border-0 border-b-2 border-opacity-10"
                    in:fly={{
                        x: -(100 + Math.random() * 50),
                        y: 0,
                        duration: 150 + (300 * i) / sessions.length,
                    }}
                    out:fade={{ duration: 200 }}
                >
                    <p>
                        {session[1]}
                        <span
                            class="text-sm p-2 ml-4 border-md {session[2] ==
                            'Waiting'
                                ? 'bg-green-600'
                                : session[2] == 'Busy'
                                ? 'bg-orange-600'
                                : 'bg-gray-600'}">{session[2]}</span
                        >
                    </p>
                    <div class="flex-row">
                        <button
                            disabled={sessionId &&
                                sessionId == session[0] &&
                                login}
                            on:click={() => showJoinMenu(session[0])}
                        >
                            Join <span class="material-symbols-outlined">
                                login
                            </span>
                        </button>

                        <button on:click={() => showLeaderboard(session[0])}>
                            <span class="material-symbols-outlined">
                                leaderboard
                            </span>
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    </div>
</main>

<style lang="postcss">
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    @tailwind variants;
    main {
        width: 100%;
        min-height: 100vh;
        padding: 1.5rem;
        font-family: Bungee, sans-serif;
        font-size: 0.8rem;
    }

    div {
        @apply flex;
    }

    label {
        color: white;
        margin: 0.25rem;
    }

    p {
        margin: 0.25rem;
        color: white;
    }

    input {
        border: 0;
        outline: 0;
        margin: 0.25rem;
        padding: 0.25rem;
        padding-inline: 0.5rem;
        border-radius: 0.125rem;
    }

    button {
        @apply text-center p-2 bg-slate-200 text-gray-800 m-2 rounded-sm 
        shadow-md transition-all duration-150 cursor-pointer
        flex items-center justify-center
        enabled:hover:scale-105 enabled:hover:-translate-y-0.5 enabled:hover:shadow-lg
        enabled:active:scale-95 enabled:active:translate-y-0.5 enabled:active:shadow-md
        disabled:shadow-none disabled:opacity-50;
    }
</style>
