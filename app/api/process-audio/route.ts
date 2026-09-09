import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import os from "node:os";
import Busboy from "busboy";
import { NextResponse } from "next/server";
import { probeAudio } from "@/lib/audio/ffprobe";
import { processAudio } from "@/lib/audio/processor";
import { sanitizeOutputName } from "@/lib/validation";
import type { AudioSegment, OutputSettings } from "@/types/audio";

export const runtime = "nodejs";
export const maxDuration = 300;
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

async function readMultipart(request: Request, workDir: string, maxBytes: number) {
  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data")) throw new Error("Expected a multipart audio upload.");
  const fields: Record<string, string> = {};
  const files: Array<{ name: string; path: string; size: number } | undefined> = [];
  const writes: Promise<void>[] = [];
  let fileIndex = 0;
  await new Promise<void>((resolve, reject) => {
    const parser = Busboy({ headers: { "content-type": contentType }, limits: { files: 50, fileSize: maxBytes } });
    parser.on("field", (name, value) => { fields[name] = value; });
    parser.on("file", (name, stream, info) => {
      if (name !== "files") { stream.resume(); return; }
      const currentIndex = fileIndex++;
      const filePath = path.join(workDir, `input-${currentIndex}`);
      let size = 0;
      stream.on("data", (chunk: Buffer) => { size += chunk.length; });
      stream.on("limit", () => reject(new Error(`${info.filename} exceeds the maximum file size.`)));
      writes.push(pipeline(stream, createWriteStream(filePath)).then(() => { files[currentIndex] = { name: info.filename, path: filePath, size }; }));
    });
    parser.on("error", reject);
    parser.on("finish", () => { Promise.all(writes).then(() => resolve()).catch(reject); });
    if (!request.body) return reject(new Error("The upload body is empty."));
    Readable.fromWeb(request.body as never).pipe(parser);
  });
  return { fields, files: files.filter((file): file is { name: string; path: string; size: number } => Boolean(file)) };
}

export async function POST(request: Request) {
  const workDir = path.join(os.tmpdir(), `precision-audio-${crypto.randomUUID()}`);
  try {
    const maxBytes = Number(process.env.MAX_FILE_SIZE_MB || 200) * 1024 * 1024;
    await mkdir(workDir, { recursive: true });
    const upload = await readMultipart(request, workDir, maxBytes);
    const segments = JSON.parse(upload.fields.segments || "[]") as AudioSegment[];
    const settings = JSON.parse(upload.fields.settings || "{}") as OutputSettings;
    if (!upload.files.length || !segments.length || upload.files.length > 50) return NextResponse.json({ error: "Add at least one audio file and segment." }, { status: 400, headers: corsHeaders });
    const paths: string[] = upload.files.map((file) => file.path);
    const metadata = [];
    for (const filePath of paths) {
      const file = await stat(filePath);
      if (file.size > maxBytes) return NextResponse.json({ error: "A file exceeds the maximum file size." }, { status: 413, headers: corsHeaders });
      metadata.push(await probeAudio(filePath));
    }
    for (const segment of segments) {
      const source = metadata[segment.fileIndex];
      if (!source || !Number.isInteger(segment.startMicroseconds) || !Number.isInteger(segment.endMicroseconds) || segment.startMicroseconds < 0 || segment.endMicroseconds <= segment.startMicroseconds || segment.endMicroseconds > source.durationMicroseconds) {
        return NextResponse.json({ error: "One or more selected segments are outside the source duration." }, { status: 400, headers: corsHeaders });
      }
    }
    const outputPath = path.join(workDir, "output.mp3");
    await processAudio(paths, segments, outputPath, settings);
    const output = await readFile(outputPath);
    return new NextResponse(output, { headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Content-Disposition": `attachment; filename="${sanitizeOutputName(settings.outputName)}"` } });
  } catch (error) {
    console.error("Audio processing failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Audio processing failed." }, { status: 500, headers: corsHeaders });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
