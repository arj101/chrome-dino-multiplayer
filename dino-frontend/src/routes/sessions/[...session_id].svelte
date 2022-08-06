<script lang="ts">
	import { fly, fade, scale } from 'svelte/transition';
	import { page, session } from '$app/stores';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import type { TxData } from '../../lib/game/ws-de-serialize'
	import type { SocketClient } from '$lib/game/socket-client';
	import { ws } from '../../lib/store'

	async function sessionReq(ws: SocketClient): Promise<Object> {
		return new Promise((resolve, reject) => {
			ws.onOpen(() => {
				ws.send({
					type: 'Query',
					query: {
						type: 'Sessions'
					}
				})

				setTimeout(() => reject('Timeout, took longer than 5s to respond'), 5000)

				ws.onMessage((msg) => {
					if (msg.type === 'QueryResponse' && msg.queryRes.type === 'Sessions') {
						let sessions = {}
						for (const session of msg.queryRes.sessions) {
							const id = session[0];
							const sessionName = session[1];
							const status = session[2];
							const users = session[3];
							sessions[id] = {
								sessionName, status, users
							}
						}
						resolve(sessions)
					} else {
						reject(424344277642672467)
					}
				})
			})
		})
	}

	let username;
	let sessionName;

	async function createSessionReq(ws: SocketClient): Promise<{sessionId: string, userId: string}>{
		return new Promise((resolve, reject) => {
			ws.onOpen(() => {
				ws.send({
					type: 'CreateSession',
					sessionName,
					username
				})

				let sessionId;
				let userId;

				setTimeout(() => reject('Timeout, took longer than 5s to respond'), 5000)

				ws.onMessage((msg) => {
					if (msg.type === 'SessionCreationResponse' && msg.creationSucceeded) {
						sessionId = msg.sessionId
					} else if (msg.type === 'UserCreationResponse' && msg.creationSucceeded) {
						userId = msg.userId
					} else {
						reject('lol')
					}
					if (sessionId && userId) resolve({sessionId, userId})
				})
			})
		})
	}

	function createSession() {
		ws.update((ws) => {
			(async () => {
				let { sessionId, userId } = await createSessionReq(ws)
				console.log(`Succesfully created user and session`)
				console.log(`Session id: ${sessionId}`)
				console.log(`User id: ${userId}`)
				username = ''
				sessionName = ''
				window.location.href = `./game?id=${sessionId}`
			})()
			return ws
		})
	}

	onMount(querySessions)

	$: sessionId = $page.params['session_id'];

	let sessions: Object = {
		'AAAAAAAAAAAAA': {
			sessionName: 'AEAEAE',
			status: 'Waiting',
		},
		'kmgjiisfijsfji': {
			sessionName: ':((',
			status: 'Waiting',
		},
		'23eedsffsf': {
			sessionName: 'sfssfsfkF',
			status: 'Waiting',
		},
		':((': {
			sessionName: 'def not a session',
			status: 'Waiting',
		},
		
	}


	function querySessions() {
		ws.update((ws) => {
			(async () => {
				let tmpSessions = await sessionReq(ws)
				console.log(tmpSessions)
				sessions = tmpSessions
			})()
			return ws
		})
	}

	// $: allowSessionCreation = (() => Object.keys(sessions).filter(k => sessions[k].status === 'Waiting').length === 0)();
	$: allowSessionCreation = true
	let showSessionCreationMenu = false;
</script>

<content
	class="relative w-full h-screen grid place-items-center z-10 flex-1" in:scale={{duration: 200, start: 0.8}}
