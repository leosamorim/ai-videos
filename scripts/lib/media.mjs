// Inspeção e medição de mídia com ffprobe/ffmpeg.
import { fail, round, run } from './util.mjs';

let ffmpegMajor;
/** Recent FFmpeg removed *_script options; older packages lack -/option. */
export function filterFileArgs(path) {
  ffmpegMajor ??= Number(run('ffmpeg', ['-version']).stdout.match(/ffmpeg version n?(\d+)/)?.[1] ?? 8);
  return [ffmpegMajor >= 7 ? '-/filter_complex' : '-filter_complex_script', path];
}

function ratio(text) {
  const [a, b] = String(text ?? '').split('/').map(Number);
  return b ? a / b : Number(text) || 0;
}

/**
 * Lê o que o pipeline precisa saber do arquivo: tamanho já com a rotação aplicada,
 * taxa de quadros real, se é HDR e se a taxa é variável.
 */
export function probe(path) {
  const { stdout } = run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path]);
  const info = JSON.parse(stdout);
  const video = info.streams.find((s) => s.codec_type === 'video');
  const audio = info.streams.find((s) => s.codec_type === 'audio');
  if (!video) fail(`sem trilha de vídeo: ${path}`);

  const side = (video.side_data_list ?? []).find((d) => d.rotation !== undefined);
  const rotation = (((Number(side?.rotation ?? video.tags?.rotate ?? 0) % 360) + 360) % 360);
  const sideways = rotation === 90 || rotation === 270;
  const fps = ratio(video.avg_frame_rate) || ratio(video.r_frame_rate);
  const nominal = ratio(video.r_frame_rate);
  const hdr = ['arib-std-b67', 'smpte2084'].includes(video.color_transfer);

  return {
    duration: Number(video.duration ?? info.format.duration),
    timeline: { origin: 'first-video-frame', video_start: Number(video.start_time ?? 0),
      audio_offset: audio ? Number(audio.start_time ?? 0) - Number(video.start_time ?? 0) : null },
    size_bytes: Number(info.format.size),
    video: {
      codec: video.codec_name,
      width: sideways ? video.height : video.width,
      height: sideways ? video.width : video.height,
      coded_width: video.width,
      coded_height: video.height,
      rotation,
      start_time: Number(video.start_time ?? 0),
      time_base: video.time_base,
      frames: Number(video.nb_frames) || null,
      fps: round(fps),
      variable_frame_rate: Math.abs(fps - nominal) > 0.02,
      pix_fmt: video.pix_fmt,
      sample_aspect_ratio: video.sample_aspect_ratio ?? null,
      color_space: video.color_space ?? null,
      color_range: video.color_range ?? null,
      chroma_location: video.chroma_location ?? null,
      field_order: video.field_order ?? null,
      hdr,
      color_transfer: video.color_transfer ?? null,
      color_primaries: video.color_primaries ?? null,
    },
    audio: audio
      ? { codec: audio.codec_name, sample_rate: Number(audio.sample_rate), channels: audio.channels, channel_layout: audio.channel_layout ?? null, start_time: Number(audio.start_time ?? 0) }
      : null,
  };
}

/** PCM and rendered audio use the same zero as the first video frame. */
export function audioTimelineFilter({ offset = 0, duration, sampleRate = 48000 } = {}) {
  if (![offset, duration, sampleRate].every(Number.isFinite) || duration <= 0 || sampleRate <= 0) fail('relógio de áudio inválido');
  const shift = offset >= 0 ? `adelay=${Math.round(offset * sampleRate)}S:all=1` : `atrim=start=${-offset},asetpts=PTS-STARTPTS`;
  return `aresample=${sampleRate},asetpts=PTS-STARTPTS,${shift},apad,atrim=duration=${duration}`;
}

/** Loudness integrado (LUFS), true peak (dBTP) e faixa dinâmica, medidos pelo ffmpeg. */
export function measureLoudness(path) {
  const { stderr } = run('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-vn',
    '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
  const start = stderr.lastIndexOf('{');
  const end = stderr.lastIndexOf('}');
  if (start < 0 || end < start) fail(`não consegui medir o áudio de ${path}`);
  const json = JSON.parse(stderr.slice(start, end + 1));
  return {
    lufs: Number(json.input_i),
    true_peak: Number(json.input_tp),
    lra: Number(json.input_lra),
    threshold: Number(json.input_thresh),
    target_offset: Number(json.target_offset),
  };
}

/** Trechos em que o áudio fica abaixo de `noiseDb` por pelo menos `minDuration` segundos. */
export function detectSilences(path, { noiseDb, minDuration, duration }) {
  const { stderr } = run('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-vn',
    '-af', `silencedetect=noise=${noiseDb}dB:d=${minDuration}`, '-f', 'null', '-']);
  const silences = [];
  let open = null;
  for (const line of stderr.split('\n')) {
    const startMatch = line.match(/silence_start:\s*(-?[\d.]+)/);
    const endMatch = line.match(/silence_end:\s*([\d.]+)/);
    if (startMatch) open = Math.max(0, Number(startMatch[1]));
    if (endMatch && open !== null) { silences.push({ start: round(open), end: round(Number(endMatch[1])) }); open = null; }
  }
  // Silêncio que vai até o fim do arquivo não recebe silence_end.
  if (open !== null && duration > open) silences.push({ start: round(open), end: round(duration) });
  return silences;
}

/** Intervalos de tela preta e de imagem congelada, que denunciam erro de render. */
export function detectVideoDefects(path, duration) {
  const { stderr } = run('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-an',
    '-vf', 'blackdetect=d=0.1:pix_th=0.10,freezedetect=n=-60dB:d=0.75', '-f', 'null', '-']);
  const black = [];
  const frozen = [];
  let freezeStart = null;
  for (const line of stderr.split('\n')) {
    const blackMatch = line.match(/black_start:([\d.]+)\s+black_end:([\d.]+)/);
    if (blackMatch) black.push({ start: round(Number(blackMatch[1])), end: round(Number(blackMatch[2])) });
    const fs = line.match(/freeze_start:\s*([\d.]+)/);
    const fe = line.match(/freeze_end:\s*([\d.]+)/);
    if (fs) freezeStart = Number(fs[1]);
    if (fe && freezeStart !== null) { frozen.push({ start: round(freezeStart), end: round(Number(fe[1])) }); freezeStart = null; }
  }
  if (freezeStart !== null && duration > freezeStart) frozen.push({ start: round(freezeStart), end: round(duration) });
  return { black, frozen };
}
