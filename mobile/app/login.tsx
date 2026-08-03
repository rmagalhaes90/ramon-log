import { FirebaseError } from 'firebase/app';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { Screen } from '@/components/Screen';
import { getMobileAuth } from '@/services/firebase';
import { tokens } from '@/theme/tokens';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const auth = getMobileAuth();
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!credential.user.emailVerified) {
        await auth.signOut();
        setError('Verifique seu e-mail antes de entrar.');
        return;
      }
      router.replace('/');
    } catch (cause) {
      setError(
        cause instanceof FirebaseError
          ? 'Não foi possível entrar com essas credenciais.'
          : 'Erro inesperado. Tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Entrar
      </Text>
      <Text style={styles.subtitle}>Use a mesma conta do KYRO Web.</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="E-mail"
        placeholderTextColor={tokens.colors.muted}
        style={styles.input}
        value={email}
      />
      <TextInput
        autoCapitalize="none"
        autoComplete="current-password"
        onChangeText={setPassword}
        placeholder="Senha"
        placeholderTextColor={tokens.colors.muted}
        secureTextEntry
        style={styles.input}
        value={password}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={loading || !email || !password}
        onPress={() => void submit()}
        style={({ pressed }) => [styles.button, (pressed || loading) && styles.disabled]}
      >
        {loading ? (
          <ActivityIndicator color={tokens.colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>Entrar</Text>
        )}
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: tokens.colors.text,
    fontSize: 36,
    fontWeight: '800',
    marginTop: tokens.spacing.xl,
  },
  subtitle: {
    color: tokens.colors.muted,
    fontSize: 16,
    marginBottom: tokens.spacing.lg,
    marginTop: tokens.spacing.sm,
  },
  input: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    color: tokens.colors.text,
    fontSize: 16,
    marginBottom: tokens.spacing.md,
    padding: tokens.spacing.md,
  },
  error: { color: tokens.colors.danger, marginBottom: tokens.spacing.md },
  button: {
    alignItems: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.pill,
    marginTop: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  buttonText: { color: tokens.colors.primaryText, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.55 },
});
