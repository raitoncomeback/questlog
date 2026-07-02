const DB_KEY = 'questlog_v1';
let _saveTimer = null;

function dbLoad() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.reflections) data.reflections = [];
    return data;
  } catch(e) { return null; }
}

function dbSave(state) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try { localStorage.setItem(DB_KEY, JSON.stringify(state)); } catch(e) {}
  }, 300);
}

function dbExport(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'questlog-backup-' + state.createdAt + '.json';
  a.click();
}

function dbImport(file, callback) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!data || !data.skills || !data.tasks) { callback(null, 'Invalid backup file'); return; }
      if (!data.reflections) data.reflections = [];
      callback(data, null);
    } catch(e) { callback(null, 'Could not read file'); }
  };
  r.readAsText(file);
}

function dbReset() {
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem('questlog_named');
}
