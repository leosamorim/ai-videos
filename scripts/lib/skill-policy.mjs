import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function applyRepositoryPolicy(dir, name) {
  const path = join(dir, 'SKILL.md');
  if (!existsSync(path)) return;
  if (name === 'embedded-captions') {
    const ignore = join(dir, '.gitignore');
    if (existsSync(ignore)) {
      let rules = readFileSync(ignore, 'utf8').replace(/^!assets\/ppmatting.*\n/gm, '');
      const fixture = '!scripts/fixtures/heroless/transcript.json';
      if (!rules.includes(fixture)) rules += `\n# Synthetic upstream fixture; user transcripts remain private.\n${fixture}\n`;
      writeFileSync(ignore, rules);
    }
  }
  if (name === 'hyperframes') {
    const original = readFileSync(path, 'utf8');
    mkdirSync(join(dir, 'references'), { recursive: true });
    if (!original.includes('REPO_ROUTER_V2')) writeFileSync(join(dir, 'references/upstream-entrypoint.md'), original);
    writeFileSync(path, `---\nname: hyperframes\ndescription: Technical entry point for video and motion work in this repository. Existing footage editing uses video-edit; load HyperFrames domain skills for composition and rendering.\n---\n\n<!-- REPO_ROUTER_V2 -->\n# Repository video routing\n\nRead AGENTS.md at the repository root. For footage editing, use ../video-edit/SKILL.md. This is the only editorial orchestrator.\n\n- Existing project: read project.json and run node scripts/vid.mjs status <project>. Follow the current user request and preserve previous choices.\n- Site/material supplied with footage: reference intake in video-edit; it does not change the deliverable into a product advertisement.\n- Standalone motion graphics or an explicitly different deliverable: use general-video or motion-graphics with core and the necessary domain skills.\n- Technical contracts: core for structure, animation/keyframes for motion, audio for mixing, creative for design, registry/media-use for assets. Load only what the task needs.\n- Run the pinned CLI through node scripts/hf.mjs. Keep skills and CLI versions aligned. Upgrade/vendor operations happen only as explicit maintenance, never during an edit.\n- Do not run upstream global skill installers, freshness routines, another transcript pass, or another intent interview. The upstream entrypoint is archived as reference, not an executable workflow for this repo.\n- User authorization and review_policy govern approvals. Autonomously authorized work does not acquire extra approval gates from vendor documentation.\n`);
    return;
  }
  let text = readFileSync(path, 'utf8');
  if (!text.includes('REPO_DOMAIN_V2')) {
    const end = text.indexOf('\n---', 3) + 4;
    text = text.slice(0, end) + '\n\n<!-- REPO_DOMAIN_V2 -->\n> Neste repo, `video-edit` coordena o fluxo e `AGENTS.md` define os contratos. Esta skill fornece capacidade técnica. Consuma o corte, a transcrição, o tema e o storyboard existentes; não reinicie briefing/transcrição, não instale/atualize skills globais e não imponha aprovações extras. Use `node scripts/hf.mjs` para o CLI fixado.\n' + text.slice(end);
  }
  text = text.replaceAll('--model small.en', '--language pt');
  writeFileSync(path, text);
}
