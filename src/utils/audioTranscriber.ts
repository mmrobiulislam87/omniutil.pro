export async function decodeAudioFileToMono16k(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));

  const { length, sampleRate, numberOfChannels } = decoded;
  let samples: Float32Array;

  if (numberOfChannels === 1) {
    samples = decoded.getChannelData(0).slice();
  } else {
    samples = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let c = 0; c < numberOfChannels; c++) {
        sum += decoded.getChannelData(c)[i];
      }
      samples[i] = sum / numberOfChannels;
    }
  }

  if (sampleRate !== 16000) {
    const ratio = sampleRate / 16000;
    const newLength = Math.round(samples.length / ratio);
    const resampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const pos = i * ratio;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const a = samples[idx] ?? 0;
      const b = samples[idx + 1] ?? a;
      resampled[i] = a + (b - a) * frac;
    }
    await audioContext.close();
    return resampled;
  }

  await audioContext.close();
  return samples;
}

type ProgressCallback = (message: string, percent?: number) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriberPromise: Promise<any> | null = null;

export async function transcribeAudio(
  audio: Float32Array,
  onProgress?: ProgressCallback,
): Promise<string> {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.useBrowserCache = true;
  env.allowLocalModels = false;

  if (!transcriberPromise) {
    onProgress?.("Downloading Whisper model (first run only)…", 5);
    transcriberPromise = pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny",
      {
        progress_callback: (data: {
          status?: string;
          progress?: number;
          file?: string;
        }) => {
          if (data.status === "progress" && data.progress != null) {
            onProgress?.(
              `Loading model: ${data.file ?? "weights"}…`,
              Math.round(data.progress),
            );
          }
        },
      },
    );
  }

  const transcriber = await transcriberPromise;
  onProgress?.("Transcribing audio…", 90);

  const result = await transcriber(audio, {
    sampling_rate: 16000,
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  const text =
    typeof result === "object" && result !== null && "text" in result
      ? String((result as { text: string }).text)
      : String(result);

  onProgress?.("Done", 100);
  return text.trim();
}
