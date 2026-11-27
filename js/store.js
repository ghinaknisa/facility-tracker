// Pure logic (no DOM, no network) so CI can unit-test it.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Store = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const STATUSES = ['New', 'In Progress', 'Resolved'];
  const PRIORITIES = ['Low', 'Medium', 'High'];
  const ROLES = ['reporter', 'technician', 'admin'];

  function validateComplaint(d) {
    const e = {};
    if (!d || !d.category_id) e.category = 'Please select a category.';
    if (!d || !String(d.location || '').trim()) e.location = 'Location is required.';
    if (!d || String(d.description || '').trim().length < 10) e.description = 'Describe the problem (min. 10 characters).';
    return e;
  }
  function validateSignup(d) {
    const e = {};
    if (!String((d && d.full_name) || '').trim()) e.full_name = 'Full name is required.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String((d && d.email) || '').trim())) e.email = 'Enter a valid email.';
    if (String((d && d.password) || '').length < 6) e.password = 'Password must be at least 6 characters.';
    return e;
  }
  function validateEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim()); }
  function validateNewPassword(pw, confirm) {
    const e = {};
    if (String(pw || '').length < 6) e.password = 'Password must be at least 6 characters.';
    if (pw !== confirm) e.confirm = 'Passwords do not match.';
    return e;
  }
  function validatePhoto(f) {
    if (!f) return { ok: true };
    if (['image/jpeg', 'image/png'].indexOf(f.type) < 0) return { ok: false, error: 'Photo must be JPG or PNG.' };
    if (f.size > 2 * 1024 * 1024) return { ok: false, error: 'Photo must be 2 MB or smaller.' };
    return { ok: true };
  }
  // Which statuses a role may pick from the current one (the database enforces the same rule).
  function allowedStatuses(role, current) {
    if (role === 'admin') return STATUSES.slice();
    if (role === 'technician') {
      if (current === 'New') return ['New', 'In Progress'];
      if (current === 'In Progress') return ['In Progress', 'Resolved'];
      return ['Resolved'];
    }
    return [current];
  }
  function canEditOwn(c, uid) { return !!c && c.reporter_id === uid && c.status === 'New'; }
  function filterComplaints(list, f) {
    f = f || {};
    return list.filter((c) =>
      (!f.status || c.status === f.status) &&
      (!f.priority || (f.priority === 'none' ? !c.priority : c.priority === f.priority)) &&
      (!f.category || String(c.category_id) === String(f.category)));
  }
  function summarize(list) {
    const byStatus = {}, byPriority = { Low: 0, Medium: 0, High: 0, 'Not set': 0 }, byCategory = {};
    STATUSES.forEach((s) => (byStatus[s] = 0));
    list.forEach((c) => {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      byPriority[c.priority || 'Not set'] += 1;
      const k = c.catName || 'Other';
      byCategory[k] = (byCategory[k] || 0) + 1;
    });
    const total = list.length;
    return { total, byStatus, byPriority, byCategory, unresolved: total - byStatus.Resolved,
      resolutionRate: total ? Math.round((byStatus.Resolved / total) * 100) : 0 };
  }
  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return { STATUSES, PRIORITIES, ROLES, validateComplaint, validateSignup, validateEmail, validateNewPassword, validatePhoto, allowedStatuses, canEditOwn, filterComplaints, summarize, fmtDate };
});
