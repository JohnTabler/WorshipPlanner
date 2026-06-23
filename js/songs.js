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

const songKeysSelect = document.getElementById('song-keys-select');
const songKeysContent = document.getElementById('song-keys-content');
const songKeyForm = document.getElementById('song-key-form');
const songKeyNameField = document.getElementById('song-key-name');
const songKeyYoutubeField = document.getElementById('song-key-youtube');
const songKeyChartField = document.getElementById('song-key-chart');
const songKeyDefaultField = document.getElementById('song-key-default');
const songKeyError = document.getElementById('song-key-error');
const songKeysTbody = document.getElementById('song-keys-tbody');

let allSongs = [];
let currentSongKeysSongId = '';
let currentSongKeys = [];
let energySortDirection = null; // null | 'asc' | 'desc'

function resetSongForm() {
  songForm.reset();
  songIdField.value = '';
  songSubmitBtn.textContent = 'Add Song';
  songCancelBtn.classList.add('hidden');
  songError.textContent = '';
  songForm.classList.add('hidden');
}

addSongBtn.addEventListener('click', () => {
  resetSongForm();
  songForm.classList.remove('hidden');
  songForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

async function loadSongs() {
  // song_keys embedded so the main table can show each song's default key/links
  const { data, error } = await supabaseClient
    .from('songs')
    .select('*, song_keys(*)')
    .order('title', { ascending: true });

  if (error) {
    console.error('Error loading songs:', error);
    return;
  }

  allSongs = data;
  renderSongs(getFilteredSongs());
  populateSongKeysDropdown();
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
  if (energyValue) {
    filtered = filtered.filter((song) => song.energy === energyValue);
  }

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
        <button class="manage-keys-btn" data-id="${song.id}">Keys</button>
      </td>
    `;

    songsTbody.appendChild(row);
  });
}

function findSongById(id) {
  return allSongs.find((s) => s.id === id);
}

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

  const editingId = songIdField.value;

  const { error } = editingId
    ? await supabaseClient.from('songs').update(songData).eq('id', editingId)
    : await supabaseClient.from('songs').insert(songData);

  if (error) {
    songError.textContent = 'Could not save song. ' + error.message;
    return;
  }

  resetSongForm();
  loadSongs();
});

songCancelBtn.addEventListener('click', resetSongForm);

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
    songForm.classList.remove('hidden');
    songForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (e.target.classList.contains('delete-btn')) {
    const confirmed = confirm('Delete this song? This cannot be undone.');
    if (!confirmed) return;

    const { error } = await supabaseClient.from('songs').delete().eq('id', id);
    if (error) {
      alert('Could not delete song: ' + error.message);
      return;
    }
    loadSongs();
  }

  if (e.target.classList.contains('manage-keys-btn')) {
    songKeysSelect.value = id;
    songKeysSelect.dispatchEvent(new Event('change'));
    songKeysSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

songSearch.addEventListener('input', () => renderSongs(getFilteredSongs()));
songEnergyFilter.addEventListener('change', () => renderSongs(getFilteredSongs()));

songsEnergyHeader.addEventListener('click', () => {
  energySortDirection = energySortDirection === 'desc' ? 'asc' : 'desc';
  renderSongs(getFilteredSongs());
});

// ---- Manage Song Keys ----

function populateSongKeysDropdown() {
  const previousValue = songKeysSelect.value;
  songKeysSelect.innerHTML = '<option value="">Select a song</option>' +
    allSongs.map((s) => `<option value="${s.id}">${s.title}</option>`).join('');
  songKeysSelect.value = previousValue;
}

songKeysSelect.addEventListener('change', async () => {
  currentSongKeysSongId = songKeysSelect.value;

  if (!currentSongKeysSongId) {
    songKeysContent.classList.add('hidden');
    return;
  }

  songKeysContent.classList.remove('hidden');
  await loadSongKeys();
});

async function loadSongKeys() {
  const { data, error } = await supabaseClient
    .from('song_keys')
    .select('*')
    .eq('song_id', currentSongKeysSongId)
    .order('song_key', { ascending: true });

  if (error) {
    console.error('Error loading song keys:', error);
    return;
  }

  currentSongKeys = data;
  renderSongKeys();
}

function renderSongKeys() {
  songKeysTbody.innerHTML = '';

  currentSongKeys.forEach((k) => {
    const links = [
      k.youtube_link ? `<a href="${k.youtube_link}" target="_blank">YouTube</a>` : '',
      k.chord_chart_link ? `<a href="${k.chord_chart_link}" target="_blank">Chart</a>` : ''
    ].filter(Boolean).join(' / ');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${k.song_key}</td>
      <td>${k.is_default ? '★ Default' : ''}</td>
      <td>${links}</td>
      <td>
        ${k.is_default ? '' : `<button class="make-default-key-btn" data-id="${k.id}">Make Default</button>`}
        <button class="remove-key-btn" data-id="${k.id}">Remove</button>
      </td>
    `;
    songKeysTbody.appendChild(tr);
  });
}

songKeyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  songKeyError.textContent = '';

  const keyName = songKeyNameField.value.trim();
  if (!keyName) {
    songKeyError.textContent = 'Please enter a key.';
    return;
  }

  // First key for a song always becomes the default, even if the box isn't checked
  const makeDefault = songKeyDefaultField.checked || currentSongKeys.length === 0;

  if (makeDefault) {
    await supabaseClient
      .from('song_keys')
      .update({ is_default: false })
      .eq('song_id', currentSongKeysSongId)
      .eq('is_default', true);
  }

  const { error } = await supabaseClient.from('song_keys').insert({
    song_id: currentSongKeysSongId,
    song_key: keyName,
    youtube_link: songKeyYoutubeField.value || null,
    chord_chart_link: songKeyChartField.value || null,
    is_default: makeDefault
  });

  if (error) {
    songKeyError.textContent = 'Could not add key. ' + error.message;
    return;
  }

  songKeyForm.reset();
  await loadSongKeys();
  loadSongs();
});

songKeysTbody.addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.classList.contains('make-default-key-btn')) {
    await supabaseClient
      .from('song_keys')
      .update({ is_default: false })
      .eq('song_id', currentSongKeysSongId)
      .eq('is_default', true);
    await supabaseClient.from('song_keys').update({ is_default: true }).eq('id', id);
    await loadSongKeys();
    loadSongs();
  }

  if (e.target.classList.contains('remove-key-btn')) {
    const confirmed = confirm('Remove this key? Past services that used it will show a blank key going forward.');
    if (!confirmed) return;

    const { error } = await supabaseClient.from('song_keys').delete().eq('id', id);
    if (error) {
      alert('Could not remove: ' + error.message);
      return;
    }
    await loadSongKeys();
    loadSongs();
  }
});
