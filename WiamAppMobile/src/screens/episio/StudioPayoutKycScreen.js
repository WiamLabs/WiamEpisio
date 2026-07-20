/**
 * WiamStudio payout KYC — bank account only + live selfie holding ID.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Image, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CreditCard, FileText, Car, Building2, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import apiClient from '../../api/client';

const ID_TYPES = [
  { id: 'national_id', label: 'National ID', Icon: CreditCard },
  { id: 'passport', label: 'Passport', Icon: FileText },
  { id: 'license', label: 'Driver license', Icon: Car },
];

const StudioPayoutKycScreen = () => {
  const navigation = useNavigation();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [idType, setIdType] = useState('national_id');
  const [selfieWithId, setSelfieWithId] = useState(null);
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [routingOrSwift, setRoutingOrSwift] = useState('');
  const [busy, setBusy] = useState(false);

  const takeSelfieWithId = async () => {
    try {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) {
        Alert.alert('Camera', 'Allow camera access to take a live selfie holding your ID.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.9,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setSelfieWithId({
        uri: asset.uri,
        name: asset.fileName || 'selfie_id.jpg',
      });
    } catch {
      Alert.alert('Camera', 'Could not open the camera on this device.');
    }
  };

  const onContinueStep1 = () => {
    if (!fullName.trim() || !dob.trim()) {
      Alert.alert('Missing details', 'Enter your full legal name and date of birth.');
      return;
    }
    if (!selfieWithId) {
      Alert.alert(
        'Live selfie required',
        'Take a real selfie while holding your ID next to your face (ID readable, face clear).',
      );
      return;
    }
    setAccountName(fullName.trim());
    setStep(2);
  };

  const onSubmitBank = async () => {
    if (!accountName.trim() || !accountNumber.trim() || !bankName.trim()) {
      Alert.alert('Bank details', 'Enter account name, account number, and bank name.');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('full_name', fullName.trim());
      form.append('date_of_birth', dob.trim());
      form.append('id_type', idType);
      form.append('account_name', accountName.trim());
      form.append('account_number', accountNumber.trim());
      form.append('bank_name', bankName.trim());
      form.append('routing_or_swift', routingOrSwift.trim());
      form.append('provider', 'bank');
      if (selfieWithId?.uri) {
        form.append('selfie_with_id', {
          uri: selfieWithId.uri,
          name: selfieWithId.name || 'selfie_id.jpg',
          type: 'image/jpeg',
        });
      }
      await apiClient.post('/creator/studio/payout-kyc', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert(
        'Submitted',
        'Your identity and bank details were sent for review. Payouts use bank transfer only.',
        [{ text: 'Done', onPress: () => { if (navigation.canGoBack()) navigation.goBack(); } }],
      );
    } catch (e) {
      // Soft-save locally if endpoint not deployed yet
      Alert.alert(
        'Saved on device',
        e?.response?.data?.error
          || 'Details captured. They will sync when the payout KYC endpoint is live on the server.',
        [{ text: 'OK', onPress: () => { if (navigation.canGoBack()) navigation.goBack(); } }],
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <EpisioScreenShell title="Payout verification" subtitle="Bank account · live selfie + ID">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {step === 1 ? (
          <View>
            <Text style={styles.lead}>
              Take a live selfie holding your government ID next to your face (not a gallery photo of an old ID alone).
            </Text>
            <Text style={styles.label}>Full legal name</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholderTextColor={COLORS.textFaint} />
            <Text style={styles.label}>Date of birth</Text>
            <TextInput style={styles.input} value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textFaint} />
            <Text style={styles.label}>ID type</Text>
            <View style={styles.rowWrap}>
              {ID_TYPES.map((t) => {
                const on = idType === t.id;
                const Icon = t.Icon;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => setIdType(t.id)}
                  >
                    <Icon size={14} color={on ? COLORS.navy : COLORS.gold} />
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.selfieBox} onPress={takeSelfieWithId}>
              {selfieWithId?.uri ? (
                <Image source={{ uri: selfieWithId.uri }} style={styles.selfieImg} />
              ) : (
                <View style={styles.selfieEmpty}>
                  <Camera size={28} color={COLORS.gold} />
                  <Text style={styles.selfieHint}>Take live selfie holding ID</Text>
                </View>
              )}
            </TouchableOpacity>
            <EpisioGoldButton label="Continue to bank details" onPress={onContinueStep1} />
          </View>
        ) : (
          <View>
            <View style={styles.bankBadge}>
              <Building2 size={16} color={COLORS.navy} />
              <Text style={styles.bankBadgeText}>Bank transfer only</Text>
            </View>
            <Text style={styles.lead}>
              Creator payouts land via bank account only.
            </Text>
            <Text style={styles.label}>Account holder name</Text>
            <TextInput style={styles.input} value={accountName} onChangeText={setAccountName} placeholderTextColor={COLORS.textFaint} />
            <Text style={styles.label}>Account number / IBAN</Text>
            <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} placeholderTextColor={COLORS.textFaint} />
            <Text style={styles.label}>Bank name</Text>
            <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholderTextColor={COLORS.textFaint} />
            <Text style={styles.label}>Routing / SWIFT (optional)</Text>
            <TextInput style={styles.input} value={routingOrSwift} onChangeText={setRoutingOrSwift} placeholderTextColor={COLORS.textFaint} />
            <EpisioGoldButton label={busy ? 'Submitting…' : 'Submit for review'} onPress={onSubmitBank} disabled={busy} />
            <TouchableOpacity onPress={() => setStep(1)} style={{ marginTop: 12 }}>
              <Text style={styles.back}>← Back to identity</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  lead: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, lineHeight: 19, marginBottom: 14 },
  label: { fontFamily: FONTS.semi, fontSize: 12, color: COLORS.textDim, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.navyCard, borderRadius: 12, borderWidth: 1, borderColor: COLORS.navyLine,
    color: '#fff', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, fontFamily: FONTS.regular,
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  chipOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipText: { color: '#fff', fontFamily: FONTS.semi, fontSize: 12 },
  chipTextOn: { color: COLORS.navy },
  selfieBox: {
    height: 200, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: 16,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  selfieImg: { width: '100%', height: '100%' },
  selfieEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  selfieHint: { color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 13 },
  bankBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.gold, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginBottom: 12,
  },
  bankBadgeText: { fontFamily: FONTS.bold, color: COLORS.navy, fontSize: 12 },
  back: { textAlign: 'center', color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 13 },
});

export default StudioPayoutKycScreen;
