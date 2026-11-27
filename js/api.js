// Data layer: every call to Supabase (Auth, PostgreSQL, Storage) lives here.
(function (root) {
  var cfg = root.APP_CONFIG || {};
  var BUCKET = 'complaint-photos';
  // Read the password-recovery link state BEFORE the Supabase client clears the URL hash.
  var hash = root.location.hash || '';
  var recovery = /type=recovery/.test(hash);
  var linkError = /error_code=|error=access_denied/.test(hash) ? 'This link is invalid or has expired. Request a new reset link.' : '';
  var ready = !!(root.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && String(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY).indexOf('YOUR-') < 0);
  var sb = ready ? root.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  function ok(r) { if (r.error) throw new Error(r.error.message); return r.data; }

  root.Api = {
    configured: ready, recovery: recovery, linkError: linkError,
    session: async function () { return ok(await sb.auth.getSession()).session; },
    signIn: async function (email, password) { return ok(await sb.auth.signInWithPassword({ email: email, password: password })); },
    signUp: async function (name, email, password) {
      return ok(await sb.auth.signUp({ email: email, password: password, options: { data: { full_name: name } } }));
    },
    signOut: async function () { await sb.auth.signOut(); },
    resetPassword: async function (email) { return ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: root.location.origin + root.location.pathname })); },
    updatePassword: async function (password) { return ok(await sb.auth.updateUser({ password: password })); },
    profile: async function (uid) { return ok(await sb.from('profiles').select('*').eq('user_id', uid).single()); },
    profiles: async function () { return ok(await sb.from('profiles').select('*').order('full_name', { ascending: true })); },
    updateProfile: async function (uid, patch) { ok(await sb.from('profiles').update(patch).eq('user_id', uid)); },
    categories: async function () { return ok(await sb.from('categories').select('*').order('name', { ascending: true })); },
    addCategory: async function (name, description) { ok(await sb.from('categories').insert({ name: name, description: description || null })); },
    updateCategory: async function (id, patch) { ok(await sb.from('categories').update(patch).eq('category_id', id)); },
    complaints: async function () { return ok(await sb.from('complaints').select('*').order('created_at', { ascending: false })); },
    createComplaint: async function (row) { return ok(await sb.from('complaints').insert(row).select().single()); },
    updateComplaint: async function (id, patch) { ok(await sb.from('complaints').update(patch).eq('complaint_id', id)); },
    deleteComplaint: async function (id) { ok(await sb.from('complaints').delete().eq('complaint_id', id)); },
    history: async function () { return ok(await sb.from('complaint_status_history').select('*').order('changed_at', { ascending: true })); },
    attachments: async function () { return ok(await sb.from('complaint_attachments').select('*')); },
    uploadPhoto: async function (uid, complaintId, file) {
      var type = file.type === 'image/png' ? 'png' : 'jpg';
      var path = uid + '/' + Date.now() + '-' + file.name.replace(/[^\w.\-]/g, '_');
      ok(await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type }));
      ok(await sb.from('complaint_attachments').insert({ complaint_id: complaintId, file_name: file.name, file_path: path, file_type: type, file_size_kb: Math.max(1, Math.ceil(file.size / 1024)) }));
    },
    photoUrl: async function (path) { return ok(await sb.storage.from(BUCKET).createSignedUrl(path, 3600)).signedUrl; }
  };
})(window);
