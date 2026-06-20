<script lang="ts">
  interface Props {
    pointA: number | null;
    pointB: number | null;
    duration: number | null;
    currentTime: number;
    loopActive: boolean;
    loopPending: boolean;
    startLoopPointDrag: (point: "a" | "b", event: PointerEvent) => void;
    handleLoopPointDrag: (event: PointerEvent) => void;
    stopLoopPointDrag: (event: PointerEvent) => void;
  }

  const {
    pointA,
    pointB,
    duration,
    currentTime,
    loopActive,
    loopPending,
    startLoopPointDrag,
    handleLoopPointDrag,
    stopLoopPointDrag,
  }: Props = $props();

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
</script>

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
