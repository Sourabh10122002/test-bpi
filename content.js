const CONFIG = {
  ATTR: {
    ORIGINAL: 'data-bp-o',
    LAST_SET: 'data-bp-last',
    MULTIPLIER: 'data-bp-m'
  },
  KEYWORDS: ['pnl', 'textbuy', 'textsell', 't-buy', 't-sell', 'balance', 'estimated', 'equity', 'profit', 'total', 'available', 'asset'],
  SELECTORS: [
    'a[href*="/my/wallet/account/overview"]:not(.bp-injected)',
    '.typography-Headline4:not(.bp-injected)',
    '.body3.mt-2:not(.bp-injected)',
    '.mr-s.text-right .body2:not(.bp-injected)',
    '.body3.text-t-Secondary:not(.bp-injected)',
    '.body2:not(.bp-injected)',
    '.body3.mt-1:not(.bp-injected)',
    '#dashboard-assets-balance-today-pnl-val:not(.bp-injected)',
    '[class*="text-TextBuy"]:not(.bp-injected)',
    '[class*="text-TextSell"]:not(.bp-injected)',
    '[class*="text-t-buy"]:not(.bp-injected)',
    '[class*="text-t-sell"]:not(.bp-injected)',
    '[id*="EstimatedBalance"]',
    '[div*="EstimatedBalance"]',
    '.body3.mt-2'
  ],
  PROFILE_SELECTORS: ['.bn-flex.group.items-center:not(.bp-injected)', '.subtitle3:not(.bp-injected)']
};

let multiplier = 1.0;
let usdtAmount = '';
let isUpdating = false;
let debounceTimer;

// --- UTILITIES ---

const isPlaceholder = (text) => {
  if (!text) return true;
  const t = text.trim();
  return /^[*-]+$/.test(t) || t.includes('--') || t === '0.00' || t === '0';
};

const getPrecision = (valStr) => {
  const parts = valStr.split('.');
  return parts.length > 1 ? parts[1].length : 2;
};

// --- PRICE SERVICE ---

const PriceService = {
  regex: /([\d,]+\.?\d*)(\s*%)?/g,

  transformString(text, factor) {
    if (!text) return text;
    return text.replace(this.regex, (matchStr, number, percent) => {
      if (percent) return matchStr; // Keep percentages original

      const rawValue = parseFloat(number.replace(/,/g, ''));
      if (isNaN(rawValue) || rawValue === 0) return matchStr;

      const newValue = rawValue * factor;
      const precision = getPrecision(number.replace(/,/g, ''));

      return newValue.toLocaleString('en-US', {
        minimumFractionDigits: Math.min(precision, 2),
        maximumFractionDigits: Math.max(precision, 8)
      });
    });
  }
};

// --- TARGETING ENGINE ---

const TargetingEngine = {
  isAccountStat(el) {
    if (el.classList.contains('bp-injected')) return false;
    const text = (el.textContent || '').toLowerCase();
    const className = (el.className || '').toString().toLowerCase();
    const id = (el.id || '').toString().toLowerCase();

    if (CONFIG.KEYWORDS.some(k => id.includes(k) || text.includes(k) || className.includes(k))) return true;

    const checkContext = (target) => {
      if (!target) return false;
      const t = (target.textContent || '').toLowerCase();
      const i = (target.id || '').toString().toLowerCase();
      return i.includes('balance') || i.includes('estimated') || t.includes('balance') || t.includes('estimated');
    };

    let parent = el.parentElement;
    if (parent && checkContext(parent)) return true;
    if (parent?.parentElement && checkContext(parent.parentElement)) return true;
    if (el.previousElementSibling && checkContext(el.previousElementSibling)) return true;
    if (el.nextElementSibling && checkContext(el.nextElementSibling)) return true;

    return false;
  },

  isCoinRowTargeted(el) {
    if (el.hasAttribute(CONFIG.ATTR.ORIGINAL)) return true;
    if (this.isAccountStat(el)) return true;

    const row = el.closest('tr, .flex-wrap, .bn-line, [class*="row"]');
    if (!row) return false;

    if (row.querySelector('[id^="btn-AvgCostPrice-"][id*="USDT"]')) return true;

    if (!row.classList.contains('coin-view-pc')) {
      const text = row.textContent;
      if (text.includes('USDT') || text.includes('TetherUS')) return true;
    }

    return false;
  },

  isGlobalTargeted() {
    return document.title.includes('USDT') || document.querySelector('h1')?.textContent.includes('USDT');
  }
};

// --- CORE LOGIC ---

