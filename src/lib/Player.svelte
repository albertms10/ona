<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { clamp, formatTime, hashFileToSeed, hashStringToSeed } from "./utils";
  import InnerGlowAudioVisualizer from "./visualizations/audio/InnerGlowAudioVisualizer.svelte";
  import { AudioAnalysis } from "./visualizations/wavtools";

  let audio: HTMLAudioElement;
  let timelineSection: HTMLElement;
  let audioUrl = $state<string | null>(null);
  let clipboardStatus = $state<"unknown" | "valid" | "invalid">("unknown");
  let gradientSeed = $state<number>(Math.floor(Math.random() * 4294967296));
  let objectAudioUrl: string | null = null;
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

  function resetAudioState() {
    currentTime = 0;
    duration = 0;
    paused = true;
    clearLoop();
  }

  async function loadAudioSource(
    source: string,
    seed = hashStringToSeed(source),
  ) {
    audioUrl = source;
    gradientSeed = seed;
    resetAudioState();

    await tick();
    audio.load();

    // Wait for metadata or canplay so duration/currentTime are available,
    // then attempt to autoplay (best-effort; may be blocked by autoplay policies).
    await new Promise<void>((resolve) => {
      if (audio.readyState >= 1) {
        resolve();
        return;
      }

      const onLoaded = () => {
        cleanup();
        resolve();
      };

      const onCanPlay = () => {
        cleanup();
        resolve();
      };

      function cleanup() {
        audio.removeEventListener("loadedmetadata", onLoaded);
        audio.removeEventListener("canplay", onCanPlay);
      }

      audio.addEventListener("loadedmetadata", onLoaded);
      audio.addEventListener("canplay", onCanPlay);
    });

    try {
      await audio.play();
    } catch (err) {
      // Autoplay may be blocked; leave the player paused.
    }
  }

  function revokeObjectAudioUrl() {
    if (objectAudioUrl === null) return;

    URL.revokeObjectURL(objectAudioUrl);
    objectAudioUrl = null;
  }

  async function loadLocalAudio(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    revokeObjectAudioUrl();
    objectAudioUrl = URL.createObjectURL(file);
    await loadAudioSource(objectAudioUrl, await hashFileToSeed(file));
  }

  async function pasteAndLoadFromClipboard() {
    clipboardStatus = "unknown";

    try {
      const text = await navigator.clipboard.readText();

      if (!text) {
        clipboardStatus = "invalid";
        return;
      }

      try {
        const parsed = new URL(text);

        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          // Validate by attempting to load metadata from the URL using a temporary Audio element.
          clipboardStatus = "unknown";

          const testAudio = new Audio();
          testAudio.preload = "metadata";
          testAudio.src = text;

          const success = await new Promise<boolean>((resolve) => {
            let settled = false;

            const onLoaded = () => {
              if (settled) return;
              settled = true;
              cleanup();
              resolve(true);
            };

            const onError = () => {
              if (settled) return;
              settled = true;
              cleanup();
              resolve(false);
            };

            const timeoutId = setTimeout(() => {
              if (settled) return;
              settled = true;
              cleanup();
              resolve(false);
            }, 7000);

            function cleanup() {
              clearTimeout(timeoutId);
              testAudio.removeEventListener("loadedmetadata", onLoaded);
              testAudio.removeEventListener("error", onError);
            }

            testAudio.addEventListener("loadedmetadata", onLoaded);
            testAudio.addEventListener("error", onError);
          });

          if (!success) {
            clipboardStatus = "invalid";
            return;
          }

          clipboardStatus = "valid";
          revokeObjectAudioUrl();
          await loadAudioSource(text, hashStringToSeed(text));
          // update query param so the URL can be shared / revisited
          try {
            const url = new URL(window.location.href);
            url.searchParams.set("a", text);
            history.replaceState(null, "", url.toString());
          } catch (e) {
            // ignore
          }
          return;
        }

        clipboardStatus = "invalid";
      } catch (err) {
        clipboardStatus = "invalid";
      }
    } catch (err) {
      clipboardStatus = "invalid";
    }
  }

  // Load a small example audio URL (validates metadata first)
  async function loadExampleAudio() {
    clipboardStatus = "unknown";

    const example = "https://samplelib.com/mp3/sample-6s.mp3";

    try {
      const testAudio = new Audio();
      testAudio.preload = "metadata";
      testAudio.src = example;

      const success = await new Promise<boolean>((resolve) => {
        let settled = false;

        const onLoaded = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(true);
        };

        const onError = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(false);
        };

        const timeoutId = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(false);
        }, 7000);

        function cleanup() {
          clearTimeout(timeoutId);
          testAudio.removeEventListener("loadedmetadata", onLoaded);
          testAudio.removeEventListener("error", onError);
        }

        testAudio.addEventListener("loadedmetadata", onLoaded);
        testAudio.addEventListener("error", onError);
      });

      if (!success) {
        clipboardStatus = "invalid";
        return;
      }

      clipboardStatus = "valid";
      revokeObjectAudioUrl();
      await loadAudioSource(example, hashStringToSeed(example));

      // update query param so the example can be linked
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("a", example);
        history.replaceState(null, "", url.toString());
      } catch (e) {
        // ignore
      }
    } catch (err) {
      clipboardStatus = "invalid";
    }
  }

  // On mount, if there's an `a` query param, attempt to load it.
  onMount(async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const a = params.get("a");

      if (!a) return;

      // Validate URL format
      try {
        const parsed = new URL(a);

        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
      } catch (err) {
        return;
      }

      // Test metadata load before committing
      const testAudio = new Audio();
      testAudio.preload = "metadata";
      testAudio.src = a;

      const success = await new Promise<boolean>((resolve) => {
        let settled = false;

        const onLoaded = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(true);
        };

        const onError = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(false);
        };

        const timeoutId = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(false);
        }, 7000);

        function cleanup() {
          clearTimeout(timeoutId);
          testAudio.removeEventListener("loadedmetadata", onLoaded);
          testAudio.removeEventListener("error", onError);
        }

        testAudio.addEventListener("loadedmetadata", onLoaded);
        testAudio.addEventListener("error", onError);
      });

      if (!success) return;

      revokeObjectAudioUrl();
      await loadAudioSource(a, hashStringToSeed(a));
    } catch (err) {
      // ignore
    }
  });

  function seekToPercent(value: string) {
    if (!duration) return;

    currentTime = (Number(value) / 100) * duration;
  }

  // Mobile-first pointer-based scrub (drag) support for the seek bar
  let draggingSeek = false;
  let audioAnalyzer: AudioAnalysis | null = $state(null);

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

  $effect(() => {
    if (!audio) {
      audioAnalyzer = null;
      return;
    }

    let created = false;
    try {
      audioAnalyzer = new AudioAnalysis(audio);
      created = true;

      if (audioAnalyzer && audioAnalyzer.resumeIfSuspended) {
        void audioAnalyzer.resumeIfSuspended();
      }
    } catch (e) {
      audioAnalyzer = null;
    }

    return () => {
      try {
        if (
          created &&
          audioAnalyzer &&
          audioAnalyzer.context &&
          audioAnalyzer.context.close
        ) {
          void audioAnalyzer.context.close();
        }
      } catch (e) {
        // ignore
      }

      audioAnalyzer = null;
    };
  });

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

  onDestroy(() => {
    revokeObjectAudioUrl();
    try {
      if (
        audioAnalyzer &&
        audioAnalyzer.context &&
        audioAnalyzer.context.close
      ) {
        void audioAnalyzer.context.close();
      }
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
    <InnerGlowAudioVisualizer
      class="timeline-visualizer"
      aria-hidden="true"
      audio={audioAnalyzer}
      glow={18}
      detail={64}
    />
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
      <div class="timeline-empty-source">
        <label class="file-picker">
          <!-- https://feathericons.dev/?search=upload&iconset=feather -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            class="main-grid-item-icon"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>

          File
          <input type="file" accept="audio/*" onchange={loadLocalAudio} />
        </label>

        <div class="url-picker" class:invalid={clipboardStatus === "invalid"}>
          <button
            type="button"
            class="clipboard-button"
            onclick={pasteAndLoadFromClipboard}
          >
            <!-- https://feathericons.dev/?search=clipboard&iconset=feather -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              class="main-grid-item-icon"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            >
              <path
                d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
              />
              <rect height="4" rx="1" ry="1" width="8" x="8" y="2" />
            </svg>

            Paste URL
          </button>
          <button
            type="button"
            class="clipboard-button"
            onclick={loadExampleAudio}
            title="Load example audio"
          >
            <!-- example icon: music -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              class="main-grid-item-icon"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>

            Load Example
          </button>
        </div>
      </div>
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
