export type AudioMetadata = {
  durationMicroseconds: number;
  sampleRate: number;
  channels: number;
  codec: string;
  bitrate: number | null;
  format: string;
};

export type AudioSegment = {
  fileIndex: number;
  startMicroseconds: number;
  endMicroseconds: number;
};

export type OutputSettings = {
  bitrate: 128 | 192 | 256 | 320;
  sampleRate: 44100 | 48000;
  channels: 1 | 2;
  outputName: string;
};
