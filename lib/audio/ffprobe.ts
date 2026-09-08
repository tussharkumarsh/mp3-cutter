import { spawn } from "node:child_process";
import type { AudioMetadata } from "@/types/audio";

const command = process.env.FFPROBE_PATH || "ffprobe";

export function probeAudio(filePath: string): Promise<AudioMetadata> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=duration,sample_rate,channels,codec_name,bit_rate:format=format_name,duration", "-of", "json", filePath]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr || "Unable to inspect audio file."));
      try {
        const data = JSON.parse(stdout) as { streams?: Array<Record<string, string>>; format?: Record<string, string> };
        const stream = data.streams?.[0];
        const duration = Number(stream?.duration || data.format?.duration);
        if (!stream || !Number.isFinite(duration)) return reject(new Error("No readable audio stream found."));
        resolve({ durationMicroseconds: Math.round(duration * 1_000_000), sampleRate: Number(stream.sample_rate || 0), channels: Number(stream.channels || 0), codec: stream.codec_name || "unknown", bitrate: stream.bit_rate ? Number(stream.bit_rate) : null, format: data.format?.format_name || "unknown" });
      } catch { reject(new Error("Unable to read audio metadata.")); }
    });
  });
}
