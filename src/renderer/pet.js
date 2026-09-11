const stage = document.querySelector('#stage');
const pet = document.querySelector('#pet');
const petSprite = document.querySelector('#petSprite');
let current = null;
let animationTimer = null;
let animationKey = '';
let currentVisualStatus = 'idle';
let hoverTriggered = false;
let hoverReactionActive = false;
let lastReportedStatus = null;
let dragging = false;
let dragged = false;
let dragOrigin = null;
let easterEggActive = false;
let completionActive = false;

const SPRITES = {
  idle: '../../assets/spooly-idle-full.png',
  offline: '../../assets/spooly-offline.png',
  complete: '../../assets/spooly-idle-full.png',
  printing: '../../assets/spooly-printing.png',
  paused: '../../assets/spooly-paused.png',
  error: '../../assets/spooly-error.png',
  filament_out: '../../assets/spooly-filament-out.png',
};

const ERROR_FRAME_NUMBERS = Array.from({ length: 36 }, (_, index) => index + 12);
const ERROR_FRAMES = ERROR_FRAME_NUMBERS.map(
  (index) => `../../assets/animation/error-higgsfield-loop/frame-${String(index).padStart(3, '0')}.png`,
);

const RUNOUT_FRAME_NUMBERS = Array.from({ length: 48 }, (_, index) => index);
const RUNOUT_FRAMES = RUNOUT_FRAME_NUMBERS.map(
  (index) => `../../assets/animation/runout-higgsfield-loop/frame-${String(index).padStart(3, '0')}.png`,
);

// The generated clip contains several repeated arm pumps. Frames 24-36 form
// one complete working cycle whose next pose matches frame 24, avoiding the
// extra backward pump at the full clip's endpoint.
const PRINTING_FRAME_NUMBERS = Array.from({ length: 13 }, (_, index) => index + 24);
const PRINTING_FRAMES = PRINTING_FRAME_NUMBERS.map(
  (index) => `../../assets/animation/printing-higgsfield-loop/frame-${String(index).padStart(3, '0')}.png`,
);

const IDLE_FRAME_NUMBERS = Array.from({ length: 49 }, (_, index) => index);
const IDLE_FRAMES = IDLE_FRAME_NUMBERS.map(
  (index) => `../../assets/animation/idle-higgsfield-loop-v2/frame-${String(index).padStart(3, '0')}.png`,
);

const PAUSED_FRAMES = Array.from({ length: 49 }, (_, index) => (
  `../../assets/animation/paused-higgsfield-loop/frame-${String(index).padStart(3, '0')}.png`
));

const COMPLETE_FRAMES = Array.from({ length: 49 }, (_, index) => (
  `../../assets/animation/complete-higgsfield-celebration/frame-${String(index).padStart(3, '0')}.png`
));

const HOVER_FRAMES = Array.from({ length: 49 }, (_, index) => (
  `../../assets/animation/hover-higgsfield-attention/frame-${String(index).padStart(3, '0')}.png`
));

// The useful action is the second half of the generated clip: a neutral devil
// pose, one contained hop with flames, then the same neutral pose. Keeping the
// pitchfork inside each image prevents Electron's transparent pet window from
// clipping it during the Easter egg.
// Frames 29-31 shrink the entire character as anticipation rather than making
// him crouch. Skip that generated scale wobble so he stays full-size until the
// flame-powered jump begins.
const DEVIL_FRAME_NUMBERS = [24, 25, 26, 27, 28, ...Array.from({ length: 17 }, (_, index) => index + 32)];
const DEVIL_FRAMES = DEVIL_FRAME_NUMBERS.map(
  (index) => `../../assets/animation/devil-higgsfield-v2/frame-${String(index).padStart(3, '0')}.png`,
);

// Decode the motion frames before a printer enters the printing state. Without
// this warm-up Chromium can visibly hesitate the first time through the loop.
[...PRINTING_FRAMES, ...IDLE_FRAMES, ...ERROR_FRAMES, ...RUNOUT_FRAMES, ...PAUSED_FRAMES, ...COMPLETE_FRAMES, ...HOVER_FRAMES, ...DEVIL_FRAMES].forEach((src) => {
  const frame = new Image();
  frame.decoding = 'async';
  frame.src = src;
  frame.decode?.().catch(() => {});
});

