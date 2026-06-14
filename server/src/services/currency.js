const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const OER_BASE = 'https://openexchangerates.org/api';

/**
 * Returns exchange rate from `from` currency to `to` currency.
 * Caches in DB for 24 hours to stay within free API limits.
 * Falls back to rate=1 if API key is missing or call fails.
 */
async function getRate(from, to) {
  if (from === to) return 1;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Check cache first
  const cached = await prisma.exchangeRateCache.findFirst({
    where: {
      fromCurrency: from,
      toCurrency: to,
      fetchedAt: { gte: oneDayAgo },
    },
    orderBy: { fetchedAt: 'desc' },
  });

  if (cached) return cached.rate;

  // Fetch from Open Exchange Rates
  const appId = process.env.OER_APP_ID;
  if (!appId || appId === 'your-open-exchange-rates-app-id') {
    console.warn(`[currency] OER_APP_ID not set — using rate=1 for ${from}->${to}`);
    return 1;
  }

  try {
    // OER free plan uses USD as base; convert via USD
    const { data } = await axios.get(`${OER_BASE}/latest.json`, {
      params: { app_id: appId },
      timeout: 5000,
    });

    const rates = data.rates; // rates relative to USD

    // rate(from→to) = rates[to] / rates[from]
    const fromRate = rates[from];
    const toRate = rates[to];

    if (!fromRate || !toRate) {
      console.warn(`[currency] Unknown currency ${from} or ${to}`);
      return 1;
    }

    const rate = toRate / fromRate;

    // Cache the result
    await prisma.exchangeRateCache.create({
      data: { fromCurrency: from, toCurrency: to, rate },
    });

    return rate;
  } catch (err) {
    console.error('[currency] OER fetch failed:', err.message);
    return 1;
  }
}

module.exports = { getRate };
