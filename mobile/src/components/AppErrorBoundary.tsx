import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { reportDiagnostic } from '@/services/diagnostics';
import { tokens } from '@/theme/tokens';

interface State {
  failed: boolean;
}
export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    void reportDiagnostic(
      new Error(`${error.message}\n${info.componentStack ?? ''}`),
      'react-boundary',
    );
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          O KYRO encontrou um erro
        </Text>
        <Text style={styles.body}>
          O diagnóstico ficou salvo somente neste aparelho. Seus dados não foram apagados.
        </Text>
        <Pressable onPress={() => this.setState({ failed: false })} style={styles.button}>
          <Text style={styles.buttonText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }
}
const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: tokens.colors.background,
    flex: 1,
    gap: tokens.spacing.md,
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  title: { color: tokens.colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  body: { color: tokens.colors.muted, lineHeight: 22, textAlign: 'center' },
  button: {
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.pill,
    padding: tokens.spacing.md,
  },
  buttonText: { color: tokens.colors.primaryText, fontWeight: '800' },
});
