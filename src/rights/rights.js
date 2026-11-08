// Data-rights request wizard: letter generation and in-memory deadline tracking.
// No network, no cookies, no localStorage/sessionStorage/IndexedDB. Closing the
// tab deletes every record; users can export a JSON file themselves.

import {
  JURISDICTIONS,
  getJurisdiction,
  isUsable
} from './rights/jurisdictions.js';
import {
  buildMailto,
  renderComplaintDraft,
  renderReminderLetter,
  renderRequestLetter
} from './rights/templates.js';
import { computeDeadlines, isValidIsoDate } from './rights/deadlines.js';

const $ = (id) => document.getElementById(id);
const RIGHT_LABELS = {
  erasure: 'Delete my personal data',
  access: 'Access my personal data',
  rectification: 'Correct my personal data',
  object: 'Object to processing'
};
const DRAFT_NOTICE =
  'DRAFT: the rules for this jurisdiction have not been verified against the official text. Do not treat the deadline as a legal deadline.';
const IDENTITY_FIELDS = ['fullName', 'email', 'city', 'state'];

const state = {
  draft: null,
  records: []
};

function localIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function plural(days) {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

function setError(message) {
  const box = $('rights-error');
  box.textContent = message || '';
  box.hidden = !message;
  if (message) box.focus();
}

function setStatus(id, message) {
  $(id).textContent = message;
}

function selectedWho() {
  return document.querySelector('input[name="rights-who"]:checked').value;
}

function identityFields() {
  const fields = [];
  for (const box of document.querySelectorAll('[data-identity]')) {
    if (!box.checked) continue;
    const field = box.dataset.identity;
    const input = document.querySelector(`[data-identity-value="${field}"]`);
    if (!input || !input.value.trim()) {
      throw new Error(`Enter a value for ${box.parentElement.textContent.trim()} or untick it.`);
    }
    fields.push(field);
  }
  return fields;
}

function profileFromFields(fields) {
  const profile = {};
  for (const field of fields) {
    const input = document.querySelector(`[data-identity-value="${field}"]`);
    profile[field] = input.value.trim();
  }
  return profile;
}

function populateJurisdictions() {
  const select = $('rights-jurisdiction');
  for (const record of JURISDICTIONS) {
    const option = document.createElement('option');
    option.value = record.id;
    option.textContent = isUsable(record)
      ? `Verified: ${record.name}`
      : `Draft, rules not verified: ${record.name}`;
    select.append(option);
  }
  select.value = 'eu-gdpr';
}

function refreshDraftNote() {
  const record = getJurisdiction($('rights-jurisdiction').value);
  $('rights-draft-note').hidden = !record || isUsable(record);
}

function currentJurisdiction() {
  const record = getJurisdiction($('rights-jurisdiction').value);
  if (!record) throw new Error('Choose a jurisdiction.');
  return record;
}

function generateLetter() {
  setError('');
  try {
    const company = $('rights-company').value.trim();
    if (!company) throw new Error('Enter the company name.');
    const email = $('rights-email').value.trim();
    if (!email) throw new Error('Enter the company privacy email.');
    const right = $('rights-right').value;
    const record = currentJurisdiction();
    if (!record.rights.includes(right)) {
      throw new Error('That right is not part of this jurisdiction record. Choose another right or jurisdiction.');
    }
    const verified = isUsable(record);
    if (selectedWho() === 'other' && !$('rights-auth').checked) {
      throw new Error('Confirm that you have authorization to act for this person.');
    }
    const fields = identityFields();
    const profile = profileFromFields(fields);
    const letter = renderRequestLetter({
      jurisdiction: record,
      right,
      company,
      profile,
      fields,
      allowUnverified: !verified
    });
    let body = letter.body;
    if (!verified) body = `${DRAFT_NOTICE}\n\n${body}`;
    if (selectedWho() === 'other') {
      body = body.replace(
        '\n\n',
        '\n\nI am making this request on behalf of the person named above and confirm that I have their authorization.\n\n'
      );
    }
    state.draft = { company, email, right, jurisdictionId: record.id, subject: letter.subject, body, profile, fields };
    $('rights-letter').textContent = body;
    const mail = buildMailto({ to: email, subject: letter.subject, body });
    const link = $('rights-mailto');
    if (mail.mode === 'mailto') {
      link.href = mail.url;
      link.removeAttribute('aria-disabled');
      link.textContent = 'Send with my email';
    } else {
      link.href = '#';
      link.setAttribute('aria-disabled', 'true');
      link.textContent = 'Letter too long for an email link: copy it instead';
    }
    $('rights-letter-section').hidden = false;
    setStatus('rights-copy-status', 'Letter generated in this tab. Nothing was sent or uploaded.');
    $('rights-letter-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('rights-letter').focus({ preventScroll: true });
  } catch (error) {
    setError(error.message || 'Could not generate the letter.');
  }
}

async function copyLetter() {
  setStatus('rights-copy-status', '');
  try {
    await navigator.clipboard.writeText($('rights-letter').textContent);
    setStatus('rights-copy-status', 'Copied. Paste it into your email app.');
  } catch {
    setStatus('rights-copy-status', 'Copy failed. Select the letter text and copy it manually.');
  }
}

function deadlineFor(record, sentDate) {
  return computeDeadlines({
    sentDate,
    responseDays: record.responseDays,
    dayType: record.dayType,
    extendableDays: record.extendableDays
  });
}

function makeRecord() {
  if (!state.draft) throw new Error('Generate the letter first.');
  const sentDate = $('rights-sent-date').value;
  if (!isValidIsoDate(sentDate)) throw new Error('Enter a valid date for when you sent the request.');
  const jurisdiction = getJurisdiction(state.draft.jurisdictionId);
  if (!jurisdiction) throw new Error('The jurisdiction for this draft is missing. Generate the letter again.');
  const deadlines = deadlineFor(jurisdiction, sentDate);
  return {
    id: `local-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    company: state.draft.company,
    email: state.draft.email,
    right: state.draft.right,
    jurisdictionId: jurisdiction.id,
    jurisdictionName: jurisdiction.name,
    verified: isUsable(jurisdiction),
    subject: state.draft.subject,
    body: state.draft.body,
    profile: state.draft.profile || {},
    fields: state.draft.fields || [],
    sentDate,
    dueDate: deadlines.dueDate,
    extendedDueDate: deadlines.extendedDueDate,
    reminderDate: deadlines.reminderDate,
    followUpDate: null,
    createdAt: localIso()
  };
}

function addButton(parent, label, handler) {
  const button = document.createElement('button');
  button.className = 'button button--secondary';
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', handler);
  parent.append(button);
  return button;
}

function recordDeadlineText(record, today) {
  if (today <= record.dueDate) {
    const left = daysBetween(today, record.dueDate);
    return `Due ${record.dueDate}: ${plural(left)} left. Reminder date ${record.reminderDate}.`;
  }
  if (record.extendedDueDate && today <= record.extendedDueDate) {
    return `First deadline passed on ${record.dueDate}. Possible extension to ${record.extendedDueDate}. You can send a follow-up now.`;
  }
  const latest = record.extendedDueDate || record.dueDate;
  return `Deadline passed on ${latest}. You can send a follow-up or prepare a regulator complaint draft.`;
}

function renderRecords() {
  const list = $('rights-list');
  list.textContent = '';
  const today = $('rights-today').value;
  for (const record of state.records) {
    const item = document.createElement('li');
    item.className = 'rights-record';

    const title = document.createElement('h3');
    title.textContent = `${record.company} - ${RIGHT_LABELS[record.right] || record.right}`;
    item.append(title);

    const meta = document.createElement('p');
    meta.className = 'rights-help';
    meta.textContent = `${record.jurisdictionName} (${record.verified ? 'Verified' : 'Draft, rules not verified'}). Sent ${record.sentDate}.`;
    item.append(meta);

    const deadline = document.createElement('p');
    deadline.className = 'rights-deadline';
    deadline.textContent = recordDeadlineText(record, today);
    item.append(deadline);

    const actions = document.createElement('div');
    actions.className = 'rights-actions';
    const jurisdiction = getJurisdiction(record.jurisdictionId);
    if (jurisdiction) {
      const passedFirst = today > record.dueDate;
      const passedExtended = record.extendedDueDate ? today > record.extendedDueDate : false;
      if (passedFirst) {
        addButton(actions, 'Generate follow-up letter', () => generateFollowUp(record));
      }
      if (passedExtended) {
        addButton(actions, 'Generate regulator complaint draft', () => generateComplaint(record));
      }
      const regulator = document.createElement('a');
      regulator.className = 'rights-regulator';
      regulator.href = jurisdiction.regulator.complaintUrl;
      regulator.rel = 'noopener';
      regulator.target = '_blank';
      regulator.textContent = `Regulator: ${jurisdiction.regulator.name}`;
      actions.append(regulator);
    }
    item.append(actions);
    list.append(item);
  }
  if (state.records.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'rights-help';
    empty.textContent = 'No requests recorded in this tab yet.';
    list.append(empty);
  }
}

function showGenerated(subject, body, status) {
  state.draft = { ...state.draft, subject, body };
  $('rights-letter').textContent = body;
  $('rights-letter-section').hidden = false;
  setStatus('rights-copy-status', status);
  $('rights-letter').focus({ preventScroll: true });
}

function generateFollowUp(record) {
  setError('');
  try {
    const jurisdiction = getJurisdiction(record.jurisdictionId);
    if (!jurisdiction) throw new Error('Jurisdiction data is missing for this record.');
    const letter = renderReminderLetter({
      jurisdiction,
      right: record.right,
      company: record.company,
      profile: record.profile || {},
      fields: record.fields || [],
      sentDate: record.sentDate,
      dueDate: record.extendedDueDate || record.dueDate,
      allowUnverified: !isUsable(jurisdiction)
    });
    record.followUpDate = $('rights-today').value;
    const body = isUsable(jurisdiction) ? letter.body : `${DRAFT_NOTICE}\n\n${letter.body}`;
    showGenerated(letter.subject, body, 'Follow-up draft generated. Send it from your own email account.');
    renderRecords();
  } catch (error) {
    setError(error.message || 'Could not generate the follow-up.');
  }
}

function generateComplaint(record) {
  setError('');
  try {
    const jurisdiction = getJurisdiction(record.jurisdictionId);
    if (!jurisdiction) throw new Error('Jurisdiction data is missing for this record.');
    const letter = renderComplaintDraft({
      jurisdiction,
      right: record.right,
      company: record.company,
      profile: record.profile || {},
      fields: record.fields || [],
      sentDate: record.sentDate,
      dueDate: record.extendedDueDate || record.dueDate,
      timeline: [
        { type: 'sent', at: record.sentDate },
        { type: 'overdue', at: record.extendedDueDate || record.dueDate, note: 'No response recorded' }
      ],
      allowUnverified: !isUsable(jurisdiction)
    });
    const body = isUsable(jurisdiction) ? letter.body : `${DRAFT_NOTICE}\n\n${letter.body}`;
    showGenerated(letter.subject, body, 'Complaint draft generated. Check the regulator page and the facts before submitting.');
  } catch (error) {
    setError(error.message || 'Could not generate the complaint draft.');
  }
}

function exportRecords() {
  setError('');
  if (state.records.length === 0) {
    setError('There are no records to export yet.');
    return;
  }
  const payload = {
    format: 'secureinchat-rights-records',
    version: 1,
    exportedAt: localIso(),
    warning: 'This file is not encrypted. Store it somewhere safe.',
    records: state.records
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `data-rights-records-${localIso()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  setStatus('rights-track-status', 'Exported. The file is not encrypted.');
}

function sanitizeImported(value) {
  if (!value || typeof value !== 'object') return null;
  if (!getJurisdiction(value.jurisdictionId)) return null;
  if (!isValidIsoDate(value.sentDate) || !isValidIsoDate(value.dueDate)) return null;
  if (typeof value.company !== 'string' || !value.company.trim()) return null;
  const fields = Array.isArray(value.fields)
    ? value.fields.filter((field) => IDENTITY_FIELDS.includes(field))
    : [];
  const profile = {};
  for (const field of fields) {
    if (value.profile && typeof value.profile[field] === 'string') {
      profile[field] = value.profile[field].slice(0, 300);
    }
  }
  return {
    id: typeof value.id === 'string' ? value.id : `local-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    company: value.company.trim().slice(0, 200),
    email: typeof value.email === 'string' ? value.email.slice(0, 320) : '',
    right: typeof value.right === 'string' ? value.right : 'erasure',
    jurisdictionId: value.jurisdictionId,
    jurisdictionName: getJurisdiction(value.jurisdictionId).name,
    verified: isUsable(getJurisdiction(value.jurisdictionId)),
    profile,
    fields,
    subject: typeof value.subject === 'string' ? value.subject : '',
    body: typeof value.body === 'string' ? value.body : '',
    sentDate: value.sentDate,
    dueDate: value.dueDate,
    extendedDueDate: isValidIsoDate(value.extendedDueDate) ? value.extendedDueDate : null,
    reminderDate: isValidIsoDate(value.reminderDate) ? value.reminderDate : value.dueDate,
    followUpDate: isValidIsoDate(value.followUpDate) ? value.followUpDate : null,
    createdAt: isValidIsoDate(value.createdAt) ? value.createdAt : localIso()
  };
}

function importRecords(file) {
  setError('');
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const incoming = Array.isArray(parsed) ? parsed : parsed.records;
      if (!Array.isArray(incoming)) throw new Error('The file does not contain a records array.');
      const clean = incoming.map(sanitizeImported).filter(Boolean);
      if (clean.length === 0) throw new Error('No valid records were found in that file.');
      const byId = new Map(state.records.map((record) => [record.id, record]));
      for (const record of clean) byId.set(record.id, record);
      state.records = [...byId.values()];
      renderRecords();
      setStatus('rights-track-status', `Imported ${clean.length} record(s) into this tab's memory.`);
    } catch (error) {
      setError(error.message || 'Could not import that file.');
    }
  };
  reader.onerror = () => setError('Could not read that file.');
  reader.readAsText(file);
}

function clearEverything() {
  state.draft = null;
  state.records = [];
  for (const id of ['rights-company', 'rights-email', 'rights-fullname', 'rights-identity-email', 'rights-city', 'rights-state']) {
    $(id).value = '';
  }
  for (const box of document.querySelectorAll('[data-identity], #rights-auth')) box.checked = false;
  $('rights-for-self').checked = true;
  $('rights-auth-wrap').hidden = true;
  $('rights-right').value = 'erasure';
  $('rights-jurisdiction').value = 'eu-gdpr';
  refreshDraftNote();
  $('rights-sent-date').value = localIso();
  $('rights-today').value = localIso();
  $('rights-letter').textContent = '';
  $('rights-letter-section').hidden = true;
  $('rights-mailto').href = 'mailto:';
  $('rights-import').value = '';
  setError('');
  setStatus('rights-copy-status', '');
  setStatus('rights-track-status', 'Cleared from this tab.');
  renderRecords();
  $('rights-company').focus();
}

function init() {
  populateJurisdictions();
  $('rights-sent-date').value = localIso();
  $('rights-today').value = localIso();
  refreshDraftNote();
  renderRecords();

  $('rights-jurisdiction').addEventListener('change', refreshDraftNote);
  $('rights-for-other').addEventListener('change', () => {
    $('rights-auth-wrap').hidden = false;
  });
  $('rights-for-self').addEventListener('change', () => {
    $('rights-auth-wrap').hidden = true;
    $('rights-auth').checked = false;
  });
  $('rights-generate').addEventListener('click', generateLetter);
  $('rights-copy').addEventListener('click', copyLetter);
  $('rights-mark-sent').addEventListener('click', () => {
    setError('');
    try {
      const record = makeRecord();
      state.records = [...state.records, record];
      renderRecords();
      setStatus('rights-track-status', `Recorded. Deadline ${record.dueDate}.`);
    } catch (error) {
      setError(error.message || 'Could not record the request.');
    }
  });
  $('rights-today').addEventListener('change', renderRecords);
  $('rights-export').addEventListener('click', exportRecords);
  $('rights-import').addEventListener('change', (event) => {
    importRecords(event.target.files && event.target.files[0]);
    event.target.value = '';
  });
  $('rights-clear').addEventListener('click', clearEverything);
}

init();
