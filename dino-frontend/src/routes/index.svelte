<script lang="ts">
</script>

<svelte:head>
	<title>Home</title>
</svelte:head>

<content class="w-full h-screen">
	<div class="flex items-stretch justify-items-stretch w-full h-full">
		<div class="h-full grid place-items-center m-10 w-4/6">
			<h1 class="text-white transition-all text-sm sm:text-2xl md:text-4xl">Chrome Dino Multiplayer</h1>
		</div>
		<div class="h-full grid place-items-center">
			<div class="flex place-items-end justify-items-center flex-col">
				<a href="/sessions/" class="pl-32">Play</a>
				<a href="." class="pl-20">What?</a>
				<a href="." class="pl-24">Why??</a>
			</div>
		</div>
	</div>
</content>


<style lang="postcss">
	a {
		background-color: #2D2D2D;
		box-shadow: 3px 4px 0px #636363;
		transition: transform 300ms cubic-bezier(0,1.12,.33,1.97);
		@apply pr-8 py-5 text-white text-2xl my-4 mx-4 scale-100;
	}

	a:hover {
		box-shadow: 0px 0px 10px #00000005;
		@apply scale-105;
	}

	a:active {
		@apply scale-100;
	}
	
</style>
