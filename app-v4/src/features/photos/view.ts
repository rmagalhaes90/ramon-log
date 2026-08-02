import type { User } from 'firebase/auth';
import type { MessageKey } from '../../core/i18n';
import { reportError } from '../../core/errors';
import { loadUserData, saveUserData } from '../../services/user-data';
import { deletePhoto, photoUrl, uploadPhoto } from '../../services/photo-storage';
import { shareOrFallback } from '../share';
import { dateKey } from '../workouts/model';
import { comparisonReady, validatePhoto } from './model';
import { enqueuePhoto, photoQueueCount } from './offline';
interface Options {
  copy: (key: MessageKey) => string;
  shell: (content: string) => void;
  onBack: () => void;
}
export async function renderPhotosView(user: User, options: Options): Promise<void> {
  const { copy, shell } = options;
  const [photos, pendingCount] = await Promise.all([
    loadUserData(user, 'photoIndex').then((value) => value ?? []),
    photoQueueCount(user),
  ]);
  const selected = new Set<string>();
  shell(
    `<section class="feature-view"><button id="photos-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">02 · RECOVER</p><h1>${copy('progressPhotos')}</h1><form id="photo-form" class="photo-upload"><label>${copy('choosePhoto')}<input id="photo-input" type="file" accept="image/jpeg" capture="environment" required></label><button class="primary">${copy('upload')}</button><progress id="photo-progress" max="100" value="0" hidden></progress><p id="photo-status" role="status">${pendingCount ? `${pendingCount} ${copy('photosPending')}` : ''}</p></form><div class="photo-actions"><button id="compare-photos" disabled>${copy('compare')}</button><button id="share-photos" disabled>${copy('share')}</button></div><div id="photo-comparison" class="photo-comparison" hidden></div><div id="photo-grid" class="photo-grid"></div></section>`,
  );
  document.querySelector('#photos-back')?.addEventListener('click', options.onBack);
  const grid = document.querySelector('#photo-grid');
  const comparison = document.querySelector<HTMLElement>('#photo-comparison');
  const compare = document.querySelector<HTMLButtonElement>('#compare-photos');
  const share = document.querySelector<HTMLButtonElement>('#share-photos');
  const urls = new Map<string, string>();
  const updateActions = () => {
    if (compare) compare.disabled = !comparisonReady(selected);
    if (share) share.disabled = selected.size === 0;
  };
  const results = await Promise.allSettled(
    photos
      .slice()
      .reverse()
      .map(async (photo) => ({ photo, url: await photoUrl(user, photo.id) })),
  );
  results.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    const { photo, url } = result.value;
    urls.set(photo.id, url);
    const card = document.createElement('article');
    const image = document.createElement('img');
    image.src = url;
    image.alt = `${copy('progressPhoto')} ${photo.d}`;
    image.loading = 'lazy';
    const meta = document.createElement('div');
    const choice = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        if (selected.size >= 2) {
          checkbox.checked = false;
          return;
        }
        selected.add(photo.id);
      } else selected.delete(photo.id);
      updateActions();
    });
    choice.append(checkbox, document.createTextNode(` ${photo.d}`));
    const remove = document.createElement('button');
    remove.textContent = copy('remove');
    remove.addEventListener('click', () => {
      if (!confirm(copy('deletePhotoConfirm'))) return;
      remove.disabled = true;
      void deletePhoto(user, photo.id)
        .then(() =>
          saveUserData(
            user,
            'photoIndex',
            photos.filter((item) => item.id !== photo.id),
          ),
        )
        .then(() => renderPhotosView(user, options))
        .catch((error: unknown) => {
          remove.disabled = false;
          reportError(error, 'photos/delete');
        });
    });
    meta.append(choice, remove);
    card.append(image, meta);
    grid?.append(card);
  });
  if (!photos.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = copy('noPhotos');
    grid?.append(empty);
  }
  compare?.addEventListener('click', () => {
    if (!comparison || !comparisonReady(selected)) return;
    comparison.replaceChildren();
    selected.forEach((id) => {
      const url = urls.get(id);
      if (!url) return;
      const image = document.createElement('img');
      image.src = url;
      image.alt = copy('progressPhoto');
      comparison.append(image);
    });
    comparison.hidden = false;
  });
  share?.addEventListener(
    'click',
    () =>
      void (async () => {
        const files: File[] = [];
        for (const id of selected) {
          const url = urls.get(id);
          if (!url) continue;
          const blob = await fetch(url).then((response) => response.blob());
          files.push(new File([blob], `${id}.jpg`, { type: 'image/jpeg' }));
        }
        const result = await shareOrFallback({
          title: 'KYRO Progress',
          text: copy('shareText'),
          files,
        });
        const status = document.querySelector('#photo-status');
        if (status) status.textContent = copy(result === 'shared' ? 'shared' : 'copied');
      })().catch((error: unknown) => {
        if ((error as Error).name !== 'AbortError') reportError(error, 'photos/share');
      }),
  );
  document.querySelector('#photo-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = document.querySelector<HTMLInputElement>('#photo-input')?.files?.[0];
    if (!file) return;
    const validation = validatePhoto(file);
    const status = document.querySelector('#photo-status');
    if (validation) {
      if (status) status.textContent = copy(validation);
      return;
    }
    const progress = document.querySelector<HTMLProgressElement>('#photo-progress');
    if (progress) progress.hidden = false;
    const id = crypto.randomUUID().slice(0, 60);
    const run = navigator.onLine
      ? uploadPhoto(user, id, file, (value) => {
          if (progress) progress.value = value;
        }).then(() => saveUserData(user, 'photoIndex', [...photos, { id, d: dateKey() }]))
      : enqueuePhoto(user, id, file);
    void run
      .then(() => renderPhotosView(user, options))
      .catch(async (error: unknown) => {
        if (!navigator.onLine) {
          try {
            await enqueuePhoto(user, id, file);
            await renderPhotosView(user, options);
            return;
          } catch (queueError) {
            error = queueError;
          }
        }
        try {
          await deletePhoto(user, id);
        } catch {
          /* Upload may not have created an object. */
        }
        reportError(error, 'photos/upload');
        if (status)
          status.textContent = copy(
            (error as Error).message === 'photoQueueFull' ? 'photoQueueFull' : 'uploadFailed',
          );
      });
  });
}
