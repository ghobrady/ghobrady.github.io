// Reveal promptly on ascent, but require a deliberate descent before hiding.
export function nextReturnLinkState(previous, { scrollY, maxScroll, focused = false, now = 0 }) {
  const y = Math.max(0, Math.min(scrollY, maxScroll));
  const atTop = y <= 96;
  const atEnd = maxScroll > 0 && maxScroll - y <= 48;
  const movement = y - previous.lastY;
  const direction = movement < 0 ? 'up' : movement > 0 ? 'down' : previous.direction;
  const travel = direction === previous.direction ? previous.travel + Math.abs(movement) : Math.abs(movement);
  let visible = previous.visible;
  let visibleSince = previous.visibleSince;

  if (atTop || atEnd || focused) visible = true;
  else if (direction === 'up' && travel >= 12) visible = true;
  else if (direction === 'down' && travel >= 96 && now - visibleSince >= 650) visible = false;

  if (visible && !previous.visible) visibleSince = now;

  return {
    lastY: y,
    direction,
    travel,
    visible,
    visibleSince,
  };
}

if (typeof document !== 'undefined') {
  const control = document.querySelector('[data-article-return]');
  if (control) {
    let state = { lastY: window.scrollY, direction: undefined, travel: 0, visible: true, visibleSince: performance.now() };
    let frame;
    const update = () => {
      frame = undefined;
      state = nextReturnLinkState(state, {
        scrollY: window.scrollY,
        maxScroll: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
        focused: control.contains(document.activeElement),
        now: performance.now(),
      });
      control.dataset.hidden = String(!state.visible);
    };
    const scheduleUpdate = () => {
      if (frame === undefined) frame = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('pageshow', scheduleUpdate);
    control.addEventListener('focusin', update);
    control.addEventListener('focusout', scheduleUpdate);
    document.fonts.ready.then(scheduleUpdate);
    update();
  }
}
