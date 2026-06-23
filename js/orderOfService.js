const oosServiceSelect = document.getElementById('oos-service-select');
const oosContent = document.getElementById('oos-content');

const oosSongForm = document.getElementById('oos-song-form');
const oosSongSelect = document.getElementById('oos-song-select');
const oosKeyOverrideField = document.getElementById('oos-key-override');
const oosSongNotesField = document.getElementById('oos-song-notes');
const oosSongError = document.getElementById('oos-song-error');
const oosSongsTbody = document.getElementById('oos-songs-tbody');

const oosAssignmentForm = document.getElementById('oos-assignment-form');
const oosMusicianSelect = document.getElementById('oos-musician-select');
const oosInstrumentField = document.getElementById('oos-instrument');
const oosAssignmentError = document.getElementById('oos-assignment-error');
const oosAssignmentsTbody = document.getElementById('oos-assignments-tbody');

let currentServiceId = '';
let currentServiceSongs = [];

function populateServiceDropdown() {
  const previousValue = oosServiceSelect.value;
  oosServiceSelect.innerHTML = '<option value="">Select a service</option>' +
    allServices.map((s) => `<option value="${s.id}">${s.service_date}${s.title ? ' - ' + s.title : ''}</option>`).join('');
  oosServiceSelect.value = previousValue;
}

function populateSongDropdownForOos() {
  oosSongSelect.innerHTML = '<option value="">Select a song</option>' +
    allSongs.map((s) => `<option value="${s.id}">${s.title}</option>`).join('');
}

function populateMusicianDropdownForOos() {
  oosMusicianSelect.innerHTML = '<option value="">Select a musician</option>' +
    allMusicians.map((m) => `<option value="${m.id}">${m.name}</option>`).join('');
}

oosServiceSelect.addEventListener('change', async () => {
  currentServiceId = oosServiceSelect.value;

  if (!currentServiceId) {
    oosContent.classList.add('hidden');
    return;
  }

  oosContent.classList.remove('hidden');
  populateSongDropdownForOos();
  populateMusicianDropdownForOos();
  await loadServiceSongs();
  await loadAssignments();
});

async function loadServiceSongs() {
  const { data, error } = await supabaseClient
    .from('service_songs')
    .select('*, songs(title, song_key, bpm)')
    .eq('service_id', currentServiceId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error loading service songs:', error);
    return;
  }

  currentServiceSongs = data;
  renderServiceSongs();
}

function renderServiceSongs() {
  oosSongsTbody.innerHTML = '';

  currentServiceSongs.forEach((row, index) => {
    const song = row.songs || {};
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.position}</td>
      <td>${song.title || ''}</td>
      <td>${row.key_override || song.song_key || ''}</td>
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
    key_override: oosKeyOverrideField.value || null,
    notes: oosSongNotesField.value || null
  });

  if (error) {
    oosSongError.textContent = 'Could not add song. ' + error.message;
    return;
  }

  oosSongForm.reset();
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

async function loadAssignments() {
  const { data, error } = await supabaseClient
    .from('assignments')
    .select('*, musicians(name)')
    .eq('service_id', currentServiceId);

  if (error) {
    console.error('Error loading assignments:', error);
    return;
  }

  renderAssignments(data);
}

function renderAssignments(assignments) {
  oosAssignmentsTbody.innerHTML = '';

  assignments.forEach((a) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${a.musicians ? a.musicians.name : ''}</td>
      <td>${a.instrument}</td>
      <td><button class="remove-assignment-btn" data-id="${a.id}">Remove</button></td>
    `;
    oosAssignmentsTbody.appendChild(tr);
  });
}

oosAssignmentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  oosAssignmentError.textContent = '';

  const musicianId = oosMusicianSelect.value;
  if (!musicianId) {
    oosAssignmentError.textContent = 'Please select a musician.';
    return;
  }

  const { error } = await supabaseClient.from('assignments').insert({
    service_id: currentServiceId,
    musician_id: musicianId,
    instrument: oosInstrumentField.value
  });

  if (error) {
    oosAssignmentError.textContent = 'Could not add assignment. ' + error.message;
    return;
  }

  oosAssignmentForm.reset();
  loadAssignments();
});

oosAssignmentsTbody.addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  if (!id || !e.target.classList.contains('remove-assignment-btn')) return;

  const confirmed = confirm('Remove this assignment?');
  if (!confirmed) return;

  const { error } = await supabaseClient.from('assignments').delete().eq('id', id);
  if (error) {
    alert('Could not remove: ' + error.message);
    return;
  }
  loadAssignments();
});
