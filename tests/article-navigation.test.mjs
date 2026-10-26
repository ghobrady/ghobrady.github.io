import assert from 'node:assert/strict';
import test from 'node:test';
import { nextReturnLinkState } from '../assets/js/article-navigation.mjs';

const step = (state, scrollY, options = {}) => nextReturnLinkState(state, { scrollY, maxScroll: 2000, now: 1000, ...options });
const start = () => ({ lastY: 0, direction: undefined, travel: 0, visible: true, visibleSince: 0 });

test('return link hides on descent, appears at the end, stays while ascending, and hides on a new descent', () => {
  let state = step(start(), 0);
  assert.equal(state.visible, true);
  state = step(state, 240);
  assert.equal(state.visible, false);
  state = step(state, 2000, { now: 1500 });
  assert.equal(state.visible, true);
  state = step(state, 1600, { now: 1700 });
  assert.equal(state.visible, true);
  state = step(state, 1200, { now: 1900 });
  assert.equal(state.visible, true);
  state = step(state, 1220, { now: 2200 });
  assert.equal(state.visible, true);
  state = step(state, 1320, { now: 2300 });
  assert.equal(state.visible, false);
  state = step(state, 0);
  assert.equal(state.visible, true);
});

test('small scroll deltas accumulate without flickering on a direction reversal', () => {
  let state = step(start(), 300);
  state = step(state, 298);
  state = step(state, 295);
  assert.equal(state.visible, false);
  state = step(state, 288);
  assert.equal(state.visible, true);
  state = step(state, 293);
  assert.equal(state.visible, true);
  state = step(state, 301);
  assert.equal(state.visible, true);
});

test('a newly revealed link stays visible long enough to use, even after a fast downward swipe', () => {
  let state = step(start(), 300);
  state = step(state, 280, { now: 1400 });
  assert.equal(state.visible, true);
  state = step(state, 420, { now: 1450 });
  assert.equal(state.visible, true);
  state = step(state, 425, { now: 2100 });
  assert.equal(state.visible, false);
});

test('the initial top link survives a small scroll and a fast first swipe', () => {
  let state = step(start(), 60, { now: 1000 });
  assert.equal(state.visible, true);
  state = step(start(), 300, { now: 200 });
  assert.equal(state.visible, true);
  state = step(state, 400, { now: 800 });
  assert.equal(state.visible, false);
});

test('keyboard focus keeps the return link visible during downward scrolling', () => {
  const state = step(step(start(), 300), 500, { focused: true });
  assert.equal(state.visible, true);
});

test('short pages and overscroll keep top and bottom behavior stable', () => {
  let state = step(start(), -30);
  assert.equal(state.visible, true);
  state = step(state, 2100);
  assert.equal(state.visible, true);
  assert.equal(state.lastY, 2000);
  state = step(start(), 30, { maxScroll: 0 });
  assert.equal(state.visible, true);
});
