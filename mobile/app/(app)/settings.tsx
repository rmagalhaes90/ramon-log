import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Card, FeatureScreen, featureStyles } from '@/components/FeatureScreen';
import { useLocale } from '@/i18n/LocaleProvider';
import { deleteOwnAccount, usesPassword } from '@/services/account';
import { tokens } from '@/theme/tokens';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const passwordRequired = user ? usesPassword(user) : false;

  function confirmDeletion() {
    if (!user || phrase.trim().toUpperCase() !== 'EXCLUIR') {
      setStatus('Digite EXCLUIR para confirmar.');
      return;
    }
    if (passwordRequired && !password) {
      setStatus('Informe sua senha atual.');
      return;
    }
    Alert.alert(
      'Excluir conta permanentemente?',
      'Treinos, progresso, nutrição e fotos serão apagados. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir tudo', style: 'destructive', onPress: () => void runDeletion() },
      ],
    );
  }

  async function runDeletion() {
    if (!user) return;
    setBusy(true);
    setStatus('Excluindo conta e dados…');
    try {
      await deleteOwnAccount(user, password);
      setStatus('Conta excluída.');
    } catch (cause) {
      setStatus(
        cause instanceof Error &&
          (cause.message === 'passwordRequired' || cause.message.includes('invalid-credential'))
          ? 'Senha inválida. A conta não foi excluída.'
          : 'Não foi possível excluir. Nenhum dado local foi removido.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <FeatureScreen eyebrow={t('account')} title={t('accountSettings')}>
      <Card>
        <Text style={featureStyles.cardTitle}>{t('session')}</Text>
        <Text style={featureStyles.muted}>{user?.email}</Text>
        <Pressable disabled={busy} onPress={() => void logout()} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>{t('logout')}</Text>
        </Pressable>
      </Card>
      <Card>
        <Text style={styles.dangerTitle}>{t('deleteAccount')}</Text>
        <Text style={featureStyles.muted}>
          Remove permanentemente autenticação, documentos Firestore e fotos privadas do Storage.
        </Text>
        <TextInput
          autoCapitalize="characters"
          editable={!busy}
          onChangeText={setPhrase}
          placeholder="Digite EXCLUIR"
          placeholderTextColor={tokens.colors.muted}
          style={styles.input}
          value={phrase}
        />
        {passwordRequired ? (
          <TextInput
            editable={!busy}
            onChangeText={setPassword}
            placeholder="Senha atual"
            placeholderTextColor={tokens.colors.muted}
            secureTextEntry
            style={styles.input}
            value={password}
          />
        ) : null}
        {status ? (
          <Text accessibilityLiveRegion="assertive" style={styles.status}>
            {status}
          </Text>
        ) : null}
        <Pressable disabled={busy} onPress={confirmDeletion} style={styles.dangerButton}>
          <Text style={styles.dangerButtonText}>{t('deleteForever')}</Text>
        </Pressable>
      </Card>
    </FeatureScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: tokens.colors.surfaceElevated,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    color: tokens.colors.text,
    padding: tokens.spacing.md,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    padding: tokens.spacing.md,
  },
  secondaryText: { color: tokens.colors.text, fontWeight: '800' },
  dangerTitle: { color: tokens.colors.danger, fontSize: 18, fontWeight: '800' },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: tokens.colors.danger,
    borderRadius: tokens.radius.pill,
    padding: tokens.spacing.md,
  },
  dangerButtonText: { color: '#240408', fontWeight: '900' },
  status: { color: tokens.colors.muted, lineHeight: 21 },
});
