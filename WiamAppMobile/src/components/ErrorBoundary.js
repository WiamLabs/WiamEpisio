import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, DevSettings } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { getErrorHint, getErrorLocation } from '../utils/errorHints';

class ErrorBoundary extends React.Component {
  state = { error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error?.message, '\nStack:', error?.stack, '\nComponent:', errorInfo?.componentStack);
    this.setState((s) => ({ ...s, errorInfo }));
  }

  handleReload = () => {
    this.setState({ error: null, errorInfo: null });
    if (typeof this.props.onRetry === 'function') {
      this.props.onRetry();
    } else if (__DEV__ && typeof DevSettings?.reload === 'function') {
      DevSettings.reload();
    }
  };

  render() {
    const { error, errorInfo } = this.state;
    const { children } = this.props;

    if (!error) return children;

    const message = error?.message || String(error);
    const hint = getErrorHint(message);
    const location = getErrorLocation(error);
    const componentStack = errorInfo?.componentStack?.trim() || null;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.badge}>ERROR</Text>
          <Text style={styles.title}>Something went wrong</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <View style={styles.card}>
            <Text style={styles.label}>Error message</Text>
            <Text style={styles.errorText} selectable>{message}</Text>
          </View>

          {location && (
            <View style={styles.card}>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.locationText} selectable>{location}</Text>
            </View>
          )}

          {hint && (
            <View style={[styles.card, styles.fixCard]}>
              <Text style={styles.label}>Likely cause</Text>
              <Text style={styles.causeText}>{hint.cause}</Text>
              <Text style={styles.label}>Suggested fix</Text>
              <Text style={styles.fixText} selectable>{hint.fix}</Text>
            </View>
          )}

          {componentStack && __DEV__ && (
            <View style={styles.card}>
              <Text style={styles.label}>Component stack</Text>
              <Text style={styles.stackText} selectable>{componentStack}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={this.handleReload}>
            <Text style={styles.primaryButtonText}>Reload App</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 50,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  badge: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
  },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  fixCard: { borderLeftWidth: 4, borderLeftColor: COLORS.secondary },
  label: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  errorText: { color: COLORS.error, fontSize: 14, lineHeight: 20 },
  locationText: { color: COLORS.secondary, fontSize: 13, fontFamily: 'monospace' },
  causeText: { color: COLORS.textSecondary, fontSize: 14, marginBottom: SPACING.sm },
  fixText: { color: COLORS.text, fontSize: 14, lineHeight: 22 },
  stackText: { color: COLORS.textMuted, fontSize: 11, fontFamily: 'monospace', lineHeight: 16 },
  actions: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  primaryButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ErrorBoundary;
