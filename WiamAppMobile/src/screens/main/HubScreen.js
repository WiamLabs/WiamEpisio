import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import AppBackground from '../../components/AppBackground';
import { Star, Trophy, Users, Megaphone, Gift, Zap, Crown, Library, Settings } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const HubScreen = ({ navigation }) => {
  const HubCard = ({ title, subtitle, icon: Icon, color, onPress, badge }) => (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={[styles.iconWrapper, { backgroundColor: color + '20' }]}>
        <Icon color={color} size={28} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{title}</Text>
          {badge && (
            <View style={[styles.badge, { backgroundColor: color }]}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <AppBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.greeting}>WiamHub</Text>
          <Text style={styles.subGreeting}>The center of the WiamApp universe</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premium Experiences</Text>
          <HubCard 
            title="WiamElite" 
            subtitle="The Hall of Fame for top-tier creators" 
            icon={Star} 
            color={COLORS.secondary}
            onPress={() => navigation.navigate('WiamElite')}
            badge="LIVE"
          />
          <HubCard 
            title="Classics" 
            subtitle="Timeless public-domain masterpieces" 
            icon={Library} 
            color="#60a5fa"
            onPress={() => navigation.navigate('Classics')}
          />
          <HubCard 
            title="WiamPremium" 
            subtitle="Unlock unlimited potential" 
            icon={Crown} 
            color="#c084fc"
            onPress={() => navigation.navigate('PremiumScreen')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community & Programs</Text>
          <HubCard 
            title="Bulletin Feed" 
            subtitle="Latest updates from creators you follow" 
            icon={Megaphone} 
            color="#60a5fa"
            onPress={() => navigation.navigate('Bulletin')}
          />
          <HubCard 
            title="Programs Hub" 
            subtitle="Ambassador, Rising Stars & Challenges" 
            icon={Zap} 
            color="#9b59b6"
            onPress={() => navigation.navigate('Programs')}
          />
          <HubCard 
            title="Gift Stickers" 
            subtitle="Support creators with beautiful gifts" 
            icon={Gift} 
            color="#e879f9"
            onPress={() => navigation.navigate('Gifts')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <HubCard 
            title="Settings" 
            subtitle="Profile, notifications & preferences" 
            icon={Settings} 
            color="#94a3b8"
            onPress={() => navigation.navigate('Settings')}
          />
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
  },
  header: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xxl,
  },
  greeting: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
    fontFamily: 'System',
  },
  subGreeting: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  section: {
    marginBottom: SPACING.xxl,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: SPACING.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  spacer: {
    height: 100,
  },
});

export default HubScreen;
