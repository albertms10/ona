<script lang="ts">
  import type { Snippet } from "svelte";
  import { normalizeArray, raf, type Analyzer } from "../core/utils";
  import { AudioFilePlayer, WavRecorder, WavStreamPlayer } from "../wavtools";

  interface Props {
    audio: Analyzer | AudioFilePlayer | WavRecorder | WavStreamPlayer | null;
    analysisType?: "music" | "voice" | "frequency";
    minDecibels?: number;
    maxDecibels?: number;
    children?: Snippet<
      [{ values: Float32Array; getValues: (detail: number) => number[] }]
    >;
  }

  let {
    audio,
    analysisType = "frequency",
    minDecibels = -100,
    maxDecibels = -30,
    children,
  }: Props = $props();

  let values: Float32Array = $state(new Float32Array([0]));

  // Update frequency values every render frame (raf handles mount/unmount)
  raf(() => {
    if (!audio) {
      values = new Float32Array([0]);
      return;
    }

    if (audio instanceof WavRecorder && !audio.recording) {
      values = new Float32Array([0]);
      return;
    }

    values = audio.getFrequencies(
      analysisType,
      minDecibels,
      maxDecibels,
    ).values;
  });

  const getValues = $derived((detail: number) =>
    normalizeArray(values as unknown as number[], detail),
  );
</script>

{@render children?.({ values, getValues })}
