<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  interface Props {
    audioUrl: string | null;
    currentTime: number;
    duration: number | null;
    timelineSection: HTMLElement | null;
    timeFromPointer: (event: PointerEvent) => number;
  }

  let {
    audioUrl,
    currentTime,
    duration,
    timelineSection,
    timeFromPointer,
  }: Props = $props();

  let waveformCanvas = $state<HTMLCanvasElement | null>(null);
  let waveformPeaks: Float32Array | null = null;
  const waveformBuckets = 1024;
  let waveformPointerDown = false;
  let resizeObserver: ResizeObserver | null = null;

  // Compute waveform when a source is set
  $effect(() => {
    if (audioUrl) {
      void computeWaveformPeaks(audioUrl);
    } else {
      waveformPeaks = null;
    }
  });

  // Redraw when we have both canvas and peaks
  $effect(() => {
    if (waveformCanvas && waveformPeaks) drawWaveform();
  });

  onMount(() => {
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => drawWaveform());
      if (timelineSection) resizeObserver.observe(timelineSection);
    }
  });

  onDestroy(() => {
    if (resizeObserver && timelineSection)
      resizeObserver.unobserve(timelineSection);
    resizeObserver = null;
  });

  async function computeWaveformPeaks(src: string | null) {
    waveformPeaks = null;

    if (!src) return;

    try {
      const resp = await fetch(src);
      const arrayBuffer = await resp.arrayBuffer();

      const audioCtx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      // Mix down to mono and compute max absolute per bucket
      const len = audioBuffer.length;
      const channels = audioBuffer.numberOfChannels;
      const mixed = new Float32Array(len);

      for (let ch = 0; ch < channels; ch++) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          mixed[i] += data[i] / channels;
        }
      }

      const peaks = new Float32Array(waveformBuckets);
      const samplesPerBucket = Math.max(1, Math.floor(len / waveformBuckets));

      for (let i = 0; i < waveformBuckets; i++) {
        let start = i * samplesPerBucket;
        let end = Math.min(len, start + samplesPerBucket);
        let max = 0;

        for (let j = start; j < end; j++) {
          const v = Math.abs(mixed[j]);
          if (v > max) max = v;
        }

        peaks[i] = max;
      }

      waveformPeaks = peaks;
      drawWaveform();
    } catch (err) {
      waveformPeaks = null;
    }
  }

  function drawWaveform() {
    if (!waveformCanvas || !waveformPeaks) return;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(waveformCanvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(waveformCanvas.clientHeight * dpr));
    waveformCanvas.width = width;
    waveformCanvas.height = height;

    const ctx = waveformCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const half = height / 2;
    const step = width / waveformPeaks.length;

    // derive accent color from CSS variables (fallback to --accent)
    const docStyle = getComputedStyle(document.documentElement);
    const accentRaw =
      docStyle.getPropertyValue("--gradient-a") ||
      docStyle.getPropertyValue("--accent");
    const accent = (accentRaw || "#60a5fa").trim();

    // Build a single closed polygon: top profile left->right, bottom profile right->left
    ctx.beginPath();
    ctx.moveTo(0, half);

    for (let i = 0; i < waveformPeaks.length; i++) {
      const x = i * step;
      const v = waveformPeaks[i];
      const y = half - v * half;
      ctx.lineTo(x, y);
    }

    // ensure we close along baseline to the right edge before drawing bottom
    ctx.lineTo(width, half);

    for (let i = waveformPeaks.length - 1; i >= 0; i--) {
      const x = i * step;
      const v = waveformPeaks[i];
      const y = half + v * half;
      ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function handleWaveformPointerDown(event: PointerEvent) {
    if (!duration) return;
    waveformPointerDown = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    currentTime = timeFromPointer(event);
  }

  function handleWaveformPointerMove(event: PointerEvent) {
    if (!waveformPointerDown) return;
    currentTime = timeFromPointer(event);
  }

  function handleWaveformPointerUp(event: PointerEvent) {
    if (!waveformPointerDown) return;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    waveformPointerDown = false;
  }
</script>

<canvas
  bind:this={waveformCanvas}
  class="timeline-waveform"
  onpointerdown={handleWaveformPointerDown}
  onpointermove={handleWaveformPointerMove}
  onpointerup={handleWaveformPointerUp}
  onpointercancel={handleWaveformPointerUp}
  aria-hidden={audioUrl ? "false" : "true"}
>
</canvas>
