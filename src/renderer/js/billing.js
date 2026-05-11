'use strict';

window.Billing = (() => {

  // ── Plan metadata ─────────────────────────────────────────────────────────────

  const PLAN_META = {
    free_trial:  { label: 'Free Trial',  max_credits: 3,  unlimited: false },
    starter:     { label: 'Starter',     max_credits: 10, unlimited: false },
    unlimited:   { label: 'Unlimited',   max_credits: -1, unlimited: true  },
    pay_per_use: { label: 'Pay-per-use', max_credits: 0,  unlimited: false },
  };

  // ── Storage ───────────────────────────────────────────────────────────────────

  function _getSettings() {
    return JSON.parse(localStorage.getItem('klinch_settings') || '{}');
  }

  function _getBilling() {
    return _getSettings().billing || _defaultState();
  }

  function _saveBilling(b) {
    const s = _getSettings();
    s.billing = b;
    localStorage.setItem('klinch_settings', JSON.stringify(s));
  }

  function _defaultState() {
    return {
      plan:                 'free_trial',
      credits_remaining:    3,
      trial_started_at:     new Date().toISOString(),
      period_end:           null,
      subscription_id:      null,
      customer_id:          null,
      cancel_at_period_end: false,
    };
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    const s = _getSettings();
    if (!s.billing) {
      // First launch — write default state including trial_started_at
      const init_state = _defaultState();
      _saveBilling(init_state);
      // Sync trial_started_at to Supabase now (fire-and-forget; silently skipped if not yet authed)
      window.klinch.invoke('billing:sync-to-supabase', {
        plan:               init_state.plan,
        credits:            init_state.credits_remaining,
        stripe_customer_id: null,
        trial_started_at:   init_state.trial_started_at,
      }).catch(() => {});
    } else {
      _checkPeriodReset();
      // Backfill trial_started_at for users created before this field existed
      const b = _getBilling();
      if (!b.trial_started_at) {
        const backfilled = { ...b, trial_started_at: new Date().toISOString() };
        _saveBilling(backfilled);
        window.klinch.invoke('billing:sync-to-supabase', {
          plan:               backfilled.plan,
          credits:            backfilled.credits_remaining || 0,
          stripe_customer_id: backfilled.customer_id || null,
          trial_started_at:   backfilled.trial_started_at,
        }).catch(() => {});
      }
    }
    _bindUpgradeModal();
    _bindCancelModal();
    _bindTrialBanner();
    _bindSettingsPlanButtons();
    refreshBanner();
    refreshSettings();
    _maybeSyncSubscription(); // fire-and-forget
  }

  function _checkPeriodReset() {
    const b = _getBilling();
    if (b.plan !== 'starter' || !b.period_end) return;
    if (Date.now() >= new Date(b.period_end).getTime()) {
      // Billing period rolled over — reset session credits
      const updated = { ...b, credits_remaining: 10 };
      _saveBilling(updated);
    }
  }

  async function _maybeSyncSubscription() {
    const b = _getBilling();
    // Run if we have a subscription or at least a customer on file
    if (!b.subscription_id && !b.customer_id) return;
    try {
      const res = await window.klinch.invoke('billing:sync-status', {
        subscription_id: b.subscription_id || undefined,
        customer_id:     b.customer_id     || undefined,
      });
      if (!res.ok) return;
      const updated = { ...b };

      // Apply Supabase-authoritative fields (survive reinstalls)
      if (res.stripe_customer_id) updated.customer_id = res.stripe_customer_id;
      if (res.plan)                updated.plan = res.plan;
      if (res.credits !== undefined && res.credits !== null) updated.credits_remaining = res.credits;
      // Restore trial_started_at from Supabase only if not already set locally
      if (res.trial_started_at && !updated.trial_started_at) updated.trial_started_at = res.trial_started_at;

      // Apply Stripe subscription fields
      if (res.current_period_end)               updated.period_end          = new Date(res.current_period_end * 1000).toISOString();
      if (res.cancel_at_period_end !== undefined) updated.cancel_at_period_end = res.cancel_at_period_end;

      // Subscription lapsed — drop back to free trial
      if (res.status === 'canceled' || res.status === 'unpaid') {
        updated.plan              = 'free_trial';
        updated.credits_remaining = 0;
        updated.subscription_id   = null;
      }

      _saveBilling(updated);
      refreshBanner();
      refreshSettings();
    } catch (_) {}
  }

  // ── Plan enforcement ──────────────────────────────────────────────────────────

  function getTrialDaysRemaining() {
    const b = _getBilling();
    if (!b.trial_started_at) return 7;
    const msLeft = new Date(b.trial_started_at).getTime() + 7 * 24 * 60 * 60 * 1000 - Date.now();
    return Math.max(0, Math.floor(msLeft / (24 * 60 * 60 * 1000)));
  }

  function canStartSession() {
    const b = _getBilling();
    if (b.plan === 'unlimited') return true;
    if (b.plan === 'free_trial' && b.trial_started_at) {
      const expiry = new Date(b.trial_started_at).getTime() + 7 * 24 * 60 * 60 * 1000;
      if (Date.now() >= expiry) return false;
    }
    return (b.credits_remaining || 0) > 0;
  }

  function consumeCredit() {
    const b = _getBilling();
    if (b.plan === 'unlimited') return;
    if ((b.credits_remaining || 0) > 0) {
      _saveBilling({ ...b, credits_remaining: b.credits_remaining - 1 });
      refreshBanner();
      refreshSettings();
    }
  }

  // ── Upgrade modal ─────────────────────────────────────────────────────────────

  let _pollTimer = null;

  function showUpgradeModal() {
    const modal = document.getElementById('upgrade-modal');
    if (modal) modal.style.display = 'flex';
  }

  function _hideUpgradeModal() {
    const modal = document.getElementById('upgrade-modal');
    if (modal) modal.style.display = 'none';
    _stopPolling();
  }

  function _stopPolling() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  function _bindUpgradeModal() {
    const modal = document.getElementById('upgrade-modal');
    if (!modal) return;
    document.getElementById('upgrade-maybe-later')?.addEventListener('click', _hideUpgradeModal);
    modal.addEventListener('click', e => { if (e.target === modal) _hideUpgradeModal(); });
    modal.querySelectorAll('[data-checkout]').forEach(btn => {
      btn.addEventListener('click', () => _handleCheckoutBtn(btn));
    });
  }

  // ── Settings plan buttons (event delegation) ──────────────────────────────────

  function _bindSettingsPlanButtons() {
    document.getElementById('page-settings')?.addEventListener('click', e => {
      const btn = e.target.closest('.plan-upgrade-btn[data-checkout]');
      if (btn) _handleCheckoutBtn(btn);
    });
  }

  // ── Checkout flow ─────────────────────────────────────────────────────────────

  async function _handleCheckoutBtn(btn) {
    const plan_key  = btn.dataset.checkout;
    const origLabel = btn.textContent;
    btn.disabled    = true;
    btn.textContent = 'Opening checkout…';

    const b   = _getBilling();
    const res = await window.klinch.invoke('billing:create-checkout', {
      plan_key,
      customer_id: b.customer_id || undefined,
    });

    btn.disabled = false;
    if (!res.ok) {
      btn.textContent = origLabel;
      _showError(res.error);
      return;
    }

    btn.textContent = 'Waiting for payment…';
    _pollCheckout(res.session_id, plan_key, () => {
      btn.textContent = origLabel;
    });
  }

  function _pollCheckout(session_id, plan_key, onDone) {
    _stopPolling();
    let attempts = 0;
    _pollTimer = setInterval(async () => {
      attempts++;
      if (attempts > 72) { // stop after ~6 min
        _stopPolling();
        onDone?.();
        return;
      }
      try {
        const res = await window.klinch.invoke('billing:poll-checkout', { session_id });
        if (!res.ok) return;
        if (res.payment_status === 'paid' || res.status === 'complete') {
          _stopPolling();
          onDone?.();
          _applyCheckoutResult(res, plan_key);
        }
      } catch (_) {}
    }, 5000);
  }

  function _applyCheckoutResult(data, plan_key) {
    const b = { ..._getBilling() };

    if (data.customer_id) b.customer_id = data.customer_id;

    if (plan_key === 'starter') {
      b.plan              = 'starter';
      b.credits_remaining = 10;
      if (data.subscription) {
        b.subscription_id = data.subscription.id || data.subscription;
        if (data.subscription.current_period_end) {
          b.period_end = new Date(data.subscription.current_period_end * 1000).toISOString();
        }
      }
    } else if (plan_key === 'unlimited') {
      b.plan              = 'unlimited';
      b.credits_remaining = -1;
      if (data.subscription) {
        b.subscription_id = data.subscription.id || data.subscription;
        if (data.subscription.current_period_end) {
          b.period_end = new Date(data.subscription.current_period_end * 1000).toISOString();
        }
      }
    } else if (plan_key === 'pack') {
      b.credits_remaining = Math.max(b.credits_remaining || 0, 0) + 5;
      if (b.plan === 'free_trial' || b.plan === 'pay_per_use') b.plan = 'pay_per_use';
    }

    b.cancel_at_period_end = false;
    _saveBilling(b);
    _hideUpgradeModal();
    refreshBanner();
    refreshSettings();

    // Persist billing state to Supabase so it survives reinstalls
    window.klinch.invoke('billing:sync-to-supabase', {
      plan:               b.plan,
      credits:            b.plan === 'unlimited' ? -1 : (b.credits_remaining || 0),
      stripe_customer_id: b.customer_id || null,
      trial_started_at:   b.trial_started_at || null,
    }).catch(() => {});

    const msgs = {
      starter:   'Starter plan activated! You have 10 interviews this month.',
      unlimited: "Unlimited plan activated! You're all set.",
      pack:      '5 interviews added to your account!',
    };
    window.klinch.send('notify', { title: 'Klinch', body: msgs[plan_key] || 'Plan activated!' });
  }

  // ── Cancel subscription ───────────────────────────────────────────────────────

  async function cancelSubscription() {
    const b = _getBilling();
    if (!b.subscription_id) return { ok: false, error: 'No active subscription' };
    const res = await window.klinch.invoke('billing:cancel-subscription', {
      subscription_id: b.subscription_id,
    });
    if (res.ok) {
      _saveBilling({ ..._getBilling(), cancel_at_period_end: true });
      refreshSettings();
    }
    return res;
  }

  function _bindCancelModal() {
    const modal   = document.getElementById('billing-cancel-modal');
    const confirm = document.getElementById('billing-cancel-confirm');
    const abort   = document.getElementById('billing-cancel-abort');
    if (!modal) return;

    abort?.addEventListener('click', () => modal.classList.remove('visible'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('visible'); });

    confirm?.addEventListener('click', async () => {
      confirm.disabled    = true;
      confirm.textContent = 'Canceling…';
      const res = await cancelSubscription();
      confirm.disabled    = false;
      confirm.textContent = 'Yes, Cancel';
      modal.classList.remove('visible');
      if (!res.ok) _showError('Could not cancel: ' + res.error);
    });
  }

  // ── Billing portal ────────────────────────────────────────────────────────────

  async function openBillingPortal() {
    const b   = _getBilling();
    if (!b.customer_id) { _showError('No billing account on file.'); return; }
    const res = await window.klinch.invoke('billing:customer-portal', { customer_id: b.customer_id });
    if (!res.ok) _showError('Could not open billing portal: ' + res.error);
  }

  // ── UI — trial banner ─────────────────────────────────────────────────────────

  function refreshBanner() {
    const banner = document.getElementById('trial-banner');
    if (!banner) return;
    const b = _getBilling();
    if (b.plan !== 'free_trial' || !canStartSession()) {
      banner.style.display = 'none';
      return;
    }
    const creditsEl = document.getElementById('trial-credits-count');
    if (creditsEl) creditsEl.textContent = b.credits_remaining;
    const daysEl = document.getElementById('trial-days-count');
    if (daysEl) daysEl.textContent = getTrialDaysRemaining();
    banner.style.display = '';
  }

  function _bindTrialBanner() {
    document.getElementById('trial-banner-upgrade')?.addEventListener('click', showUpgradeModal);
    document.getElementById('trial-banner-close')?.addEventListener('click', () => {
      const banner = document.getElementById('trial-banner');
      if (banner) banner.style.display = 'none';
    });
  }

  // ── UI — settings billing status ──────────────────────────────────────────────

  function refreshSettings() {
    _renderBillingStatus();
    _updatePlanCardHighlight();
    _updateTrialCard();
  }

  function _updateTrialCard() {
    const el = document.getElementById('trial-days-remaining-feature');
    if (!el) return;
    const days = getTrialDaysRemaining();
    el.textContent = days > 0 ? `${days} day${days !== 1 ? 's' : ''} remaining` : 'Trial expired';
  }

  function _renderBillingStatus() {
    const container = document.getElementById('billing-status-section');
    if (!container) return;
    const b    = _getBilling();
    const meta = PLAN_META[b.plan] || PLAN_META.free_trial;

    // Credits badge
    let creditsHtml = '';
    if (b.plan === 'unlimited') {
      creditsHtml = `<span class="billing-badge billing-badge-unlimited">Unlimited</span>`;
    } else {
      const n = b.credits_remaining || 0;
      const suffix = b.plan === 'starter' ? ` of ${meta.max_credits} this month` : ` interview${n !== 1 ? 's' : ''} remaining`;
      creditsHtml = `<span class="billing-badge">${n}${suffix}</span>`;
    }

    // Renewal/expiry line
    let renewalHtml = '';
    if (b.period_end && (b.plan === 'starter' || b.plan === 'unlimited')) {
      const verb = b.cancel_at_period_end ? 'Access until' : 'Renews';
      const dstr = new Date(b.period_end).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      });
      renewalHtml = `<span class="billing-renewal-text">${verb} ${dstr}</span>`;
    }

    // Action buttons
    const btns = [];
    if (b.plan !== 'unlimited') {
      btns.push(`<button class="billing-action-btn" id="bs-upgrade-btn">Upgrade Plan</button>`);
    }
    if (b.plan !== 'unlimited') {
      btns.push(`<button class="billing-action-btn billing-action-secondary" id="bs-pack-btn">Buy 5 Interviews — $1.99</button>`);
    }
    if (b.customer_id) {
      btns.push(`<button class="billing-action-btn billing-action-secondary" id="bs-portal-btn">Manage Billing</button>`);
    }
    if (b.subscription_id && !b.cancel_at_period_end) {
      btns.push(`<button class="billing-action-btn billing-action-danger" id="bs-cancel-btn">Cancel Subscription</button>`);
    }

    container.innerHTML = `
      <div class="billing-status-card">
        <div class="billing-status-main">
          <div class="billing-status-name-row">
            <span class="billing-status-plan-name">${meta.label}</span>
            ${b.cancel_at_period_end ? '<span class="billing-canceling-badge">Canceling</span>' : ''}
          </div>
          <div class="billing-status-meta">
            ${creditsHtml}${renewalHtml ? ' · ' + renewalHtml : ''}
          </div>
        </div>
        ${btns.length ? `<div class="billing-action-row">${btns.join('')}</div>` : ''}
      </div>
    `;

    // Bind freshly rendered buttons
    document.getElementById('bs-upgrade-btn')?.addEventListener('click', showUpgradeModal);
    document.getElementById('bs-pack-btn')?.addEventListener('click', () => _startPackCheckout());
    document.getElementById('bs-portal-btn')?.addEventListener('click', openBillingPortal);
    document.getElementById('bs-cancel-btn')?.addEventListener('click', () => {
      const modal  = document.getElementById('billing-cancel-modal');
      const dateEl = modal?.querySelector('.cancel-period-end-date');
      const b      = _getBilling();
      if (dateEl && b.period_end) {
        dateEl.textContent = new Date(b.period_end).toLocaleDateString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric',
        });
      }
      modal?.classList.add('visible');
    });
  }

  async function _startPackCheckout() {
    const btn = document.getElementById('bs-pack-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Opening checkout…'; }
    const b   = _getBilling();
    const res = await window.klinch.invoke('billing:create-checkout', {
      plan_key:    'pack',
      customer_id: b.customer_id || undefined,
    });
    if (btn) { btn.disabled = false; btn.textContent = 'Buy 5 Interviews — $1.99'; }
    if (!res.ok) { _showError(res.error); return; }
    _pollCheckout(res.session_id, 'pack', () => {});
  }

  function _updatePlanCardHighlight() {
    const b = _getBilling();
    document.querySelectorAll('.plan-card[data-plan-id]').forEach(card => {
      const isCurrent = card.dataset.planId === b.plan;
      card.classList.toggle('plan-card-current', isCurrent);
      let badge = card.querySelector('.plan-current-badge');
      if (isCurrent && !badge) {
        badge = document.createElement('div');
        badge.className = 'plan-current-badge';
        badge.textContent = 'Current Plan';
        card.prepend(badge);
      } else if (!isCurrent && badge) {
        badge.remove();
      }
    });
  }

  // ── Error helper ──────────────────────────────────────────────────────────────

  function _showError(msg) {
    window.klinch.send('notify', { title: 'Klinch Billing', body: msg });
    console.error('[billing]', msg);
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  return {
    init,
    canStartSession,
    consumeCredit,
    getTrialDaysRemaining,
    showUpgradeModal,
    openBillingPortal,
    refreshBanner,
    refreshSettings,
    getState: _getBilling,
  };

})();

// Auto-init after page has loaded all scripts
window.Billing.init();
