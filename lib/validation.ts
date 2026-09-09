import { parseTimestampToMicroseconds } from "./timestamp";

export function validateSegment(start: string, end: string, durationMicroseconds: number) {
    const startMicroseconds = parseTimestampToMicroseconds(start);
    const endMicroseconds = parseTimestampToMicroseconds(end);
    if (startMicroseconds === null || endMicroseconds === null) return { valid: false, error: "Use HH:MM:SS with up to 2 decimal places." };
    if (startMicroseconds < 0) return { valid: false, error: "Start time cannot be negative." };
    if (endMicroseconds <= startMicroseconds) return { valid: false, error: "End time must be after start time." };
    if (endMicroseconds > durationMicroseconds) return { valid: false, error: "End time exceeds the source duration." };
    return { valid: true, startMicroseconds, endMicroseconds };
}

export function sanitizeOutputName(name: string) {
    const base = name.trim().replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
    return (base || "audio-mix").replace(/\.mp3$/i, "") + ".mp3";
}
