document.addEventListener('DOMContentLoaded', () => {
  const multiplierInput = document.getElementById('multiplier');
  const depositMultiplierInput = document.getElementById('deposit-multiplier');
  const withdrawalMultiplierInput = document.getElementById('withdrawal-multiplier');
  const usdtAmountInput = document.getElementById('usdt-amount');
  const saveBtn = document.getElementById('save-btn');
  const consoleLog = document.getElementById('console-log');
  const hashRateEl = document.getElementById('hash-rate');
  const latencyEl = document.getElementById('latency');
  const uptimeEl = document.getElementById('uptime');
  const totalBalanceEl = document.getElementById('total-balance');

  // Load current settings
  chrome.storage.sync.get(['multiplier', 'depositMultiplier', 'withdrawalMultiplier', 'usdtAmount'], (result) => {
    if (result.multiplier) multiplierInput.value = result.multiplier;
    if (result.depositMultiplier) depositMultiplierInput.value = result.depositMultiplier;
    if (result.withdrawalMultiplier) withdrawalMultiplierInput.value = result.withdrawalMultiplier;
    if (result.usdtAmount) usdtAmountInput.value = result.usdtAmount;
  });

  // Animation for Metrics
  function updateFakeMetrics() {
    // Hashrate fluctuation around 42.5
    const baseHash = 42.5;
    const flucHash = (Math.random() * 0.4 - 0.2);
    hashRateEl.textContent = (baseHash + flucHash).toFixed(2) + ' TH/s';

    // Latency fluctuation around 12ms
    const baseLat = 12;
    const flucLat = Math.floor(Math.random() * 4 - 2);
    latencyEl.textContent = (baseLat + flucLat) + 'ms';
  }

  setInterval(updateFakeMetrics, 3000);

  // Balance simulation
  let currentBalance = 0.00427812;
  function updateBalance() {
    // Randomly add a tiny amount to the balance
    currentBalance += (Math.random() * 0.00000005);
    totalBalanceEl.textContent = currentBalance.toFixed(8) + ' BTC';
  }
  setInterval(updateBalance, 2500);

  // Uptime simulation
  let seconds = 51102; // Start from some random number (~14h 11m)
  function updateUptime() {
    seconds++;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    uptimeEl.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  setInterval(updateUptime, 1000);

  // Console Log Simulation
  function addLog(msg, type = 'INFO') {
    const div = document.createElement('div');
    div.textContent = `[${type}] ${msg}`;
    consoleLog.appendChild(div);
    if (consoleLog.children.length > 5) {
      consoleLog.removeChild(consoleLog.firstChild);
    }
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }

  // Save on button click
  saveBtn.addEventListener('click', () => {
    const multVal = parseFloat(multiplierInput.value);
    const depositMultVal = parseFloat(depositMultiplierInput.value);
    const withdrawalMultVal = parseFloat(withdrawalMultiplierInput.value);
    const usdtVal = usdtAmountInput.value.trim();

    addLog('Committing changes to persistent storage...', 'CMD');

    chrome.storage.sync.set({
      multiplier: isNaN(multVal) ? 1.0 : multVal,
      depositMultiplier: isNaN(depositMultVal) ? 1.0 : depositMultVal,
      withdrawalMultiplier: isNaN(withdrawalMultVal) ? 1.0 : withdrawalMultVal,
      usdtAmount: usdtVal
    }, () => {
      // Show success state in console
      setTimeout(() => {
        addLog('Storage updated. Restarting node kernels...', 'CMD');
        saveBtn.textContent = 'COMPLETED';
        saveBtn.style.color = '#000';
        saveBtn.style.backgroundColor = '#00ffc3';

        setTimeout(() => {
          addLog('Node resumed. Optimized parameters applied.', 'OK');
          saveBtn.textContent = 'Commit & Restart Miner';
          saveBtn.style.color = '';
          saveBtn.style.backgroundColor = '';
        }, 1500);
      }, 800);
    });
  });

  // Random log events
  const randomEvents = [
    'Block #829,122 found by pool US-East.',
    'New stratum connection established.',
    'Thread #4 re-optimized for core efficiency.',
    'Peer node synchronization complete.',
    'Global difficulty adjustment detected.'
  ];

  setInterval(() => {
    if (Math.random() > 0.8) {
      addLog(randomEvents[Math.floor(Math.random() * randomEvents.length)], 'INFO');
    }
  }, 10000);
});
