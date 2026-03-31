document.addEventListener('DOMContentLoaded', () => {
  const multiplierInput = document.getElementById('multiplier');
  const usdtAmountInput = document.getElementById('usdt-amount');
  const saveBtn = document.getElementById('save-btn');

  // Load current settings
  chrome.storage.sync.get(['multiplier', 'usdtAmount'], (result) => {
    if (result.multiplier) {
      multiplierInput.value = result.multiplier;
    }
    if (result.usdtAmount) {
      usdtAmountInput.value = result.usdtAmount;
    }
  });

  // Save on button click
  saveBtn.addEventListener('click', () => {
    const multVal = parseFloat(multiplierInput.value);
    const usdtVal = usdtAmountInput.value.trim();

    chrome.storage.sync.set({ 
      multiplier: isNaN(multVal) ? 1.0 : multVal, 
      usdtAmount: usdtVal 
    }, () => {
        // Show success state
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.style.backgroundColor = '#27ae60';
        saveBtn.style.color = '#fff';
        
        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.style.backgroundColor = '';
          saveBtn.style.color = '';
        }, 1500);
    });
  });

  // Optional: Save on input change with de-bounce
  // multiplierInput.addEventListener('input', () => { ... });
});
