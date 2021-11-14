<script>
    import { fly } from 'svelte/transition'
</script>

<content class="h-screen w-full bg-white">
    <h1>E</h1>
    <p>jkdisfgfkogkhgsdjhigshsmg;hgsgusigsghsggs gshsgish hssggskbjkgsjsk</p>
</content>

<style>
    content {
        transform: translateX(100%);
        animation: fly-in 400ms ease-in-out forwards;
        z-index: 0;
    }
    @keyframes fly-in {
        from {
            transform: translateX(100%);
        }
        to {
            transform: translateX(0%);
        }
    }
</style>