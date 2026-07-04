// © 2026 WiamApp. Powered by WiamLabs
// screens/QuotesListScreen.js
// Customer reviews quotes from workers, accepts one to book
// Backend: GET /api/quotes/:requestId, GET /api/quotes/:requestId/quotes, POST /api/quotes/:requestId/select/:quoteId

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, FlatList,
  ActivityIndicator, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import VerifiedBadge from '../components/VerifiedBadge';
import { getQuoteRequest, getQuotesForRequest, acceptQuote } from '../lib/api/quotes';

const BG      = '#FFFFFF';
const NAVY    = '#0D0D2B';
const GOLD    = '#D4A017';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const GOLD_BD = 'rgba(212,160,23,0.25)';
const BORDER  = '#EBEBEB';
const MUTED   = '#888899';

const QuoteCard = ({ quote, onAccept, accepting }) => {
  const worker = quote.worker_profiles;
  const user = worker?.users;
  return (
  <View style={qc.card}>
    {/* Worker info */}
    <View style={qc.workerRow}>
      <View style={qc.avatarWrap}>
        {user?.avatar_url
          ? <Image source={{ uri: user.avatar_url }} style={qc.avatar} />
          : <View style={[qc.avatar, qc.avatarFallback]}>
              <Text style={qc.avatarInitial}>{user?.full_name?.[0]?.toUpperCase()}</Text>
            </View>
        }
        {quote.is_online && <View style={qc.onlineDot} />}
      </View>
      <View style={qc.workerInfo}>
        <View style={qc.nameRow}>
          <Text style={qc.workerName}>{user?.full_name}</Text>
          {worker?.verified_badge && (
            <View style={qc.verifiedBadge}>
              <VerifiedBadge color="blue" size={12} />
              {(worker.subscription_tier === 'pro' || worker.subscription_tier === 'basic') && (
                <Text style={qc.verifiedText}>
                  {worker.subscription_tier === 'pro' ? 'Pro Worker' : 'Basic Worker'}
                </Text>
              )}
            </View>
          )}
        </View>
        <View style={qc.statsRow}>
          <Ionicons name="star" size={11} color={GOLD} />
          <Text style={qc.rating}>{worker?.average_rating?.toFixed(1) || '–'}</Text>
          <Text style={qc.dot}>·</Text>
          <Text style={qc.jobs}>{worker?.total_jobs_done || 0} jobs</Text>
          <Text style={qc.dot}>·</Text>
          <Text style={qc.city}>{user?.city}</Text>
        </View>
      </View>
      <View style={qc.priceWrap}>
        <Text style={qc.price}>${quote.price_usd}</Text>
        <Text style={qc.priceLabel}>quoted</Text>
      </View>
    </View>

    {/* Quote message */}
    {quote.message ? (
      <Text style={qc.message}>{quote.message}</Text>
    ) : null}

    {/* Timeline / availability */}
    {(quote.timeline || quote.availability) && (
      <View style={qc.availRow}>
        <Ionicons name="calendar-outline" size={13} color={MUTED} />
        <Text style={qc.availText}>
          {quote.timeline}{quote.timeline && quote.availability ? ' · ' : ''}{quote.availability}
        </Text>
      </View>
    )}

    {/* Actions */}
    <View style={qc.actions}>
      <TouchableOpacity
        style={qc.viewProfileBtn}
        onPress={() => {}}
      >
        <Text style={qc.viewProfileText}>View Profile</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={qc.acceptBtn}
        onPress={() => onAccept(quote)}
        activeOpacity={0.85}
        disabled={accepting === quote.id}
      >
        {accepting === quote.id ? (
          <ActivityIndicator color={NAVY} size="small" />
        ) : (
          <>
            <Text style={qc.acceptBtnText}>Accept Quote</Text>
            <Ionicons name="arrow-forward" size={14} color={NAVY} />
          </>
        )}
      </TouchableOpacity>
    </View>
  </View>
  );
};

