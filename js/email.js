const emailServiceSelect = document.getElementById('email-service-select');
const emailOutput = document.getElementById('email-output');
const emailCopyBtn = document.getElementById('email-copy-btn');
const emailCopyStatus = document.getElementById('email-copy-status');

function populateEmailServiceDropdown() {
  const previousValue = emailServiceSelect.value;
  emailServiceSelect.innerHTML = '<option value="">Select a service</option>' +
    allServices.map((s) => `<option value="${s.id}">${s.service_date}${s.title ? ' - ' + s.title : ''}</option>`).join('');
  emailServiceSelect.value = previousValue;
}

emailServiceSelect.addEventListener('change', async () => {
  const serviceId = emailServiceSelect.value;
  emailCopyStatus.textContent = '';

  if (!serviceId) {
    emailOutput.value = '';
    return;
  }

  const service = allServices.find((s) => s.id === serviceId);

  const { data: songRows, error: songError } = await supabaseClient
    .from('service_songs')
    .select('*, songs(title, bpm), song_keys(song_key, youtube_link, chord_chart_link)')
    .eq('service_id', serviceId)
    .order('position', { ascending: true });

  const { data: assignmentRows, error: assignError } = await supabaseClient
    .from('assignments')
    .select('*, musicians(name, email)')
    .eq('service_id', serviceId);

  if (songError || assignError) {
    emailOutput.value = 'Error loading data for this service.';
    return;
  }

  emailOutput.value = buildEmailText(service, songRows, assignmentRows);
});

function buildEmailText(service, songRows, assignmentRows) {
  const lines = [];

  lines.push(`Worship Plan — ${service.service_date}${service.title ? ' (' + service.title + ')' : ''}`);
  lines.push('');
  lines.push('Team:');

  if (assignmentRows.length === 0) {
    lines.push('  (no assignments yet)');
  } else {
    assignmentRows.forEach((a) => {
      lines.push(`  - ${a.instrument}: ${a.musicians ? a.musicians.name : 'Unassigned'}`);
    });
  }

  lines.push('');
  lines.push('Set List:');

  if (songRows.length === 0) {
    lines.push('  (no songs yet)');
  } else {
    songRows.forEach((row, index) => {
      const song = row.songs || {};
      const keyInfo = row.song_keys || {};
      const parts = [`${index + 1}. ${song.title || ''}`];
      if (keyInfo.song_key) parts.push(`Key: ${keyInfo.song_key}`);
      if (song.bpm) parts.push(`BPM: ${song.bpm}`);
      lines.push('  ' + parts.join(' | '));
      if (keyInfo.youtube_link) lines.push(`     YouTube: ${keyInfo.youtube_link}`);
      if (keyInfo.chord_chart_link) lines.push(`     Chart: ${keyInfo.chord_chart_link}`);
      if (row.notes) lines.push(`     Notes: ${row.notes}`);
    });
  }

  return lines.join('\n');
}

emailCopyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(emailOutput.value);
    emailCopyStatus.textContent = 'Copied!';
  } catch (err) {
    emailCopyStatus.textContent = 'Could not copy automatically — select the text and copy manually.';
  }
});