function playBambuEasterEgg() {
  clearInterval(animationTimer);
  clearTimeout(animationTimer);
  animationTimer = null;
  hoverReactionActive = false;
  completionActive = false;
  easterEggActive = true;
  stage.classList.add('bambu-easter');
  let frame = 0;
  const show = () => {
    petSprite.src = DEVIL_FRAMES[frame];
    frame += 1;
    if (frame < DEVIL_FRAMES.length) {
      animationTimer = setTimeout(show, 60);
      return;
    }
    animationTimer = setTimeout(() => {
      animationTimer = null;
      easterEggActive = false;
      stage.classList.remove('bambu-easter');
      animationKey = '';
      updateSpriteAnimation(currentVisualStatus, current?.bouncing);
    }, 60);
  };
  show();
}

function playCompleteCelebration() {
  clearInterval(animationTimer);
  clearTimeout(animationTimer);
  animationTimer = null;
  hoverReactionActive = false;
  completionActive = true;
  stage.className = 'complete';
  let frame = 0;
  const show = () => {
    petSprite.src = COMPLETE_FRAMES[frame];
    frame = (frame + 1) % COMPLETE_FRAMES.length;
    animationTimer = setTimeout(show, 77);
  };
  show();
}

function stopCompleteCelebration() {
  if (!completionActive) return;
  clearInterval(animationTimer);
  clearTimeout(animationTimer);
  animationTimer = null;
  completionActive = false;
  animationKey = '';
  currentVisualStatus = 'idle';
  stage.className = 'idle';
  updateSpriteAnimation('idle', false);
}

function playHoverReaction(onFinished) {
  clearInterval(animationTimer);
  clearTimeout(animationTimer);
  animationTimer = null;
  hoverReactionActive = true;
  let frame = 0;
  const show = () => {
    petSprite.src = HOVER_FRAMES[frame];
    frame += 1;
    if (frame < HOVER_FRAMES.length) {
      animationTimer = setTimeout(show, 77);
      return;
    }
    animationTimer = null;
    hoverReactionActive = false;
    onFinished?.();
  };
  show();
}

function stopHoverReaction() {
  if (!hoverReactionActive) return;
  clearInterval(animationTimer);
  clearTimeout(animationTimer);
  animationTimer = null;
  hoverReactionActive = false;
}

function loopFrames(frames, delay) {
  let frame = 0;
  petSprite.src = frames[frame];
  animationTimer = setInterval(() => {
    frame = (frame + 1) % frames.length;
    petSprite.src = frames[frame];
  }, delay);
}

function loopTimeline(poses) {
  let frame = 0;
  const show = () => {
    const pose = poses[frame];
    petSprite.src = pose.src;
    animationTimer = setTimeout(() => {
      frame = (frame + 1) % poses.length;
      show();
    }, pose.hold);
  };
  show();
}

function scheduleIdleBlink() {
  loopFrames(IDLE_FRAMES, 77);
}

function updateSpriteAnimation(status, bouncing) {
  const nextKey = `${status}:${bouncing}`;
  if (nextKey === animationKey) return;
  animationKey = nextKey;
  clearInterval(animationTimer);
  animationTimer = null;
  if (status === 'error' && bouncing) loopFrames(ERROR_FRAMES, 70);
  else if (status === 'filament_out' && bouncing) loopFrames(RUNOUT_FRAMES, 70);
  else if (status === 'printing') loopFrames(PRINTING_FRAMES, 95);
  else if (status === 'paused') loopFrames(PAUSED_FRAMES, 77);
  else if (status === 'idle' || status === 'complete') scheduleIdleBlink();
  else petSprite.src = SPRITES[status] || SPRITES.offline;
}

function label(status) {
  return ({ filament_out: 'FILAMENT OUT', printing: 'PRINTING', paused: 'PAUSED', complete: 'COMPLETE', error: 'ERROR', idle: 'IDLE', offline: 'OFFLINE' })[status] || status;
}

