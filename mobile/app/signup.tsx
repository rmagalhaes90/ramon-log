import { FirebaseError } from 'firebase/app';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { Screen } from '@/components/Screen';
import { getMobileAuth } from '@/services/firebase';
import { tokens } from '@/theme/tokens';

function strongPassword(value: string): boolean {
  return value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
}

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!strongPassword(password)) {
      setError('Use ao menos 12 caracteres, com maiúscula, minúscula e número.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const auth = getMobileAuth();
      auth.languageCode = 'pt';
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase().slice(0, 254),
        password.slice(0, 128),
      );
      await sendEmailVerification(credential.user);
      router.replace('/verify-email');
    } catch (cause) {
      setError(
        cause instanceof FirebaseError && cause.code === 'auth/email-already-in-use'
          ? 'Este e-mail já possui uma conta.'
          : 'Não foi possível criar a conta.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Criar conta
      </Text>
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
        autoComplete="new-password"
        onChangeText={setPassword}
        placeholder="Senha forte"
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
        disabled={loading || !email || !password}
        onPress={() => void submit()}
        style={styles.button}
      >
        {loading ? (
          <ActivityIndicator color={tokens.colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>Criar conta</Text>
        )}
      </Pressable>
      <Link href="/login" style={styles.link}>
        Já tenho uma conta
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: tokens.colors.text,
    fontSize: 34,
    fontWeight: '800',
    marginBottom: tokens.spacing.lg,
    marginTop: tokens.spacing.xl,
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
    padding: tokens.spacing.md,
  },
  buttonText: { color: tokens.colors.primaryText, fontSize: 16, fontWeight: '800' },
  link: { color: tokens.colors.primary, marginTop: tokens.spacing.lg, textAlign: 'center' },
});
