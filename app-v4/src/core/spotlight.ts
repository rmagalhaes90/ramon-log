export interface SpotlightCopy {
  title: string;
  body: string;
  actionLabel: string;
}

export function shouldShowRoutineSpotlight(params: {
  tourDone: boolean;
  spotlightDone: boolean;
  hasRoutine: boolean;
}): boolean {
  return params.tourDone && !params.spotlightDone && !params.hasRoutine;
}

export function showSpotlight(
  target: HTMLElement,
  copyText: SpotlightCopy,
  onDismiss: () => void,
): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'spotlight-overlay';
  const hole = document.createElement('div');
  hole.className = 'spotlight-hole';
  const tooltip = document.createElement('div');
  tooltip.className = 'spotlight-tooltip';
  const title = document.createElement('h3');
  title.textContent = copyText.title;
  const body = document.createElement('p');
  body.textContent = copyText.body;
  const action = document.createElement('button');
  action.type = 'button';
  action.textContent = copyText.actionLabel;
  tooltip.append(title, body, action);
  overlay.append(hole, tooltip);
  document.body.append(overlay);

  const position = () => {
    const rect = target.getBoundingClientRect();
    const pad = 8;
    hole.style.top = `${rect.top - pad}px`;
    hole.style.left = `${rect.left - pad}px`;
    hole.style.width = `${rect.width + pad * 2}px`;
    hole.style.height = `${rect.height + pad * 2}px`;
    const tooltipTop = Math.min(rect.bottom + 16, window.innerHeight - 180);
    const tooltipLeft = Math.max(16, Math.min(rect.left, window.innerWidth - 296));
    tooltip.style.top = `${tooltipTop}px`;
    tooltip.style.left = `${tooltipLeft}px`;
  };
  position();
  window.addEventListener('resize', position);

  const cleanup = () => {
    window.removeEventListener('resize', position);
    overlay.remove();
  };
  const finish = () => {
    cleanup();
    onDismiss();
  };
  action.addEventListener('click', finish);
  target.addEventListener('click', finish, { once: true });
  return cleanup;
}
