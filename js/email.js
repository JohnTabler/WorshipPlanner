const emailServiceSelect = document.getElementById('email-service-select');
const emailPreview = document.getElementById('email-preview');
const emailCopyBtn = document.getElementById('email-copy-btn');
const emailCopyStatus = document.getElementById('email-copy-status');
const emailRecipientsSection = document.getElementById('email-recipients-section');
const emailRecipientsOutput = document.getElementById('email-recipients-output');
const emailRecipientsCopyBtn = document.getElementById('email-recipients-copy-btn');
const emailRecipientsCopyStatus = document.getElementById('email-recipients-copy-status');
const emailIntroSection = document.getElementById('email-intro-section');
const emailIntroInput = document.getElementById('email-intro-input');
const emailIntroConfirmBtn = document.getElementById('email-intro-confirm-btn');
const emailIntroStatus = document.getElementById('email-intro-status');

let currentEmailHtml = '';
let currentEmailPlain = '';
let emailServiceId = null;
let emailService = null;
let emailSongRows = [];
let emailAssignmentRows = [];

function populateEmailServiceDropdown() {
  const previousValue = emailServiceSelect.value;
  emailServiceSelect.innerHTML = '<option value="">Select a service</option>' +
    allServices.map((s) => `<option value="${s.id}">${s.service_date}${s.title ? ' - ' + s.title : ''}</option>`).join('');
  emailServiceSelect.value = previousValue;
}

function introStorageKey(serviceId) {
  return `email_intro_${serviceId}`;
}

function loadIntro(serviceId) {
  return localStorage.getItem(introStorageKey(serviceId)) || '';
}

function saveIntro(serviceId, text) {
  localStorage.setItem(introStorageKey(serviceId), text);
}

function refreshPreview() {
  if (!emailService) return;
  const intro = emailIntroInput.value.trim();
  currentEmailHtml = buildEmailHtml(emailService, emailSongRows, emailAssignmentRows, intro);
  currentEmailPlain = buildEmailPlain(emailService, emailSongRows, emailAssignmentRows, intro);
  emailPreview.innerHTML = currentEmailHtml;
}

emailServiceSelect.addEventListener('change', async () => {
  const serviceId = emailServiceSelect.value;
  emailCopyStatus.textContent = '';
  emailRecipientsCopyStatus.textContent = '';
  emailIntroStatus.textContent = '';

  if (!serviceId) {
    emailPreview.innerHTML = '';
    currentEmailHtml = '';
    currentEmailPlain = '';
    emailServiceId = null;
    emailService = null;
    emailSongRows = [];
    emailAssignmentRows = [];
    emailRecipientsSection.classList.add('hidden');
    emailIntroSection.classList.add('hidden');
    emailRecipientsOutput.value = '';
    emailIntroInput.value = '';
    return;
  }

  emailServiceId = serviceId;
  emailService = allServices.find((s) => s.id === serviceId);

  const [{ data: songRows, error: songError }, { data: assignmentRows, error: assignError }] = await Promise.all([
    supabaseClient
      .from('service_songs')
      .select('*, songs(title, bpm), song_keys(song_key, youtube_link, chord_chart_link, capo_number, capo_chord_chart_link)')
      .eq('service_id', serviceId)
      .order('position', { ascending: true }),
    supabaseClient
      .from('assignments')
      .select('*, musicians(name, email)')
      .eq('service_id', serviceId),
  ]);

  if (songError || assignError) {
    emailPreview.innerHTML = '<p style="color:red;padding:1rem;">Error loading data for this service.</p>';
    return;
  }

  emailSongRows = songRows;
  emailAssignmentRows = assignmentRows;

  // Load saved intro for this service
  const savedIntro = loadIntro(serviceId);
  emailIntroInput.value = savedIntro;
  emailIntroSection.classList.remove('hidden');

  refreshPreview();

  const recipients = buildRecipients(assignmentRows);
  if (recipients) {
    emailRecipientsOutput.value = recipients;
    emailRecipientsSection.classList.remove('hidden');
  } else {
    emailRecipientsSection.classList.add('hidden');
    emailRecipientsOutput.value = '';
  }
});