function modifyElement(el) {
  if (el.classList.contains('bp-injected')) return;

  const isStat = TargetingEngine.isAccountStat(el);

  // Exclude unit prices (avg cost) unless it's a general statistic
  if (!isStat && el.closest('[id*="AvgCostPrice"], [id*="AvgPrice"], [id*="CostPrice"]')) return;

  let currentText = el.textContent.trim();
  if (!currentText) return;

  // Initialize or Restore original text
  if (!el.hasAttribute(CONFIG.ATTR.ORIGINAL)) {
    if (isPlaceholder(currentText)) return;
    el.setAttribute(CONFIG.ATTR.ORIGINAL, currentText);
  }

  const originalText = el.getAttribute(CONFIG.ATTR.ORIGINAL);
  const isTargeted = TargetingEngine.isCoinRowTargeted(el) || TargetingEngine.isGlobalTargeted();

  const lastSet = el.getAttribute(CONFIG.ATTR.LAST_SET);
  const lastMult = el.getAttribute(CONFIG.ATTR.MULTIPLIER);

  // Skip if already up-to-date
  if (lastSet === currentText && lastMult === multiplier.toString()) return;

  // If not targeted, revert to original
  if (!isTargeted && !isStat) {
    if (el.textContent !== originalText) {
      el.textContent = originalText;
      el.setAttribute(CONFIG.ATTR.LAST_SET, originalText);
      el.setAttribute(CONFIG.ATTR.MULTIPLIER, multiplier.toString());
    }
    return;
  }

  // Transform
  const newText = PriceService.transformString(originalText, multiplier);

  // Color logic for PnL / Stat labels
  const isColorCandidate = /[\+\-\$]|PnL|Profit/i.test(originalText) && /[+-]/.test(newText);
  const labelMatch = isStat && isColorCandidate ?
    newText.match(/^(.*?(?:PnL|Profit|Balance|Total|Equity|Assets))(\s*[\+\-\$].*)$/i) : null;

  if (labelMatch) {
    const label = labelMatch[1];
    const value = labelMatch[2];
    const isPositive = value.includes('+') || (!value.includes('-') && parseFloat(value.replace(/[^\d.-]/g, '')) > 0);
    const colorClass = isPositive ? 'text-t-buy' : 'text-t-sell';
    const altColorClass = isPositive ? 'text-TextBuy' : 'text-TextSell';

    const html = `${label}<span class="${colorClass} ${altColorClass} bp-injected">${value}</span>`;
    if (el.innerHTML !== html) {
      el.innerHTML = html;
    }
    el.setAttribute(CONFIG.ATTR.LAST_SET, newText);
    el.setAttribute(CONFIG.ATTR.MULTIPLIER, multiplier.toString());
    el.classList.remove('text-t-buy', 'text-t-sell', 'text-TextBuy', 'text-TextSell');
  } else {
    if (el.textContent !== newText || lastMult !== multiplier.toString()) {
      el.textContent = newText;
      el.setAttribute(CONFIG.ATTR.LAST_SET, newText);
      el.setAttribute(CONFIG.ATTR.MULTIPLIER, multiplier.toString());
    }

    if (isStat && isColorCandidate) {
      const isPositive = newText.includes('+') || (!newText.includes('-') && parseFloat(newText.replace(/[^\d.-]/g, '')) > 0);
      const colorClass = isPositive ? 'text-t-buy' : 'text-t-sell';
      const altColorClass = isPositive ? 'text-TextBuy' : 'text-TextSell';
      if (!el.classList.contains(colorClass)) el.classList.add(colorClass);
      if (!el.classList.contains(altColorClass)) el.classList.add(altColorClass);
      el.classList.remove(isPositive ? 'text-t-sell' : 'text-t-buy', isPositive ? 'text-TextSell' : 'text-TextBuy');
    } else if (isStat) {
      el.classList.remove('text-t-buy', 'text-t-sell', 'text-TextBuy', 'text-TextSell');
    }
  }
}

function updateProfile() {
  CONFIG.PROFILE_SELECTORS.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('Regular User')) {
          node.textContent = node.textContent.replace('Regular User', 'VIP 7');
        }
      });
    });
  });
}

function updateAllPrices() {
  if (isUpdating) return;
  isUpdating = true;

  if (observer) observer.disconnect();

  try {
    const uniqueElements = new Set();
    CONFIG.SELECTORS.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => uniqueElements.add(el));
    });

    uniqueElements.forEach(el => modifyElement(el));
    updateProfile();
    updateSpecialBalances();
  } catch (e) {
    console.debug('Binance Price Increaser: Error during update', e);
  } finally {
    isUpdating = false;
    startObserver();
  }
}

const seenSpecialTargets = new WeakSet();

// Helper to find absolute targets (including piercing Shadow DOM)
function findTargets(selector, root = document) {
  let result = Array.from(root.querySelectorAll(selector));
  const all = root.querySelectorAll('*');
  for (const el of all) {
    if (el.shadowRoot) {
      result = result.concat(findTargets(selector, el.shadowRoot));
    }
  }
  return result;
}

function getStableRandomBalance(symbol) {
  if (!symbol) return '0.00000000';
  const sym = symbol.toUpperCase().trim();

  // Deterministic seed based on symbol
  let hash = 0;
  for (let i = 0; i < sym.length; i++) {
    hash = ((hash << 5) - hash) + sym.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash) / 2147483647;

  // Plausible ranges for common coins
  if (sym === 'BTC') return (seed * 0.4 + 0.08).toFixed(8);
  if (sym === 'ETH') return (seed * 4 + 1).toFixed(4);
  if (sym === 'BNB') return (seed * 20 + 5).toFixed(2);
  if (sym === 'SOL') return (seed * 50 + 15).toFixed(2);
  if (sym.includes('USD') || sym === 'USDT' || sym === 'FDUSD') return usdtAmount || '1000.00';

  return (seed * 500 + 100).toFixed(2);
}

