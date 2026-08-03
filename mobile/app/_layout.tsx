import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { tokens } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: tokens.colors.surface },
          headerTintColor: tokens.colors.text,
          contentStyle: { backgroundColor: tokens.colors.background },
        }}
      />
    </>
  );
}
