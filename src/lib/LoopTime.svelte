<script lang="ts">
  import { formatTime } from "./utils";

  interface Props {
    pointA: number;
    pointB: number | null;
  }

  const { pointA, pointB }: Props = $props();
</script>

<output class="loop-range"
  >Loop: {formatTime(pointA)}–{pointB ? formatTime(pointB) : ""}</output
>
