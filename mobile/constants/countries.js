// © 2026 WiamApp. Powered by WiamLabs
// constants/countries.js
// All African countries with flag emoji and phone code
// Used in RegisterScreen — free, no API needed

export const AFRICAN_COUNTRIES = [
  // ── North Africa ─────────────────────────────────────────
  { name: 'Algeria',               code: 'DZ', flag: '🇩🇿', phoneCode: '+213' },
  { name: 'Egypt',                 code: 'EG', flag: '🇪🇬', phoneCode: '+20'  },
  { name: 'Libya',                 code: 'LY', flag: '🇱🇾', phoneCode: '+218' },
  { name: 'Morocco',               code: 'MA', flag: '🇲🇦', phoneCode: '+212' },
  { name: 'Sudan',                 code: 'SD', flag: '🇸🇩', phoneCode: '+249' },
  { name: 'Tunisia',               code: 'TN', flag: '🇹🇳', phoneCode: '+216' },

  // ── West Africa ───────────────────────────────────────────
  { name: 'Benin',                 code: 'BJ', flag: '🇧🇯', phoneCode: '+229' },
  { name: 'Burkina Faso',          code: 'BF', flag: '🇧🇫', phoneCode: '+226' },
  { name: 'Cape Verde',            code: 'CV', flag: '🇨🇻', phoneCode: '+238' },
  { name: 'Gambia',                code: 'GM', flag: '🇬🇲', phoneCode: '+220' },
  { name: 'Ghana',                 code: 'GH', flag: '🇬🇭', phoneCode: '+233' },
  { name: 'Guinea',                code: 'GN', flag: '🇬🇳', phoneCode: '+224' },
  { name: 'Guinea-Bissau',         code: 'GW', flag: '🇬🇼', phoneCode: '+245' },
  { name: 'Ivory Coast',           code: 'CI', flag: '🇨🇮', phoneCode: '+225' },
  { name: 'Liberia',               code: 'LR', flag: '🇱🇷', phoneCode: '+231' },
  { name: 'Mali',                  code: 'ML', flag: '🇲🇱', phoneCode: '+223' },
  { name: 'Mauritania',            code: 'MR', flag: '🇲🇷', phoneCode: '+222' },
  { name: 'Niger',                 code: 'NE', flag: '🇳🇪', phoneCode: '+227' },
  { name: 'Nigeria',               code: 'NG', flag: '🇳🇬', phoneCode: '+234' },
  { name: 'Senegal',               code: 'SN', flag: '🇸🇳', phoneCode: '+221' },
  { name: 'Sierra Leone',          code: 'SL', flag: '🇸🇱', phoneCode: '+232' },
  { name: 'Togo',                  code: 'TG', flag: '🇹🇬', phoneCode: '+228' },

  // ── East Africa ───────────────────────────────────────────
  { name: 'Burundi',               code: 'BI', flag: '🇧🇮', phoneCode: '+257' },
  { name: 'Comoros',               code: 'KM', flag: '🇰🇲', phoneCode: '+269' },
  { name: 'Djibouti',              code: 'DJ', flag: '🇩🇯', phoneCode: '+253' },
  { name: 'Eritrea',               code: 'ER', flag: '🇪🇷', phoneCode: '+291' },
  { name: 'Ethiopia',              code: 'ET', flag: '🇪🇹', phoneCode: '+251' },
  { name: 'Kenya',                 code: 'KE', flag: '🇰🇪', phoneCode: '+254' },
  { name: 'Madagascar',            code: 'MG', flag: '🇲🇬', phoneCode: '+261' },
  { name: 'Malawi',                code: 'MW', flag: '🇲🇼', phoneCode: '+265' },
  { name: 'Mauritius',             code: 'MU', flag: '🇲🇺', phoneCode: '+230' },
  { name: 'Mozambique',            code: 'MZ', flag: '🇲🇿', phoneCode: '+258' },
  { name: 'Rwanda',                code: 'RW', flag: '🇷🇼', phoneCode: '+250' },
  { name: 'Seychelles',            code: 'SC', flag: '🇸🇨', phoneCode: '+248' },
  { name: 'Somalia',               code: 'SO', flag: '🇸🇴', phoneCode: '+252' },
  { name: 'South Sudan',           code: 'SS', flag: '🇸🇸', phoneCode: '+211' },
  { name: 'Tanzania',              code: 'TZ', flag: '🇹🇿', phoneCode: '+255' },
  { name: 'Uganda',                code: 'UG', flag: '🇺🇬', phoneCode: '+256' },
  { name: 'Zambia',                code: 'ZM', flag: '🇿🇲', phoneCode: '+260' },
  { name: 'Zimbabwe',              code: 'ZW', flag: '🇿🇼', phoneCode: '+263' },

  // ── Central Africa ────────────────────────────────────────
  { name: 'Angola',                code: 'AO', flag: '🇦🇴', phoneCode: '+244' },
  { name: 'Cameroon',              code: 'CM', flag: '🇨🇲', phoneCode: '+237' },
  { name: 'Central African Rep.',  code: 'CF', flag: '🇨🇫', phoneCode: '+236' },
  { name: 'Chad',                  code: 'TD', flag: '🇹🇩', phoneCode: '+235' },
  { name: 'Congo (Brazzaville)',   code: 'CG', flag: '🇨🇬', phoneCode: '+242' },
  { name: 'Congo (DRC)',           code: 'CD', flag: '🇨🇩', phoneCode: '+243' },
  { name: 'Equatorial Guinea',     code: 'GQ', flag: '🇬🇶', phoneCode: '+240' },
  { name: 'Gabon',                 code: 'GA', flag: '🇬🇦', phoneCode: '+241' },
  { name: 'São Tomé & Príncipe',   code: 'ST', flag: '🇸🇹', phoneCode: '+239' },

  // ── Southern Africa ───────────────────────────────────────
  { name: 'Botswana',              code: 'BW', flag: '🇧🇼', phoneCode: '+267' },
  { name: 'Eswatini',              code: 'SZ', flag: '🇸🇿', phoneCode: '+268' },
  { name: 'Lesotho',               code: 'LS', flag: '🇱🇸', phoneCode: '+266' },
  { name: 'Namibia',               code: 'NA', flag: '🇳🇦', phoneCode: '+264' },
  { name: 'South Africa',          code: 'ZA', flag: '🇿🇦', phoneCode: '+27'  },
];

// Default country — Ghana is our launch market
export const DEFAULT_COUNTRY = AFRICAN_COUNTRIES.find(c => c.code === 'GH');
