import { acknowledgeWelcome, welcomeMessage, welcomeState } from '../lib/welcome.mjs';
import { ROOT, fail, parseArgs } from '../lib/util.mjs';

export function welcome(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['json', 'ack', 'preview'] });
  if (positional.length || Object.keys(flags).some((key) => !['json', 'ack', 'preview'].includes(key)) || (flags.ack && flags.preview)) {
    fail('uso: vid welcome [--json] [--ack | --preview]');
  }
  const state = flags.ack ? acknowledgeWelcome(ROOT) : welcomeState(ROOT);
  const message = !flags.ack && (flags.preview || state.should_show) ? welcomeMessage(ROOT) : null;
  if (flags.json) console.log(JSON.stringify({ ...state, message }));
  else if (message) console.log(message);
}
