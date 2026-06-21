<script lang="ts">
  import LoopTime from "./LoopTime.svelte";
  import SourcePicker from "./SourcePicker.svelte";
  import TimelineLoop from "./TimelineLoop.svelte";
  import TimelineTime from "./TimelineTime.svelte";
  import Transport from "./Transport.svelte";
  import { clamp } from "./utils";
  import Waveform from "./Waveform.svelte";

  let audio = $state(new Audio());
  let timelineSection = $state<HTMLElement | null>(null);
  let audioUrl = $state<string | null>(null);
  let gradientSeed = $state<number>(Math.floor(Math.random() * 4294967296));
  let currentTime = $state(0);
  let duration = $state(0);
  let paused = $state(true);
  let pointA = $state<number | null>(null);
  let pointB = $state<number | null>(null);
  let draggingLoopPoint = $state<"a" | "b" | null>(null);
  let speed = $state(1);

  const params = new URLSearchParams(window.location.search);
  const showWaveform = params.get("w") !== null;

  function cycleSpeed() {
    const speeds = [1, 0.25, 0.5, 0.75];
    const idx = speeds.indexOf(speed);
    const next = speeds[(idx + 1) % speeds.length];
    speed = next;
  }

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
    if (!duration || !timelineSection) return;
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
    if (!timelineSection) return 0;
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
    if (!draggingLoopPoint) return;
    event.preventDefault();
    moveLoopPoint(draggingLoopPoint, event);
  }

  function stopLoopPointDrag(event: PointerEvent) {
    if (!draggingLoopPoint) return;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    draggingLoopPoint = null;
  }

  function setPointA() {
    pointA = currentTime;
    if (pointB !== null && pointB <= pointA) pointB = null;
  }

  function setPointB() {
    pointB = currentTime;
    if (pointA !== null && pointB <= pointA) pointB = null;
  }

  function clearLoop() {
    pointA = null;
    pointB = null;
  }

  function cycleLoop() {
    if (pointA === null) return setPointA();
    if (pointB === null) return setPointB();
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

  $effect(() => {
    // Apply playback speed and enable pitch preservation where supported
    if (!audio) return;

    try {
      (audio as any).playbackRate = speed;
      (audio as any).preservesPitch = true;
      (audio as any).webkitPreservesPitch = true;
      (audio as any).mozPreservesPitch = true;
    } catch (e) {
      // ignore
    }
  });
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
      {#if showWaveform}
        <Waveform
          {audioUrl}
          {currentTime}
          {duration}
          {timelineSection}
          {timeFromPointer}
        />
      {/if}
      <TimelineTime {currentTime} {duration} />
    {/if}

    <TimelineLoop
      {pointA}
      {pointB}
      {duration}
      {currentTime}
      {loopActive}
      {loopPending}
      {startLoopPointDrag}
      {handleLoopPointDrag}
      {stopLoopPointDrag}
    />

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
      <LoopTime {pointA} {pointB} />
    {/if}

    {#if !audioUrl}
      <SourcePicker {audio} {resetAudioState} />
    {/if}
  </section>

  <Transport
    {audioUrl}
    {jump}
    {paused}
    {togglePlayback}
    {loopActive}
    {loopPending}
    {cycleLoop}
    {speed}
    {cycleSpeed}
  />
</div>
