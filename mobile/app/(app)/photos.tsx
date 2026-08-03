import { dateKey } from '@kyro/domain';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { useAuth } from '@/auth/AuthProvider';
import { Card, FeatureScreen, StateMessage, featureStyles } from '@/components/FeatureScreen';
import { useUserData } from '@/hooks/useUserData';
import {
  acknowledgePhotos,
  deletePhoto,
  enqueuePhoto,
  flushPhotoQueue,
  pendingPhotoCount,
  photoUrl,
  preparePhoto,
  shareablePhoto,
  type PendingPhoto,
} from '@/services/photo-storage';
import { saveUserData, SyncConflictError } from '@/services/user-data';
import { tokens } from '@/theme/tokens';

const photoSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
  d: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const photoIndexSchema = z.array(photoSchema).max(5000);

function mergeIndex(
  current: z.infer<typeof photoIndexSchema>,
  uploaded: PendingPhoto[],
): z.infer<typeof photoIndexSchema> {
  return [
    ...current,
    ...uploaded
      .filter((photo) => !current.some(({ id }) => id === photo.id))
      .map((photo) => ({ id: photo.id, d: photo.date })),
  ].slice(-5000);
}

export default function PhotosScreen() {
  const { user } = useAuth();
  const photos = useUserData('photoIndex', photoIndexSchema);
  const [localPhotos, setLocalPhotos] = useState<z.infer<typeof photoIndexSchema>>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => setLocalPhotos(photos.data ?? []), [photos.data]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void Promise.allSettled(
      localPhotos.map(async (photo) => [photo.id, await photoUrl(user.uid, photo.id)] as const),
    ).then((results) => {
      const entries = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      );
      if (active) setUrls(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [localPhotos, user]);

  useEffect(() => {
    if (!user || photos.loading) return;
    let active = true;
    void (async () => {
      const uploaded = await flushPhotoQueue(user.uid);
      const next = mergeIndex(photos.data ?? [], uploaded);
      if (uploaded.length) {
        await saveUserData(user.uid, 'photoIndex', photoIndexSchema, next);
        await acknowledgePhotos(
          user.uid,
          uploaded.map(({ id }) => id),
        );
      }
      const count = await pendingPhotoCount(user.uid);
      if (active) {
        setLocalPhotos(next);
        setPending(count);
        if (uploaded.length) setStatus(`${uploaded.length} foto(s) pendente(s) sincronizada(s).`);
      }
    })().catch(() => {
      if (active) void pendingPhotoCount(user.uid).then(setPending);
    });
    return () => {
      active = false;
    };
  }, [photos.data, photos.loading, user]);

  async function choosePhoto(camera: boolean) {
    if (!user || busy) return;
    setBusy(true);
    setStatus('');
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatus('Permissão necessária para selecionar a foto.');
        return;
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const file = await preparePhoto(user.uid, id, asset.uri);
      const pendingPhoto = { id, date: dateKey(), uri: file.uri };
      await enqueuePhoto(user.uid, pendingPhoto);
      const uploaded = await flushPhotoQueue(user.uid);
      const next = mergeIndex(localPhotos, uploaded);
      if (uploaded.length) {
        const sync = await saveUserData(user.uid, 'photoIndex', photoIndexSchema, next);
        await acknowledgePhotos(
          user.uid,
          uploaded.map(({ id: uploadedId }) => uploadedId),
        );
        setLocalPhotos(next);
        setStatus(
          sync === 'queued'
            ? 'Foto enviada; índice aguardando sincronização.'
            : 'Foto de progresso salva.',
        );
      } else {
        setStatus('Foto protegida no aparelho; upload pendente.');
      }
      setPending(await pendingPhotoCount(user.uid));
    } catch (cause) {
      setStatus(
        cause instanceof SyncConflictError
          ? 'O índice mudou em outro aparelho. A foto continua protegida localmente.'
          : cause instanceof Error && cause.message === 'photoQueueFull'
            ? 'Fila cheia: conecte-se para enviar as fotos pendentes.'
            : cause instanceof Error && cause.message === 'photoSize'
              ? 'A foto continua maior que 3 MB após a otimização.'
              : 'Não foi possível processar a foto.',
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(id: string) {
    if (!user) return;
    Alert.alert('Excluir foto?', 'A foto será removida permanentemente do Storage.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await deletePhoto(user.uid, id);
              const next = localPhotos.filter((photo) => photo.id !== id);
              await saveUserData(user.uid, 'photoIndex', photoIndexSchema, next);
              setLocalPhotos(next);
              setSelected((current) => current.filter((selectedId) => selectedId !== id));
              setStatus('Foto excluída.');
            } catch {
              setStatus('Não foi possível excluir a foto.');
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((selectedId) => selectedId !== id);
      if (current.length >= 2) return [current[1] ?? id, id];
      return [...current, id];
    });
  }

  async function shareSelected() {
    if (!user || selected.length !== 1) return;
    const id = selected[0];
    const remoteUrl = id ? urls[id] : undefined;
    if (!id || !remoteUrl) {
      setStatus('Aguarde a foto terminar de carregar.');
      return;
    }
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        setStatus('Compartilhamento de arquivos não está disponível neste aparelho.');
        return;
      }
      const file = await shareablePhoto(user.uid, id, remoteUrl);
      await Sharing.shareAsync(file.uri, {
        dialogTitle: 'Compartilhar progresso KYRO',
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
      });
      setStatus('Compartilhamento aberto.');
    } catch {
      setStatus('Não foi possível compartilhar a foto.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FeatureScreen eyebrow="PROGRESSO VISUAL" title="Fotos">
      <Card>
        <Text style={featureStyles.cardTitle}>Nova foto de progresso</Text>
        <Text style={featureStyles.muted}>
          JPEG otimizado, sem metadados EXIF e limitado a 3 MB.
        </Text>
        <View style={styles.actions}>
          <Pressable
            disabled={busy}
            onPress={() => void choosePhoto(true)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Câmera</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => void choosePhoto(false)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Galeria</Text>
          </Pressable>
        </View>
        {pending ? <Text style={featureStyles.muted}>{pending} upload(s) pendente(s).</Text> : null}
        {status ? (
          <Text accessibilityLiveRegion="polite" style={featureStyles.muted}>
            {status}
          </Text>
        ) : null}
      </Card>
      {photos.loading ? <StateMessage>Carregando fotos…</StateMessage> : null}
      {photos.error ? (
        <StateMessage error>Não foi possível carregar o índice de fotos.</StateMessage>
      ) : null}
      {!photos.loading && !localPhotos.length ? (
        <StateMessage>Nenhuma foto de progresso.</StateMessage>
      ) : null}
      {selected.length ? (
        <Card>
          <Text style={featureStyles.cardTitle}>
            {selected.length === 2 ? 'Comparação selecionada' : 'Foto selecionada'}
          </Text>
          <View style={styles.comparison}>
            {selected.map((id) =>
              urls[id] ? (
                <Image key={id} source={{ uri: urls[id] }} style={styles.comparisonImage} />
              ) : null,
            )}
          </View>
          <Text style={featureStyles.muted}>
            {selected.length === 2
              ? 'Compare as duas datas lado a lado.'
              : 'Selecione duas fotos para comparar ou compartilhe esta foto.'}
          </Text>
          <View style={styles.actions}>
            <Pressable
              disabled={busy || selected.length !== 1}
              onPress={() => void shareSelected()}
              style={[styles.primaryButton, selected.length !== 1 && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>Compartilhar</Text>
            </Pressable>
            <Pressable onPress={() => setSelected([])} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Limpar</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}
      <View style={styles.grid}>
        {[...localPhotos].reverse().map((photo) => (
          <View key={photo.id} style={styles.photoCard}>
            {urls[photo.id] ? (
              <Image
                accessibilityLabel={`Foto de progresso ${photo.d}`}
                source={{ uri: urls[photo.id] }}
                style={styles.image}
              />
            ) : (
              <View style={styles.placeholder}>
                <Text style={featureStyles.muted}>Carregando…</Text>
              </View>
            )}
            <View style={styles.photoMeta}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected.includes(photo.id) }}
                onPress={() => toggleSelected(photo.id)}
                style={[
                  styles.selectButton,
                  selected.includes(photo.id) && styles.selectButtonActive,
                ]}
              >
                <Text
                  style={selected.includes(photo.id) ? styles.selectTextActive : styles.selectText}
                >
                  {selected.includes(photo.id) ? '✓ Selecionada' : photo.d}
                </Text>
              </Pressable>
              <Pressable disabled={busy} onPress={() => confirmDelete(photo.id)}>
                <Text style={styles.deleteText}>Excluir</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </FeatureScreen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: tokens.spacing.sm },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.pill,
    flex: 1,
    padding: tokens.spacing.md,
  },
  primaryButtonText: { color: tokens.colors.primaryText, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flex: 1,
    padding: tokens.spacing.md,
  },
  secondaryButtonText: { color: tokens.colors.text, fontWeight: '800' },
  disabledButton: { opacity: 0.4 },
  comparison: { flexDirection: 'row', gap: tokens.spacing.sm },
  comparisonImage: {
    aspectRatio: 3 / 4,
    backgroundColor: tokens.colors.surfaceElevated,
    borderRadius: tokens.radius.sm,
    flex: 1,
  },
  grid: { gap: tokens.spacing.md },
  photoCard: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: { aspectRatio: 3 / 4, backgroundColor: tokens.colors.surfaceElevated, width: '100%' },
  placeholder: {
    alignItems: 'center',
    aspectRatio: 3 / 4,
    backgroundColor: tokens.colors.surfaceElevated,
    justifyContent: 'center',
    width: '100%',
  },
  photoMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
  },
  selectButton: {
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  selectButtonActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  selectText: { color: tokens.colors.muted, fontWeight: '700' },
  selectTextActive: { color: tokens.colors.primaryText, fontWeight: '800' },
  deleteText: { color: tokens.colors.danger, fontWeight: '700' },
});
