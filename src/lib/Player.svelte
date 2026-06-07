<script lang="ts">
  import exerciseUrl from "../assets/exercise.mp3";

  let audio: HTMLAudioElement;
  let timelineSection: HTMLElement;
  let currentTime = $state(0);
  let duration = $state(0);
  let paused = $state(true);
  let pointA = $state<number | null>(null);
  let pointB = $state<number | null>(null);
  let draggingLoopPoint = $state<"a" | "b" | null>(null);

  const minLoopDuration = 0.05;

  const loopActive = $derived(
    pointA !== null && pointB !== null && pointB > pointA,
  );

  const loopPending = $derived(pointA !== null && !loopActive);

  const seekValue = $derived(duration ? (currentTime / duration) * 100 : 0);

  const seekProgressStyle = $derived(`--seek-progress: ${seekValue}%;`);

  const highlightStyle = $derived.by(() => {
    if (!duration || pointA === null) {
      return "";
    }

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

  function formatTime(seconds: number) {
    if (!Number.isFinite(seconds)) {
      return "0:00.0";
    }

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const tenth = Math.floor((seconds % 1) * 10);

    return `${mins}:${String(secs).padStart(2, "0")}.${tenth}`;
  }

  async function togglePlayback() {
    if (paused) {
      await audio.play();
      return;
    }

    audio.pause();
  }

  function seekToPercent(value: string) {
    if (!duration) return;

    currentTime = (Number(value) / 100) * duration;
  }

  function jump(seconds: number) {
    currentTime += seconds;
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
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

    pointB = clamp(time, Math.min(duration, pointA + minLoopDuration), duration);
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
    ontimeupdate={handleTimeUpdate}
    preload="metadata"
  >
    <source src={exerciseUrl} type="audio/mpeg" />
  </audio>

  <header class="time-panel">
    <output>{formatTime(currentTime)}</output>
    <div class="loop-status">{loopActive ? "Loop Active" : "Loop Off"}</div>
    <output>{formatTime(duration)}</output>
  </header>

  <section bind:this={timelineSection} class="timeline-section" aria-label="Timeline">
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
    />
  </section>

  <section class="transport" aria-label="Playback controls">
    <button
      class="play"
      aria-label={paused ? "Play" : "Pause"}
      onclick={togglePlayback}
    >
      {paused ? "▶" : "❚❚"}
    </button>
  </section>

  <section class="jump-grid" aria-label="Precise navigation">
    <button onclick={() => jump(-5)}>−5s</button>
    <button onclick={() => jump(-2)}>−2s</button>
    <button onclick={() => jump(-1)}>−1s</button>

    <button onclick={() => jump(1)}>+1s</button>
    <button onclick={() => jump(2)}>+2s</button>
    <button onclick={() => jump(5)}>+5s</button>
  </section>

  <section class="loop-controls" aria-label="A-B loop controls">
    <button onclick={setPointA}>Set A</button>
    <button onclick={setPointB}>Set B</button>
    <button onclick={clearLoop}>Clear</button>
  </section>

  <section class="loop-info">
    <div>
      A:
      <span>{pointA === null ? "—" : formatTime(pointA)}</span>
    </div>

    <div>
      B:
      <span>{pointB === null ? "—" : formatTime(pointB)}</span>
    </div>
  </section>
</div>
