import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { tokens } from '@/theme/tokens';
import { AuthProvider } from '@/auth/AuthProvider';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <LocaleProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: tokens.colors.surface },
              headerTintColor: tokens.colors.text,
              contentStyle: { backgroundColor: tokens.colors.background },
            }}
          />
        </AuthProvider>
      </LocaleProvider>
    </AppErrorBoundary>
  );
}
