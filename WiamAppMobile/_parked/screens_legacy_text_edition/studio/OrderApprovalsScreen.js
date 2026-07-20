/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  Dimensions
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import BrandedFooter from '../../components/BrandedFooter';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import AppBackground from '../../components/AppBackground';
import { ChevronLeft, CircleCheck, CircleX, Clock, Package, User, House } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const OrderApprovalsScreen = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated fetch
    setTimeout(() => {
      setOrders([
        {
          id: 'ORD-7721',
          customer: 'John Doe',
          book: 'The Midnight Sun',
          amount: '₵25.00',
          status: 'pending',
          date: '2024-03-18 14:30',
        },
        {
          id: 'ORD-7722',
          customer: 'Sarah Smith',
          book: 'Echoes of Eternity',
          amount: '₵15.00',
          status: 'pending',
          date: '2024-03-18 15:45',
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const handleApprove = (orderId) => {
    Alert.alert(
      'Approve Order',
      `Are you sure you want to approve ${orderId}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Approve', 
          onPress: () => {
            setOrders(prev => prev.filter(o => o.id !== orderId));
          } 
        },
      ]
    );
  };

  const handleReject = (orderId) => {
    Alert.alert(
      'Reject Order',
      `Are you sure you want to reject ${orderId}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          style: 'destructive',
          onPress: () => {
            setOrders(prev => prev.filter(o => o.id !== orderId));
          } 
        },
      ]
    );
  };

  const renderOrderItem = ({ item }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderIdContainer}>
          <Package size={14} color={COLORS.secondary} />
          <Text style={styles.orderId}>{item.id}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Clock size={10} color={COLORS.secondary} />
          <Text style={styles.statusText}>PENDING</Text>
        </View>
      </View>

      <View style={styles.orderBody}>
        <View style={styles.orderInfoRow}>
          <User size={16} color={COLORS.textMuted} />
          <Text style={styles.orderInfoText}>{item.customer}</Text>
        </View>
        <Text style={styles.bookTitle}>{item.book}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Amount:</Text>
          <Text style={styles.priceValue}>{item.amount}</Text>
        </View>
        <Text style={styles.orderDate}>{item.date}</Text>
      </View>

      <View style={styles.orderActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleReject(item.id)}
        >
          <CircleX size={18} color={COLORS.error} />
          <Text style={[styles.actionButtonText, { color: COLORS.error }]}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => handleApprove(item.id)}
        >
          <CircleCheck size={18} color={COLORS.white} />
          <Text style={[styles.actionButtonText, { color: COLORS.white }]}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <AppBackground>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Main')}>
          <House size={18} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Approvals</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.container}>
        {loading ? (
          <View style={{ marginTop: 16 }}><SkeletonLoader.ListItem count={4} /></View>
        ) : (
          <FlatList
            data={orders}
            renderItem={renderOrderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <CircleCheck size={64} color={COLORS.textMuted} strokeWidth={1} />
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptySubtitle}>No pending orders to approve.</Text>
              </View>
            }
          />
        )}
      </View>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: 50,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  backButton: {
    padding: SPACING.sm,
  },
  listContent: {
    padding: SPACING.md,
  },
  loader: {
    marginTop: 100,
  },
  orderCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderId: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 168, 67, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: COLORS.secondary,
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  orderBody: {
    marginBottom: SPACING.lg,
  },
  orderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderInfoText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  bookTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: SPACING.sm,
    marginLeft: 24,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 24,
  },
  priceLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  priceValue: {
    color: COLORS.success,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  orderDate: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: SPACING.sm,
    marginLeft: 24,
  },
  orderActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  approveButton: {
    backgroundColor: COLORS.primary,
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: SPACING.lg,
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: SPACING.sm,
  }
});

export default OrderApprovalsScreen;
