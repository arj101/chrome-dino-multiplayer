<script context="module" lang="ts">
	// export const hydrate = true;
	// export const prerender = false;
	export const ssr = false;
	import { onMount, setContext } from 'svelte';
    import { browser } from '$app/env';
	import { socket } from '../store';

	socket.update((a) => {
		a.onopen = () => {
			console.log('Socket opened');
			a.send('EEEEEEEEEEEEEEEEEEEEEEE');
		}
		return a
	});
</script>

<!-- <script lang="ts">
	import Counter from '$lib/Counter.svelte';
import { browser } from '$app/env';
</script> -->

<svelte:head>
	<title>Home</title>
</svelte:head>

<section class="flex flex-col justify-center items-center flex-1">
	<!-- <Counter /> -->
	<a href="/sessions" class="no-underline hover:no-underline text-red-500  text-2xl uppercase font-semibold bg-white px-10 py-3 rounded-md shadow-md hover:shadow-lg transition-shadow">
		Play
	</a>
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 1;
	}
</style>
