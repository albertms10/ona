<script lang="ts">
  import { formatTime } from "./utils";

  interface Props {
    pointA: number;
    pointB: number | null;
  }

  const { pointA, pointB }: Props = $props();
</script>

<div
  class="loop-range"
  title="{formatTime(pointA)}–{pointB ? formatTime(pointB) : ''}"
>
  Loop on
</div>
