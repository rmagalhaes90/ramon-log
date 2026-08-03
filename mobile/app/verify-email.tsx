import AsyncStorage from '@react-native-async-storage/async-storage';
import { reload, sendEmailVerification } from 'firebase/auth';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { tokens } from '@/theme/tokens';

export default function VerifyEmailScreen() {
  const { user, logout } = useAuth();
  const [message, setMessage] = useState('');

  async function refresh() {
    if (!user) return router.replace('/login');
    await reload(user);
    if (user.emailVerified) router.replace('/(app)/dashboard');
    else setMessage('A verificação ainda não foi confirmada.');
  }

  async function resend() {
    if (!user) return;
    const key = `@kyro:verify:${user.uid}`;
    const previous = Number(await AsyncStorage.getItem(key)) || 0;
    if (Date.now() - previous < 60_000) {
      setMessage('Aguarde um minuto antes de reenviar.');
      return;
    }
    await sendEmailVerification(user);
    await AsyncStorage.setItem(key, String(Date.now()));
    setMessage('Novo e-mail enviado.');
  }

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Verifique seu e-mail
      </Text>
      <Text style={styles.body}>Enviamos um link para {user?.email ?? 'seu e-mail'}.</Text>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}
      <Pressable onPress={() => void refresh()} style={styles.primary}>
        <Text style={styles.primaryText}>Já verifiquei</Text>
      </Pressable>
      <Pressable onPress={() => void resend()} style={styles.secondary}>
        <Text style={styles.secondaryText}>Reenviar e-mail</Text>
      </Pressable>
      <Pressable onPress={() => void logout()} style={styles.logout}>
        <Text style={styles.secondaryText}>Sair</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: tokens.colors.text,
    fontSize: 34,
    fontWeight: '800',
    marginTop: tokens.spacing.xl,
  },
  body: {
    color: tokens.colors.muted,
    fontSize: 16,
    marginBottom: tokens.spacing.lg,
    marginTop: tokens.spacing.sm,
  },
  message: { color: tokens.colors.text, marginBottom: tokens.spacing.md },
  primary: {
    alignItems: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.pill,
    padding: tokens.spacing.md,
  },
  primaryText: { color: tokens.colors.primaryText, fontWeight: '800' },
  secondary: {
    alignItems: 'center',
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    marginTop: tokens.spacing.md,
    padding: tokens.spacing.md,
  },
  secondaryText: { color: tokens.colors.text, fontWeight: '700' },
  logout: { alignItems: 'center', marginTop: tokens.spacing.lg, padding: tokens.spacing.sm },
});
