const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let priceCache = {
  prices: {},
  inrRate: 83.5, // Default/Fallback
  lastUpdated: 0
};

async function fetchPrices() {
  try {
    // 1. Fetch Crypto Prices (Binance)
    const cryptoResponse = await fetch('https://api.binance.com/api/v3/ticker/price');
    const cryptoData = await cryptoResponse.json();
    
    // Convert to easy-to-use map: { BTC: 66000, ETH: 3500, ... }
    const priceMap = {};
    cryptoData.forEach(item => {
      if (item.symbol.endsWith('USDT')) {
        const base = item.symbol.replace('USDT', '');
        priceMap[base] = parseFloat(item.price);
      }
    });

    // 2. Fetch Exchange Rate (USD/INR)
    const rateResponse = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const rateData = await rateResponse.json();
    const inrRate = rateData.rates.INR || 83.5;

    priceCache = {
      prices: priceMap,
      inrRate: inrRate,
      lastUpdated: Date.now()
    };

    console.log('Background: Prices updated', priceCache);
  } catch (error) {
    console.error('Background: Error fetching prices', error);
  }
}

// Initial fetch
fetchPrices();

// Periodically update
setInterval(fetchPrices, CACHE_DURATION);

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_PRICES') {
    // If cache is stale, trigger a refresh (but return current cache for speed)
    if (Date.now() - priceCache.lastUpdated > CACHE_DURATION) {
      fetchPrices();
    }
    sendResponse(priceCache);
  }
  return true;
});
