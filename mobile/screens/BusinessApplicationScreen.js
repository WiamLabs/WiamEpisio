// © 2026 WiamApp. Powered by WiamLabs
// screens/BusinessApplicationScreen.js
// Businesses apply to join WiamApp — starter, growth, enterprise
// Backend: POST /api/business/apply

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, StatusBar, ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/colors';
import { uploadImage } from '../lib/api/uploads';
import { supabase } from '../lib/supabase';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$22/month',
    icon: 'business-outline',
    color: '#3B82F6',
    features: ['Up to 5 team members', 'Basic dashboard', 'Book workers', 'Standard support'],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$44/month',
    icon: 'trending-up-outline',
    color: Colors.gold,
    features: ['Up to 25 team members', 'Advanced analytics', 'Job assignment system', 'Priority support', 'Dedicated account manager'],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$105/month',
    icon: 'building-outline',
    color: '#A8D8F0',
    features: ['Unlimited team members', 'Multi-location management', 'SLA contracts', 'Monthly invoicing', 'API access', 'Dedicated enterprise manager'],
  },
];

export default function BusinessApplicationScreen({ navigation }) {
  const [step, setStep]           = useState(1); // 1 = plan, 2 = details, 3 = documents, 4 = success
  const [plan, setPlan]           = useState('growth');
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [industry, setIndustry]   = useState('');
  const [teamSize, setTeamSize]   = useState('');
  const [registrationDocUri, setRegistrationDocUri] = useState(null);
  const [tinDocUri, setTinDocUri] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [uploadStage, setUploadStage] = useState('');

  const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

  const pickDocument = async (setter) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload your document.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setter(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!companyName || !contactName || !email || !phone) {
      Alert.alert('Required', 'Please fill in all required fields.');
      setStep(2);
      return;
    }
    if (!registrationDocUri || !tinDocUri) {
      Alert.alert('Documents required', 'Please upload both your registration certificate and TIN certificate — these are required before our team can review your business.');
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('You must be logged in to submit a business application.');

      setUploadStage('Uploading registration certificate...');
      const registrationDocUrl = await uploadImage(registrationDocUri, 'business_documents');

      setUploadStage('Uploading TIN certificate...');
      const tinDocUrl = await uploadImage(tinDocUri, 'business_documents');

      setUploadStage('Submitting application...');
      const res = await fetch(`${BACKEND}/api/business/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          plan, companyName, contactName, email, phone, industry, teamSize,
          registrationDocUrl, tinDocUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Application could not be submitted. Please try again.');
      }
      setStep(4);
    } catch (err) {
      // Real failure handling — a failed submission must NEVER show
      // the success screen. Every previous version of this screen
      // did exactly that, which meant no application was ever
      // actually recorded even when the user saw "Submitted!"
      Alert.alert('Could not submit', err.message);
    } finally {
      setLoading(false);
      setUploadStage('');
    }
  };

  const selectedPlan = PLANS.find(p => p.id === plan);

  if (step === 4) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Application Submitted!</Text>
          <Text style={styles.successSub}>
            Our team is reviewing your registration documents for the {selectedPlan?.name} plan. This usually takes 24–48 hours.
          </Text>
          <View style={styles.successInfo}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.gold} />
            <Text style={styles.successInfoText}>
              You'll get a notification the moment your Gold checkmark is approved — no action needed from you in the meantime.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.successBtn}
            onPress={() => navigation.navigate('Landing')}
          >
            <Text style={styles.successBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Business Account</Text>
          <Text style={styles.headerSub}>Step {step} of 3</Text>
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Choose Your Plan</Text>
            <Text style={styles.stepSub}>All plans include access to WiamApp's verified worker network across Ghana.</Text>

            {PLANS.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.planCard, plan === p.id && styles.planCardActive]}
                onPress={() => setPlan(p.id)}
              >
                {p.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>Most Popular</Text>
                  </View>
                )}
                <View style={styles.planTop}>
                  <View style={[styles.planIconBox, { backgroundColor: `${p.color}18` }]}>
                    <Ionicons name={p.icon} size={24} color={p.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planName}>{p.name}</Text>
                    <Text style={[styles.planPrice, { color: p.color }]}>{p.price}</Text>
                  </View>
                  <View style={[styles.planRadio, plan === p.id && styles.planRadioActive]}>
                    {plan === p.id && <View style={styles.planRadioDot} />}
                  </View>
                </View>
                {p.features.map(f => (
                  <View key={f} style={styles.featureRow}>
                    <Ionicons name="checkmark" size={14} color={Colors.success} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Company Details</Text>
            <Text style={styles.stepSub}>Tell us about your business so we can set up your account properly.</Text>

            <Text style={styles.fieldLabel}>Company Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Accra Grand Hotel"
              value={companyName}
              onChangeText={setCompanyName}
              placeholderTextColor="#aaa"
            />

            <Text style={styles.fieldLabel}>Contact Person *</Text>
            <TextInput
              style={styles.input}
              placeholder="Kwame Mensah (Operations Manager)"
              value={contactName}
              onChangeText={setContactName}
              placeholderTextColor="#aaa"
            />

            <Text style={styles.fieldLabel}>Business Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="operations@yourcompany.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#aaa"
            />

            <Text style={styles.fieldLabel}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="+233 24 123 4567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor="#aaa"
            />

            <Text style={styles.fieldLabel}>Industry</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Hospitality, Banking, Healthcare"
              value={industry}
              onChangeText={setIndustry}
              placeholderTextColor="#aaa"
            />

            <Text style={styles.fieldLabel}>Team Size</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 50 employees"
              value={teamSize}
              onChangeText={setTeamSize}
              placeholderTextColor="#aaa"
            />

            <View style={styles.selectedPlanSummary}>
              <Text style={styles.summaryLabel}>Selected Plan</Text>
              <Text style={[styles.summaryValue, { color: selectedPlan?.color }]}>
                {selectedPlan?.name} — {selectedPlan?.price}
              </Text>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Verify Your Business</Text>
            <Text style={styles.stepSub}>
              Required before your Gold checkmark can be approved. Our team reviews these within 24–48 hours.
            </Text>

            <Text style={styles.fieldLabel}>Business Registration Certificate *</Text>
            <TouchableOpacity style={styles.docPicker} onPress={() => pickDocument(setRegistrationDocUri)}>
              {registrationDocUri ? (
                <Image source={{ uri: registrationDocUri }} style={styles.docPreview} />
              ) : (
                <>
                  <Ionicons name="document-attach-outline" size={26} color={Colors.gold} />
                  <Text style={styles.docPickerText}>Tap to upload a clear photo</Text>
                </>
              )}
            </TouchableOpacity>
            {registrationDocUri && (
              <TouchableOpacity onPress={() => pickDocument(setRegistrationDocUri)}>
                <Text style={styles.docRetake}>Retake photo</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.fieldLabel}>TIN Certificate *</Text>
            <TouchableOpacity style={styles.docPicker} onPress={() => pickDocument(setTinDocUri)}>
              {tinDocUri ? (
                <Image source={{ uri: tinDocUri }} style={styles.docPreview} />
              ) : (
                <>
                  <Ionicons name="document-attach-outline" size={26} color={Colors.gold} />
                  <Text style={styles.docPickerText}>Tap to upload a clear photo</Text>
                </>
              )}
            </TouchableOpacity>
            {tinDocUri && (
              <TouchableOpacity onPress={() => pickDocument(setTinDocUri)}>
                <Text style={styles.docRetake}>Retake photo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Footer button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, loading && { opacity: 0.7 }]}
          onPress={() => {
            if (step === 1) setStep(2);
            else if (step === 2) {
              if (!companyName || !contactName || !email || !phone) {
                Alert.alert('Required', 'Please fill in all required fields.');
                return;
              }
              setStep(3);
            }
            else handleSubmit();
          }}
          disabled={loading}
        >
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color={Colors.navy} />
              {uploadStage ? <Text style={styles.nextBtnText}>{uploadStage}</Text> : null}
            </View>
          ) : (
            <>
              <Text style={styles.nextBtnText}>{step === 3 ? 'Submit Application' : 'Continue'}</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.navy} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: '#fff' },
  header:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 12 },
  backBtn:            { padding: 4 },
  headerTitle:        { fontSize: 18, fontWeight: '700', color: Colors.navy },
  headerSub:          { fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  progressBar:        { height: 3, backgroundColor: '#EBEBEB', marginHorizontal: 20 },
  progressFill:       { height: '100%', backgroundColor: Colors.gold, borderRadius: 3 },
  stepContent:        { padding: 20 },
  stepTitle:          { fontSize: 22, fontWeight: '800', color: Colors.navy, marginBottom: 8 },
  stepSub:            { fontSize: 14, color: Colors.light.textSecondary, lineHeight: 21, marginBottom: 20 },
  planCard:           { borderWidth: 1.5, borderColor: '#EBEBEB', borderRadius: 14, padding: 16, marginBottom: 14, position: 'relative', overflow: 'hidden' },
  planCardActive:     { borderColor: Colors.gold, backgroundColor: 'rgba(212,160,23,0.03)' },
  popularBadge:       { position: 'absolute', top: 12, right: 12, backgroundColor: Colors.gold, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  popularText:        { fontSize: 10, fontWeight: '700', color: Colors.navy },
  planTop:            { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  planIconBox:        { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  planName:           { fontSize: 16, fontWeight: '700', color: Colors.navy },
  planPrice:          { fontSize: 14, fontWeight: '700', marginTop: 2 },
  planRadio:          { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#EBEBEB', alignItems: 'center', justifyContent: 'center' },
  planRadioActive:    { borderColor: Colors.gold },
  planRadioDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.gold },
  featureRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  featureText:        { fontSize: 13, color: Colors.light.textSecondary },
  fieldLabel:         { fontSize: 13, fontWeight: '600', color: Colors.navy, marginBottom: 6, marginTop: 16 },
  input:              { backgroundColor: Colors.light.inputBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: Colors.navy, borderWidth: 1, borderColor: Colors.light.border },
  docPicker:          { backgroundColor: Colors.light.inputBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border, borderStyle: 'dashed', height: 110, alignItems: 'center', justifyContent: 'center', marginBottom: 6, overflow: 'hidden' },
  docPreview:         { width: '100%', height: '100%', resizeMode: 'cover' },
  docPickerText:      { fontSize: 13, color: Colors.navy, marginTop: 8, fontWeight: '500' },
  docRetake:          { fontSize: 12.5, color: Colors.gold, fontWeight: '600', marginBottom: 18, alignSelf: 'flex-start' },
  selectedPlanSummary:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(212,160,23,0.08)', borderRadius: 12, padding: 16, marginTop: 20, borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)' },
  summaryLabel:       { fontSize: 13, color: Colors.light.textSecondary },
  summaryValue:       { fontSize: 15, fontWeight: '700' },
  footer:             { padding: 20, paddingBottom: 28, borderTopWidth: 1, borderTopColor: Colors.light.border },
  nextBtn:            { backgroundColor: Colors.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14 },
  nextBtnText:        { fontSize: 16, fontWeight: '700', color: Colors.navy },
  successContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  successIcon:        { marginBottom: 20 },
  successTitle:       { fontSize: 26, fontWeight: '800', color: Colors.navy, textAlign: 'center', marginBottom: 12 },
  successSub:         { fontSize: 15, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 23, marginBottom: 20 },
  successInfo:        { flexDirection: 'row', gap: 10, backgroundColor: 'rgba(212,160,23,0.08)', borderRadius: 12, padding: 14, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)' },
  successInfoText:    { flex: 1, fontSize: 13, color: Colors.navy, lineHeight: 20 },
  successBtn:         { backgroundColor: Colors.gold, paddingHorizontal: 40, paddingVertical: 16, borderRadius: 14 },
  successBtnText:     { fontSize: 16, fontWeight: '700', color: Colors.navy },
});
