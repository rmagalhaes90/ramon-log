import { z } from 'zod';
import { Text } from 'react-native';

import { Card, FeatureScreen, StateMessage, featureStyles } from '@/components/FeatureScreen';
import { useUserData } from '@/hooks/useUserData';

const weightsSchema = z.array(z.object({ d: z.string(), kg: z.number() })).max(5000);
const measurementsSchema = z.record(
  z.string(),
  z.object({
    waist: z.number().optional(),
    chest: z.number().optional(),
    arm: z.number().optional(),
    hip: z.number().optional(),
    thigh: z.number().optional(),
  }),
);

export default function ProgressScreen() {
  const weights = useUserData('bodyWeights', weightsSchema);
  const measurements = useUserData('bodyMeasurements', measurementsSchema);
  const latestWeights = [...(weights.data ?? [])]
    .sort((a, b) => b.d.localeCompare(a.d))
    .slice(0, 8);
  const latestMeasurements = Object.entries(measurements.data ?? {})
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 5);
  const loading = weights.loading || measurements.loading;
  const error = weights.error || measurements.error;
  return (
    <FeatureScreen eyebrow="EVOLUÇÃO" title="Progresso">
      {loading ? <StateMessage>Carregando progresso…</StateMessage> : null}
      {error ? <StateMessage error>Parte dos dados não pôde ser carregada.</StateMessage> : null}
      <Card>
        <Text style={featureStyles.cardTitle}>Peso recente</Text>
        {latestWeights.length ? (
          latestWeights.map((entry) => (
            <Text key={entry.d} style={featureStyles.muted}>
              {entry.d} · {entry.kg.toFixed(1)} kg
            </Text>
          ))
        ) : (
          <Text style={featureStyles.muted}>Sem registros.</Text>
        )}
      </Card>
      <Card>
        <Text style={featureStyles.cardTitle}>Medidas recentes</Text>
        {latestMeasurements.length ? (
          latestMeasurements.map(([date, values]) => (
            <Text key={date} style={featureStyles.muted}>
              {date} ·{' '}
              {Object.entries(values)
                .map(([key, value]) => `${key}: ${value} cm`)
                .join(' · ')}
            </Text>
          ))
        ) : (
          <Text style={featureStyles.muted}>Sem registros.</Text>
        )}
      </Card>
    </FeatureScreen>
  );
}
