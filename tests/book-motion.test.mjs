import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceHinge, bookMotion, hingeAngleForShelf } from '../assets/js/book-motion.mjs';

const settled = target => ({ position: target, velocity: 0 });
test('motion starts directly with a small hinge and has no pull stage', () => {
  assert.deepEqual(bookMotion(0), {angle: 0, phase: 'rest'});
  assert.deepEqual(bookMotion(1), {angle: 9, phase: 'lean'});
  const first = advanceHinge(settled(0), 1, 1/60);
  assert.ok(bookMotion(first.position).angle > 0);
  assert.equal('pull' in bookMotion(.5), false);
});

test('entry and return settle monotonically without overshoot at different frame rates', () => {
  for (const fps of [30,60,120]) {
    for (const target of [0,1]) {
      let state = settled(1-target);
      for (let i=0;i<fps*2;i++) {
        const previous = state.position;
        state = advanceHinge(state,target,1/fps);
        assert.ok(state.position >= 0 && state.position <= 1);
        assert.ok(target ? state.position >= previous : state.position <= previous);
      }
      assert.deepEqual(state,settled(target));
    }
  }
});

test('interrupted motion preserves position and velocity instead of restarting', () => {
  let state = settled(0);
  for(let i=0;i<5;i++) state = advanceHinge(state,1,1/60);
  const before = {...state};
  const reversed = advanceHinge(state,0,1/1000);
  assert.ok(Math.abs(reversed.position - before.position) < .01);
  assert.ok(Math.abs(reversed.velocity - before.velocity) < .6);
  for(let i=0;i<180;i++) {
    state = advanceHinge(state,Math.floor(i/7)%2,1/60);
    assert.ok(state.position >= 0 && state.position <= 1);
    assert.ok(Number.isFinite(state.velocity));
  }
  for(let i=0;i<120;i++) state = advanceHinge(state,0,1/60);
  assert.deepEqual(state,settled(0));
});

test('the upper row tips slightly farther to expose pages below eye level',()=>{
  assert.equal(hingeAngleForShelf('top'),12);
  assert.equal(hingeAngleForShelf('bottom'),9);
  assert.equal(bookMotion(1,hingeAngleForShelf('top')).angle,12);
  assert.equal(bookMotion(1,hingeAngleForShelf('bottom')).angle,9);
});
