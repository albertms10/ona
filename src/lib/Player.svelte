<script lang="ts">
  import SourcePicker from "./SourcePicker.svelte";
  import { clamp, formatTime } from "./utils";

  let audio: HTMLAudioElement = $state(new Audio());
  let timelineSection: HTMLElement;
  let audioUrl = $state<string | null>(null);
  let gradientSeed = $state<number>(Math.floor(Math.random() * 4294967296));
  let currentTime = $state(0);
  let duration = $state(0);
  let paused = $state(true);
  let pointA = $state<number | null>(null);
  let pointB = $state<number | null>(null);
  let draggingLoopPoint = $state<"a" | "b" | null>(null);

  const minLoopDuration = 1;

  const loopActive = $derived(
    pointA !== null && pointB !== null && pointB > pointA,
  );

  const loopPending = $derived(pointA !== null && !loopActive);

  const seekValue = $derived(duration ? (currentTime / duration) * 100 : 0);

  const seekProgressStyle = $derived.by(() => {
    const baseHue = gradientSeed % 360;
    const secondHue = (baseHue + 42 + ((gradientSeed >>> 8) % 72)) % 360;
    const thirdHue = (baseHue + 138 + ((gradientSeed >>> 16) % 88)) % 360;
    const angle = 118 + (gradientSeed % 54);
    const glowAX = 12 + ((gradientSeed >>> 3) % 26);
    const glowAY = 12 + ((gradientSeed >>> 9) % 32);
    const glowBX = 62 + ((gradientSeed >>> 15) % 26);
    const glowBY = 18 + ((gradientSeed >>> 21) % 42);
    const useThreeStops = (gradientSeed & 1) === 1;

    return [
      `--seek-progress: ${seekValue}%`,
      `--seek-fill: ${seekValue}%`,
      `--gradient-angle: ${angle}deg`,
      `--gradient-a: oklch(69% 0.18 ${baseHue})`,
      `--gradient-b: oklch(72% 0.17 ${secondHue})`,
      `--gradient-c: oklch(67% 0.19 ${thirdHue})`,
      `--gradient-mid-stop: ${useThreeStops ? "var(--gradient-b)" : "var(--gradient-a)"}`,
      `--glow-a-x: ${glowAX}%`,
      `--glow-a-y: ${glowAY}%`,
      `--glow-b-x: ${glowBX}%`,
      `--glow-b-y: ${glowBY}%`,
    ].join("; ");
  });

  const highlightStyle = $derived.by(() => {
    if (!duration || pointA === null) return "";

    const rangeEnd = loopActive && pointB !== null ? pointB : currentTime;
    const start = Math.min(pointA, rangeEnd);
    const end = Math.max(pointA, rangeEnd);
    const range = end - start;
    const left = (start / duration) * 100;
    const width = (range / duration) * 100;
    const markerA = range ? ((pointA - start) / range) * 100 : 0;
    const markerEnd = range ? ((rangeEnd - start) / range) * 100 : 100;

    return `--loop-left: ${left}%; --loop-width: ${width}%; --loop-a: ${markerA}%; --loop-end: ${markerEnd}%;`;
  });

  async function togglePlayback() {
    if (paused) {
      await audio.play();
      return;
    }

    audio.pause();
  }

  function resetAudioState(source: string, seed: number) {
    audioUrl = source;
    gradientSeed = seed;
    currentTime = 0;
    duration = 0;
    paused = true;
    clearLoop();
  }

  function seekToPercent(value: string) {
    if (!duration) return;

    currentTime = (Number(value) / 100) * duration;
  }

  // Mobile-first pointer-based scrub (drag) support for the seek bar
  let draggingSeek = false;

  function updateSeekFromPointer(event: PointerEvent) {
    if (!duration) return;
    const rect = timelineSection.getBoundingClientRect();
    const percent = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    currentTime = percent * duration;
  }

  function startSeekDrag(event: PointerEvent) {
    if (!duration) return;
    event.preventDefault();
    draggingSeek = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    updateSeekFromPointer(event);
  }

  function handleSeekDrag(event: PointerEvent) {
    if (!draggingSeek) return;
    event.preventDefault();
    updateSeekFromPointer(event);
  }

  function stopSeekDrag(event: PointerEvent) {
    if (!draggingSeek) return;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    draggingSeek = false;
  }

  function jump(seconds: number) {
    currentTime += seconds;
  }

  function timeFromPointer(event: PointerEvent) {
    const rect = timelineSection.getBoundingClientRect();
    const percent = clamp((event.clientX - rect.left) / rect.width, 0, 1);

    return percent * duration;
  }

  function moveLoopPoint(point: "a" | "b", event: PointerEvent) {
    if (!duration) return;

    const time = timeFromPointer(event);

    if (point === "a") {
      pointA =
        pointB === null
          ? time
          : clamp(time, 0, Math.max(0, pointB - minLoopDuration));
      return;
    }

    if (pointA === null) {
      pointB = time;
      return;
    }

    pointB = clamp(
      time,
      Math.min(duration, pointA + minLoopDuration),
      duration,
    );
  }

  function startLoopPointDrag(point: "a" | "b", event: PointerEvent) {
    if (!duration) return;

    event.preventDefault();
    event.stopPropagation();

    draggingLoopPoint = point;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    moveLoopPoint(point, event);
  }

  function handleLoopPointDrag(event: PointerEvent) {
    if (draggingLoopPoint === null) return;

    event.preventDefault();
    moveLoopPoint(draggingLoopPoint, event);
  }

  function stopLoopPointDrag(event: PointerEvent) {
    if (draggingLoopPoint === null) return;

    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    draggingLoopPoint = null;
  }

  function setPointA() {
    pointA = currentTime;

    if (pointB !== null && pointB <= pointA) {
      pointB = null;
    }
  }

  function setPointB() {
    pointB = currentTime;

    if (pointA !== null && pointB <= pointA) {
      pointB = null;
    }
  }

  function clearLoop() {
    pointA = null;
    pointB = null;
  }

  function cycleLoop() {
    if (pointA === null) {
      setPointA();
      return;
    }

    if (pointB === null) {
      setPointB();
      return;
    }

    clearLoop();
  }

  function handleTimeUpdate() {
    if (
      loopActive &&
      pointA !== null &&
      pointB !== null &&
      currentTime >= pointB
    ) {
      currentTime = pointA;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (
      event.target instanceof HTMLElement &&
      event.target.matches("button, input, textarea")
    ) {
      return;
    }

    switch (event.key) {
      case " ":
        event.preventDefault();
        void togglePlayback();
        break;

      case "ArrowLeft":
        jump(event.shiftKey ? -5 : -1);
        break;

      case "ArrowRight":
        jump(event.shiftKey ? 5 : 1);
        break;

      case "a":
      case "A":
        setPointA();
        break;

      case "b":
      case "B":
        setPointB();
        break;

      case "Escape":
        clearLoop();
        break;
    }
  }
</script>

<svelte:document onkeydown={handleKeydown} />

<div class="player">
  <audio
    bind:this={audio}
    bind:currentTime
    bind:duration
    bind:paused
    src={audioUrl ?? undefined}
    ontimeupdate={handleTimeUpdate}
    preload="metadata"
  ></audio>

  <section
    bind:this={timelineSection}
    class="timeline-section"
    aria-label="Timeline"
  >
    {#if audioUrl}
      <div class="timeline-time" aria-hidden="true">
        <div>
          <output>{formatTime(currentTime)}</output>
        </div>
        <output>{formatTime(duration)}</output>
      </div>
    {/if}

    <div
      class:active={loopActive}
      class:pending={loopPending}
      class="timeline-highlight"
      style={highlightStyle}
    >
      {#if pointA !== null}
        <button
          class="loop-handle loop-handle-a"
          type="button"
          aria-label="Drag loop start"
          title="Drag loop start"
          onpointerdown={(event) => startLoopPointDrag("a", event)}
          onpointermove={handleLoopPointDrag}
          onpointerup={stopLoopPointDrag}
          onpointercancel={stopLoopPointDrag}
        >
          A
        </button>
      {/if}

      {#if loopActive}
        <button
          class="loop-handle loop-handle-b"
          type="button"
          aria-label="Drag loop end"
          title="Drag loop end"
          onpointerdown={(event) => startLoopPointDrag("b", event)}
          onpointermove={handleLoopPointDrag}
          onpointerup={stopLoopPointDrag}
          onpointercancel={stopLoopPointDrag}
        >
          B
        </button>
      {:else if loopPending}
        <span class="loop-pending-end" aria-hidden="true"></span>
      {/if}
    </div>

    <input
      class="seek"
      type="range"
      min="0"
      max="100"
      value={seekValue}
      step="0.01"
      style={seekProgressStyle}
      aria-label="Audio position"
      oninput={(event) => seekToPercent(event.currentTarget.value)}
      onpointerdown={startSeekDrag}
      onpointermove={handleSeekDrag}
      onpointerup={stopSeekDrag}
      onpointercancel={stopSeekDrag}
    />

    {#if pointA !== null}
      <output class="loop-range"
        >Loop: {formatTime(pointA)}–{pointB ? formatTime(pointB) : ""}</output
      >
    {/if}

    {#if !audioUrl}
      <SourcePicker {audio} {resetAudioState} />
    {/if}
  </section>

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
</div>
