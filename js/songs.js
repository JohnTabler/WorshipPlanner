// ---- Song form fields ----
const songForm = document.getElementById('song-form');
const songIdField = document.getElementById('song-id');
const songTitleField = document.getElementById('song-title');
const songArtistField = document.getElementById('song-artist');
const songBpmField = document.getElementById('song-bpm');
const songTagsField = document.getElementById('song-tags');
const songEnergyField = document.getElementById('song-energy');
const songLastPlayedField = document.getElementById('song-last-played');
const songNotesField = document.getElementById('song-notes');
const songSubmitBtn = document.getElementById('song-submit-btn');
const songCancelBtn = document.getElementById('song-cancel-btn');
const songError = document.getElementById('song-error');
const addSongBtn = document.getElementById('add-song-btn');
const songSearch = document.getElementById('song-search');
const songEnergyFilter = document.getElementById('song-energy-filter');
const songsEnergyHeader = document.getElementById('songs-th-energy');
const songsTbody = document.getElementById('songs-tbody');

// ---- Inline key manager ----
const sfkList = document.getElementById('sfk-list');
const sfkNameField = document.getElementById('sfk-name');
const sfkYoutubeField = document.getElementById('sfk-youtube');
const sfkChartField = document.getElementById('sfk-chart');
const sfkDefaultField = document.getElementById('sfk-default');
const sfkAddBtn = document.getElementById('sfk-add-btn');
const sfkError = document.getElementById('sfk-error');

let allSongs = [];
let energySortDirection = null;

// Each entry: { ref, dbId, name, youtube, chart, isDefault }
// New-song mode: dbId is null (buffered until submit).
// Edit mode: dbId is the DB UUID; DB writes happen immediately.
let modalKeys = [];
let modalKeyCounter = 0;
let editingSongId = '';

// ---- Reset / open helpers ----

function resetSongForm() {
  songForm.reset();
  songIdField.value = '';
  songSubmitBtn.textContent = 'Add Song';
  songCancelBtn.classList.add('hidden');
  songError.textContent = '';
  closeModal();
}

function resetKeyInputs() {
  sfkNameField.value = '';
  sfkYoutubeField.value = '';
  sfkChartField.value = '';
  sfkDefaultField.checked = false;
  sfkError.textContent = '';
}

addSongBtn.addEventListener('click', () => {
  resetSongForm();
  editingSongId = '';
  modalKeys = [];
  modalKeyCounter = 0;
  resetKeyInputs();
  renderModalKeys();
  songCancelBtn.classList.remove('hidden');
  openModal(songForm);
});

// ---- Load & render songs ----

async function loadSongs() {
  const { data, error } = await supabaseClient
    .from('songs')
    .select('*, song_keys(*)')
    .order('title', { ascending: true });

  if (error) { console.error('Error loading songs:', error); return; }

  allSongs = data;
  renderSongs(getFilteredSongs());
}

function getDefaultKey(song) {
  const keys = song.song_keys || [];
  return keys.find((k) => k.is_default) || keys[0] || null;
}

function getEnergyRank(energy) {
  return { High: 3, Medium: 2, Low: 1 }[energy] || 0;
}

function getFilteredSongs() {
  const term = songSearch.value.toLowerCase();
  let filtered = allSongs.filter((song) =>
    song.title.toLowerCase().includes(term) ||
    (song.artist || '').toLowerCase().includes(term) ||
    (song.tags || []).join(' ').toLowerCase().includes(term)
  );

  const energyValue = songEnergyFilter.value;
  if (energyValue) filtered = filtered.filter((s) => s.energy === energyValue);

  if (energySortDirection) {
    filtered = [...filtered].sort((a, b) => {
      const diff = getEnergyRank(a.energy) - getEnergyRank(b.energy);
      return energySortDirection === 'asc' ? diff : -diff;
    });
  }

  return filtered;
}

function renderSongs(songs) {
  songsTbody.innerHTML = '';

  songs.forEach((song) => {
    const row = document.createElement('tr');
    const defaultKey = getDefaultKey(song);
    const keyCount = (song.song_keys || []).length;
    const keyDisplay = defaultKey
      ? defaultKey.song_key + (keyCount > 1 ? ` (+${keyCount - 1} more)` : '')
      : '—';

    const links = defaultKey
      ? [
          defaultKey.youtube_link ? `<a href="${defaultKey.youtube_link}" target="_blank">YouTube</a>` : '',
          defaultKey.chord_chart_link ? `<a href="${defaultKey.chord_chart_link}" target="_blank">Chart</a>` : ''
        ].filter(Boolean).join(' / ')
      : '';

    row.innerHTML = `
      <td>${song.title}</td>
      <td>${song.artist || ''}</td>
      <td>${keyDisplay}</td>
      <td>${song.bpm || ''}</td>
      <td>${links}</td>
      <td>${(song.tags || []).join(', ')}</td>
      <td>${song.energy || ''}</td>
      <td>${song.last_played_date || ''}</td>
      <td>
        <button class="edit-btn" data-id="${song.id}">Edit</button>
        <button class="delete-btn" data-id="${song.id}">Delete</button>
      </td>
    `;

    songsTbody.appendChild(row);
  });
}

