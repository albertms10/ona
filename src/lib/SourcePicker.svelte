<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { hashFileToSeed, hashStringToSeed } from "./utils";

  interface Props {
    audio: HTMLAudioElement;
    resetAudioState: (source: string, seed: number) => void;
  }

  const { audio, resetAudioState }: Props = $props();

  let clipboardStatus = $state<"unknown" | "valid" | "invalid">("unknown");
  let objectAudioUrl: string | null = null;

  async function loadAudioSource(
    source: string,
    seed = hashStringToSeed(source),
  ) {
    resetAudioState(source, seed);

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
    if (!objectAudioUrl) return;
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

      revokeObjectAudioUrl();
      await loadAudioSource(a, hashStringToSeed(a));
    } catch (err) {
      // ignore
    }
  });

  onDestroy(revokeObjectAudioUrl);
</script>

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
