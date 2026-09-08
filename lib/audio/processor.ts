import { spawn } from "node:child_process";
import type { AudioSegment, OutputSettings } from "@/types/audio";

const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";

export function processAudio(files: string[], segments: AudioSegment[], outputPath: string, settings: OutputSettings, onProgress?: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const filter = segments.map((segment, index) => `[${segment.fileIndex}:a]atrim=start=${segment.startMicroseconds / 1_000_000}:end=${segment.endMicroseconds / 1_000_000},asetpts=PTS-STARTPTS,aresample=${settings.sampleRate},aformat=sample_fmts=s16:channel_layouts=${settings.channels === 1 ? "mono" : "stereo"}[a${index}]`).join(";");
    const concatInputs = segments.map((_, index) => `[a${index}]`).join("");
    const args = ["-y", ...files.flatMap((file) => ["-i", file]), "-filter_complex", `${filter};${concatInputs}concat=n=${segments.length}:v=0:a=1[out]`, "-map", "[out]", "-ar", String(settings.sampleRate), "-ac", String(settings.channels), "-c:a", "libmp3lame", "-b:a", `${settings.bitrate}k`, "-progress", "pipe:1", "-nostats", outputPath];
    const child = spawn(ffmpeg, args);
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdout.on("data", (chunk) => {
      const time = String(chunk).match(/out_time_us=(\d+)/)?.[1];
      if (time && onProgress) onProgress(Math.min(99, Math.max(5, Number(time) / 1_000_000)));
    });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || "Audio processing failed.")));
  });
}
