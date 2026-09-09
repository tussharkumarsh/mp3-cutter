"use client";

import { ChangeEvent, DragEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Check, ChevronDown, ChevronUp, Download, FileAudio, GripVertical, Layers, ListOrdered, LoaderCircle, Merge, Plus, Scissors, Trash2, Upload, WandSparkles } from "lucide-react";
import { formatShortDuration, microsecondsToTimestamp, parseTimestampToMicroseconds } from "@/lib/timestamp";
import { validateSegment } from "@/lib/validation";

function MarqueeText({ text }: { text: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    const measure = () => { const wrap = wrapRef.current; const span = textRef.current; if (!wrap || !span) return; setOverflow(Math.max(0, span.scrollWidth - wrap.clientWidth)); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text]);

  return (
    <div ref={wrapRef} className="marquee" style={overflow > 0 ? { "--marquee-distance": `-${overflow + 16}px`, "--marquee-duration": `${Math.max(4, overflow / 22)}s` } as React.CSSProperties : undefined}>
      <span ref={textRef} className={overflow > 0 ? "marquee-track" : undefined}>{text}</span>
    </div>
  );
}

type Track = { id: string; file: File; url: string; duration: number; start: string; end: string; error?: string; };
const ACCEPT = ".mp3,.wav,.m4a,.aac,.flac,.ogg,.webm,audio/*";
const defaultSettings = { bitrate: 320 as 128 | 192 | 256 | 320, sampleRate: 48000 as 44100 | 48000, channels: 2 as 1 | 2, outputName: "audio-mix" };
const VERCEL_BODY_LIMIT = 4 * 1024 * 1024;
const MAX_FILE_SIZE = 200 * 1024 * 1024;
const processingEndpoint = process.env.NEXT_PUBLIC_AUDIO_API_URL || "/api/process-audio";

const WORKFLOW = [
  { icon: Upload, label: "Upload" },
  { icon: Scissors, label: "Trim" },
  { icon: ListOrdered, label: "Arrange" },
  { icon: Merge, label: "Join" },
  { icon: Download, label: "Download" },
];

