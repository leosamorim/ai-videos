import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { ROOT } from '../scripts/lib/util.mjs';

const { gsap } = createRequire(import.meta.url)('gsap');
const context = {};
runInNewContext(readFileSync(join(ROOT, 'templates/components/motion.js'), 'utf8'), context);
const motion = context.VidMotion;

test('click keeps its before/during/after state when seeking backwards and forwards', () => {
  const tl = gsap.timeline({ paused: true });
  const button = { scale: 1 }, cursor = { x: 0, y: 0, autoAlpha: 0 }, label = { autoAlpha: 1 }, doneLabel = { autoAlpha: 0 };
  try {
    motion.click(tl, { button, cursor, label, doneLabel }, { id: 'follow', start: 0.5, duration: 1 });
    tl.seek(0.25);
    assert.equal(cursor.autoAlpha, 0);
    assert.equal(label.autoAlpha, 1);
    tl.seek(0.75);
    assert.ok(cursor.autoAlpha > 0 && cursor.autoAlpha < 1);
    assert.ok(cursor.x > 0 && cursor.x < 40);
    tl.seek(1.1);
    assert.ok(button.scale < 1);
    tl.seek(1.5);
    assert.equal(button.scale, 1);
    assert.equal(cursor.autoAlpha, 0);
    assert.equal(label.autoAlpha, 0);
    assert.equal(doneLabel.autoAlpha, 1);
    tl.seek(0.25);
    assert.equal(button.scale, 1);
    assert.equal(label.autoAlpha, 1);
    assert.equal(doneLabel.autoAlpha, 0);
    assert.equal(cursor.autoAlpha, 0);
    tl.seek(1.5);
    assert.equal(doneLabel.autoAlpha, 1);
  } finally { tl.kill(); }
});

test('draw and punch progress continuously and restore earlier poses on seek', () => {
  const tl = gsap.timeline({ paused: true });
  const path = { strokeDasharray: 0, strokeDashoffset: 0 };
  const wrapper = { scale: 1, transformOrigin: '50% 50%' };
  const element = { autoAlpha: 1, y: 0 };
  try {
    motion.draw(tl, path, { id: 'line', start: 0.5, duration: 1, length: 100 });
    motion.punch(tl, wrapper, { id: 'camera', start: 0.5, duration: 1, to: 1.1 });
    motion.enter(tl, element, { id: 'label', start: 0.5, duration: 0.5 });
    tl.seek(0.25); assert.equal(path.strokeDashoffset, 100); assert.equal(element.autoAlpha, 0);
    tl.seek(1); assert.ok(path.strokeDashoffset > 0 && path.strokeDashoffset < 100); assert.ok(wrapper.scale > 1 && wrapper.scale < 1.1);
    tl.seek(1.5); assert.equal(path.strokeDashoffset, 0); assert.equal(wrapper.scale, 1.1);
    tl.seek(0.25); assert.equal(path.strokeDashoffset, 100); assert.equal(wrapper.scale, 1);
    assert.throws(() => motion.draw(tl, path, { id: 'bad', start: 0, duration: 1 }), /length/);
  } finally { tl.kill(); }
});
