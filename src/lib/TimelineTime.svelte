<script lang="ts">
  import { formatTime } from "./utils";

  interface Props {
    currentTime: number;
    duration: number;
  }

  const { currentTime, duration }: Props = $props();
</script>

<div class="timeline-time" aria-hidden="true">
  <div>
    <output>{formatTime(currentTime)}</output>
  </div>
  <output>{formatTime(duration)}</output>
</div>
