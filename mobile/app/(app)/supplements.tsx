import { dateKey } from '@kyro/domain';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { Card, FeatureScreen, StateMessage, featureStyles } from '@/components/FeatureScreen';
import { useUserData } from '@/hooks/useUserData';
import { saveUserData, SyncConflictError } from '@/services/user-data';
import { tokens } from '@/theme/tokens';

const supplementsSchema = z
  .array(z.object({ id: z.string(), name: z.string(), times: z.array(z.string()) }))
  .max(100);
const logSchema = z.record(z.string(), z.record(z.string(), z.array(z.boolean())));

export default function SupplementsScreen() {
  const { user } = useAuth();
  const supplements = useUserData('mySupplements', supplementsSchema);
  const logs = useUserData('supplementLog', logSchema);
  const today = logs.data?.[dateKey()] ?? {};
  const [localToday, setLocalToday] = useState<Record<string, boolean[]>>({});
  const [status, setStatus] = useState('');
  useEffect(() => setLocalToday(today), [logs.data]);

  async function toggle(id: string, index: number) {
    if (!user) return;
    const values = [...(localToday[id] ?? [])];
    values[index] = !values[index];
    const nextToday = { ...localToday, [id]: values };
    setLocalToday(nextToday);
    try {
      const result = await saveUserData(user.uid, 'supplementLog', logSchema, {
        ...(logs.data ?? {}),
        [dateKey()]: nextToday,
      });
      setStatus(result === 'queued' ? 'Rotina salva offline.' : 'Rotina sincronizada.');
    } catch (cause) {
      setStatus(
        cause instanceof SyncConflictError
          ? 'Conflito detectado. Atualize os dados.'
          : 'Falha ao salvar.',
      );
    }
  }
  return (
    <FeatureScreen eyebrow="ROTINA" title="Suplementos">
      {supplements.loading || logs.loading ? (
        <StateMessage>Carregando suplementos…</StateMessage>
      ) : null}
      {supplements.error || logs.error ? (
        <StateMessage error>Parte da rotina não pôde ser carregada.</StateMessage>
      ) : null}
      {!supplements.loading && !supplements.data?.length ? (
        <StateMessage>Nenhum suplemento configurado.</StateMessage>
      ) : null}
      {supplements.data?.map((supplement) => {
        const completed = localToday[supplement.id]?.filter(Boolean).length ?? 0;
        return (
          <Card key={supplement.id}>
            <Text style={featureStyles.cardTitle}>{supplement.name}</Text>
            <Text style={featureStyles.muted}>
              {supplement.times.join(' · ') || 'Sem horário'} · {completed}/
              {supplement.times.length} concluídos
            </Text>
            <View style={styles.times}>
              {supplement.times.map((time, index) => (
                <Pressable
                  key={`${time}-${index}`}
                  onPress={() => void toggle(supplement.id, index)}
                  style={[styles.time, localToday[supplement.id]?.[index] && styles.done]}
                >
                  <Text
                    style={localToday[supplement.id]?.[index] ? styles.doneText : styles.timeText}
                  >
                    {time}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        );
      })}
      {status ? (
        <Text accessibilityLiveRegion="polite" style={featureStyles.muted}>
          {status}
        </Text>
      ) : null}
    </FeatureScreen>
  );
}

const styles = StyleSheet.create({
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  time: {
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  done: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
  timeText: { color: tokens.colors.text },
  doneText: { color: tokens.colors.primaryText, fontWeight: '800' },
});
import { useAuth } from '@/auth/AuthProvider';