function updateSpecialBalances() {
  function setNodeText(target, text) {
    let textUpdated = false;
    function searchAndReplace(node) {
      if (textUpdated) return;
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE && child.nodeValue.trim() !== '') {
          child.nodeValue = text;
          textUpdated = true;
          return;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          searchAndReplace(child);
        }
      }
    }
    searchAndReplace(target);
    if (!textUpdated) target.textContent = text;
  }

  // Search for all currency toggles (including Shadow DOM)
  const buttons = findTargets(`
    [data-testid*="toggle-currency-"], 
    [aria-label*="Select "], 
    [data-testid*="currency-display-"],
    [data-testid*="selected-currency"],
    [data-active-currency],
    [data-testid="coin-toggle"]
  `.trim());

  buttons.forEach(btn => {
    // 1. Determine the Coin Symbol
    let symbol = (btn.getAttribute('data-active-currency') ||
      btn.getAttribute('aria-label')?.replace('Select ', '') ||
      '').toUpperCase();

    if (!symbol) {
      // Fallback: look for coin icon or specific text
      const icon = btn.querySelector('svg[data-ds-icon], [title]');
      symbol = (icon?.getAttribute('data-ds-icon') || icon?.getAttribute('title') || '').toUpperCase();
    }

    if (!symbol) {
      // Final fallback: regex match USDT/BTC/ETH etc in button text
      const match = btn.textContent.match(/(USDT|BTC|ETH|SOL|BNB|DOGE|LTC|XRP|TRX|BCH)/i);
      symbol = match ? match[0].toUpperCase() : '';
    }

    if (!symbol) return;

    // 2. Identify the Target Balance Span
    const targets = findTargets(`
        .content .ds-body-md-strong, 
        span[tag="span"].ds-body-md-strong,
        .ds-body-md-strong,
        span.typography-body1,
        span[data-ds-text="true"]
    `.trim(), btn);
    const target = targets[0];
    if (!target) return;

    // 3. Apply the Balance (USDT override OR Stable Random)
    const targetValue = (symbol === 'USDT' && usdtAmount) ? usdtAmount : getStableRandomBalance(symbol);

    const currentText = target.textContent.trim();
    if (currentText !== targetValue) {
      setNodeText(target, targetValue);
      target.classList.add('bp-injected');
      btn.classList.add('bp-injected');
    }

    // 4. Persistence Observer
    if (!seenSpecialTargets.has(btn)) {
      const btnObserver = new MutationObserver(() => {
        const innerSpans = findTargets(`
            .content .ds-body-md-strong, 
            span[tag="span"].ds-body-md-strong,
            .ds-body-md-strong,
            span.typography-body1,
            span[data-ds-text="true"]
        `.trim(), btn);
        const span = innerSpans[0];
        if (span && span.textContent.trim() !== targetValue) {
          setNodeText(span, targetValue);
          span.classList.add('bp-injected');
        }
      });
      btnObserver.observe(btn, { childList: true, subtree: true, characterData: true });
      seenSpecialTargets.add(btn);
    }
  });
}

function debouncedUpdate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(updateAllPrices, 100);
}

// --- INITIALIZATION ---

const observer = new MutationObserver((mutations) => {
  let shouldUpdate = false;
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('bp-injected')) {
          shouldUpdate = true;
          break;
        }
      }
    } else if (mutation.type === 'characterData') {
      const parent = mutation.target.parentElement;
      if (parent && !parent.classList.contains('bp-injected')) {
        shouldUpdate = true;
      }
    } else if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
      if (!mutation.target.classList.contains('bp-injected')) {
        shouldUpdate = true;
      }
    }
    if (shouldUpdate) break;
  }
  if (shouldUpdate) debouncedUpdate();
});

function startObserver() {
  if (observer) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }
}

// Setup storage listeners
chrome.storage.sync.get(['multiplier', 'usdtAmount'], (result) => {
  if (result.multiplier) {
    multiplier = parseFloat(result.multiplier);
  }
  if (result.usdtAmount) {
    usdtAmount = result.usdtAmount;
  }
  debouncedUpdate();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.multiplier) {
    multiplier = parseFloat(changes.multiplier.newValue);
    debouncedUpdate();
  }
  if (changes.usdtAmount) {
    usdtAmount = changes.usdtAmount.newValue;
    debouncedUpdate();
  }
});

// Continuous check for the special USDT toggle (brute force for Svelte re-renders)
setInterval(updateSpecialBalances, 1000);

// Staggered initial updates
updateAllPrices();
setTimeout(updateAllPrices, 500);
setTimeout(updateAllPrices, 1000);
setTimeout(updateAllPrices, 2000);
setTimeout(updateAllPrices, 5000);
startObserver();
