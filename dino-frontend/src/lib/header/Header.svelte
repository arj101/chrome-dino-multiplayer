<script lang="ts">
	import { page } from '$app/stores';
	import { scale } from 'svelte/transition';
	$: largeMenu = $page.path !== '/game';
</script>

<header
	class="relative shadow-md bg-white h-10 duration-500 w-screen transition-all ease-in-out z-10"
	class:short-header={$page.path === '/game'}
>
	{#if $page.path !== '/game'}
		<div class="corner">
			<!-- <img src='/favicon.png' alt="chrome dino multiplayer" class="h-40 w-56"/> -->
		</div>
	{/if}
	<nav class="rounded-lg flex justify-center">
		<ul
			class="rounded-lg relative h-10 flex flex-row m-0 p-0 justify-center items-center list-none bg-white"
		>
			{#if $page.path !== '/game'}
				<li class:active={$page.path === '/'}>
					<a class:large-menu={true} sveltekit:prefetch href="/">Home</a>
				</li>
				<li class:active={$page.path.startsWith('/sessions')}>
					<a class:large-menu={true} sveltekit:prefetch href="/sessions">Sessions</a>
				</li>
				<li class:active={$page.path === '/about'}>
					<a class:large-menu={true} sveltekit:prefetch href="/about">About</a>
				</li>
				<li class:active={$page.path === '/game'}>
					<a class:large-menu={true} sveltekit:prefetch href="/game">Game</a>
				</li>
			{/if}
			{#if $page.path === '/game'}
				<li>
					<a class="p-0" sveltekit:prefetch href="/">
						<span class="material-icons-round"> close </span>
					</a>
				</li>
			{/if}
		</ul>
	</nav>

	{#if $page.path !== '/game'}
		<div class="corner">
			<!-- TODO put something else here? github link? -->
		</div>
	{/if}
</header>

<style lang="postcss">
	header {
		display: flex;
		justify-content: space-between;
	}

	.short-header {
		@apply absolute w-10 rounded-lg top-1 left-1 align-middle justify-center shadow-lg;
	}

	.large-menu {
		@apply p-4;
	}

	.corner {
		display: flex;
		align-items: center;
		justify-content: center;
		/* @apply w-16 h-16; */
	}

	.corner img {
		@apply object-contain w-8 h-8;
	}

	li {
		@apply relative h-full;
	}

	li::before {
		@apply content-none w-full h-0 absolute border border-solid border-red-500 bg-red-500 bottom-0 opacity-0 transition duration-300;
	}

	li.active::before {
		content: '';
		@apply h-1 bottom-0 opacity-100 rounded-t-sm;
	}

	nav a {
		@apply flex h-full items-center text-gray-600 font-semibold text-sm uppercase tracking-wider no-underline transition-colors;
	}

	a:hover {
		color: var(--accent-color);
	}
</style>
