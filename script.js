// --- Navigation (Tab Logic for Sandbox) ---
window.showTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }

    document.querySelectorAll('.tab-trigger').forEach(t => {
        if (t.dataset.tab === tabId) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });
};

// Global Event Delegation for Tabs and Buttons
document.addEventListener('click', (e) => {
    // Handle Tab Triggers
    const tabTrigger = e.target.closest('.tab-trigger');
    if (tabTrigger) {
        const tabId = tabTrigger.dataset.tab;
        if (tabId) {
            e.preventDefault();
            window.showTab(tabId);
            return;
        }
    }
});

// --- Initialization ---
const init = () => {
    const yearEl = document.getElementById('current-year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
} else {
    document.addEventListener('DOMContentLoaded', init);
}
