import { dateKey } from '@kyro/domain';
import { Text } from 'react-native';
import { z } from 'zod';

import { Card, FeatureScreen, StateMessage, featureStyles } from '@/components/FeatureScreen';
import { useUserData } from '@/hooks/useUserData';

const supplementsSchema = z
  .array(z.object({ id: z.string(), name: z.string(), times: z.array(z.string()) }))
  .max(100);
const logSchema = z.record(z.string(), z.record(z.string(), z.array(z.boolean())));

export default function SupplementsScreen() {
  const supplements = useUserData('mySupplements', supplementsSchema);
  const logs = useUserData('supplementLog', logSchema);
  const today = logs.data?.[dateKey()] ?? {};
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
        const completed = today[supplement.id]?.filter(Boolean).length ?? 0;
        return (
          <Card key={supplement.id}>
            <Text style={featureStyles.cardTitle}>{supplement.name}</Text>
            <Text style={featureStyles.muted}>
              {supplement.times.join(' · ') || 'Sem horário'} · {completed}/
              {supplement.times.length} concluídos
            </Text>
          </Card>
        );
      })}
    </FeatureScreen>
  );
}
