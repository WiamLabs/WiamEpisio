import * as Linking from 'expo-linking';

const prefix = Linking.createURL('/');

/**
 * Deep linking — Pass 1 watch-first.
 * Old book/reader/novel routes redirect via RedirectToWatchScreen.
 */
const linking = {
  prefixes: [prefix, 'wiamapp://', 'https://wiamapp.com'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register',
        },
      },
      Main: {
        screens: {
          MainTabs: {
            screens: {
              Home: 'home',
              Browse: 'browse',
              Library: 'library',
              Profile: 'profile',
            },
          },
        },
      },
      Studio: 'studio',
      BookDetail: {
        path: 'book/:bookId',
        parse: { bookId: Number },
      },
      Reader: {
        path: 'book/:bookId/read/:chNum',
        parse: {
          bookId: Number,
          chNum: (chNum) => parseInt(chNum, 10) || 1,
        },
      },
      CreatorProfile: {
        path: 'creator/:creatorId',
        parse: { creatorId: Number },
      },
      UniverseDetail: {
        path: 'universe/:universeId',
        parse: { universeId: Number },
      },
      SeriesDetail: {
        path: 'series/:seriesId',
        parse: { seriesId: Number },
      },
      DramaSeries: {
        path: 'drama/:seriesId',
        parse: { seriesId: Number },
      },
      Player: {
        path: 'watch/:seriesId/:episodeId',
        parse: { seriesId: Number, episodeId: Number },
      },
      CategoryResults: {
        path: 'category/:category',
      },
      NovelHome: 'novels',
      StoryBundleDetail: {
        path: 'story-bundle/:storyBundleId',
        parse: { storyBundleId: Number },
      },
      GlobalSearch: 'search',
      Wallet: 'wallet',
      Notifications: 'notifications',
    },
  },
};

export default linking;
