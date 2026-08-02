import type { User } from 'firebase/auth';
import type { MessageKey } from '../../core/i18n';
import { reportError } from '../../core/errors';
import { loadUserData } from '../../services/user-data';
import { dateKey } from '../workouts/model';
import { createBackup, parseBackup, restoreBackup } from './index';
import { sessionsCsv } from './csv';

type Copy = (key: MessageKey) => string;
function download(content: BlobPart, type: string, name: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function bindDataPortability(user: User, copy: Copy): void {
  const csvButton = document.createElement('button');
  csvButton.textContent = copy('exportCsv');
  document.querySelector('.backup-card>div')?.append(csvButton);
  csvButton.addEventListener(
    'click',
    () =>
      void loadUserData(user, 'sessionLog')
        .then((sessions) =>
          download(
            sessionsCsv(sessions ?? []),
            'text/csv;charset=utf-8',
            `kyro-sessions-${dateKey()}.csv`,
          ),
        )
        .catch((error: unknown) => reportError(error, 'backup/csv')),
  );
  document.querySelector('#export-data')?.addEventListener(
    'click',
    () =>
      void createBackup(user)
        .then((backup) => {
          download(
            JSON.stringify(backup, null, 2),
            'application/json',
            `kyro-backup-${dateKey()}.json`,
          );
          const status = document.querySelector('#backup-status');
          if (status) status.textContent = copy('exportReady');
        })
        .catch((error: unknown) => reportError(error, 'backup/export')),
  );
  document.querySelector<HTMLInputElement>('#import-data')?.addEventListener('change', (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const status = document.querySelector('#backup-status');
    if (status) status.textContent = copy('validatingBackup');
    void file
      .text()
      .then(parseBackup)
      .then(async (backup) => {
        const safety = await createBackup(user);
        download(
          JSON.stringify(safety, null, 2),
          'application/json',
          `kyro-before-import-${dateKey()}.json`,
        );
        if (!confirm(copy('importConfirm'))) throw new DOMException('Cancelled', 'AbortError');
        await restoreBackup(user, backup);
        if (status) status.textContent = copy('importComplete');
      })
      .catch((error: unknown) => {
        if ((error as Error).name === 'AbortError') return;
        reportError(error, 'backup/import');
        if (status)
          status.textContent = copy(
            (error as Error).message === 'backupTooLarge' ? 'backupTooLarge' : 'backupInvalid',
          );
      });
  });
}
