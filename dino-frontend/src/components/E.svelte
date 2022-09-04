<script>
    export let title;
</script>

<a href="/game">Play!</a>

<style>
    a {
        flex-shrink: 0;
        flex-grow: 0;
        color: black;
        font-weight: 800;
        font-size: 1.2rem;
        border-radius: 0.4rem;
        background-image: linear-gradient(
            0deg,
            rgb(248, 56, 130),
            rgb(255, 113, 70)
        );
        padding: 1rem;
        word-wrap: break-word;
        background-size: 200% 200%;
        transition: all 300ms ease-in;
        cursor: pointer;
        border: 3px solid transparent;
        text-align: center;
        /* padding-top: 25%; */
        /* padding-bottom: auto; */
    }
    a:hover {
        background-position: 100% 100%;
        border: 3px rgb(248, 56, 56) solid;
    }
</style>
