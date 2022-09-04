<script>
    import { SocketClient } from "../../../chrome-dino-multiplayer/dino-frontend-v2/src/socket-client";
    import { onMount } from "svelte";
    let s = [];
    onMount(() => {
        // if (!window.browser) return;
        try {
            const client = new SocketClient("ws://127.0.0.1:8080", () => {
                console.log("open");
                client.send({ type: "Query", query: { type: "Sessions" } });
            });
            client.onNextMsg((qr) => {
                if (
                    qr.type == "QueryResponse" &&
                    qr.queryRes.type == "Sessions"
                )
                    s = qr.queryRes.sessions;
            });
            setInterval(() => {
                client.send({ type: "Query", query: { type: "Sessions" } });
                client.onNextMsg((qr) => {
                    if (
                        qr.type == "QueryResponse" &&
                        qr.queryRes.type == "Sessions"
                    )
                        s = qr.queryRes.sessions;
                });
            }, 200);
        } catch (e) {}
    });
</script>

<div>
    {#each s as e}
        <p>{e[1] || ""} : {e[2] || ""}</p>
    {/each}
</div>
