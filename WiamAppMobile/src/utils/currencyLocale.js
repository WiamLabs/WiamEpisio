/** Map user country → ISO currency for fair USD-based display. */
const COUNTRY_CURRENCY = {
  GH: 'GHS', Ghana: 'GHS',
  NG: 'NGN', Nigeria: 'NGN',
  KE: 'KES', Kenya: 'KES',
  ZA: 'ZAR', 'South Africa': 'ZAR',
  US: 'USD', USA: 'USD', 'United States': 'USD',
  GB: 'GBP', UK: 'GBP', 'United Kingdom': 'GBP',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR',
  CA: 'CAD', Canada: 'CAD',
  AU: 'AUD', Australia: 'AUD',
  IN: 'INR', India: 'INR',
  BR: 'BRL', Brazil: 'BRL',
  JP: 'JPY', Japan: 'JPY',
  CN: 'CNY', China: 'CNY',
  AE: 'AED', UAE: 'AED',
  EG: 'EGP', Egypt: 'EGP',
};

export function currencyForCountry(country) {
  if (!country) return 'USD';
  const key = String(country).trim();
  if (COUNTRY_CURRENCY[key]) return COUNTRY_CURRENCY[key];
  if (COUNTRY_CURRENCY[key.toUpperCase()]) return COUNTRY_CURRENCY[key.toUpperCase()];
  if (key.length === 2) return COUNTRY_CURRENCY[key.toUpperCase()] || 'USD';
  return 'USD';
}

/** @deprecated alias — prefer currencyForCountry */
export const currency_for_country = currencyForCountry;

export default currencyForCountry;