>
	{#if showSessionCreationMenu}
	<div class="absolute z-10 bg-black bg-opacity-50 w-screen h-screen top-0 left-0" transition:fade={{duration:100}} on:click={() => showSessionCreationMenu = false}></div>
	<div class="flex flex-col items-start justify-around absolute z-10 px-14 py-20 bg-session-creation" transition:scale={{duration:200, start: 0.8}}>
		<h1 class="text-white text-xl mb-10">Enter session and username</h1>
		<label for="sessionname">Session name</label>
		<input type="text" name="sessionname" id="sessionname" class="w-full" bind:value={sessionName}>
		<label for="username" class="mt-10">Username</label>
		<input type="text" name="username" id="username" class="w-full" bind:value={username}>
		<button on:click={createSession} class="button mt-10 w-full border-white border bg-transparent text-white py-4">Continue</button>
	</div>
	{/if}
	<div id="sessions-container" class="py-14 px-12 flex flex-col items-center justify-items-start">
		{#if !sessionId}
			<h1 class="text-white text-xl text-center">Join a session to continue</h1>
			<div class="relative flex flex-col items-center overflow-auto w-full sessions gap-6 p-6 mt-5">
				{#if Object.keys(sessions).length <= 0}
					<h2 class="text-gray-200">There are no active sessions rn :(</h2>
				{/if}
				{#if allowSessionCreation}
					<button class="relative bg-white border transition-all border-white w-80 flex flex-row items-center justify-between" on:click={() => showSessionCreationMenu = true}>
						<p class="text-black text-md px-8 py-4 w-64 overflow-x-hidden overflow-ellipsis">
							Create New
						</p>
						<span  class="material-icons-outlined text-black w-16 grid place-items-center h-16 cursor-pointer session-span">
							add
						</span>
					</button>
				{/if}
				{#each Object.keys(sessions) as session}
					<a class="relative session bg-transparent border transition-all border-white w-80 flex flex-row items-center justify-between" href={'/sessions/' + session}>
						<p class="text-white text-md px-8 py-4 w-64 overflow-x-hidden overflow-ellipsis" href={'/sessions/' + session}>
							{sessions[session].sessionName}
						</p>
						<span  class="material-icons-outlined text-white w-16 grid place-items-center h-16 cursor-pointer session-span" href={'/sessions/' + session}>
							{sessions[session].status === 'Busy' ? 'leaderboard' : 'login'}
						</span>
					</a>
				{/each}
			</div>
		{:else if sessionId === 'new'}
		<h1>e</h1>
		{:else}
			<div class="flex flex-col items-start justify-around" in:scale={{duration:200, start: 0.8}}>
				<h1 class="text-white text-xl">Enter username</h1>
				<!-- <label for="username">Username</label> -->
				<input type="text" name="username" id="username" class="mt-5">
				<!-- <label for="sessionname" class="mt-10">Session name</label> -->
				<!-- <input type="text" name="sessionname" id="sessionname"> -->
				<button class="button mt-10 w-full border-white border bg-transparent text-white py-4">Continue</button>
			</div>
		{/if}
	</div>
</content>

<style lang="postcss">
	#sessions-container {
		width: 35rem;
		max-height: 80vh;
		background-color: rgba(10, 10, 10, 0.4);
	}

	label {
		@apply text-sm text-white
	}

	input {
		box-shadow: 2px 3px 0px #FFFFFF;
		@apply p-3 text-lg border-white border outline-none text-white transition-all;
		background-color: #00000025;

	}

	input:focus {
		box-shadow: 0px 0px 10px #00000036;
		transform: scaleX(102%);
	}

	.session {
		box-shadow: 2px 3px 0px #FFFFFF;
	}

	.session:hover {
		box-shadow: 0px 0px 10px #00000036;
		background-color: #0000003a;
	}

	.bg-session-creation {
		background-color: #3d3d3d;
		/* backdrop-filter: blur(1px); */
	}

	.button {
		background-color: #00000036;
	}

	.button:hover {
		background-color: #0000006b;
	}

	button {
		transform: scale(100%);
		transition: transform 200ms cubic-bezier(0,1.12,.33,1.97);
	}

	button:hover {
		transform: scale(102%);
	}

	button:active {
		transform: scale(98%);
	}

	.session-span {
		background-color: #00000036;
	}
	
	.new-button {
		background-color: #0000008f;
	}
</style>
