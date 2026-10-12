import { join } from 'node:path';
import { locate } from '../lib/project.mjs';
import { probe } from '../lib/media.mjs';
import { sourceSignature } from '../lib/editorial.mjs';
import { boundaryWindows, generateSignals } from '../lib/signals.mjs';
import { setupSignals, signalRuntimeStatus } from '../lib/signal-runtime.mjs';
import { fail, numberFlag, parseArgs, readJson } from '../lib/util.mjs';

export async function signals(args) {
  const { positional, flags } = parseArgs(args, { booleans: ['face', 'pose', 'boundaries', 'force', 'status', 'help'] });
  if (flags.help) return console.log([
    'signals setup [--face|--pose] [--python python3.12]   Instala extras locais e testa modelos',
    'signals --status [--face|--pose]                    Verifica runtime/modelos',
    'signals SLUG                                      Mede fala no áudio original',
    'signals SLUG --face --from S --to E                 Mede rosto no proxy validado',
    'signals SLUG --face --boundaries [--context 1]      Inspeciona bordas do edit-plan',
    '--pose inclui punhos; --fps 5 é padrão; --force recalcula. Nada altera takes ou aprova etapas.',
    'Detalhes: docs/SIGNALS.md',
  ].join('\n'));
  if (positional[0] === 'setup') return setupSignals({ python: flags.python, face: flags.face, pose: flags.pose });
  if (flags.status) {
    const status = signalRuntimeStatus({ face: flags.face, pose: flags.pose });
    console.log(status.ok ? `Signals disponível: Python ${status.versions.python}; modelos íntegros.` : `${status.reason}. ${status.hint}`);
    process.exitCode = status.ok ? 0 : 1;
    return;
  }
  // Intentionally do not loadProject(): measuring must not migrate stages or approvals.
  const project = locate(positional[0]);
  project.data = readJson(project.file);
  const visual = Boolean(flags.face || flags.pose);
  if ((flags.boundaries || flags.from !== undefined || flags.to !== undefined) && !visual) fail('janelas exigem --face ou --pose');
  if (flags.boundaries && (flags.from !== undefined || flags.to !== undefined)) fail('use --boundaries OU --from/--to');
  let windows = [];
  if (flags.boundaries) {
    const plan = readJson(join(project.paths.cut, 'edit-plan.json'));
    if (plan.source_signature !== sourceSignature(project)) fail('plano editorial antigo: reveja antes de medir as bordas');
    const duration = probe(join(project.dir, project.data.source.file)).duration;
    windows = boundaryWindows(plan.segments, duration, numberFlag(flags, 'context', 1));
  } else if (visual) windows = [{ start: numberFlag(flags, 'from', NaN), end: numberFlag(flags, 'to', NaN) }];
  return generateSignals(project, { face: flags.face, pose: flags.pose, windows,
    fps: numberFlag(flags, 'fps', 5), force: Boolean(flags.force) });
}
