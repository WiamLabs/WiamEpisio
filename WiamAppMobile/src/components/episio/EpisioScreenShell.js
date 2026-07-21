/**
 * Shared shell for Episio HTML-matched screens — navy + gold, back + title + scroll.
 * KeyboardAvoidingView keeps footer CTAs reachable when inputs are focused.
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const EpisioScreenShell = ({
  title,
  subtitle,
  children,
  footer,
  scroll = true,
  onBack,
  right,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll
    ? {
      contentContainerStyle: { paddingHorizontal: 20, paddingBottom: footer ? 28 : 40 },
      keyboardShouldPersistTaps: 'handled',
      keyboardDismissMode: 'on-drag',
    }
    : { style: { flex: 1, paddingHorizontal: 20 } };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack || (() => navigation.goBack())}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        </View>
        {right || null}
      </View>
      <Body style={scroll ? { flex: 1 } : undefined} {...bodyProps}>{children}</Body>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontFamily: FONTS.extraBold, color: '#fff', fontSize: 16 },
  sub: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 11.5, marginTop: 2 },
  footer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.navyLine },
});

export default EpisioScreenShell;
