// Analytic critically damped hinge: position and velocity survive reversals.
// There is no translation, approach scaling, bounce, or pull phase.
export function advanceHinge({ position, velocity }, target, seconds) {
  const dt = Math.max(0, Math.min(seconds, 0.064));
  const frequency = target ? 21 : 18;
  const offset = position - target;
  const coefficient = velocity + frequency * offset;
  const decay = Math.exp(-frequency * dt);
  const nextPosition = target + (offset + coefficient * dt) * decay;
  const nextVelocity = (velocity - frequency * coefficient * dt) * decay;
  if (Math.abs(nextPosition - target) < 0.0002 && Math.abs(nextVelocity) < 0.003) {
    return { position: target, velocity: 0 };
  }
  return { position: nextPosition, velocity: nextVelocity };
}

export const HINGE_ANGLES = Object.freeze({ top: 12, bottom: 9 });

export function hingeAngleForShelf(shelfId) {
  return HINGE_ANGLES[shelfId] ?? HINGE_ANGLES.bottom;
}

export function bookMotion(position, maxAngle = HINGE_ANGLES.bottom) {
  const p = Math.max(0, Math.min(1, position));
  return { angle: p * maxAngle, phase: p === 0 ? "rest" : p === 1 ? "lean" : "hinge" };
}
