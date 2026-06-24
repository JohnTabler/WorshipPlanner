const oosServiceSelect = document.getElementById('oos-service-select');
const oosContent = document.getElementById('oos-content');

const oosSongForm = document.getElementById('oos-song-form');
const oosEnergyFilter = document.getElementById('oos-energy-filter');
const oosSongSelect = document.getElementById('oos-song-select');
const oosSongKeySelect = document.getElementById('oos-song-key-select');
const oosSongNotesField = document.getElementById('oos-song-notes');
const oosSongCaution = document.getElementById('oos-song-caution');
const oosSongError = document.getElementById('oos-song-error');
const oosSongsTbody = document.getElementById('oos-songs-tbody');

const oosAssignmentsGrid = document.getElementById('oos-assignments-grid');
const oosAssignmentError = document.getElementById('oos-assignment-error');

let currentServiceId = '';
let currentServiceSongs = [];
let currentAssignments = [];
let previousServiceSongIds = new Set();
let previousServiceLabel = '';
let dragSrcIndex = -1;

const ALL_ROLES = ['Vocals', 'Rhythm Guitar', 'Electric Guitar', 'Bass', 'Keys', 'Drums', 'Other'];
// Exact instrument values stored for each named role; anything else belongs to "Other"
const NAMED_ROLES = new Set(['Vocals', 'Rhythm Guitar', 'Electric Guitar', 'Bass', 'Keys', 'Drums']);

const ROLE_KEYWORDS = {
  'Vocals': ['vocal', 'voice', 'sing'],
  'Rhythm Guitar': ['rhythm guitar', 'acoustic guitar', 'rhythm', 'acoustic'],
  'Electric Guitar': ['electric guitar', 'lead guitar', 'electric'],
  'Bass': ['bass'],
  'Keys': ['key', 'piano', 'keyboard'],
  'Drums': ['drum', 'percussion', 'kit']
};

function musicianMatchesRole(musician, role) {
  if (role === 'Other') return true;
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
  const energyFilter = oosEnergyFilter.value;
  const filtered = energyFilter
    ? allSongs.filter((s) => s.energy === energyFilter)
    : allSongs;

  oosSongSelect.innerHTML = '<option value="">Select a song</option>' +
    filtered.map((s) => `<option value="${s.id}">${s.title}</option>`).join('');
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

oosEnergyFilter.addEventListener('change', () => {
  populateSongDropdownForOos();
  oosSongSelect.value = '';
  oosSongKeySelect.innerHTML = '<option value="">— Select a song first —</option>';
  oosSongCaution.textContent = '';
  oosSongCaution.classList.add('hidden');
});

async function loadPreviousServiceSongs() {
  previousServiceSongIds = new Set();
  previousServiceLabel = '';

  const currentIndex = allServices.findIndex((s) => s.id === currentServiceId);
  if (currentIndex <= 0) return;

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
    tr.draggable = true;

    tr.innerHTML = `
      <td class="drag-handle" title="Drag to reorder">⠿</td>
      <td>${row.position}</td>
      <td>${flagged ? '⚠️ ' : ''}${song.title || ''}</td>
      <td>${keyLabel}</td>
      <td>${song.bpm || ''}</td>
      <td>${row.notes || ''}</td>
      <td>
        <button class="remove-song-btn" data-id="${row.id}">Remove</button>
      </td>
    `;

    tr.addEventListener('dragstart', (e) => {
      dragSrcIndex = index;
      e.dataTransfer.effectAllowed = 'move';
      requestAnimationFrame(() => tr.classList.add('dragging'));
    });

    tr.addEventListener('dragend', () => {
      tr.classList.remove('dragging');
      oosSongsTbody.querySelectorAll('tr').forEach((r) => r.classList.remove('drag-over'));
    });

    tr.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    tr.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (index === dragSrcIndex) return;
      oosSongsTbody.querySelectorAll('tr').forEach((r) => r.classList.remove('drag-over'));
      tr.classList.add('drag-over');
    });

    tr.addEventListener('dragleave', (e) => {
      if (!tr.contains(e.relatedTarget)) tr.classList.remove('drag-over');
    });

    tr.addEventListener('drop', async (e) => {
      e.preventDefault();
      const dropIndex = index;
      if (dragSrcIndex === -1 || dragSrcIndex === dropIndex) return;

      const moved = currentServiceSongs.splice(dragSrcIndex, 1)[0];
      currentServiceSongs.splice(dropIndex, 0, moved);
      dragSrcIndex = -1;

      await savePositions();
    });

    oosSongsTbody.appendChild(tr);
  });
}

