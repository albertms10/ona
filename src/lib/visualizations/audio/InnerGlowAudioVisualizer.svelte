<script lang="ts">
  import Glow from "../core/Glow.svelte";
  import InnerGlowVisualizer from "../core/InnerGlowVisualizer.svelte";
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
    [index: string]: unknown;
  }

  let {
    audio,
    glow = 10,
    detail = 50,
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
        <InnerGlowVisualizer values={getValues(detail ?? 50)} />
      </Glow>
    {/snippet}
  </AudioFrequency>
</div>
