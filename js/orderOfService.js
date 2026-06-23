const oosServiceSelect = document.getElementById('oos-service-select');
const oosContent = document.getElementById('oos-content');

const oosSongForm = document.getElementById('oos-song-form');
const oosSongSelect = document.getElementById('oos-song-select');
const oosSongKeySelect = document.getElementById('oos-song-key-select');
const oosSongNotesField = document.getElementById('oos-song-notes');
const oosSongCaution = document.getElementById('oos-song-caution');
const oosSongError = document.getElementById('oos-song-error');
const oosSongsTbody = document.getElementById('oos-songs-tbody');

const oosAssignmentsGrid = document.getElementById('oos-assignments-grid');
const oosVocalsContainer = document.getElementById('oos-vocals-selects');
const oosAddVocalistBtn = document.getElementById('oos-add-vocalist-btn');
const oosAssignmentError = document.getElementById('oos-assignment-error');

let currentServiceId = '';
let currentServiceSongs = [];
let currentAssignments = [];
let previousServiceSongIds = new Set();
let previousServiceLabel = '';

// Fixed single-select roles. Vocals is handled separately since it allows multiple people.
const SINGLE_SELECT_ROLES = ['Rhythm Guitar', 'Electric Guitar', 'Bass', 'Keys', 'Other'];

// Keyword groups used to fuzzy-match a musician's freeform instrument tags to a role.
// "Other" intentionally matches everyone, so nobody who's mistagged ever becomes
// invisible to every dropdown - worst case they land in Other instead.
const ROLE_KEYWORDS = {
  'Vocals': ['vocal', 'voice', 'sing'],
  'Rhythm Guitar': ['rhythm guitar', 'acoustic guitar', 'rhythm'],
  'Electric Guitar': ['electric guitar', 'lead guitar', 'electric'],
  'Bass': ['bass'],
  'Keys': ['key', 'piano', 'keyboard']
};

function musicianMatchesRole(musician, role) {
  if (role === 'Other') return true; // catch-all - always available as a fallback

  const tags = (musician.instruments || []).map((t) => t.toLowerCase());
  const keywords = ROLE_KEYWORDS[role] || [];
  if (tags.some((tag) => keywords.some((kw) => tag.includes(kw)))) return true;

  if (role === 'Rhythm Guitar' || role === 'Electric Guitar') {
    return tags.some((tag) => tag.includes('guitar') && !tag.includes('bass'));
  }

  return false;
}

function buildRoleOptionsHtml(role, selectedMusicianId) {
  const eligible = allMusicians.filter((m) => musicianMatchesRole(m, role));
  const options = ['<option value="">— Unassigned —</option>'].concat(
    eligible.map((m) => `<option value="${m.id}" ${m.id === selectedMusicianId ? 'selected' : ''}>${m.name}</option>`)
  );
  return options.join('');
}