function findSongById(id) {
  return allSongs.find((s) => s.id === id);
}

// ---- Form submit ----

songForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  songError.textContent = '';

  const tags = songTagsField.value
    ? songTagsField.value.split(',').map((t) => t.trim()).filter(Boolean)
    : null;

  const songData = {
    title: songTitleField.value,
    artist: songArtistField.value || null,
    bpm: songBpmField.value ? parseInt(songBpmField.value, 10) : null,
    tags,
    energy: songEnergyField.value || null,
    last_played_date: songLastPlayedField.value || null,
    notes: songNotesField.value || null
  };

  if (editingSongId) {
    const { error } = await supabaseClient.from('songs').update(songData).eq('id', editingSongId);
    if (error) { songError.textContent = 'Could not save song. ' + error.message; return; }
  } else {
    const { data: newSong, error } = await supabaseClient.from('songs').insert(songData).select().single();
    if (error) { songError.textContent = 'Could not save song. ' + error.message; return; }

    for (const k of modalKeys) {
      await supabaseClient.from('song_keys').insert({
        song_id: newSong.id,
        song_key: k.name,
        youtube_link: k.youtube || null,
        chord_chart_link: k.chart || null,
        is_default: k.isDefault
      });
    }
  }

  resetSongForm();
  loadSongs();
});

songCancelBtn.addEventListener('click', resetSongForm);

// ---- Table row actions ----

songsTbody.addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.classList.contains('edit-btn')) {
    const song = findSongById(id);
    if (!song) return;

    songIdField.value = song.id;
    songTitleField.value = song.title || '';
    songArtistField.value = song.artist || '';
    songBpmField.value = song.bpm || '';
    songTagsField.value = (song.tags || []).join(', ');
    songEnergyField.value = song.energy || '';
    songLastPlayedField.value = song.last_played_date || '';
    songNotesField.value = song.notes || '';

    songSubmitBtn.textContent = 'Update Song';
    songCancelBtn.classList.remove('hidden');

    editingSongId = song.id;
    await loadModalKeysForEdit(song.id);

    openModal(songForm);
  }

  if (e.target.classList.contains('delete-btn')) {
    const confirmed = confirm('Delete this song? This cannot be undone.');
    if (!confirmed) return;

    const { error } = await supabaseClient.from('songs').delete().eq('id', id);
    if (error) { alert('Could not delete song: ' + error.message); return; }
    loadSongs();
  }
});

songSearch.addEventListener('input', () => renderSongs(getFilteredSongs()));
songEnergyFilter.addEventListener('change', () => renderSongs(getFilteredSongs()));

songsEnergyHeader.addEventListener('click', () => {
  energySortDirection = energySortDirection === 'desc' ? 'asc' : 'desc';
  renderSongs(getFilteredSongs());
});

// ---- Inline key manager ----

