<script>
    import { fly, fade, scale } from 'svelte/transition';
    import { socket } from '../../store';
    import { page } from '$app/stores';
    import { get } from 'svelte/store';
    import { browser } from '$app/env';
    


    console.log(get(socket));

    $: sessionId = $page.params['session_id'];
</script>

<content class="relative bg-white w-full h-[calc(100vh-2.5rem)] flex flex-row justify-around items-stretch bg-transparent transition-all">
    <div id="backdrop" class="absolute top-0 left-0 w-full h-full z-0 bg-gradient-to-br from-purple-100 to-purple-50 opacity-0 m-0 p-0 border-0"></div>
    <div class="bg-transparent w-80 flex justify-center items-center p-2 z-10">
        <div in:fly={{duration:300, x: -300}} class=" bg-white rounded-md w-full h-full shadow-lg flex flex-col justify-items-start items-stretch gap-4 p-10">
            <h2 class="text-xl font-light">Sessions</h2>
            <a class="create-new" class:new-active={sessionId === 'new'} href="/sessions/new">Create New</a>
            <hr class="border-2 border-solid border-transparent"/>
            <a class="session-active" class:active-selected={sessionId === 'djsjkskgsjsgjhsgk'} href="/sessions/djsjkskgsjsgjhsgk">Session 1</a>
            <a class="session-waiting" class:waiting-selected={sessionId === 'ddjjfieghgeiggjjjhdh'} href="/sessions/ddjjfieghgeiggjjjhdh">Session 2</a>
            <a class="session-active" class:active-selected={sessionId === 'ejfjhdgddghjdgjdg'} href="/sessions/ejfjhdgddghjdgjdg">Session 3</a>
            <a class="session-active" class:active-selected={sessionId === 'skjgjhgjhgdjhdg'} href="/sessions/skjgjhgjhgdjhdg">Session 4</a>
        </div>
    </div>
    <div class="flex-1 bg-transparent flex justify-center items-center z-10 p-2">
        {#if !sessionId}
            <h1 class="text-2xl text-gray-800">Select or create new session to continue!</h1>
        {:else if sessionId == 'new'}
            <form in:scale={{duration:200, start:0.85}} class="p-10 flex flex-col justify-center items-stretch h-3/4 w-96 bg-white bg-opacity-30 border-2 border-white rounded-md">
                <h1 class="text-2xl text-gray-800 mb-10 text-left">Create New Session</h1>
                <label for="session-name" class="mb-1">Session name</label>
                <input type="text" name="session-name" id="session-name" maxlength="30">
                <label for="user-name" class="mb-1">Username</label>
                <input type="text" name="user-name" id="user-name" maxlength="30" minlength="2">
                <button on:click={() => location.href='/sessions/skjgjhgjhgdjhdg'} class="mt-2.5 bg-red-500 rounded-md shadow-md transition-shadow hover:shadow-lg uppercase py-3 text-white font-medium">Continue</button>
            </form>
        {/if}
    </div>
</content>

<style lang="postcss">
    label {
        @apply text-gray-800 text-left font-normal;
    }

    input {
        @apply w-full mb-5 shadow-inner h-8 rounded-sm px-2 outline-none ring-red-300 ring-1 focus:ring-2;
    }

    a {
        @apply rounded-lg py-1.5 border border-transparent text-sm
        text-gray-700 text-left p-4 box-border hover:bg-opacity-100
        font-semibold no-underline hover:no-underline transition-all 
        duration-200 shadow-sm;
    }

    .create-new {
        @apply transition-all border-red-100 bg-red-50 bg-opacity-50;
    }

    .new-active {
        @apply border-red-300;
    }

    .session-active {
        @apply bg-red-50 bg-opacity-50 border-red-100;
    }

    .session-waiting {
        @apply bg-purple-50 bg-opacity-50 border-purple-100;
    }

    .waiting-selected {
        @apply border-purple-300;
    }

    .active-selected {
        @apply border-red-300;
    }

    #backdrop {
        animation: gradient-fade-in 300ms ease-in forwards;
        animation-delay: 100ms;
    }

    @keyframes gradient-fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
</style>
