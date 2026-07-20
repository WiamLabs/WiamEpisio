/**
 * WiamEpisio-Player-Error.html — dark player frame + playback failure.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ChevronLeft,
  MoreHorizontal,
  AlertCircle,
  RefreshCw,
  Info,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');

const PlayerErrorScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const {
    episodeId,
    seriesId,
    seriesTitle = 'Episode',
    episodeNumber,
    episodeSummary,
    message,
  } = route.params || {};

  const epLabel = episodeNumber != null ? `EP.${episodeNumber}` : 'Episode';
  const meta = episodeSummary
    || message
    || 'Something interrupted this episode. Check your connection and try again.';

  const retry = () => {
    if (episodeId) {
      navigation.replace('Player', { episodeId, seriesId });
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={[styles.videoFrame, { height: Math.min(SCREEN_H * 0.52, 420) }]}>
        <View style={styles.videoTop}>
          <TouchableOpacity
            style={styles.vtBtn}
            onPress={() => navigation.goBack()}
            hitSlop={8}
          >
            <ChevronLeft size={15} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.vtBtn} hitSlop={8}>
            <MoreHorizontal size={14} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.errorCenter}>
          <View style={styles.errorIcon}>
            <AlertCircle size={24} color="#E4573D" />
          </View>
          <Text style={styles.errorTitle}>Playback failed</Text>
          <Text style={styles.errorSub}>
            Something interrupted this episode.{'\n'}Check your connection and try again.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retry} activeOpacity={0.9}>
            <RefreshCw size={14} color={COLORS.navy} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.infoPanel}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
      >
        <Text style={styles.seriesTitle}>{seriesTitle}</Text>
        <Text style={styles.epMeta}>
          {epLabel}
          {episodeSummary ? ` · ${episodeSummary}` : ` · ${meta}`}
        </Text>

        <View style={styles.tipCard}>
          <Info size={16} color={COLORS.gold} />
          <Text style={styles.tipText}>
            Playback errors are usually a weak connection. Try switching to a lower quality
            in Settings → Default video quality.
          </Text>
        </View>

        <Text style={styles.labelTag}>Need help?</Text>
        <Text style={styles.helpNote}>
          If this keeps happening, email support@wiamapp.com with the series name and episode number.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoFrame: {
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  videoTop: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 4,
  },
  vtBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  errorIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(228,87,61,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(228,87,61,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#fff',
    marginBottom: 6,
  },
  errorSub: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    color: '#8B8BA3',
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 18,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 26,
    borderRadius: 12,
    backgroundColor: COLORS.gold,
  },
  retryText: {
    fontFamily: FONTS.extraBold,
    fontSize: 12.5,
    color: COLORS.navy,
  },
  infoPanel: {
    flex: 1,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  seriesTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15.5,
    color: '#fff',
    marginBottom: 4,
  },
  epMeta: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    color: '#8B8BA3',
    lineHeight: 17,
    marginBottom: 16,
  },
  tipCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  tipText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#C9C9DE',
    lineHeight: 17,
  },
  labelTag: {
    fontFamily: FONTS.extraBold,
    fontSize: 10,
    color: COLORS.textFaint,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  helpNote: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textDim,
    lineHeight: 17,
  },
});

export default PlayerErrorScreen;