async function loadModalKeysForEdit(songId) {
  modalKeys = [];
  modalKeyCounter = 0;
  resetKeyInputs();

  const { data, error } = await supabaseClient
    .from('song_keys')
    .select('*')
    .eq('song_id', songId)
    .order('song_key', { ascending: true });

  if (!error && data) {
    modalKeys = data.map((k) => ({
      ref: k.id,
      dbId: k.id,
      name: k.song_key,
      youtube: k.youtube_link || '',
      chart: k.chord_chart_link || '',
      isDefault: k.is_default,
      _editing: false
    }));
  }

  renderModalKeys();
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderModalKeys() {
  if (!modalKeys.length) {
    sfkList.innerHTML = '<p class="sfk-empty">No keys yet — add one below.</p>';
    return;
  }

  sfkList.innerHTML = modalKeys.map((k) => {
    if (k._editing) {
      return `
        <div class="sfk-key-row sfk-key-editing">
          <input class="sfk-edit-name" type="text" value="${esc(k.name)}" placeholder="Key">
          <input class="sfk-edit-youtube" type="url" value="${esc(k.youtube)}" placeholder="YouTube link">
          <input class="sfk-edit-chart" type="url" value="${esc(k.chart)}" placeholder="Chord chart link">
          <span class="sfk-key-actions">
            <button type="button" class="sfk-save-btn" data-ref="${k.ref}">Save</button>
            <button type="button" class="sfk-cancel-edit-btn" data-ref="${k.ref}">Cancel</button>
          </span>
        </div>`;
    }
    return `
      <div class="sfk-key-row">
        <span class="sfk-key-name">${esc(k.name)}</span>
        ${k.isDefault ? '<span class="sfk-key-star">★</span>' : ''}
        ${k.youtube ? `<a href="${esc(k.youtube)}" target="_blank" class="sfk-key-link">YouTube</a>` : ''}
        ${k.chart ? `<a href="${esc(k.chart)}" target="_blank" class="sfk-key-link">Chart</a>` : ''}
        <span class="sfk-key-actions">
          ${!k.isDefault ? `<button type="button" class="sfk-default-btn" data-ref="${k.ref}">Default</button>` : ''}
          <button type="button" class="sfk-edit-btn" data-ref="${k.ref}">Edit</button>
          <button type="button" class="sfk-remove-btn" data-ref="${k.ref}">×</button>
        </span>
      </div>`;
  }).join('');
}

sfkAddBtn.addEventListener('click', async () => {
  sfkError.textContent = '';
  const keyName = sfkNameField.value.trim();
  if (!keyName) { sfkError.textContent = 'Key name is required.'; return; }

  const makeDefault = sfkDefaultField.checked || modalKeys.length === 0;

  if (!editingSongId) {
    // New song: buffer in memory until form submit
    if (makeDefault) modalKeys.forEach((k) => (k.isDefault = false));
    modalKeys.push({
      ref: `t${modalKeyCounter++}`,
      dbId: null,
      name: keyName,
      youtube: sfkYoutubeField.value.trim(),
      chart: sfkChartField.value.trim(),
      isDefault: makeDefault,
      _editing: false
    });
  } else {
    // Editing: write to DB immediately
    if (makeDefault) {
      await supabaseClient.from('song_keys')
        .update({ is_default: false })
        .eq('song_id', editingSongId)
        .eq('is_default', true);
      modalKeys.forEach((k) => (k.isDefault = false));
    }

    const { data, error } = await supabaseClient.from('song_keys').insert({
      song_id: editingSongId,
      song_key: keyName,
      youtube_link: sfkYoutubeField.value.trim() || null,
      chord_chart_link: sfkChartField.value.trim() || null,
      is_default: makeDefault
    }).select().single();

    if (error) { sfkError.textContent = 'Could not add key. ' + error.message; return; }

    modalKeys.push({
      ref: data.id,
      dbId: data.id,
      name: data.song_key,
      youtube: data.youtube_link || '',
      chart: data.chord_chart_link || '',
      isDefault: data.is_default,
      _editing: false
    });
  }

  resetKeyInputs();
  renderModalKeys();
});

sfkList.addEventListener('click', async (e) => {
  const ref = e.target.dataset.ref;
  if (!ref) return;
  const key = modalKeys.find((k) => k.ref === ref);
  if (!key) return;

  if (e.target.classList.contains('sfk-edit-btn')) {
    key._editing = true;
    renderModalKeys();
    return;
  }

  if (e.target.classList.contains('sfk-cancel-edit-btn')) {
    key._editing = false;
    renderModalKeys();
    return;
  }

  if (e.target.classList.contains('sfk-save-btn')) {
    sfkError.textContent = '';
    const row = e.target.closest('.sfk-key-row');
    const newName = row.querySelector('.sfk-edit-name').value.trim();
    const newYoutube = row.querySelector('.sfk-edit-youtube').value.trim();
    const newChart = row.querySelector('.sfk-edit-chart').value.trim();

    if (!newName) { sfkError.textContent = 'Key name is required.'; return; }

    if (editingSongId && key.dbId) {
      const { error } = await supabaseClient.from('song_keys').update({
        song_key: newName,
        youtube_link: newYoutube || null,
        chord_chart_link: newChart || null
      }).eq('id', key.dbId);
      if (error) { sfkError.textContent = 'Could not update key. ' + error.message; return; }
    }

    key.name = newName;
    key.youtube = newYoutube;
    key.chart = newChart;
    key._editing = false;
    renderModalKeys();
    return;
  }

  if (e.target.classList.contains('sfk-remove-btn')) {
    if (key.dbId) {
      const confirmed = confirm('Remove this key? Past services using it will show no key.');
      if (!confirmed) return;
      const { error } = await supabaseClient.from('song_keys').delete().eq('id', key.dbId);
      if (error) { sfkError.textContent = 'Could not remove key. ' + error.message; return; }
    }

    modalKeys = modalKeys.filter((k) => k.ref !== ref);
    renderModalKeys();
  }

  if (e.target.classList.contains('sfk-default-btn')) {
    if (editingSongId && key.dbId) {
      await supabaseClient.from('song_keys').update({ is_default: false })
        .eq('song_id', editingSongId).eq('is_default', true);
      await supabaseClient.from('song_keys').update({ is_default: true }).eq('id', key.dbId);
    }

    modalKeys.forEach((k) => (k.isDefault = false));
    key.isDefault = true;
    renderModalKeys();
  }
});
