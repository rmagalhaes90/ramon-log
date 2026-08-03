import { FirebaseError } from 'firebase/app';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { Screen } from '@/components/Screen';
import { getMobileAuth } from '@/services/firebase';
import { tokens } from '@/theme/tokens';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  async function submit() {
    try {
      await sendPasswordResetEmail(getMobileAuth(), email.trim().toLowerCase().slice(0, 254));
      setMessage('Se a conta existir, você receberá as instruções por e-mail.');
    } catch (cause) {
      setMessage(
        cause instanceof FirebaseError && cause.code === 'auth/too-many-requests'
          ? 'Muitas tentativas. Aguarde antes de tentar novamente.'
          : 'Se a conta existir, você receberá as instruções por e-mail.',
      );
    }
  }

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Recuperar senha
      </Text>
      <Text style={styles.body}>Informe seu e-mail para receber um link seguro.</Text>
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
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}
      <Pressable disabled={!email} onPress={() => void submit()} style={styles.button}>
        <Text style={styles.buttonText}>Enviar link</Text>
      </Pressable>
      <Link href="/login" style={styles.link}>
        Voltar ao login
      </Link>
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
  message: { color: tokens.colors.text, marginBottom: tokens.spacing.md },
  button: {
    alignItems: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.pill,
    padding: tokens.spacing.md,
  },
  buttonText: { color: tokens.colors.primaryText, fontWeight: '800' },
  link: { color: tokens.colors.primary, marginTop: tokens.spacing.lg, textAlign: 'center' },
});
