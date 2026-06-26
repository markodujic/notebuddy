/**
 * ErrorBoundary – Fängt Runtime-Fehler in Komponenten ab.
 *
 * Verhindert weiße Bildschirme bei Crashes.
 */

import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ThemedView style={styles.container}>
          <View style={styles.content}>
            <ThemedText type="subtitle">Etwas ist schiefgelaufen</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
              {this.state.error?.message ?? 'Unbekannter Fehler'}
            </ThemedText>
            <Pressable onPress={this.handleReset} style={styles.button}>
              <ThemedText type="smallBold" style={styles.buttonText}>Erneut versuchen</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    textAlign: 'center',
    opacity: 0.7,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.16)',
  },
  buttonText: {
    color: '#7c3aed',
  },
});