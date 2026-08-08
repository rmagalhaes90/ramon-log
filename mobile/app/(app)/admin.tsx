import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { useLocale } from '@/i18n/LocaleProvider';
import { Card, FeatureScreen, StateMessage, featureStyles } from '@/components/FeatureScreen';
import {
  listAdminAudit,
  listSharedUsers,
  setUserAdmin,
  setUserBlocked,
  type AuditEntry,
  type SharedUser,
} from '@/services/admin';
import { tokens } from '@/theme/tokens';

export default function AdminScreen() {
  const { isAdmin, user } = useAuth();
  const { t } = useLocale();
  const [users, setUsers] = useState<SharedUser[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [busyUid, setBusyUid] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      const [nextUsers, nextAudit] = await Promise.all([listSharedUsers(), listAdminAudit()]);
      setUsers(nextUsers);
      setAudit(nextAudit);
      setStatus('');
    } catch {
      setStatus('Não foi possível carregar usuários.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (isAdmin) void refresh();
  }, [isAdmin]);
  if (!isAdmin) return <Redirect href="/(app)/dashboard" />;

  async function mutate(target: SharedUser, action: 'blocked' | 'admin') {
    setBusyUid(target.uid);
    try {
      if (action === 'blocked') await setUserBlocked(target.uid, !target.blocked);
      else await setUserAdmin(target.uid, !target.isAdmin);
      await refresh();
      setStatus('Permissão atualizada e auditada pelo backend.');
    } catch {
      setStatus('A alteração foi recusada ou falhou.');
    } finally {
      setBusyUid('');
    }
  }
  return (
    <FeatureScreen eyebrow="ADMIN" title={t('users')}>
      <Text style={featureStyles.muted}>
        Até 100 contas. Ações exigem claim admin e são validadas novamente pela Cloud Function.
      </Text>
      {loading ? <StateMessage>{t('loadingUsers')}</StateMessage> : null}
      {status ? <StateMessage>{status}</StateMessage> : null}
      {users.map((item) => (
        <Card key={item.uid}>
          <Text style={featureStyles.cardTitle}>{item.email || item.uid}</Text>
          <Text style={featureStyles.muted}>
            {item.blocked ? t('blocked') : t('active')} · {item.isAdmin ? 'Admin' : t('user')}
          </Text>
          <View style={styles.actions}>
            <Pressable
              disabled={busyUid === item.uid || item.uid === user?.uid}
              onPress={() => void mutate(item, 'blocked')}
              style={styles.button}
            >
              <Text style={styles.buttonText}>{item.blocked ? 'Desbloquear' : 'Bloquear'}</Text>
            </Pressable>
            <Pressable
              disabled={busyUid === item.uid || item.uid === user?.uid}
              onPress={() => void mutate(item, 'admin')}
              style={styles.button}
            >
              <Text style={styles.buttonText}>
                {item.isAdmin ? 'Remover admin' : 'Tornar admin'}
              </Text>
            </Pressable>
          </View>
        </Card>
      ))}
      <Text style={featureStyles.cardTitle}>{t('recentAudit')}</Text>
      {audit.map((entry) => (
        <Card key={entry.id}>
          <Text style={featureStyles.muted}>
            {entry.at || 'Pendente'} · {entry.action} · {entry.targetUid.slice(0, 8)} ·{' '}
            {String(entry.value)}
          </Text>
        </Card>
      ))}
    </FeatureScreen>
  );
}
const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: tokens.spacing.sm },
  button: {
    alignItems: 'center',
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flex: 1,
    padding: tokens.spacing.sm,
  },
  buttonText: { color: tokens.colors.text, fontSize: 12, fontWeight: '800' },
});