async function savePositions() {
  for (let i = 0; i < currentServiceSongs.length; i++) {
    currentServiceSongs[i].position = i + 1;
    await supabaseClient.from('service_songs').update({ position: i + 1 }).eq('id', currentServiceSongs[i].id);
  }
  renderServiceSongs();
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

oosSongsTbody.addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  if (!id || !e.target.classList.contains('remove-song-btn')) return;

  const confirmed = confirm('Remove this song from the set?');
  if (!confirmed) return;

  const { error } = await supabaseClient.from('service_songs').delete().eq('id', id);
  if (error) {
    alert('Could not remove: ' + error.message);
    return;
  }
  loadServiceSongs();
});

// ---- Musician assignments ----

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
  renderAllRoleSlots();
}

function getAssignmentsForRole(role) {
  if (role === 'Other') {
    return currentAssignments.filter((a) => !NAMED_ROLES.has(a.instrument));
  }
  return currentAssignments.filter((a) => a.instrument === role);
}

function renderAllRoleSlots() {
  ALL_ROLES.forEach((role) => {
    const row = oosAssignmentsGrid.querySelector(`.assignment-row[data-role="${role}"]`);
    if (!row) return;
    const container = row.querySelector('.role-slots');
    container.innerHTML = '';
    const assignments = getAssignmentsForRole(role);
    const slots = assignments.length > 0 ? assignments : [null];
    slots.forEach((assignment) => container.appendChild(buildRoleSlot(role, assignment)));
  });
}

function buildRoleSlot(role, assignment) {
  const wrapper = document.createElement('div');
  wrapper.className = 'role-slot-row';

  const select = document.createElement('select');
  select.dataset.assignmentId = assignment ? assignment.id : '';
  select.innerHTML = buildRoleOptionsHtml(role, assignment ? assignment.musician_id : '');

  wrapper.appendChild(select);

  if (role === 'Other') {
    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.className = 'role-note-input';
    noteInput.placeholder = 'Instrument (e.g. Drums)';
    // Show stored value unless it's the plain fallback "Other"
    if (assignment && assignment.instrument !== 'Other') {
      noteInput.value = assignment.instrument;
    }
    wrapper.appendChild(noteInput);

    select.addEventListener('change', () => handleRoleSelectChange(select, noteInput, role));
    noteInput.addEventListener('change', () => handleRoleNoteChange(select, noteInput));
  } else {
    select.addEventListener('change', () => handleRoleSelectChange(select, null, role));
  }

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-role-btn';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => handleRemoveRoleSlot(wrapper, select));
  wrapper.appendChild(removeBtn);

  return wrapper;
}

function instrumentForRole(role, noteInput) {
  if (role !== 'Other') return role;
  return (noteInput && noteInput.value.trim()) ? noteInput.value.trim() : 'Other';
}

async function handleRoleSelectChange(select, noteInput, role) {
  oosAssignmentError.textContent = '';
  const assignmentId = select.dataset.assignmentId;
  const musicianId = select.value;
  const instrument = instrumentForRole(role, noteInput);

  let error;
  if (assignmentId) {
    if (!musicianId) {
      ({ error } = await supabaseClient.from('assignments').delete().eq('id', assignmentId));
      if (!error) {
        select.dataset.assignmentId = '';
        loadAssignments();
      }
    } else {
      ({ error } = await supabaseClient.from('assignments')
        .update({ musician_id: musicianId, instrument })
        .eq('id', assignmentId));
    }
  } else if (musicianId) {
    const { data, error: err } = await supabaseClient.from('assignments').insert({
      service_id: currentServiceId,
      musician_id: musicianId,
      instrument
    }).select().single();
    error = err;
    if (!error && data) select.dataset.assignmentId = data.id;
  }

  if (error) {
    oosAssignmentError.textContent = 'Could not update assignment. ' + error.message;
  }
}

async function handleRoleNoteChange(select, noteInput) {
  oosAssignmentError.textContent = '';
  const assignmentId = select.dataset.assignmentId;
  if (!assignmentId) return; // no assignment yet; note will be included when musician is chosen

  const instrument = noteInput.value.trim() || 'Other';
  const { error } = await supabaseClient.from('assignments')
    .update({ instrument })
    .eq('id', assignmentId);

  if (error) {
    oosAssignmentError.textContent = 'Could not update instrument note. ' + error.message;
  }
}

async function handleRemoveRoleSlot(wrapper, select) {
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

oosAssignmentsGrid.addEventListener('click', (e) => {
  const addBtn = e.target.closest('.add-role-btn');
  if (!addBtn) return;
  const role = addBtn.dataset.role;
  const container = oosAssignmentsGrid.querySelector(`.assignment-row[data-role="${role}"] .role-slots`);
  if (container) container.appendChild(buildRoleSlot(role, null));
});
