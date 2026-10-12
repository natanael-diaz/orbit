const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

/** Keep micro-USD credit visible, including negative and sub-cent amounts. */
export const formatUSD = (value: number) => currency.format(value);
