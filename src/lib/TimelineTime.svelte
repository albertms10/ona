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
    <span>{formatTime(currentTime)}</span>
  </div>
  <span>{formatTime(duration)}</span>
</div>
