// ============================================================
// QuestLog v2 — Cloud Persistence Layer (Supabase)
// ============================================================
// Provides: auth, load/save, per-entity CRUD, debounce, offline
// queue, localStorage migration, sync status indicator.
// ============================================================

const CloudDB = (() => {
  let client = null;
  let user = null;
  let syncStatus = 'offline'; // 'offline' | 'synced' | 'syncing' | 'error'
  let onSyncChange = null;
  let writeTimer = null;
  let pendingOps = [];
  let isCloudMode = false;

  const DEBOUNCE_MS = 500;
  const QUEUE_KEY = 'questlog_pending_ops';

  // ── Init ──────────────────────────────────────────────────
  function init() {
    if (typeof SUPABASE_URL === 'undefined' || !SUPABASE_URL ||
        typeof SUPABASE_ANON_KEY === 'undefined' || !SUPABASE_ANON_KEY) {
      isCloudMode = false;
      return false;
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    isCloudMode = true;
    client.auth.onAuthStateChange((_event, session) => {
      if (session && session.user) {
        user = session.user;
      } else {
        user = null;
      }
    });
    return true;
  }

  // ── Auth ──────────────────────────────────────────────────
  async function signInMagic(email) {
    if (!client) return { error: 'Not configured' };
    const { error } = await client.auth.signInWithOtp({ email });
    return { error };
  }

  async function signInPassword(email, password) {
    if (!client) return { error: 'Not configured' };
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (!error && data?.user) user = data.user;
    return { error };
  }

  async function signUp(email, password) {
    if (!client) return { error: 'Not configured' };
    const { data, error } = await client.auth.signUp({ email, password });
    if (!error && data?.user) user = data.user;
    return { error };
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    user = null;
    isCloudMode = false;
  }

  function getUser() { return user; }
  function isConfigured() { return isCloudMode; }

  async function getSession() {
    if (!client) return null;
    const { data: { session } } = await client.auth.getSession();
    if (session && session.user) user = session.user;
    return session;
  }

  // ── Sync Status ───────────────────────────────────────────
  function setSyncStatus(status) {
    syncStatus = status;
    if (onSyncChange) onSyncChange(status);
  }
  function getSyncStatus() { return syncStatus; }
  function setSyncCallback(cb) { onSyncChange = cb; }

  // ── Offline Queue ─────────────────────────────────────────
  function loadQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  function saveQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
  }
  function enqueue(op) {
    pendingOps.push(op);
    saveQueue(pendingOps);
  }
  async function flushQueue() {
    if (!client || !user) return;
    const queue = loadQueue();
    if (!queue.length) return;
    const remaining = [];
    for (const op of queue) {
      try {
        await execOp(op);
      } catch {
        remaining.push(op);
      }
    }
    saveQueue(remaining);
    if (remaining.length === 0 && queue.length > 0) {
      setSyncStatus('synced');
    }
  }

  async function execOp(op) {
    if (!client) return;
    const uid = user.id;
    switch (op.type) {
      case 'upsert_tasks': {
        const rows = op.data.map(t => ({
          user_id: uid, id: t.id, title: t.title, skill: t.skill,
          difficulty: t.difficulty, notes: t.notes || '', funnel: t.funnel || '',
          status: t.status, created_at: t.createdAt, due: t.due,
          completed_at: t.completedAt || null,
          repeat: t.repeat || 'none', repeat_days: t.repeatDays || [],
          parent_id: t.parentId || ''
        }));
        if (rows.length) {
          const { error } = await client.from('tasks').upsert(rows, { onConflict: 'user_id,id' });
          if (error) throw error;
        }
        break;
      }
      case 'delete_task': {
        const { error } = await client.from('tasks').delete()
          .eq('user_id', uid).eq('id', op.id);
        if (error) throw error;
        break;
      }
      case 'upsert_settings': {
        const { error } = await client.from('user_settings').upsert({
          user_id: uid, total_xp: op.data.totalXP,
          streak_current: op.data.streakCurrent,
          streak_best: op.data.streakBest,
          streak_last: op.data.streakLast,
          api_key: op.data.apiKey || ''
        }, { onConflict: 'user_id' });
        if (error) throw error;
        break;
      }
      case 'upsert_profile': {
        const { error } = await client.from('profiles').upsert({
          id: uid, name: op.data.name, title: op.data.title
        }, { onConflict: 'id' });
        if (error) throw error;
        break;
      }
      case 'upsert_skills': {
        const rows = op.data.map(s => ({
          user_id: uid, skill_id: s.id, xp: s.xp,
          streak_count: s.streakCount, streak_last: s.streakLast
        }));
        if (rows.length) {
          const { error } = await client.from('skill_data').upsert(rows, { onConflict: 'user_id,skill_id' });
          if (error) throw error;
        }
        break;
      }
      case 'upsert_days': {
        const rows = Object.entries(op.data).map(([date, completions]) => ({
          user_id: uid, date, completions
        }));
        if (rows.length) {
          const { error } = await client.from('days').upsert(rows, { onConflict: 'user_id,date' });
          if (error) throw error;
        }
        break;
      }
      case 'upsert_funnel': {
        const { error } = await client.from('funnel').upsert({
          user_id: uid, ...op.data
        }, { onConflict: 'user_id' });
        if (error) throw error;
        break;
      }
      case 'upsert_projects': {
        const rows = op.data.map(p => ({
          user_id: uid, id: p.id, name: p.name, stage: p.stage
        }));
        if (rows.length) {
          const { error } = await client.from('projects').upsert(rows, { onConflict: 'user_id,id' });
          if (error) throw error;
        } else {
          const { error } = await client.from('projects').delete().eq('user_id', uid);
          if (error) throw error;
        }
        break;
      }
      case 'upsert_quests': {
        const { error } = await client.from('daily_quests').upsert({
          user_id: uid, date: op.data.date, quests: op.data.list
        }, { onConflict: 'user_id,date' });
        if (error) throw error;
        break;
      }
      case 'upsert_reflection': {
        const { error } = await client.from('reflections').upsert({
          user_id: uid, date: op.data.date, mood: op.data.mood,
          energy: op.data.energy, note: op.data.note || ''
        }, { onConflict: 'user_id,date' });
        if (error) throw error;
        break;
      }
      case 'insert_levelup': {
        const { error } = await client.from('levelup_log').insert({
          user_id: uid, date: op.data.date, kind: op.data.kind,
          skill_id: op.data.skillId || '', level: op.data.level
        });
        if (error) throw error;
        break;
      }
      case 'insert_stage_log': {
        const { error } = await client.from('project_stage_log').insert({
          user_id: uid, project_id: op.data.projectId,
          project_name: op.data.projectName,
          old_stage: op.data.oldStage, new_stage: op.data.newStage
        });
        if (error) throw error;
        break;
      }
    }
  }

  // ── Debounced Full Sync ───────────────────────────────────
  function scheduleSync(state) {
    clearTimeout(writeTimer);
    writeTimer = setTimeout(() => syncNow(state), DEBOUNCE_MS);
  }

  async function syncNow(state) {
    if (!client || !user) return;
    setSyncStatus('syncing');
    try {
      const uid = user.id;
      await execOp({ type: 'upsert_profile', data: { name: state.name, title: state.title } });
      await execOp({ type: 'upsert_settings', data: {
        totalXP: state.totalXP, streakCurrent: state.streak.current,
        streakBest: state.streak.best, streakLast: state.streak.last,
        apiKey: state.apiKey || ''
      }});
      await execOp({ type: 'upsert_skills', data: Object.entries(state.skills || {}).map(([id, v]) => ({
        id, xp: v.xp, streakCount: (state.skillStreak || {})[id]?.count || 0,
        streakLast: (state.skillStreak || {})[id]?.last || null
      }))});
      await execOp({ type: 'upsert_tasks', data: state.tasks });
      await execOp({ type: 'upsert_days', data: state.days });
      await execOp({ type: 'upsert_funnel', data: state.funnel });
      await execOp({ type: 'upsert_projects', data: state.projects });
      await execOp({ type: 'upsert_quests', data: { date: state.quests.date, list: state.quests.list }});
      setSyncStatus('synced');
    } catch (e) {
      console.warn('CloudDB sync error:', e);
      setSyncStatus('error');
    }
  }

  // ── Load from Cloud ───────────────────────────────────────
  async function loadFromCloud() {
    if (!client || !user) return null;
    const uid = user.id;
    try {
      const [profileRes, settingsRes, skillsRes, tasksRes, daysRes,
             funnelRes, projectsRes, questsRes] = await Promise.all([
        client.from('profiles').select('*').eq('id', uid).maybeSingle(),
        client.from('user_settings').select('*').eq('user_id', uid).maybeSingle(),
        client.from('skill_data').select('*').eq('user_id', uid),
        client.from('tasks').select('*').eq('user_id', uid),
        client.from('days').select('*').eq('user_id', uid),
        client.from('funnel').select('*').eq('user_id', uid).maybeSingle(),
        client.from('projects').select('*').eq('user_id', uid),
        client.from('daily_quests').select('*').eq('user_id', uid).order('date', { ascending: false }).limit(1),
      ]);

      if (tasksRes.error) throw tasksRes.error;

      const skillMap = {};
      (skillsRes.data || []).forEach(s => {
        skillMap[s.skill_id] = { xp: s.xp };
      });

      const skillStreakMap = {};
      (skillsRes.data || []).forEach(s => {
        skillStreakMap[s.skill_id] = { count: s.streak_count, last: s.streak_last };
      });

      const daysMap = {};
      (daysRes.data || []).forEach(d => { daysMap[d.date] = d.completions; });

      const questsData = questsRes.data && questsRes.data[0];
      const tasks = (tasksRes.data || []).map(t => ({
        id: t.id, title: t.title, skill: t.skill, difficulty: t.difficulty,
        notes: t.notes || '', funnel: t.funnel || '', status: t.status,
        createdAt: t.created_at, due: t.due, completedAt: t.completed_at || undefined,
        repeat: t.repeat || 'none', repeatDays: t.repeat_days || [],
        parentId: t.parent_id || ''
      }));

      const funnel = funnelRes.data ? {
        applications: funnelRes.data.applications,
        responses: funnelRes.data.responses,
        interviews: funnelRes.data.interviews,
        offers: funnelRes.data.offers
      } : { applications: 0, responses: 0, interviews: 0, offers: 0 };

      const defaultSkills = Object.fromEntries(SKILLS.map(s=>[s.id,{xp:0}]));
      const defaultStreak = Object.fromEntries(SKILLS.map(s=>[s.id,{count:0,last:null}]));

      return {
        name: profileRes.data?.name || 'Adventurer',
        title: profileRes.data?.title || 'Newcomer',
        createdAt: profileRes.data?.created_at || new Date().toISOString().slice(0, 10),
        totalXP: settingsRes.data?.total_xp || 0,
        apiKey: settingsRes.data?.api_key || '',
        skills: Object.keys(skillMap).length ? skillMap : defaultSkills,
        skillStreak: Object.keys(skillStreakMap).length ? skillStreakMap : defaultStreak,
        tasks,
        days: Object.keys(daysMap).length ? daysMap : {},
        streak: {
          current: settingsRes.data?.streak_current || 0,
          best: settingsRes.data?.streak_best || 0,
          last: settingsRes.data?.streak_last || null
        },
        funnel,
        projects: (projectsRes.data || []).map(p => ({
          id: p.id, name: p.name, stage: p.stage
        })),
        quests: questsData ? {
          date: questsData.date,
          list: Array.isArray(questsData.quests) ? questsData.quests : []
        } : { date: null, list: [] },
      };
    } catch (e) {
      console.warn('CloudDB load error:', e);
      return null;
    }
  }

  // ── Migration ─────────────────────────────────────────────
  function hasLocalData() {
    try {
      const raw = localStorage.getItem('questlog');
      if (!raw) return false;
      const data = JSON.parse(raw);
      return data && data.skills && data.tasks &&
             (data.totalXP > 0 || data.tasks.length > 0);
    } catch { return false; }
  }

  function getLocalData() {
    try {
      const raw = localStorage.getItem('questlog');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  async function migrateLocalToCloud() {
    const local = getLocalData();
    if (!local) return false;
    if (!client || !user) return false;

    try {
      const uid = user.id;
      const blank = {
        name: 'Adventurer', createdAt: new Date().toISOString().slice(0, 10),
        totalXP: 0, skills: {}, skillStreak: {}, tasks: [], days: {},
        streak: { current: 0, best: 0, last: null },
        funnel: { applications: 0, responses: 0, interviews: 0, offers: 0 },
        projects: [], quests: { date: null, list: [] }, title: 'Newcomer',
        apiKey: ''
      };
      const d = Object.assign(blank, local);

      await execOp({ type: 'upsert_profile', data: { name: d.name, title: d.title } });
      await execOp({ type: 'upsert_settings', data: {
        totalXP: d.totalXP, streakCurrent: d.streak.current,
        streakBest: d.streak.best, streakLast: d.streak.last,
        apiKey: d.apiKey || ''
      }});
      await execOp({ type: 'upsert_skills', data: Object.entries(d.skills).map(([id, v]) => ({
        id, xp: v.xp, streakCount: d.skillStreak[id]?.count || 0,
        streakLast: d.skillStreak[id]?.last || null
      }))});
      await execOp({ type: 'upsert_tasks', data: d.tasks });
      await execOp({ type: 'upsert_days', data: d.days });
      await execOp({ type: 'upsert_funnel', data: d.funnel });
      await execOp({ type: 'upsert_projects', data: d.projects });
      if (d.quests.date) {
        await execOp({ type: 'upsert_quests', data: { date: d.quests.date, list: d.quests.list }});
      }
      return true;
    } catch (e) {
      console.warn('Migration error:', e);
      return false;
    }
  }

  // ── Online/Offline ────────────────────────────────────────
  function setupOfflineHandling() {
    window.addEventListener('online', () => {
      setSyncStatus('syncing');
      flushQueue();
    });
    window.addEventListener('offline', () => {
      setSyncStatus('offline');
    });
    if (!navigator.onLine) setSyncStatus('offline');
  }

  // ── Public API ────────────────────────────────────────────
  return {
    init, signInMagic, signInPassword, signUp, signOut, getUser, isConfigured, getSession,
    loadFromCloud, scheduleSync, syncNow,
    hasLocalData, getLocalData, migrateLocalToCloud,
    setSyncStatus, getSyncStatus, setSyncCallback,
    setupOfflineHandling, enqueue, flushQueue, execOp
  };
})();
