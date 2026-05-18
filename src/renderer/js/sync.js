'use strict';

/*
 * Renderer-side sync module.
 *
 * Overrides localStorage.setItem to transparently fire-and-forget
 * sync-up to Supabase on every write to a synced key.
 * No changes required in any page module.
 */

window.Sync = (() => {

  const SYNC_KEYS = new Set([
    'klinch_processes',
    'klinch_interviews',
    'klinch_applications',
    'klinch_dry_runs',
    'klinch_resume',
    'klinch_profile',
  ]);

  // Preserve the native setItem before overriding
  const _origSetItem = localStorage.setItem.bind(localStorage);

  // When true, writes from our own sync-down code skip the override
  let _bypassing = false;

  // Write to localStorage without triggering sync-up (used during sync-down)
  function _writeLocal(key, value) {
    _bypassing = true;
    try { _origSetItem(key, typeof value === 'string' ? value : JSON.stringify(value)); }
    finally { _bypassing = false; }
  }

  // ── Write-through override ─────────────────────────────────────────────────

  localStorage.setItem = function(key, value) {
    _origSetItem(key, value);
    if (_bypassing || !SYNC_KEYS.has(key)) return;
    try {
      const data = JSON.parse(value);
      window.klinch.invoke('supabase:sync-up', { key, data }).catch(() => {});
    } catch { /* malformed JSON — skip */ }
  };

  // ── Sync-down helpers ──────────────────────────────────────────────────────

  async function _down(key) {
    try {
      return await window.klinch.invoke('supabase:sync-down', { key });
    } catch { return { ok: false, data: null }; }
  }

  // ── Migration: push all existing localStorage data to Supabase ────────────

  async function checkMigration() {
    // Only meaningful when there's actual app data in localStorage
    const hasLocal = ['klinch_interviews', 'klinch_applications', 'klinch_dry_runs', 'klinch_resume'].some(k => {
      const v = localStorage.getItem(k);
      if (!v) return false;
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.length > 0 : p !== null;
    });
    if (!hasLocal) return false;

    // Check if Supabase already has interview data for this user
    const res = await _down('klinch_interviews');
    return res.ok && (res.data === null || res.data?.length === 0);
  }

  async function migrateLocalToSupabase() {
    const keys = ['klinch_interviews', 'klinch_applications', 'klinch_dry_runs', 'klinch_resume', 'klinch_profile'];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const data = JSON.parse(raw);
        await window.klinch.invoke('supabase:sync-up', { key, data });
      } catch { /* skip failures — best effort */ }
    }
  }

  // ── On-launch sync-down: Supabase wins on conflict ─────────────────────────

  async function syncAllDown() {
    const keys = ['klinch_processes', 'klinch_interviews', 'klinch_applications', 'klinch_dry_runs', 'klinch_resume', 'klinch_profile'];

    const results = await Promise.allSettled(keys.map(k => _down(k)));

    results.forEach((result, i) => {
      const key = keys[i];
      if (result.status !== 'fulfilled') return;
      const res = result.value;
      if (!res.ok || res.data === null) return; // no remote data — keep localStorage
      _writeLocal(key, JSON.stringify(res.data));
    });

    // Merge billing fields from profiles into klinch_settings.billing
    const profileResult = results[5]; // index 5 = klinch_profile (was 4 before klinch_processes added)
    if (profileResult.status === 'fulfilled' && profileResult.value?.billing) {
      _mergeBillingFromProfile(profileResult.value.billing);
    }

    // Signal to any listener (e.g. CoachPage badge) that synced data is now in localStorage
    window.dispatchEvent(new CustomEvent('klinch:synced'));
  }

  function _mergeBillingFromProfile(billing) {
    if (!billing.stripe_customer_id && billing.plan === null && billing.credits === null) return;
    try {
      const settings = JSON.parse(localStorage.getItem('klinch_settings') || '{}');
      const existing = settings.billing || {};
      if (billing.stripe_customer_id) existing.customer_id = billing.stripe_customer_id;
      if (billing.plan)               existing.plan        = billing.plan;
      if (billing.credits !== null)   existing.credits_remaining = billing.credits;
      settings.billing = existing;
      // Write directly — klinch_settings is not a SYNC_KEY so no loop
      _origSetItem('klinch_settings', JSON.stringify(settings));
    } catch { /* non-fatal */ }
  }

  return { syncAllDown, checkMigration, migrateLocalToSupabase };
})();
