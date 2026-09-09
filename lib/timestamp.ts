const TIMESTAMP_PATTERN = /^(\d{1,3})(?::([0-5]?\d))?(?::([0-5]?\d)(?:\.(\d{1,6}))?)?$/;

export function parseTimestampToMicroseconds(value: string): number | null {
    const normalized = value.trim();
    if (!normalized || normalized.startsWith("-")) return null;
    if (!normalized.includes(":")) {
        const seconds = Number(normalized);
        if (!/^\d+(?:\.\d{1,6})?$/.test(normalized) || !Number.isFinite(seconds)) return null;
        return Math.round(seconds * 1_000_000);
    }
    const match = normalized.match(TIMESTAMP_PATTERN);
    if (!match) return null;
    const [, first, minute = "0", second = "0", fraction = ""] = match;
    const hours = match[2] ? Number(first) : 0;
    const minutes = match[2] ? Number(minute) : Number(first);
    const seconds = match[2] ? Number(second) : 0;
    const micros = Number((fraction + "000000").slice(0, 6));
    if (minutes > 59 || seconds > 59) return null;
    return ((hours * 3600 + minutes * 60 + seconds) * 1_000_000) + micros;
}

export function microsecondsToTimestamp(value: number, showHours = true, fractionDigits = 6): string {
    const safeValue = Math.max(0, Math.round(value));
    const hours = Math.floor(safeValue / 3_600_000_000);
    const remainingAfterHours = safeValue % 3_600_000_000;
    const minutes = Math.floor(remainingAfterHours / 60_000_000);
    const remainingAfterMinutes = remainingAfterHours % 60_000_000;
    const seconds = Math.floor(remainingAfterMinutes / 1_000_000);
    const micros = remainingAfterMinutes % 1_000_000;
    const fraction = String(micros).padStart(6, "0").slice(0, fractionDigits);
    const base = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${fraction}`;
    return showHours || hours > 0 ? `${String(hours).padStart(2, "0")}:${base}` : base;
}

export function formatShortDuration(value: number): string {
    return microsecondsToTimestamp(value, false).replace(/\.\d{3}\d{3}$/, (match) => match.slice(0, 4));
}
