/**
 * Block creator — confirm
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { UserX } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const BlockCreatorScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const creatorName = route.params?.creatorName || 'this creator';

  const confirm = () => {
    Alert.alert('Blocked', `You will no longer see content from ${creatorName}.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <EpisioScreenShell
      title="Block creator"
      scroll={false}
      footer={(
        <>
          <TouchableOpacity style={styles.danger} onPress={confirm}>
            <Text style={styles.dangerText}>Block {creatorName}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </>
      )}
    >
      <View style={styles.center}>
        <UserX size={44} color={COLORS.error} />
        <Text style={styles.headline}>Block {creatorName}?</Text>
        <Text style={styles.sub}>
          Their series will be hidden from your feed. You can unblock later in Settings.
        </Text>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  headline: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.text, textAlign: 'center' },
  sub: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 20 },
  danger: { backgroundColor: COLORS.error, borderRadius: RADIUS.md, padding: 15, alignItems: 'center', marginBottom: 8 },
  dangerText: { fontFamily: FONTS.extraBold, fontSize: 14, color: '#fff' },
  cancel: { padding: 12, alignItems: 'center' },
  cancelText: { fontFamily: FONTS.semi, color: COLORS.textDim },
});

export default BlockCreatorScreen;
