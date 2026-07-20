import * as Linking from 'expo-linking';

const prefix = Linking.createURL('/');

/**
 * Deep linking configuration for WiamApp.
 *
 * Supported URLs:
 *   wiamapp://book/:bookId           → BookDetail screen
 *   wiamapp://reader/:bookId/:chNum  → Reader screen
 *   wiamapp://creator/:creatorId     → CreatorProfile screen
 *   wiamapp://universe/:universeId   → UniverseDetail screen
 *   wiamapp://series/:seriesId       → SeriesDetail screen
 *   wiamapp://studio               → WiamStudio (creators)
 *   wiamapp://wallet                 → Wallet screen
 *   https://wiamapp.com/book/:id     → BookDetail (universal link)
 *   https://wiamapp.com/book/:id/read/:ch → Reader (universal link)
 *   https://wiamapp.com/creator/:id  → CreatorProfile (universal link)
 *   https://wiamapp.com/universe/:id → UniverseDetail (universal link)
 *   https://wiamapp.com/series/:id   → SeriesDetail (universal link)
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
      GlobalSearch: 'search',
      Wallet: 'wallet',
      Notifications: 'notifications',
    },
  },
};

export default linking;
