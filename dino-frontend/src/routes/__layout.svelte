<script lang="ts">
	import Header from '$lib/header/Header.svelte';
	import '../app.css';
</script>

<img src="/sprites/ground.png" class="object-cover absolute left-0 bottom-1/4 h-5 z-0" alt="just a background, nothing important"/>
<slot />

<style>
	img {
		filter: brightness(1000%)
	}
</style>