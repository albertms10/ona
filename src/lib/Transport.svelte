<script lang="ts">
  interface Props {
    audioUrl: string | null;
    paused: boolean;
    togglePlayback: () => Promise<void>;
    loopActive: boolean;
    loopPending: boolean;
    cycleLoop: () => void;
    jump: (seconds: number) => void;
    speed: number;
    cycleSpeed: () => void;
  }

  const {
    audioUrl,
    jump,
    paused,
    togglePlayback,
    loopActive,
    loopPending,
    cycleLoop,
    speed,
    cycleSpeed,
  }: Props = $props();
</script>

<section class="transport" aria-label="Playback controls">
  <div class="transport-left">
    <button
      class="transport-button pill"
      onclick={() => jump(-2)}
      aria-label="Jump back"
      disabled={!audioUrl}
    >
      <!-- https://feathericons.dev/?search=rotate-ccw&iconset=feather -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        class="main-grid-item-icon"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
      >
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
    </button>
  </div>

  <div class="transport-center">
    <button
      class="transport-button play"
      aria-label={paused ? "Play" : "Pause"}
      onclick={togglePlayback}
      disabled={!audioUrl}
    >
      {#if paused}
        <!-- https://feathericons.dev/?search=play&iconset=feather -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          class="main-grid-item-icon"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
        >
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      {:else}
        <!-- https://feathericons.dev/?search=pause&iconset=feather -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          class="main-grid-item-icon"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
        >
          <rect height="16" width="4" x="6" y="4" />
          <rect height="16" width="4" x="14" y="4" />
        </svg>
      {/if}
    </button>

    <button
      class="transport-button pill loop-toggle"
      class:active={loopActive}
      class:pending={loopPending}
      aria-label={loopActive
        ? "Clear loop"
        : loopPending
          ? "Set loop end (B)"
          : "Set loop start (A)"}
      onclick={cycleLoop}
      disabled={!audioUrl}
    >
      <!-- https://feathericons.dev/?search=repeat&iconset=feather -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        class="main-grid-item-icon"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
      >
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    </button>
  </div>

  <div class="transport-right">
    <button
      class="transport-button pill speed-toggle"
      aria-label={`Playback speed ${speed}x`}
      onclick={cycleSpeed}
      disabled={!audioUrl}
    >
      {speed}x
    </button>

    <button
      class="transport-button pill"
      onclick={() => jump(2)}
      aria-label="Jump forward"
      disabled={!audioUrl}
    >
      <!-- https://feathericons.dev/?search=rotate-cw&iconset=feather -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        class="main-grid-item-icon"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
      >
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
    </button>
  </div>
</section>