emailIntroConfirmBtn.addEventListener('click', () => {
  if (!emailServiceId) return;
  saveIntro(emailServiceId, emailIntroInput.value.trim());
  refreshPreview();
  emailIntroStatus.textContent = 'Saved!';
  setTimeout(() => { emailIntroStatus.textContent = ''; }, 3000);
});

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml(service, songRows, assignmentRows, intro) {
  const date = escHtml(service.service_date);
  const title = service.title ? escHtml(service.title) : '';

  // Intro block
  const introHtml = intro
    ? `<div style="background:#fff;border:1px solid #E5DDD4;border-radius:6px;padding:16px 18px;margin-bottom:24px;font-family:Arial,sans-serif;font-size:14px;color:#1A130E;line-height:1.7;">${escHtml(intro).replace(/\n/g, '<br>')}</div>`
    : '';

  // Team rows
  let teamHtml;
  if (!assignmentRows.length) {
    teamHtml = `<tr><td colspan="2" style="padding:10px 14px;background:#fff;border:1px solid #E5DDD4;font-family:Arial,sans-serif;font-size:13px;color:#9A8B82;font-style:italic;">No assignments yet</td></tr>`;
  } else {
    teamHtml = assignmentRows.map((a) => {
      const inst = escHtml(a.instrument || '');
      const name = a.musicians ? escHtml(a.musicians.name) : 'Unassigned';
      return `<tr>
        <td style="padding:9px 14px;background:#fff;border:1px solid #E5DDD4;width:42%;font-family:Arial,sans-serif;font-size:13px;color:#5A4D44;font-weight:600;">${inst}</td>
        <td style="padding:9px 14px;background:#fff;border:1px solid #E5DDD4;font-family:Arial,sans-serif;font-size:13px;color:#1A130E;">${name}</td>
      </tr>`;
    }).join('');
  }

  // Song cards
  let songsHtml;
  if (!songRows.length) {
    songsHtml = `<div style="padding:10px 14px;background:#fff;border:1px solid #E5DDD4;border-radius:6px;font-family:Arial,sans-serif;font-size:13px;color:#9A8B82;font-style:italic;">No songs yet</div>`;
  } else {
    songsHtml = songRows.map((row, i) => {
      const song = row.songs || {};
      const keyInfo = row.song_keys || {};
      const songTitle = escHtml(song.title || 'Untitled');

      const metaParts = [];
      if (keyInfo.song_key) {
        metaParts.push(`Key: ${escHtml(keyInfo.song_key)}`);
      }
      if (song.bpm) metaParts.push(`BPM: ${escHtml(String(song.bpm))}`);
      const metaRow = metaParts.length
        ? `<tr><td></td><td style="padding-top:5px;font-size:12px;color:#5A4D44;font-family:Arial,sans-serif;">${metaParts.join(' &nbsp;|&nbsp; ')}</td></tr>`
        : '';

      const linkParts = [];
      if (keyInfo.youtube_link) linkParts.push(`<a href="${escHtml(keyInfo.youtube_link)}" style="color:#BF6E2E;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;">&#9654; YouTube</a>`);
      if (keyInfo.chord_chart_link) linkParts.push(`<a href="${escHtml(keyInfo.chord_chart_link)}" style="color:#BF6E2E;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;">&#9835; Chord Chart</a>`);
      if (keyInfo.capo_chord_chart_link) linkParts.push(`<a href="${escHtml(keyInfo.capo_chord_chart_link)}" style="color:#BF6E2E;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;">&#9835; ${keyInfo.capo_number ? `(Capo ${escHtml(String(keyInfo.capo_number))}) ` : ''}Capo Chart</a>`);
      const linksRow = linkParts.length
        ? `<tr><td></td><td style="padding-top:7px;">${linkParts.join('&nbsp;&nbsp;&nbsp;')}</td></tr>`
        : '';

      const notesRow = row.notes
        ? `<tr><td colspan="2"><div style="font-size:12px;color:#92400E;background:#FEF3C7;padding:6px 10px;border-radius:4px;margin-top:9px;font-family:Arial,sans-serif;">${escHtml(row.notes)}</div></td></tr>`
        : '';

      return `<div style="background:#fff;border:1px solid #E5DDD4;border-radius:6px;padding:14px 16px;margin-bottom:10px;">
        <table style="border-collapse:collapse;width:100%;">
          <tr>
            <td style="width:22px;vertical-align:top;padding:0 8px 0 0;font-size:12px;color:#BF6E2E;font-family:Arial,sans-serif;font-weight:700;">${i + 1}</td>
            <td style="vertical-align:top;padding:0;font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:600;color:#1A130E;">${songTitle}</td>
          </tr>
          ${metaRow}${linksRow}${notesRow}
        </table>
      </div>`;
    }).join('');
  }

  const titleLine = title
    ? `<div style="font-size:14px;color:#BFA07A;margin-top:6px;font-family:Arial,sans-serif;">${title}</div>`
    : '';

  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#F8F5F0;border-radius:8px;overflow:hidden;border:1px solid #E5DDD4;">
  <div style="background:#241B15;padding:28px 32px;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:2.5px;color:#BF6E2E;margin-bottom:10px;font-family:Arial,sans-serif;font-weight:600;">Worship Plan</div>
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:600;color:#F5EDE3;">${date}</div>
    ${titleLine}
  </div>
  <div style="padding:28px 32px;">
    ${introHtml}
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#9A8B82;margin-bottom:14px;font-family:Arial,sans-serif;font-weight:600;">Team</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">${teamHtml}</table>
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#9A8B82;margin-bottom:14px;font-family:Arial,sans-serif;font-weight:600;">Set List</div>
    ${songsHtml}
  </div>
  <div style="padding:14px 32px;background:#F4F0EA;border-top:1px solid #E5DDD4;text-align:center;">
    <span style="font-size:11px;color:#9A8B82;font-family:Arial,sans-serif;">Worship Planner</span>
  </div>
</div>`;
}

function buildEmailPlain(service, songRows, assignmentRows, intro) {
  const lines = [];
  lines.push(`Worship Plan — ${service.service_date}${service.title ? ' (' + service.title + ')' : ''}`);
  if (intro) {
    lines.push('');
    lines.push(intro);
  }
  lines.push('');
  lines.push('Team:');
  if (!assignmentRows.length) {
    lines.push('  (no assignments yet)');
  } else {
    assignmentRows.forEach((a) => {
      lines.push(`  ${a.instrument}: ${a.musicians ? a.musicians.name : 'Unassigned'}`);
    });
  }
  lines.push('');
  lines.push('Set List:');
  if (!songRows.length) {
    lines.push('  (no songs yet)');
  } else {
    songRows.forEach((row, i) => {
      const song = row.songs || {};
      const keyInfo = row.song_keys || {};
      const parts = [`${i + 1}. ${song.title || ''}`];
      if (keyInfo.song_key) parts.push(`Key: ${keyInfo.song_key}`);
      if (song.bpm) parts.push(`BPM: ${song.bpm}`);
      lines.push('  ' + parts.join(' | '));
      if (keyInfo.youtube_link) lines.push(`     YouTube: ${keyInfo.youtube_link}`);
      if (keyInfo.chord_chart_link) lines.push(`     Chart: ${keyInfo.chord_chart_link}`);
      if (keyInfo.capo_chord_chart_link) lines.push(`     ${keyInfo.capo_number ? `(Capo ${keyInfo.capo_number}) ` : ''}Capo Chart: ${keyInfo.capo_chord_chart_link}`);
      if (row.notes) lines.push(`     Notes: ${row.notes}`);
    });
  }
  return lines.join('\n');
}

function buildRecipients(assignmentRows) {
  const emails = assignmentRows
    .filter((a) => a.musicians && a.musicians.email)
    .map((a) => a.musicians.email);
  return [...new Set(emails)].join(', ');
}

emailCopyBtn.addEventListener('click', async () => {
  if (!currentEmailHtml) return;
  emailCopyStatus.textContent = '';
  try {
    const htmlBlob = new Blob([currentEmailHtml], { type: 'text/html' });
    const textBlob = new Blob([currentEmailPlain], { type: 'text/plain' });
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]);
    emailCopyStatus.textContent = 'Copied!';
  } catch {
    try {
      await navigator.clipboard.writeText(currentEmailPlain);
      emailCopyStatus.textContent = 'Copied as plain text.';
    } catch {
      emailCopyStatus.textContent = 'Could not copy — select the preview and copy manually.';
    }
  }
  setTimeout(() => { emailCopyStatus.textContent = ''; }, 3000);
});

emailRecipientsCopyBtn.addEventListener('click', async () => {
  const text = emailRecipientsOutput.value;
  if (!text) return;
  emailRecipientsCopyStatus.textContent = '';
  try {
    await navigator.clipboard.writeText(text);
    emailRecipientsCopyStatus.textContent = 'Copied!';
  } catch {
    emailRecipientsCopyStatus.textContent = 'Could not copy.';
  }
  setTimeout(() => { emailRecipientsCopyStatus.textContent = ''; }, 3000);
});
