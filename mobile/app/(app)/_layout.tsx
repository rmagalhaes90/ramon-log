import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { tokens } from '@/theme/tokens';

export default function ProtectedLayout() {
  const { status, logout } = useAuth();
  if (status === 'loading')
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.colors.primary} size="large" />
      </View>
    );
  if (status === 'signed-out') return <Redirect href="/login" />;
  if (status === 'unverified') return <Redirect href="/verify-email" />;
  if (status === 'blocked')
    return (
      <View style={styles.center}>
        <Text style={styles.blocked}>
          Esta conta está bloqueada. Entre em contato com o suporte KYRO.
        </Text>
        <Pressable onPress={() => void logout()} style={styles.logout}>
          <Text style={styles.logoutText}>Sair</Text>
        </Pressable>
      </View>
    );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarInactiveTintColor: tokens.colors.muted,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Hoje' }} />
      <Tabs.Screen name="workouts" options={{ title: 'Treinos' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progresso' }} />
      <Tabs.Screen name="nutrition" options={{ title: 'Nutrição' }} />
      <Tabs.Screen name="supplements" options={{ title: 'Suplementos' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    backgroundColor: tokens.colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  blocked: { color: tokens.colors.danger, fontSize: 17, lineHeight: 25, textAlign: 'center' },
  logout: {
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    marginTop: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  logoutText: { color: tokens.colors.text, fontWeight: '700' },
  tabBar: {
    backgroundColor: tokens.colors.surface,
    borderTopColor: tokens.colors.border,
    height: 72,
    paddingBottom: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
  },
});
