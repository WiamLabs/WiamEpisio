// © 2026 WiamApp. Powered by WiamLabs
// screens/RegisterScreen.js
// FIXED:
// 1. Registration uses Supabase directly — no backend needed, no "fetch failed"
// 2. FlatList replaced with ScrollView inside dropdowns — fixes VirtualizedList warning
// 3. City search uses improved Nominatim that finds ALL Ghana towns including small ones

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet,  StatusBar,
  KeyboardAvoidingView, Platform, ScrollView,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COUNTRIES, DEFAULT_COUNTRY } from '../constants/countries';
import { searchWiamAppSkills, resolveWiamAppSkill } from '../constants/skills';
import { confirmLocationSetup } from '../lib/locationWarning';
import { reverseGeocodePlace } from '../lib/reverseGeocode';
import * as Location from 'expo-location';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

const LOGO    = require('../assets/logo.png');
const BG      = '#0D0D2B';
const GOLD    = '#D4A017';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.45)';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const GOLD_BD = 'rgba(212,160,23,0.25)';
const INPUT_BG= 'rgba(255,255,255,0.07)';
const INPUT_BD= 'rgba(255,255,255,0.12)';
const DROP_BG = '#1A1A3A';

// ── Skill type-ahead (workers type what they offer; must match WiamApp) ──
function SkillTypeInput({ value, onChange, onResolved }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showTip, setShowTip] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (value != null && value !== query) setQuery(value);
  }, [value]);

  const handleChange = (text) => {
    setQuery(text);
    onChange(text);
    if (text.trim().length > 0) setShowTip(false);
    else setShowTip(true);

    const matches = searchWiamAppSkills(text, 8);
    setSuggestions(matches);
    const resolved = resolveWiamAppSkill(text);
    setInvalid(text.trim().length >= 2 && !resolved && matches.length === 0);
    onResolved?.(resolved);
  };

  const pick = (skill) => {
    setQuery(skill.name);
    onChange(skill.name);
    setSuggestions([]);
    setShowTip(false);
    setInvalid(false);
    onResolved?.({ skillName: skill.name, categoryName: skill.category });
  };

  return (
    <View>
      {showTip && (
        <View style={s.skillTip}>
          <Ionicons name="information-circle-outline" size={15} color={GOLD} />
          <Text style={s.skillTipText}>
            Type the skill you offer (e.g. Electrician, Barber, Plumber). It must be a skill WiamApp supports — suggestions will appear as you type.
          </Text>
        </View>
      )}
      <View style={[s.inputWrap, invalid && { borderColor: 'rgba(239,68,68,0.5)' }]}>
        <Ionicons name="construct-outline" size={17} color="rgba(255,255,255,0.35)" style={s.inputIcon} />
        <TextInput
          style={[s.inputText, { flex: 1 }]}
          placeholder="Type your main skill…"
          placeholderTextColor={MUTED}
          value={query}
          onChangeText={handleChange}
          autoCapitalize="words"
        />
        {!!query && (
          <TouchableOpacity onPress={() => handleChange('')} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={16} color={MUTED} />
          </TouchableOpacity>
        )}
      </View>
      {invalid && (
        <Text style={s.pwWarn}>
          That skill is not on WiamApp yet. Choose from the suggestions below.
        </Text>
      )}
      {suggestions.length > 0 && (
        <View style={s.dropDown}>
          <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.name}
                style={s.dropItem}
                onPress={() => pick(item)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.dropItemText}>{item.name}</Text>
                  <Text style={s.dropItemCode}>{item.category}</Text>
                </View>
                <Ionicons name="checkmark" size={14} color={GOLD} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── Country Picker ─────────────────────────────────────────────
// FIX: Uses ScrollView instead of FlatList to avoid VirtualizedList warning
function CountryPicker({ value, onSelect }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <View>
      <TouchableOpacity style={s.inputWrap} onPress={() => setOpen(!open)} activeOpacity={0.8}>
        <Ionicons name="globe-outline" size={17} color="rgba(255,255,255,0.35)" style={s.inputIcon} />
        <Text style={[s.inputText, !value && s.inputPlaceholder]}>
          {value ? `${value.flag}  ${value.name}  (${value.phoneCode})` : 'Select country'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color="rgba(255,255,255,0.3)" />
      </TouchableOpacity>
      {open && (
        <View style={s.dropDown}>
          <View style={s.dropSearch}>
            <Ionicons name="search-outline" size={14} color="rgba(255,255,255,0.3)" />
            <TextInput
              style={s.dropSearchInput}
              placeholder="Search country..."
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
          {/* ✅ FIX: ScrollView instead of FlatList — no more VirtualizedList warning */}
          <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {filtered.map(item => {
              const selected = value?.code === item.code;
              return (
                <TouchableOpacity
                  key={item.code}
                  style={[s.dropItem, selected && s.dropItemActive]}
                  onPress={() => { onSelect(item); setOpen(false); setSearch(''); }}
                >
                  <Text style={s.dropItemText}>{item.flag}  {item.name}</Text>
                  <Text style={s.dropItemCode}>{item.phoneCode}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── City Search ────────────────────────────────────────────────
// ✅ FIX: Removed strict type filter — now finds ALL towns including Kwahu Tafo
function CitySearch({ country, value, onSelect }) {
  const [query,       setQuery]       = useState(value || '');
  const [results,     setResults]     = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounce = useRef(null);

  // Keep the input in sync when "Use my location" fills the city
  useEffect(() => {
    if (value != null && value !== query) setQuery(value);
  }, [value]);

  const search = useCallback((text) => {
    setQuery(text);
    if (text.length < 2) { setResults([]); setShowResults(false); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const cc  = country?.code?.toLowerCase() || 'gh';
        // ✅ FIX: No type filter — finds hamlets, localities, ALL place types
        // ✅ FIX: Added featuretype=settlement to include small towns
        const url = `https://nominatim.openstreetmap.org/search`
          + `?q=${encodeURIComponent(text)}`
          + `&countrycodes=${cc}`
          + `&format=json&addressdetails=1&limit=8`;

        const res  = await fetch(url, {
          headers: { 'User-Agent': 'WiamApp/1.0 (support@wiamapp.com)' },
        });
        const data = await res.json();

        const seen = new Set();
        const cities = [];
        for (const r of data) {
          // ✅ FIX: Extract name from ALL address types, not just city/town/village
          const name =
            r.address?.city        ||
            r.address?.town        ||
            r.address?.village     ||
            r.address?.hamlet      ||   // ✅ NEW
            r.address?.locality    ||   // ✅ NEW
            r.address?.suburb      ||
            r.address?.county      ||   // ✅ NEW
            r.display_name.split(',')[0].trim();

          const region = r.address?.state || r.address?.region || r.address?.county || '';
          const key    = name.toLowerCase();
          if (!name || seen.has(key)) continue;
          seen.add(key);
          cities.push({ id: r.place_id, name, region });
        }
        setResults(cities);
        setShowResults(true);
      } catch (e) {
        console.warn('City search error:', e.message);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
  }, [country]);

  return (
    <View>
      <View style={[s.inputWrap, { paddingRight: 12 }]}>
        <Ionicons name="location-outline" size={17} color="rgba(255,255,255,0.35)" style={s.inputIcon} />
        <TextInput
          style={[s.inputText, { flex: 1 }]}
          placeholder={country ? `Search city in ${country.name}...` : 'Select country first'}
          placeholderTextColor={MUTED}
          value={query}
          onChangeText={search}
          editable={!!country}
        />
        {searching && <ActivityIndicator size="small" color={GOLD} />}
      </View>
      {/* ✅ FIX: ScrollView instead of FlatList */}
      {showResults && results.length > 0 && (
        <View style={s.dropDown}>
          <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {results.map(item => (
              <TouchableOpacity
                key={String(item.id)}
                style={s.dropItem}
                onPress={() => {
                  setQuery(item.name);
                  setShowResults(false);
                  onSelect(item);
                }}
              >
                <Text style={s.dropItemText}>{item.name}</Text>
                {item.region ? <Text style={s.dropItemCode}>{item.region}</Text> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── MAIN REGISTER SCREEN ───────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const [role,     setRole]     = useState('customer');
  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [country,  setCountry]  = useState(DEFAULT_COUNTRY);
  const [city,     setCity]     = useState('');
  const [landmarkDescription, setLandmarkDescription] = useState('');
  const [digitalAddressCode,  setDigitalAddressCode]  = useState('');
  const [coords,   setCoords]   = useState(null); // { latitude, longitude }
  const [locating, setLocating] = useState(false);
  const [locationLabel, setLocationLabel] = useState('');
  const [category, setCategory] = useState('');
  const [resolvedSkill, setResolvedSkill] = useState(null);
  const [agreed,   setAgreed]   = useState(false);
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const canSubmit = fullName.trim() && email.trim() && phone.trim()
    && password.length >= 8 && agreed && city.trim()
    && (role === 'customer' || (role === 'worker' && resolvedSkill));

  // GPS (phone) + OpenStreetMap Nominatim (free reverse-geocode for place names)
  const useMyLocation = async () => {
    const ok = await confirmLocationSetup(role);
    if (!ok) return;

    setLocating(true);
    setError('');
    setLocationLabel('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Enable location in phone Settings, or type your city manually.');
        return;
      }

      // Prefer real GPS over Wi‑Fi/cell guesses (those often land in the wrong suburb)
      await Location.enableNetworkProviderAsync().catch(() => {});
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        mayShowUserSettingsDialog: true,
      });
      const { latitude, longitude, accuracy } = pos.coords;
      setCoords({ latitude, longitude });

      const accuracyNote =
        typeof accuracy === 'number'
          ? ` (±${Math.round(accuracy)}m)`
          : '';

      // Warn if the phone itself is uncertain (wifi/cell, not GPS)
      if (typeof accuracy === 'number' && accuracy > 150) {
        setError(
          'GPS is weak right now (Wi‑Fi / network location). Turn on Location + GPS, go outdoors or near a window, then tap again — or type your city manually.'
        );
      }

      // Native geocoder first; estate labels like "Community 14" never become City
      const place = await reverseGeocodePlace(latitude, longitude);
      if (place.city) setCity(place.city);
      if (place.landmark) setLandmarkDescription(place.landmark);

      setLocationLabel(
        [
          place.label || place.city,
          `${latitude.toFixed(5)}, ${longitude.toFixed(5)}${accuracyNote}`,
          'Review city & landmark — GPS names can be off',
        ].filter(Boolean).join(' · ')
      );
    } catch (e) {
      setError('Could not get your GPS location. Turn on Location / GPS and try again, or type your city.');
    } finally {
      setLocating(false);
    }
  };

  // Register via WiamApp backend (Resend OTP) — avoids Supabase email rate limits
  const handleRegister = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError('');

    const fullPhone = `${country.phoneCode}${phone.trim()}`;
    const cleanEmail = email.trim().toLowerCase();

    try {
      if (!BACKEND) throw new Error('App is not connected to the server. Please reinstall the latest build.');

      const res = await fetch(`${BACKEND}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: cleanEmail,
          phone: fullPhone,
          password,
          role,
          city: city.trim(),
          country: country.name,
          countryCode: country.code,
          landmarkDescription: landmarkDescription || null,
          digitalAddressCode: digitalAddressCode || null,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          category: role === 'worker' ? resolvedSkill.categoryName : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || 'Registration failed. Please try again.';
        if (/rate limit/i.test(msg)) {
          throw new Error('Too many signup attempts. Wait about 1 hour, then try again — or use a different email.');
        }
        throw new Error(msg);
      }

      // Send OTP via Resend (backend) — does NOT hit Supabase email limits
      await fetch(`${BACKEND}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      navigation.navigate('EmailOTP', {
        role,
        email: cleanEmail,
        phone: fullPhone,
        userId: data.userId,
      });

    } catch (err) {
      console.warn('Register error:', err.message);
      const msg = err.message || 'Registration failed. Please check your details and try again.';
      if (/already|exist|registered/i.test(msg)) {
        setError('This email is already registered. Please log in instead.');
      } else if (/rate limit/i.test(msg)) {
        setError('Too many signup attempts. Wait about 1 hour, then try again — or use a different email.');
      } else if (/network|fetch failed|Failed to fetch/i.test(msg)) {
        setError('Cannot reach WiamApp servers. Check your internet and try again.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={WHITE} />
          </TouchableOpacity>

          {/* Logo */}
          <View style={s.brand}>
            <Image source={LOGO} style={s.logo} resizeMode="contain" />
            <Text style={s.brandName}>
              <Text style={{ color: WHITE }}>Wiam</Text>
              <Text style={{ color: GOLD }}>App</Text>
            </Text>
          </View>

          <Text style={s.title}>Create your account</Text>
          <Text style={s.subtitle}>Join Africa's most trusted service marketplace</Text>

          {/* Role Toggle */}
          <View style={s.roleToggle}>
            <TouchableOpacity
              style={[s.roleBtn, role === 'customer' && s.roleBtnActive]}
              onPress={() => { setRole('customer'); setCategory(''); setResolvedSkill(null); }}
              activeOpacity={0.8}
            >
              <Ionicons name="search-outline" size={16}
                color={role === 'customer' ? '#0D0D2B' : MUTED} />
              <Text style={[s.roleBtnText, role === 'customer' && s.roleBtnTextActive]}>
                Find Workers
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.roleBtn, role === 'worker' && s.roleBtnActive]}
              onPress={() => setRole('worker')}
              activeOpacity={0.8}
            >
              <Ionicons name="hammer-outline" size={16}
                color={role === 'worker' ? '#0D0D2B' : MUTED} />
              <Text style={[s.roleBtnText, role === 'worker' && s.roleBtnTextActive]}>
                Offer Skills
              </Text>
            </TouchableOpacity>
          </View>

          {/* Role info */}
          <View style={s.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={GOLD} />
            <Text style={s.infoText}>
              {role === 'customer'
                ? 'You will find and hire verified workers near you. Verify your identity before your first booking.'
                : 'You will offer your skills and receive job requests. Verify your identity to appear in search results.'}
            </Text>
          </View>

          {/* Error */}
          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Full Name */}
          <Text style={s.label}>Full legal name</Text>
          <View style={s.inputWrap}>
            <Ionicons name="person-outline" size={17} color="rgba(255,255,255,0.35)" style={s.inputIcon} />
            <TextInput
              style={[s.inputText, { flex: 1 }]}
              placeholder="As it appears on your ID"
              placeholderTextColor={MUTED}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          {/* Worker skill */}
          {role === 'worker' && (
            <>
              <Text style={s.label}>Your main skill</Text>
              <SkillTypeInput
                value={category}
                onChange={setCategory}
                onResolved={setResolvedSkill}
              />
            </>
          )}

          {/* Email */}
          <Text style={s.label}>Email address</Text>
          <View style={s.inputWrap}>
            <Ionicons name="mail-outline" size={17} color="rgba(255,255,255,0.35)" style={s.inputIcon} />
            <TextInput
              style={[s.inputText, { flex: 1 }]}
              placeholder="your@email.com"
              placeholderTextColor={MUTED}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Country */}
          <Text style={s.label}>Country</Text>
          <CountryPicker value={country} onSelect={setCountry} />

          {/* Phone */}
          <Text style={s.label}>Phone number</Text>
          <View style={s.inputWrap}>
            <Text style={s.phoneCode}>{country?.phoneCode || '+233'}</Text>
            <TextInput
              style={[s.inputText, { flex: 1 }]}
              placeholder="24 000 0000"
              placeholderTextColor={MUTED}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* City */}
          <Text style={s.label}>City / Town</Text>
          <CitySearch
            country={country}
            value={city}
            onSelect={(c) => setCity(c.name)}
          />

          {/* Landmark — works in every country, especially where formal
              street addressing is incomplete. This is how people already
              give directions today; the app just saves it. */}
          <Text style={s.label}>How to find you (landmark / directions)</Text>
          <View style={s.inputWrap}>
            <Ionicons name="flag-outline" size={17} color="rgba(255,255,255,0.35)" style={s.inputIcon} />
            <TextInput
              style={[s.inputText, { flex: 1 }]}
              placeholder="e.g. Blue gate opposite Shell station"
              placeholderTextColor={MUTED}
              value={landmarkDescription}
              onChangeText={setLandmarkDescription}
            />
          </View>

          {/* Digital address code — optional, whatever this country
              already has (GhanaPost GPS, a UK postcode, an Indian PIN,
              a what3words address, anything). WiamApp never validates
              or looks this up — it's just stored as-is. */}
          <Text style={s.label}>Digital address code (optional)</Text>
          <View style={s.inputWrap}>
            <Ionicons name="pricetag-outline" size={17} color="rgba(255,255,255,0.35)" style={s.inputIcon} />
            <TextInput
              style={[s.inputText, { flex: 1 }]}
              placeholder="e.g. GA-183-9038, or your country's own code"
              placeholderTextColor={MUTED}
              value={digitalAddressCode}
              onChangeText={setDigitalAddressCode}
              autoCapitalize="characters"
            />
          </View>

          {/* GPS pin — free, built into the phone, works in any country
              identically. Optional but recommended: this is the exact
              location a worker gets sent once a booking is paid. */}
          <TouchableOpacity style={s.locationBtn} onPress={useMyLocation} disabled={locating}>
            <Ionicons name={coords ? 'checkmark-circle' : 'locate-outline'} size={17} color={coords ? '#22C55E' : GOLD} />
            <Text style={[s.locationBtnText, coords && { color: '#22C55E' }]}>
              {locating ? 'Getting your location…' : coords ? 'Location detected ✓' : 'Use my current location'}
            </Text>
          </TouchableOpacity>
          {!!locationLabel && (
            <Text style={s.locationHint}>{locationLabel}</Text>
          )}

          {/* Password */}
          <Text style={s.label}>Password</Text>
          <View style={s.inputWrap}>
            <Ionicons name="lock-closed-outline" size={17} color="rgba(255,255,255,0.35)" style={s.inputIcon} />
            <TextInput
              style={[s.inputText, { flex: 1 }]}
              placeholder="Min. 8 characters"
              placeholderTextColor={MUTED}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)} style={{ padding: 4 }}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={MUTED} />
            </TouchableOpacity>
          </View>
          {password.length > 0 && password.length < 8 && (
            <Text style={s.pwWarn}>Password must be at least 8 characters</Text>
          )}

          {/* Terms */}
          <TouchableOpacity style={s.termsRow} onPress={() => setAgreed(!agreed)} activeOpacity={0.8}>
            <View style={[s.checkbox, agreed && s.checkboxActive]}>
              {agreed && <Ionicons name="checkmark" size={12} color="#0D0D2B" />}
            </View>
            <Text style={s.termsText}>
              I agree to the{' '}
              <Text style={s.termsLink}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={s.termsLink}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity
            style={[s.registerBtn, (!canSubmit || loading) && s.registerBtnDisabled]}
            onPress={handleRegister}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#0D0D2B" />
              : <Text style={s.registerBtnText}>Create Account</Text>
            }
          </TouchableOpacity>

          {/* Login link */}
          <TouchableOpacity
            style={s.loginLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={s.loginLinkText}>
              Already have an account?{' '}
              <Text style={{ color: GOLD, fontWeight: '700' }}>Sign in</Text>
            </Text>
          </TouchableOpacity>

          <Text style={s.copy}>© 2026 WiamApp · Powered by WiamLabs</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:                { flex: 1, backgroundColor: BG },
  container:           { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 48 },
  backBtn:             { marginTop: 16, marginBottom: 8, width: 40, padding: 4 },
  brand:               { alignItems: 'center', marginBottom: 10 },
  logo:                { width: 72, height: 72 },
  brandName:           { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 8 },
  title:               { color: WHITE, fontSize: 24, fontWeight: '800', marginBottom: 6 },
  subtitle:            { color: MUTED, fontSize: 13, marginBottom: 20, lineHeight: 20 },

  roleToggle:          { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 4, marginBottom: 14, gap: 4 },
  roleBtn:             { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: 11 },
  roleBtnActive:       { backgroundColor: GOLD },
  roleBtnText:         { fontSize: 14, fontWeight: '600', color: MUTED },
  roleBtnTextActive:   { color: '#0D0D2B' },

  infoBox:             { flexDirection: 'row', gap: 9, backgroundColor: GOLD_BG, borderWidth: 1, borderColor: GOLD_BD, borderRadius: 12, padding: 12, marginBottom: 16 },
  infoText:            { flex: 1, color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 19 },

  errorBox:            { flexDirection: 'row', gap: 9, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 12, padding: 12, marginBottom: 16 },
  errorText:           { flex: 1, color: '#EF4444', fontSize: 13, lineHeight: 18 },

  label:               { color: MUTED, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 14, letterSpacing: 0.3 },
  inputWrap:           { flexDirection: 'row', alignItems: 'center', backgroundColor: INPUT_BG, borderWidth: 1, borderColor: INPUT_BD, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  locationBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: GOLD_BD, backgroundColor: GOLD_BG,
    borderRadius: 12, paddingVertical: 13, marginBottom: 6,
  },
  locationBtnText: { color: GOLD, fontSize: 13.5, fontWeight: '600' },
  locationHint: { color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center', marginBottom: 10 },
  skillTip: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: GOLD_BG, borderWidth: 1, borderColor: GOLD_BD,
    borderRadius: 12, padding: 12, marginBottom: 10,
  },
  skillTipText: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 12.5, lineHeight: 18 },
  inputIcon:           { marginRight: 10 },
  inputText:           { color: WHITE, fontSize: 15 },
  inputPlaceholder:    { color: MUTED },
  phoneCode:           { color: GOLD, fontSize: 15, fontWeight: '600', marginRight: 10 },
  pwWarn:              { color: '#F59E0B', fontSize: 12, marginTop: 4 },

  dropDown:            { backgroundColor: DROP_BG, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginTop: 4, overflow: 'hidden' },
  dropSearch:          { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  dropSearchInput:     { flex: 1, color: WHITE, fontSize: 14 },
  dropItem:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  dropItemActive:      { backgroundColor: GOLD_BG },
  dropItemText:        { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  dropItemCode:        { color: MUTED, fontSize: 12 },

  termsRow:            { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 18, marginBottom: 4 },
  checkbox:            { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  checkboxActive:      { backgroundColor: GOLD, borderColor: GOLD },
  termsText:           { flex: 1, color: MUTED, fontSize: 13, lineHeight: 20 },
  termsLink:           { color: GOLD, fontWeight: '600' },

  registerBtn:         { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  registerBtnDisabled: { backgroundColor: 'rgba(212,160,23,0.25)' },
  registerBtnText:     { color: BG, fontSize: 16, fontWeight: '700' },

  loginLink:           { alignItems: 'center', marginTop: 20 },
  loginLinkText:       { color: MUTED, fontSize: 14 },

  copy:                { color: 'rgba(212,160,23,0.25)', fontSize: 10, textAlign: 'center', marginTop: 24 },
});
