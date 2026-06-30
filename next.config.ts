import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@huggingface/transformers",
    "onnxruntime-node",
    "sharp",
  ],
  // Whisper runs in the browser (onnxruntime-web). Exclude ML/native binaries
  // from serverless traces — they exceed Vercel's 250 MB function limit.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/onnxruntime-node/**",
      "node_modules/onnxruntime-web/**",
      "node_modules/@huggingface/transformers/**",
      "node_modules/@img/sharp-libvips-linux-x64/**",
      "node_modules/@img/sharp-libvips-linuxmusl-x64/**",
      "node_modules/@img/sharp-libvips-darwin-x64/**",
      "node_modules/@img/sharp-libvips-darwin-arm64/**",
      "node_modules/@img/sharp-libvips-win32-x64/**",
    ],
    "/audio-transcriber": [
      "node_modules/onnxruntime-node/**",
      "node_modules/onnxruntime-web/**",
      "node_modules/@huggingface/transformers/**",
    ],
    "/screen-recorder": [
      "node_modules/@ffmpeg/**",
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

export default nextConfig;
