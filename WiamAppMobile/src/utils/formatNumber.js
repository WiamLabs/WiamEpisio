/**
 * Format large numbers into compact form: 1500 → 1.5K, 1000000 → 1M
 */
export const formatNumber = (num) => {
  if (num == null || isNaN(num)) return '0';
  const n = Number(num);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

export default formatNumber;