function formatLocalISODateForFilter(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function populateServiceDropdown() {
  const previousValue = oosServiceSelect.value;
  const todayStr = formatLocalISODateForFilter(new Date());

  const upcoming = allServices
    .filter((s) => s.service_date >= todayStr)
    .slice(0, 4);

  oosServiceSelect.innerHTML = '<option value="">Select a service</option>' +
    upcoming.map((s) => `<option value="${s.id}">${s.service_date}${s.title ? ' - ' + s.title : ''}</option>`).join('');
  oosServiceSelect.value = previousValue;
}

function populateSongDropdownForOos() {
  oosSongSelect.innerHTML = '<option value="">Select a song</option>' +
    allSongs.map((s) => `<option value="${s.id}">${s.title}</option>`).join('');
}

// Kept as a no-op so musicians.js's conditional call to this stays harmless.
function populateMusicianDropdownForOos() {}

oosServiceSelect.addEventListener('change', async () => {
  currentServiceId = oosServiceSelect.value;
  oosSongCaution.textContent = '';
  oosSongCaution.classList.add('hidden');

  if (!currentServiceId) {
    oosContent.classList.add('hidden');
    return;
  }

  oosContent.classList.remove('hidden');
  populateSongDropdownForOos();
  await populateKeySelectForSong('');
  await loadPreviousServiceSongs();
  await loadServiceSongs();
  await loadAssignments();
});

async function loadPreviousServiceSongs() {
  previousServiceSongIds = new Set();
  previousServiceLabel = '';

  const currentIndex = allServices.findIndex((s) => s.id === currentServiceId);
  if (currentIndex <= 0) return; // no earlier service on record

  const previousService = allServices[currentIndex - 1];
  previousServiceLabel = previousService.title
    ? `${previousService.service_date} (${previousService.title})`
    : previousService.service_date;

  const { data, error } = await supabaseClient
    .from('service_songs')
    .select('song_id')
    .eq('service_id', previousService.id);

  if (error) {
    console.error('Error loading previous service songs:', error);
    return;
  }

  previousServiceSongIds = new Set(data.map((r) => r.song_id));
}

// Populates the key dropdown for whichever song is selected, defaulting to that song's marked default key
async function populateKeySelectForSong(songId) {
  if (!songId) {
    oosSongKeySelect.innerHTML = '<option value="">— Select a song first —</option>';
    return;
  }

  const { data, error } = await supabaseClient
    .from('song_keys')
    .select('*')
    .eq('song_id', songId)
    .order('song_key', { ascending: true });

  if (error) {
    console.error('Error loading song keys:', error);
    oosSongKeySelect.innerHTML = '<option value="">— Error loading keys —</option>';
    return;
  }

  if (!data.length) {
    oosSongKeySelect.innerHTML = '<option value="">— No keys defined for this song —</option>';
    return;
  }

  const defaultKey = data.find((k) => k.is_default) || data[0];
  oosSongKeySelect.innerHTML = data
    .map((k) => `<option value="${k.id}" ${k.id === defaultKey.id ? 'selected' : ''}>${k.song_key}</option>`)
    .join('');
}

oosSongSelect.addEventListener('change', async () => {
  const songId = oosSongSelect.value;

  if (songId && previousServiceSongIds.has(songId)) {
    oosSongCaution.textContent = `⚠️ Used last Sunday (${previousServiceLabel}).`;
    oosSongCaution.classList.remove('hidden');
  } else {
    oosSongCaution.textContent = '';
    oosSongCaution.classList.add('hidden');
  }

  await populateKeySelectForSong(songId);
});

async function loadServiceSongs() {
  const { data, error } = await supabaseClient
    .from('service_songs')
    .select('*, songs(title, bpm), song_keys(song_key)')
    .eq('service_id', currentServiceId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error loading service songs:', error);
    return;
  }

  currentServiceSongs = data;
  await renumberServiceSongsIfNeeded();
  renderServiceSongs();
}

// Self-heals position numbering on every load - closes gaps left by deletes
// and splits any duplicate position values (e.g. from a fast double-click on Add).
async function renumberServiceSongsIfNeeded() {
  const fixes = [];

  currentServiceSongs.forEach((row, index) => {
    const correctPosition = index + 1;
    if (row.position !== correctPosition) {
      fixes.push({ id: row.id, position: correctPosition });
      row.position = correctPosition;
    }
  });

  for (const fix of fixes) {
    await supabaseClient.from('service_songs').update({ position: fix.position }).eq('id', fix.id);
  }
}

function renderServiceSongs() {
  oosSongsTbody.innerHTML = '';

  currentServiceSongs.forEach((row, index) => {
    const song = row.songs || {};
    const keyLabel = row.song_keys ? row.song_keys.song_key : '';
    const flagged = previousServiceSongIds.has(row.song_id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.position}</td>
      <td>${flagged ? '⚠️ ' : ''}${song.title || ''}</td>
      <td>${keyLabel}</td>
      <td>${song.bpm || ''}</td>
      <td>${row.notes || ''}</td>
      <td>
        <button class="move-up-btn" data-id="${row.id}" ${index === 0 ? 'disabled' : ''}>Up</button>
        <button class="move-down-btn" data-id="${row.id}" ${index === currentServiceSongs.length - 1 ? 'disabled' : ''}>Down</button>
        <button class="remove-song-btn" data-id="${row.id}">Remove</button>
      </td>
    `;
    oosSongsTbody.appendChild(tr);
  });
}

oosSongForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  oosSongError.textContent = '';

  const songId = oosSongSelect.value;
  if (!songId) {
    oosSongError.textContent = 'Please select a song.';
    return;
  }

  const nextPosition = currentServiceSongs.length + 1;

  const { error } = await supabaseClient.from('service_songs').insert({
    service_id: currentServiceId,
    song_id: songId,
    position: nextPosition,
    song_key_id: oosSongKeySelect.value || null,
    notes: oosSongNotesField.value || null
  });

  if (error) {
    oosSongError.textContent = 'Could not add song. ' + error.message;
    return;
  }

  oosSongForm.reset();
  oosSongCaution.textContent = '';
  oosSongCaution.classList.add('hidden');
  oosSongKeySelect.innerHTML = '<option value="">— Select a song first —</option>';
  loadServiceSongs();
});

async function swapPositions(rowA, rowB) {
  await supabaseClient.from('service_songs').update({ position: rowB.position }).eq('id', rowA.id);
  await supabaseClient.from('service_songs').update({ position: rowA.position }).eq('id', rowB.id);
  loadServiceSongs();
}

oosSongsTbody.addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  if (!id) return;

  const row = currentServiceSongs.find((r) => r.id === id);
  if (!row) return;
  const index = currentServiceSongs.indexOf(row);

  if (e.target.classList.contains('move-up-btn') && index > 0) {
    await swapPositions(row, currentServiceSongs[index - 1]);
  }

  if (e.target.classList.contains('move-down-btn') && index < currentServiceSongs.length - 1) {
    await swapPositions(row, currentServiceSongs[index + 1]);
  }

  if (e.target.classList.contains('remove-song-btn')) {
    const confirmed = confirm('Remove this song from the set?');
    if (!confirmed) return;

    const { error } = await supabaseClient.from('service_songs').delete().eq('id', id);
    if (error) {
      alert('Could not remove: ' + error.message);
      return;
    }
    loadServiceSongs();
  }
});

// ---- Musician assignments (fixed dropdowns, filtered by instrument) ----

async function loadAssignments() {
  const { data, error } = await supabaseClient
    .from('assignments')
    .select('*, musicians(name)')
    .eq('service_id', currentServiceId);

  if (error) {
    console.error('Error loading assignments:', error);
    return;
  }

  currentAssignments = data;
  renderRoleSelects();
  renderVocalsSelects();
}

function renderRoleSelects() {
  SINGLE_SELECT_ROLES.forEach((role) => {
    const select = oosAssignmentsGrid.querySelector(`.oos-role-select[data-role="${role}"]`);
    if (!select) return;

    const assignment = currentAssignments.find((a) => a.instrument === role);
    select.dataset.assignmentId = assignment ? assignment.id : '';
    select.innerHTML = buildRoleOptionsHtml(role, assignment ? assignment.musician_id : '');
  });
}

function renderVocalsSelects() {
  oosVocalsContainer.innerHTML = '';

  const vocalsAssignments = currentAssignments.filter((a) => a.instrument === 'Vocals');
  const rows = vocalsAssignments.length > 0 ? vocalsAssignments : [null];

  rows.forEach((assignment) => {
    oosVocalsContainer.appendChild(buildVocalsSelectRow(assignment));
  });
}

function buildVocalsSelectRow(assignment) {
  const wrapper = document.createElement('div');
  wrapper.className = 'vocals-select-row';

  const select = document.createElement('select');
  select.className = 'vocals-select';
  select.dataset.assignmentId = assignment ? assignment.id : '';
  select.innerHTML = buildRoleOptionsHtml('Vocals', assignment ? assignment.musician_id : '');

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-vocalist-btn';
  removeBtn.textContent = '×';

  select.addEventListener('change', () => handleVocalsSelectChange(select));
  removeBtn.addEventListener('click', () => handleRemoveVocalistRow(wrapper, select));

  wrapper.appendChild(select);
  wrapper.appendChild(removeBtn);
  return wrapper;
}

async function handleVocalsSelectChange(select) {
  oosAssignmentError.textContent = '';
  const assignmentId = select.dataset.assignmentId;
  const musicianId = select.value;

  let error;
  if (assignmentId) {
    if (!musicianId) {
      ({ error } = await supabaseClient.from('assignments').delete().eq('id', assignmentId));
    } else {
      ({ error } = await supabaseClient.from('assignments').update({ musician_id: musicianId }).eq('id', assignmentId));
    }
  } else if (musicianId) {
    ({ error } = await supabaseClient.from('assignments').insert({
      service_id: currentServiceId,
      musician_id: musicianId,
      instrument: 'Vocals'
    }));
  }

  if (error) {
    oosAssignmentError.textContent = 'Could not update assignment. ' + error.message;
    return;
  }

  loadAssignments();
}

async function handleRemoveVocalistRow(wrapper, select) {
  const assignmentId = select.dataset.assignmentId;
  if (!assignmentId) {
    wrapper.remove();
    return;
  }

  const { error } = await supabaseClient.from('assignments').delete().eq('id', assignmentId);
  if (error) {
    oosAssignmentError.textContent = 'Could not remove: ' + error.message;
    return;
  }
  loadAssignments();
}

oosAddVocalistBtn.addEventListener('click', () => {
  oosVocalsContainer.appendChild(buildVocalsSelectRow(null));
});

oosAssignmentsGrid.addEventListener('change', async (e) => {
  if (!e.target.classList.contains('oos-role-select')) return;

  oosAssignmentError.textContent = '';
  const select = e.target;
  const role = select.dataset.role;
  const assignmentId = select.dataset.assignmentId;
  const musicianId = select.value;

  let error;
  if (assignmentId) {
    if (!musicianId) {
      ({ error } = await supabaseClient.from('assignments').delete().eq('id', assignmentId));
    } else {
      ({ error } = await supabaseClient.from('assignments').update({ musician_id: musicianId }).eq('id', assignmentId));
    }
  } else if (musicianId) {
    ({ error } = await supabaseClient.from('assignments').insert({
      service_id: currentServiceId,
      musician_id: musicianId,
      instrument: role
    }));
  }

  if (error) {
    oosAssignmentError.textContent = 'Could not update assignment. ' + error.message;
    return;
  }

  loadAssignments();
});
