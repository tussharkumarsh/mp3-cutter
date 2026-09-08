import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { NextResponse } from "next/server";
import { probeAudio } from "@/lib/audio/ffprobe";
import { processAudio } from "@/lib/audio/processor";
import { sanitizeOutputName } from "@/lib/validation";
import type { AudioSegment, OutputSettings } from "@/types/audio";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const workDir = path.join(os.tmpdir(), `precision-audio-${crypto.randomUUID()}`);
  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
    const segments = JSON.parse(String(formData.get("segments") || "[]")) as AudioSegment[];
    const settings = JSON.parse(String(formData.get("settings") || "{}")) as OutputSettings;
    const maxBytes = Number(process.env.MAX_FILE_SIZE_MB || 200) * 1024 * 1024;
    if (!files.length || !segments.length || files.length > 50) return NextResponse.json({ error: "Add at least one audio file and segment." }, { status: 400 });
    await mkdir(workDir, { recursive: true });
    const paths: string[] = [];
    for (const [index, file] of files.entries()) {
      if (file.size > maxBytes) return NextResponse.json({ error: `${file.name} exceeds the maximum file size.` }, { status: 413 });
      const filePath = path.join(workDir, `input-${index}`);
      await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
      await probeAudio(filePath);
      paths.push(filePath);
    }
    const outputPath = path.join(workDir, "output.mp3");
    await processAudio(paths, segments, outputPath, settings);
    const output = await readFile(outputPath);
    return new NextResponse(output, { headers: { "Content-Type": "audio/mpeg", "Content-Disposition": `attachment; filename="${sanitizeOutputName(settings.outputName)}"` } });
  } catch (error) {
    console.error("Audio processing failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Audio processing failed." }, { status: 500 });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