export default function QuotesListScreen({ navigation, route }) {
  const { requestId } = route?.params || {};
  const [request,    setRequest]    = useState(null);
  const [quotes,     setQuotes]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting,  setAccepting]  = useState(null);
  const [loadError,  setLoadError]  = useState('');

  const fetchQuotes = async () => {
    try {
      const [requestData, quotesData] = await Promise.all([
        getQuoteRequest(requestId),
        getQuotesForRequest(requestId),
      ]);
      setRequest(requestData);
      setQuotes(quotesData || []);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message || 'Could not load quotes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchQuotes(); }, [requestId]);

  const handleAccept = async (quote) => {
    setAccepting(quote.id);
    try {
      const result = await acceptQuote(requestId, quote.id);
      navigation.navigate('Booking', {
        workerId:   quote.worker_profiles?.id,
        workerName: quote.worker_profiles?.users?.full_name,
        hourlyRate: quote.price_usd,
        fromQuote:  true,
        quoteId:    quote.id,
        bookingId:  result.booking?.id,
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setAccepting(null);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Quotes Received</Text>
        <View style={{ width: 22 }} />
      </View>

      {request && (
        <View style={s.requestCard}>
          <Text style={s.requestLabel}>YOUR JOB REQUEST</Text>
          <Text style={s.requestDesc} numberOfLines={2}>{request.description}</Text>
          <View style={s.requestMeta}>
            <View style={s.metaItem}>
              <Ionicons name="location-outline" size={12} color={MUTED} />
              <Text style={s.metaText}>{request.location_address}</Text>
            </View>
            {request.preferred_date && (
              <View style={s.metaItem}>
                <Ionicons name="calendar-outline" size={12} color={MUTED} />
                <Text style={s.metaText}>
                  {new Date(request.preferred_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={GOLD} style={{ marginTop: 40 }} />
      ) : loadError ? (
        <View style={s.empty}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={s.emptyTitle}>Could not load quotes</Text>
          <Text style={s.emptyText}>{loadError}</Text>
          <Text style={s.emptyPull}>Pull down to try again</Text>
        </View>
      ) : quotes.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="hourglass-outline" size={48} color="#DDD" />
          <Text style={s.emptyTitle}>Waiting for quotes</Text>
          <Text style={s.emptyText}>
            Workers have been notified. Quotes usually arrive within 2 hours.
          </Text>
          <Text style={s.emptyPull}>Pull down to refresh</Text>
        </View>
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={q => q.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchQuotes(); }}
              tintColor={GOLD}
            />
          }
          ListHeaderComponent={
            <Text style={s.quotesCount}>
              {quotes.length} quote{quotes.length !== 1 ? 's' : ''} received
            </Text>
          }
          renderItem={({ item }) => (
            <QuoteCard
              quote={item}
              onAccept={handleAccept}
              accepting={accepting}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const qc = StyleSheet.create({
  card: {
    backgroundColor: BG, borderRadius: 16,
    borderWidth: 0.5, borderColor: BORDER,
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  workerRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  avatarWrap:    { position: 'relative' },
  avatar:        { width: 48, height: 48, borderRadius: 13 },
  avatarFallback:{ backgroundColor: GOLD_BG, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: GOLD, fontSize: 18, fontWeight: '700' },
  onlineDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#22C55E', borderWidth: 2, borderColor: BG,
    position: 'absolute', bottom: 0, right: 0,
  },
  workerInfo: { flex: 1 },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' },
  workerName: { color: NAVY, fontSize: 14, fontWeight: '600' },
  badge:      { fontSize: 12 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F0FFF4', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  verifiedText: { color: '#16A34A', fontSize: 9, fontWeight: '600' },
  statsRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating:       { color: NAVY, fontSize: 11, fontWeight: '600' },
  dot:          { color: MUTED, fontSize: 11 },
  jobs:         { color: MUTED, fontSize: 11 },
  city:         { color: MUTED, fontSize: 11 },
  priceWrap:    { alignItems: 'flex-end' },
  price:        { color: GOLD, fontSize: 18, fontWeight: '700' },
  priceLabel:   { color: MUTED, fontSize: 10 },
  message:      { color: NAVY, fontSize: 13, lineHeight: 20, marginBottom: 10, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: BORDER },
  availRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  availText:    { color: MUTED, fontSize: 12 },
  actions:      { flexDirection: 'row', gap: 10 },
  viewProfileBtn:{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: NAVY },
  viewProfileText:{ color: NAVY, fontSize: 13, fontWeight: '600' },
  acceptBtn:    { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: GOLD },
  acceptBtnText:{ color: NAVY, fontSize: 13, fontWeight: '700' },
});

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#F8F8FB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: BG, borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  headerTitle: { color: NAVY, fontSize: 17, fontWeight: '700' },
  requestCard: {
    backgroundColor: BG, marginHorizontal: 16, marginTop: 12,
    borderRadius: 13, padding: 14,
    borderWidth: 0.5, borderColor: BORDER,
  },
  requestLabel: { color: MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  requestDesc:  { color: NAVY, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  requestMeta:  { flexDirection: 'row', gap: 14 },
  metaItem:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:     { color: MUTED, fontSize: 12 },
  quotesCount:  { color: MUTED, fontSize: 13, marginBottom: 12, fontWeight: '500' },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, paddingBottom: 100 },
  emptyTitle:   { color: NAVY, fontSize: 18, fontWeight: '600', marginTop: 14, marginBottom: 8 },
  emptyText:    { color: MUTED, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  emptyPull:    { color: '#CCC', fontSize: 12 },
});