const HOW_IT_WORKS = [
  { icon: Upload, title: "Upload your audio", text: "Pick any song or audio file from your device to start your mix." },
  { icon: Scissors, title: "Trim the clip", text: "Set the start and end points to keep only the part you want." },
  { icon: Plus, title: "Add more clips", text: "Upload as many songs as you like and trim each one the same way." },
  { icon: GripVertical, title: "Arrange the order", text: "Drag your clips into the order you want them to play." },
  { icon: Merge, title: "Join everything", text: "Combine every trimmed clip into one seamless audio file." },
  { icon: Download, title: "Download your mix", text: "Save the finished audio to your device and you're done." },
];

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const trackRefs = useRef<Record<string, HTMLElement | null>>({});
  const [settings, setSettings] = useState(defaultSettings);
  const [advanced, setAdvanced] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; name: string; } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = useMemo(() => tracks.reduce((sum, track) => sum + ((parseTimestampToMicroseconds(track.end) || 0) - (parseTimestampToMicroseconds(track.start) || 0)), 0), [tracks]);
  const currentStep = !tracks.length ? 1 : processing ? 3 : result ? 4 : 2;

  const notify = (message: string) => { if (toastTimer.current) clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(null), 3200); };

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    list.forEach((file) => { const url = URL.createObjectURL(file); const duration = 0; const error = file.size > MAX_FILE_SIZE ? "This file exceeds the 200 MB per-file limit." : undefined; setTracks((current) => [...current, { id: crypto.randomUUID(), file, url, duration, start: "00:00:00.00", end: "00:00:00.00", error }]); const audio = new Audio(url); audio.onloadedmetadata = () => setTracks((current) => current.map((track) => track.url === url ? { ...track, duration: Math.round(audio.duration * 1_000_000), end: microsecondsToTimestamp(Math.round(audio.duration * 1_000_000), true, 2) } : track)); });
    notify(list.length > 1 ? "Songs added. Set the portion you want to keep for each." : "Song added. Set the portion you want to keep.");
  };
  const onInput = (event: ChangeEvent<HTMLInputElement>) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files); };
  const onCardPointerDown = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, select, textarea, .icon-button")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingId(id);
  };
  const onHandlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!draggingId) return;
    const { clientX, clientY } = event;
    let overId: string | null = null;
    for (const [id, el] of Object.entries(trackRefs.current)) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) { overId = id; break; }
    }
    if (overId && overId !== draggingId) {
      setTracks((current) => {
        const from = current.findIndex((track) => track.id === draggingId);
        const to = current.findIndex((track) => track.id === overId);
        if (from === -1 || to === -1) return current;
        const next = [...current];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      });
    }
  };
  const onHandlePointerUp = () => setDraggingId(null);
  const update = (index: number, key: "start" | "end", value: string) => setTracks((current) => current.map((track, i) => i === index ? { ...track, [key]: value, error: undefined } : track));
  const remove = (index: number) => { URL.revokeObjectURL(tracks[index].url); setTracks((current) => current.filter((_, i) => i !== index)); };
  const process = async () => {
    const checked = tracks.map((track) => ({ ...track, check: validateSegment(track.start, track.end, track.duration) }));
    if (!tracks.length || checked.some((track) => !track.check.valid) || tracks.some((track) => track.file.size > MAX_FILE_SIZE)) { setTracks(checked.map((track) => ({ ...track, error: track.file.size > MAX_FILE_SIZE ? "This file exceeds the 200 MB per-file limit." : track.check.error }))); return; }
    if (window.location.hostname.endsWith("vercel.app") && processingEndpoint === "/api/process-audio" && tracks.reduce((sum, track) => sum + track.file.size, 0) > VERCEL_BODY_LIMIT) { setTracks((current) => current.map((track) => ({ ...track, error: "Large files cannot be sent through a Vercel serverless function. Set NEXT_PUBLIC_AUDIO_API_URL to your Node/FFmpeg worker URL." }))); return; }
    setProcessing(true); setProgress(8); setResult(null);
    const form = new FormData();
    tracks.forEach((track) => form.append("files", track.file));
    form.append("segments", JSON.stringify(checked.map((track, fileIndex) => ({ fileIndex, startMicroseconds: track.check.startMicroseconds, endMicroseconds: track.check.endMicroseconds }))));
    form.append("settings", JSON.stringify(settings));
    const response = await fetch(processingEndpoint, { method: "POST", body: form });
    if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string; } | null; setTracks((current) => current.map((track) => ({ ...track, error: body?.error || (response.status === 413 ? "The processing server rejected this upload because it is too large." : "Audio processing failed.") }))); setProcessing(false); return; }
    setProgress(100);
    const blob = await response.blob();
    setResult({ url: URL.createObjectURL(blob), name: `${settings.outputName || "audio-mix"}.mp3` });
    setProcessing(false);
    notify("Your audio has been successfully combined.");
  };

  const clipNames = tracks.map((track) => track.file.name.replace(/\.[^/.]+$/, ""));

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><AudioLines size={22} /></span><span>Audio <strong>Mix Maker</strong></span></div>
        <span className="status"><span className="status-dot" /> Local processing</span>
      </header>

      <section className="hero">
        <p className="eyebrow">CREATE YOUR OWN AUDIO MIX</p>
        <h1>Trim. Arrange. Join.<br /><em>Create your perfect audio.</em></h1>
        <p className="lede">Upload any songs or audio clips, trim each one to the exact part you want, arrange them in your preferred order, and join everything into one seamless track — all in a few simple steps.</p>
        <div className="hero-actions">
          <a href="#workspace" className="hero-cta"><Scissors size={17} /> Start Creating</a>
          <p className="hero-hint">No sign-up needed · your files never leave this device</p>
        </div>
        <ol className="workflow-strip">
          {WORKFLOW.map((step, index) => (
            <li key={step.label}>
              <span className="workflow-icon"><step.icon size={16} /></span>
              <span>{step.label}</span>
              {index < WORKFLOW.length - 1 && <span className="workflow-arrow">→</span>}
            </li>
          ))}
        </ol>
      </section>

      <section className="how-it-works">
        <div className="section-heading centered">
          <div>
            <p className="eyebrow">HOW IT WORKS</p>
            <h2>Six simple steps to your custom audio</h2>
          </div>
        </div>
        <div className="how-grid">
          {HOW_IT_WORKS.map((step, index) => (
            <div className="how-card" key={step.title}>
              <span className="how-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="how-icon"><step.icon size={19} /></span>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="workspace" id="workspace">
        <ol className="stepper">
          <li className={currentStep >= 1 ? "done" : ""}><span>1</span>Upload</li>
          <li className={currentStep >= 2 ? (currentStep === 2 ? "active" : "done") : ""}><span>2</span>Trim &amp; Arrange</li>
          <li className={currentStep >= 3 ? (currentStep === 3 ? "active" : "done") : ""}><span>3</span>Join</li>
          <li className={currentStep >= 4 ? "active" : ""}><span>4</span>Download</li>
        </ol>

        <div className="section-heading">
          <div><span className="section-number">01</span><div><h2>Upload your song</h2><p>Choose an MP3, WAV, or other supported audio file to begin trimming.</p></div></div>
          <span className="format-note">MP3 · WAV · M4A · FLAC · OGG · WEBM</span>
        </div>
        <div className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={onDrop} onClick={() => inputRef.current?.click()}>
          <input ref={inputRef} hidden type="file" multiple accept={ACCEPT} onChange={onInput} />
          <span className="upload-icon"><Upload size={24} /></span>
          <strong>Drop your audio files here</strong>
          <span>or <u>browse from your device</u> · up to 200 MB per file</span>
        </div>

        {tracks.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon"><Layers size={20} /></span>
            <strong>Ready to create your audio mix?</strong>
            <p>Upload your first song above to get started. Trim the part you want, then add more clips and join them together.</p>
          </div>
        )}

        {tracks.length > 0 && (
          <>
            <div className="section-heading">
              <div><span className="section-number">02</span><div><h2>Trim &amp; arrange your clips</h2><p>Set the start and end for each clip below — this is the order they'll be joined in, so drag any card to rearrange.</p></div></div>
              <span className="format-note">{tracks.length} clip{tracks.length === 1 ? "" : "s"}</span>
            </div>
            <div className="tracks">
              {tracks.map((track, index) => {
                const segment = (parseTimestampToMicroseconds(track.end) || 0) - (parseTimestampToMicroseconds(track.start) || 0);
                return (
                  <article className={`track ${track.error ? "has-error" : ""} ${draggingId === track.id ? "is-dragging" : ""}`} key={track.id} ref={(el) => { trackRefs.current[track.id] = el; }} onPointerDown={(event) => onCardPointerDown(event, track.id)} onPointerMove={onHandlePointerMove} onPointerUp={onHandlePointerUp} onPointerCancel={onHandlePointerUp}>
                    <button className="drag-handle" aria-label="Reorder track"><GripVertical size={18} /></button>
                    <span className="track-number">{String(index + 1).padStart(2, "0")}</span>
                    <div className="track-file">
                      <span className="file-icon"><FileAudio size={18} /></span>
                      <div className="track-file-text"><strong><MarqueeText text={track.file.name} /></strong><span>{track.duration ? `Full length ${formatShortDuration(track.duration)}` : "Reading audio..."}</span></div>
                    </div>
                    <div className="segment-fields">
                      <label>START<input value={track.start} onChange={(event) => update(index, "start", event.target.value)} onBlur={(event) => update(index, "start", microsecondsToTimestamp(parseTimestampToMicroseconds(event.target.value) || 0, true, 2))} /><small>Where the clip begins</small></label>
                      <span className="arrow">→</span>
                      <label>END<input value={track.end} onChange={(event) => update(index, "end", event.target.value)} onBlur={(event) => update(index, "end", microsecondsToTimestamp(parseTimestampToMicroseconds(event.target.value) || 0, true, 2))} /><small>Where the clip ends</small></label>
                    </div>
                    <div className="segment-duration"><strong>{segment > 0 ? formatShortDuration(segment) : "--"}</strong><span>clip length</span></div>
                    <button className="icon-button" onClick={() => remove(index)} aria-label={`Remove ${track.file.name}`}><Trash2 size={17} /></button>
                    {track.error && <p className="error">{track.error}</p>}
                  </article>
                );
              })}
            </div>
            <button className="add-button" onClick={() => inputRef.current?.click()}><Plus size={16} /> Add another song<small>Trim another song and add it to your mix</small></button>

            {tracks.length > 1 && (
              <p className="recipe">
                {clipNames.map((name, index) => <span key={index}><span className="recipe-clip">{name}</span>{index < clipNames.length - 1 && <span className="recipe-plus">+</span>}</span>)}
                <span className="recipe-arrow">→ Join →</span>
                <span className="recipe-result">{(settings.outputName || "audio-mix")}.mp3</span>
              </p>
            )}
          </>
        )}
      </section>

      {tracks.length > 0 && (
        <section className="summary">
          <div>
            <p className="eyebrow">03 — JOIN YOUR CLIPS</p>
            <h2>Your combined mix length</h2>
            <strong className="total-time">{microsecondsToTimestamp(total, true, 2)}</strong>
            <p className="muted">{tracks.length} clip{tracks.length === 1 ? "" : "s"} · joined with no gaps in between</p>
          </div>
          <div className="settings">
            <button className="settings-toggle" onClick={() => setAdvanced(!advanced)}><WandSparkles size={17} /> Advanced settings {advanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
            {advanced && (
              <div className="settings-panel">
                <label>Bitrate<select value={settings.bitrate} onChange={(e) => setSettings({ ...settings, bitrate: Number(e.target.value) as typeof settings.bitrate })}><option value="128">128 kbps</option><option value="192">192 kbps</option><option value="256">256 kbps</option><option value="320">320 kbps</option></select></label>
                <label>Sample rate<select value={settings.sampleRate} onChange={(e) => setSettings({ ...settings, sampleRate: Number(e.target.value) as typeof settings.sampleRate })}><option value="44100">44.1 kHz</option><option value="48000">48 kHz</option></select></label>
                <label>File name<input value={settings.outputName} onChange={(e) => setSettings({ ...settings, outputName: e.target.value })} /></label>
              </div>
            )}
          </div>
        </section>
      )}

      {tracks.length > 0 && (
        <>
          <button className="process-button" disabled={processing || !tracks.length} onClick={process}>
            {processing ? <><LoaderCircle className="spin" size={19} /> Creating your mix {progress}%</> : <><Merge size={19} /> Join Clips &amp; Create My Mix</>}
          </button>
          <p className="process-hint">{processing ? "Trimming and joining your clips — this only takes a moment." : "This trims every clip to your chosen range and joins them into one audio file, in the order shown above."}</p>
        </>
      )}

      {processing && (
        <div className="progress">
          <div className="progress-label"><span>Creating your mix</span><span>{progress}%</span></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        </div>
      )}

      {result && (
        <section className="result">
          <div className="result-check"><Check size={17} /></div>
          <div>
            <p className="eyebrow">04 — YOUR AUDIO IS READY</p>
            <h2>{result.name}</h2>
            <p className="muted">Your final audio has been successfully combined. Listen below, then download it.</p>
            <audio controls src={result.url} />
          </div>
          <a className="download-button" href={result.url} download={result.name}><Download size={18} /> Download Your Audio</a>
        </section>
      )}

      <section className="how-to-use">
        <p className="eyebrow">QUICK RECAP</p>
        <h2>How to create your custom audio</h2>
        <ol className="recap-list">
          <li><strong>Upload</strong> one or more songs from your device.</li>
          <li><strong>Trim</strong> each one by setting a start and end point.</li>
          <li><strong>Arrange</strong> your clips by dragging them into order.</li>
          <li><strong>Join</strong> all clips with one tap of the mix button.</li>
          <li><strong>Download</strong> your finished audio and you're done.</li>
        </ol>
      </section>

      <footer><span>Audio Mix Maker</span><span>All processing happens locally · No uploads stored</span></footer>

      {toast && <div className="toast"><Check size={15} />{toast}</div>}
    </main>
  );
}
