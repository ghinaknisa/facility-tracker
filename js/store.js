// Core logic (no DOM) so it can be unit-tested by CI.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Store = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // PROTOTYPE ONLY: hard-coded demo accounts. Replaced by a real backend/DB later.
  const USERS = [
    { id: 1, name: 'Rina Reporter', email: 'reporter@campus.test', password: 'reporter123', role: 'reporter' },
    { id: 2, name: 'Adi Admin', email: 'admin@campus.test', password: 'admin123', role: 'admin' },
  ];
  const CATEGORIES = ['Electrical', 'Plumbing', 'Air Conditioning', 'Furniture', 'Cleanliness', 'Other'];

  // US-01 Log in
  function login(email, password) {
    const e = String(email || '').trim().toLowerCase();
    const u = USERS.find((x) => x.email === e && x.password === password);
    if (!u) return { ok: false, error: 'Invalid email or password.' };
    return { ok: true, user: { id: u.id, name: u.name, email: u.email, role: u.role } };
  }

  // US-02 Complaint form validation
  function validateComplaint(d) {
    const errors = {};
    if (!d || !CATEGORIES.includes(d.category)) errors.category = 'Please select a category.';
    if (!d || !String(d.location || '').trim()) errors.location = 'Location is required.';
    if (!d || String(d.description || '').trim().length < 10) errors.description = 'Describe the problem (min. 10 characters).';
    return errors;
  }

  // US-02 Save complaint with status "New"
  function createComplaint(list, user, d, now) {
    const errors = validateComplaint(d);
    if (Object.keys(errors).length) return { ok: false, errors };
    const complaint = {
      id: 'FC-' + String(list.length + 1).padStart(3, '0'),
      reporterId: user.id,
      category: d.category,
      location: String(d.location).trim(),
      description: String(d.description).trim(),
      status: 'New',
      createdAt: (now || new Date()).toISOString(),
    };
    return { ok: true, complaint, list: list.concat(complaint) };
  }

  const STATUSES = ['New', 'In Progress', 'Resolved'];
  const withTitle = (c) => Object.assign({}, c, { title: c.category + ' - ' + c.location });
  const newest = (a, b) => b.createdAt.localeCompare(a.createdAt);

  // US-03 Only the reporter's own complaints, newest first, with a display title
  function complaintsFor(list, user) {
    return list.filter((c) => c.reporterId === user.id).map(withTitle).sort(newest);
  }

  // Admin sees every complaint (read-only view); reporters only their own
  function visibleComplaints(list, user) {
    return user.role === 'admin' ? list.map(withTitle).sort(newest) : complaintsFor(list, user);
  }

  // Counts used by Dashboard and Reports
  function summarize(list) {
    const byStatus = {}, byCategory = {};
    STATUSES.forEach((s) => (byStatus[s] = 0));
    CATEGORIES.forEach((c) => (byCategory[c] = 0));
    list.forEach((c) => {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    });
    const total = list.length;
    return { total, byStatus, byCategory, unresolved: total - byStatus.Resolved,
      resolutionRate: total ? Math.round((byStatus.Resolved / total) * 100) : 0 };
  }

  return { USERS, CATEGORIES, STATUSES, login, validateComplaint, createComplaint, complaintsFor, visibleComplaints, summarize };
});
