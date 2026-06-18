<script lang="ts">
  import DeformedCircleVisualizer from "../core/DeformedCircleVisualizer.svelte";
  import Glow from "../core/Glow.svelte";
  import type { Analyzer } from "../core/utils";
  import type {
    AudioFilePlayer,
    WavRecorder,
    WavStreamPlayer,
  } from "../wavtools";
  import AudioFrequency from "./AudioFrequency.svelte";

  interface Props {
    audio: Analyzer | AudioFilePlayer | WavRecorder | WavStreamPlayer | null;
    glow?: number;
    detail?: number;
    analysisType?: "music" | "voice" | "frequency";
    // allow passing through additional visualizer props
    [key: string]: unknown;
  }

  let {
    audio,
    glow = 20,
    detail = 20,
    analysisType = "frequency",
    ...rest
  }: Props = $props();
</script>

<div
  {...rest as Record<string, unknown>}
  style="position: absolute; inset: 0; pointer-events: none;"
>
  <AudioFrequency {audio} {analysisType}>
    {#snippet children({ values, getValues })}
      <Glow {glow}>
        <DeformedCircleVisualizer values={getValues(detail ?? 20)} />
      </Glow>
    {/snippet}
  </AudioFrequency>
</div>
