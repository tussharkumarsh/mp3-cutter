import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "precision-audio-worker",
    maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 200),
  });
}
