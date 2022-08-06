<script >
	import { fly } from 'svelte/transition'
	import { Game } from '../lib/game/game'
	import '../lib/game/game'
	import { onMount } from 'svelte'
	import { page } from '$app/stores'
	import { ws, userId } from '../lib/store'

	const sessionId = $page.query.get('id');

	let canvasParent;
	onMount(() => {
		if (sessionId) {
			const game = new Game(canvasParent, sessionId)
			game.start()
			console.log(`session id: ${sessionId}`)
		}
	})
</script>

<svelte:head>
	<title>The actual game obviously</title>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.min.js" integrity="sha512-N4kV7GkNv7QR7RX9YF/olywyIgIwNvfEe2nZtfyj73HdjCUkAfOBDbcuJ/cTaN04JKRnw1YG1wnUyNKMsNgg3g==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
</svelte:head>

<content
	class="h-screen w-full bg-white overflow-auto z-10"
	id="canvas-parent"
	out:fly={{ x: 500, duration: 400 }}
	bind:this={canvasParent}
>
	{#if !sessionId}
		<h1 class="text-black">{['Thats kinda sus', 'sus', 'lol what', 'something\'s wrong 👀️'][Math.floor(Math.random() * 4)]}</h1>
	{/if}
</content>

<style lang="postcss">
	content {
		transform: translateX(100%);
		animation: fly-in 400ms ease-in-out forwards;
		z-index: 0;
	}
	:global(canvas) {
		@apply w-full h-full;
		image-rendering: -moz-crisp-edges;
		image-rendering: -webkit-crisp-edges;
		image-rendering: pixelated;
		image-rendering: crisp-edges;
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