function render(snapshot) {
  current = snapshot;
  const firstRun = !snapshot.onboarded && !snapshot.printers.length;
  const justCompleted = snapshot.status === 'complete' && lastReportedStatus !== 'complete';
  const visualStatus = firstRun || snapshot.status === 'complete' ? 'idle' : snapshot.status;
  if (completionActive && snapshot.status !== 'complete') stopCompleteCelebration();
  if (hoverReactionActive && !['idle', 'complete'].includes(snapshot.status)) stopHoverReaction();
  lastReportedStatus = snapshot.status;
  currentVisualStatus = visualStatus;
  if (!completionActive) stage.className = `${visualStatus}${firstRun ? ' onboarding' : ''}`;
  if (justCompleted) {
    playCompleteCelebration();
  } else if (!hoverReactionActive && !easterEggActive && !completionActive) {
    updateSpriteAnimation(visualStatus, snapshot.bouncing);
  }
  if (snapshot.bouncing) stage.classList.add('bouncing');
}

pet.addEventListener('click', (event) => {
  event.stopPropagation();
  if (dragged) { dragged = false; return; }
  if (!current?.onboarded && !current?.printers.length) {
    pet.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-12px) rotate(-3deg)' }, { transform: 'translateY(0)' }], { duration: 420, easing: 'steps(3)' });
    setTimeout(() => window.spooly.openSettings(), 430);
    return;
  }
  // A completion remains printer-controlled, but clicking Spooly acknowledges
  // the celebration so a printer that holds COMPLETE indefinitely cannot keep
  // him dancing forever. The status bubble still reports COMPLETE.
  stopCompleteCelebration();
  window.spooly.inspectStatus();
});
pet.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  // Hover frames can change the character's apparent scale. A drag is purely
  // positional, so return to the live status animation before moving him.
  stopHoverReaction();
  hoverTriggered = false;
  animationKey = '';
  updateSpriteAnimation(currentVisualStatus, current?.bouncing);
  dragging = true;
  dragged = false;
  dragOrigin = { x: event.screenX, y: event.screenY };
  stage.classList.add('dragging');
  pet.setPointerCapture(event.pointerId);
  window.spooly.beginDrag(dragOrigin);
});
pet.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  if (Math.hypot(event.screenX - dragOrigin.x, event.screenY - dragOrigin.y) > 4) dragged = true;
  if (dragged) window.spooly.moveDrag({ x: event.screenX, y: event.screenY });
});
pet.addEventListener('pointerup', (event) => {
  if (!dragging) return;
  dragging = false;
  stage.classList.remove('dragging');
  if (pet.hasPointerCapture(event.pointerId)) pet.releasePointerCapture(event.pointerId);
  window.spooly.endDrag();
});
pet.addEventListener('lostpointercapture', () => {
  if (!dragging) return;
  dragging = false;
  stage.classList.remove('dragging');
  window.spooly.endDrag();
});
pet.addEventListener('pointercancel', () => {
  dragging = false;
  stage.classList.remove('dragging');
  window.spooly.endDrag();
});
pet.addEventListener('contextmenu', (event) => { event.preventDefault(); window.spooly.openPetMenu(); });
pet.addEventListener('mouseenter', () => {
  window.spooly.setPetHovered(true);
  if (dragging || !['idle', 'complete'].includes(currentVisualStatus) || current?.bouncing || hoverTriggered || completionActive) return;
  hoverTriggered = true;
  playHoverReaction(() => {
    animationKey = '';
    updateSpriteAnimation(currentVisualStatus, current?.bouncing);
  });
});
pet.addEventListener('mouseleave', () => {
  window.spooly.setPetHovered(false);
  hoverTriggered = false;
  stopHoverReaction();
  animationKey = '';
  updateSpriteAnimation(currentVisualStatus, current?.bouncing);
});
window.spooly.onSnapshot(render);
window.spooly.onEasterEgg((kind) => {
  if (kind === 'bambu') playBambuEasterEgg();
  if (kind === 'complete-preview') playCompleteCelebration();
  if (kind === 'hover-preview') {
    playHoverReaction(() => {
      animationKey = '';
      updateSpriteAnimation(currentVisualStatus, current?.bouncing);
    });
  }
});
window.spooly.getSnapshot().then(render);
