// Supabase Sync Adapter that mimics the RobustiCloudSync API used by RobustDataService
// It stores a single JSON document per project under a fixed key and uses Realtime for changes
(function () {
    const STORAGE_KEYS = {
        provider: 'sync_provider', // 'icloud' | 'supabase'
        supabaseUrl: 'supabase_url',
        supabaseAnonKey: 'supabase_anon_key',
        supabaseSchemaReady: 'supabase_schema_ready'
    };

    function isCapacitor() {
        return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    }

    async function getPref(key) {
        try {
            if (isCapacitor() && window.Capacitor.Plugins?.Preferences) {
                const res = await window.Capacitor.Plugins.Preferences.get({ key });
                return res && res.value ? res.value : null;
            }
        } catch (_) {}
        try { return localStorage.getItem(key); } catch (_) { return null; }
    }

    async function setPref(key, value) {
        try {
            if (isCapacitor() && window.Capacitor.Plugins?.Preferences) {
                await window.Capacitor.Plugins.Preferences.set({ key, value: value ?? '' });
                return;
            }
        } catch (_) {}
        try { localStorage.setItem(key, value ?? ''); } catch (_) {}
    }

    function nowIso() { return new Date().toISOString(); }

    class SupabaseSyncAdapter {
        constructor() {
            this.client = null;
            this.channel = null;
            this.table = 'kanban_sync';
            this.rowId = 'kanban-data';
            this.initialized = false;
            this.changeListeners = [];
            this.lastKnown = null;
        }

        async init() {
            let url = await getPref(STORAGE_KEYS.supabaseUrl);
            const key = await getPref(STORAGE_KEYS.supabaseAnonKey);
            // Normalize URL (strip trailing slash)
            if (url && url.endsWith('/')) url = url.slice(0, -1);
            if (!url || !key || !window.supabase) {
                // Missing configuration or SDK; keep adapter inert
                return false;
            }
            if (!this.client) {
                this.client = window.supabase.createClient(url, key, {
                    realtime: { params: { eventsPerSecond: 5 } }
                });
            }

            await this.ensureSchema();

            // Subscribe to realtime changes on the single row
            try {
                if (this.channel) { try { await this.channel.unsubscribe(); } catch (_) {} }
                this.channel = this.client
                    .channel('kanban-sync-channel')
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: this.table,
                        filter: `id=eq.${this.rowId}`
                    }, (payload) => {
                        if (payload.new && payload.new.data) {
                            const data = payload.new.data;
                            this.lastKnown = data?.lastSync || nowIso();
                            this.changeListeners.forEach(cb => {
                                try { cb(data); } catch (e) { console.error(e); }
                            });
                        }
                    })
                    .subscribe((status) => {
                        // no-op; status can be 'SUBSCRIBED'
                    });
            } catch (err) {
                console.error('Supabase realtime subscribe failed:', err);
            }

            this.initialized = true;
            return true;
        }

        addChangeListener(callback) {
            this.changeListeners.push(callback);
        }

        async saveToiCloud(data) { // keep API name for compatibility
            if (!this.client) return false;
            // Upsert the single JSON document
            const payload = {
                id: this.rowId,
                data: {
                    ...data,
                    lastSync: data.lastSync || nowIso()
                },
                updated_at: new Date()
            };
            const { error } = await this.client
                .from(this.table)
                .upsert(payload, { onConflict: 'id' });
            if (error) {
                console.error('Supabase upsert error:', error);
                return false;
            }
            this.lastKnown = payload.data.lastSync;
            return true;
        }

        async loadFromiCloud() { // keep API name for compatibility
            if (!this.client) return null;
            const { data, error } = await this.client
                .from(this.table)
                .select('data')
                .eq('id', this.rowId)
                .single();
            if (error) {
                if (error.code !== 'PGRST116') { // not found is ok
                    console.error('Supabase load error:', error);
                }
                return null;
            }
            this.lastKnown = data?.data?.lastSync || null;
            return data?.data || null;
        }

        async checkForUpdates(currentData) {
            const remote = await this.loadFromiCloud();
            if (!remote) return { hasUpdates: false, currentSync: currentData?.lastSync || null, cloudSync: null };
            const hasUpdates = !currentData?.lastSync || new Date(remote.lastSync) > new Date(currentData.lastSync);
            return {
                hasUpdates,
                currentSync: currentData?.lastSync || null,
                cloudSync: remote.lastSync || null,
                data: remote
            };
        }

        async ensureSchema() {
            // best-effort: create table if it doesn't exist (requires service role; normal anon can't). So we only mark readiness if exists.
            // Expect users to run provided SQL manually in their project.
            const cached = await getPref(STORAGE_KEYS.supabaseSchemaReady);
            if (cached === 'true') return true;
            try {
                const { error } = await this.client
                    .from(this.table)
                    .select('id')
                    .eq('id', this.rowId)
                    .maybeSingle();
                if (!error) {
                    await setPref(STORAGE_KEYS.supabaseSchemaReady, 'true');
                    return true;
                }
            } catch (_) {}
            return false;
        }
    }

    async function ensureSupabaseSdk() {
        if (window.supabase) return true;
        return await new Promise(resolve => {
            try {
                const existing = document.querySelector('script[data-supabase-sdk]');
                if (existing) { existing.addEventListener('load', () => resolve(!!window.supabase)); return; }
                const s = document.createElement('script');
                s.src = 'https://unpkg.com/@supabase/supabase-js@2';
                s.setAttribute('data-supabase-sdk', 'true');
                s.onload = () => resolve(!!window.supabase);
                s.onerror = () => resolve(false);
                document.head.appendChild(s);
            } catch (_) { resolve(false); }
        });
    }

    async function selectProvider() {
        const provider = (await getPref(STORAGE_KEYS.provider)) || 'none';
        if (provider === 'supabase') {
            const ok = await ensureSupabaseSdk();
            if (!ok) { console.error('Supabase SDK not available'); return; }
            window.RobustiCloudSync = new SupabaseSyncAdapter();
            try { await window.RobustiCloudSync.init(); } catch (e) { console.error(e); }
        } else if (provider === 'none') {
            // No sync - disable cloud sync
            window.RobustiCloudSync = null;
        }
        // else (icloud) leave existing iCloud adapter as-is
    }

    // Expose helpers for UI to save settings
    window.SyncSettings = {
        get: getPref,
        set: setPref,
        keys: STORAGE_KEYS,
        selectProvider
    };

    // Attempt provider selection early
    selectProvider();
})();

// Suggested SQL (user must run in their Supabase project):
// create table if not exists public.kanban_sync (
//   id text primary key,
//   data jsonb not null,
//   updated_at timestamp with time zone default now()
// );
// -- Enable Realtime
// alter publication supabase_realtime add table public.kanban_sync;


