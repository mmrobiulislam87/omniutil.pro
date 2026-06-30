"use client";

import { useCallback, useState } from "react";
import { Copy, Download, Mic, Trash2 } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { ToolErrorBanner } from "@/components/ui/ToolStateWrapper";
import { downloadBlob } from "@/lib/format";
import {
  decodeAudioFileToMono16k,
  transcribeAudio,
} from "@/utils/audioTranscriber";

export function AudioTranscriber() {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setTranscript("");
    setError(null);
  }, []);

  const runTranscribe = useCallback(async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    setProgress(0);
    setStatus("Decoding audio…");

    try {
      const audio = await decodeAudioFileToMono16k(file);
      const text = await transcribeAudio(audio, (message, percent) => {
        setStatus(message);
        if (percent != null) setProgress(percent);
      });
      setTranscript(text);
      setStatus("Transcription complete.");
      setProgress(100);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Transcription failed.",
      );
    } finally {
      setProcessing(false);
    }
  }, [file]);

  const clearAll = useCallback(() => {
    setFile(null);
    setTranscript("");
    setError(null);
    setProgress(0);
    setStatus("");
  }, []);

  const copyText = useCallback(async () => {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript);
  }, [transcript]);

  const downloadText = useCallback(() => {
    if (!transcript) return;
    const base = file?.name.replace(/\.[^.]+$/, "") ?? "transcript";
    downloadBlob(
      new Blob([transcript], { type: "text/plain;charset=utf-8" }),
      `${base}-transcript.txt`,
    );
  }, [file, transcript]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4 text-sm text-gray-300">
        <p className="flex items-center gap-2 font-medium text-fuchsia-300">
          <Mic className="h-4 w-4" />
          Whisper WASM · Transformers.js
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Transcribe audio to text entirely in your browser using OpenAI
          Whisper (tiny) via ONNX Runtime Web. First run downloads the model
          (~40 MB); audio never leaves your device.
        </p>
      </div>

      {!file && (
        <FileDropzone
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac"
          disabled={processing}
          onFiles={handleFiles}
          label="Drop audio file here or click to browse"
          hint="MP3, WAV, M4A, OGG, WebM · processed locally"
        />
      )}

      {file && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-4">
          <p className="truncate text-sm text-gray-200">{file.name}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={runTranscribe}
              disabled={processing}
            >
              <Mic className="h-4 w-4" />
              {processing ? "Transcribing…" : "Transcribe"}
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={processing}>
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {processing && (
        <div className="space-y-2 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-4">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{status}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-fuchsia-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && <ToolErrorBanner message={error} />}

      {transcript && (
        <div className="space-y-3">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Transcript
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={copyText}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button size="sm" onClick={downloadText}>
                <Download className="h-4 w-4" />
                Download TXT
              </Button>
            </div>
          </div>
          <textarea
            readOnly
            value={transcript}
            rows={10}
            className="w-full resize-y rounded-xl border border-gray-800 bg-[#0B0F19] p-4 text-sm leading-relaxed text-gray-200 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
