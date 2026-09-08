# Precision Audio Cutter

Next.js App Router application for trimming multiple local audio files and merging selected segments into one MP3.

## Setup

Install Node.js 20+ and FFmpeg. On Windows, install FFmpeg and ensure `ffmpeg` and `ffprobe` are on `PATH`. Then run `npm install`, copy `.env.example` to `.env.local`, and run `npm run dev`.

Production commands are `npm run build` and `npm run start`. Tests use `npm test`; lint uses `npm run lint`.

## Architecture

The browser sends original files plus integer-microsecond segment metadata to `POST /api/process-audio`. The Node.js route writes safe temporary filenames, validates each stream with FFprobe, uses FFmpeg `atrim` and `asetpts`, normalizes decoded audio, concatenates it, and encodes one MP3. Temporary files are removed after processing.

## Precision

Timestamp input supports up to six fractional digits and is represented as integer microseconds. Digital audio is sample-based, so arbitrary microsecond boundaries cannot physically exist between samples. FFmpeg resolves each requested boundary to the closest valid sample boundary. At 44.1 kHz a sample is about 22.676 microseconds; at 48 kHz it is about 20.833 microseconds.

The default upload limit is 200 MB per file and can be changed with `MAX_FILE_SIZE_MB`. Only user-provided local files are accepted; the app does not download from or extract audio from YouTube.
