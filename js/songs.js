const songForm = document.getElementById('song-form');
const songIdField = document.getElementById('song-id');
const songTitleField = document.getElementById('song-title');
const songArtistField = document.getElementById('song-artist');
const songKeyField = document.getElementById('song-key');
const songBpmField = document.getElementById('song-bpm');
const songYoutubeField = document.getElementById('song-youtube');
const songChartField = document.getElementById('song-chart');
const songTagsField = document.getElementById('song-tags');
const songLastPlayedField = document.getElementById('song-last-played');
const songNotesField = document.getElementById('song-notes');
const songSubmitBtn = document.getElementById('song-submit-btn');
const songCancelBtn = document.getElementById('song-cancel-btn');
const songError = document.getElementById('song-error');
const songSearch = document.getElementById('song-search');
const songsTbody = document.getElementById('songs-tbody');

let allSongs = [];

function resetSongForm() {
  songForm.reset();
  songIdField.value = '';
  songSubmitBtn.textContent = 'Add Song';
  songCancelBtn.classList.add('hidden');
  songError.textContent = '';
}

async function loadSongs() {
  const { data, error } = await supabaseClient
    .from('songs')
    .select('*')
    .order('title', { ascending: true });

  if (error) {
    console.error('Error loading songs:', error);
    return;
  }

  allSongs = data;
  renderSongs(allSongs);
}

function renderSongs(songs) {
  songsTbody.innerHTML = '';

  songs.forEach((song) => {
    const row = document.createElement('tr');

    const links = [
      song.youtube_link ? `<a href="${song.youtube_link}" target="_blank">YouTube</a>` : '',
      song.chord_chart_link ? `<a href="${song.chord_chart_link}" target="_blank">Chart</a>` : ''
    ].filter(Boolean).join(' / ');

    row.innerHTML = `
      <td>${song.title}</td>
      <td>${song.artist || ''}</td>
      <td>${song.song_key || ''}</td>
      <td>${song.bpm || ''}</td>
      <td>${links}</td>
      <td>${(song.tags || []).join(', ')}</td>
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

songForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  songError.textContent = '';

  const tags = songTagsField.value
    ? songTagsField.value.split(',').map((t) => t.trim()).filter(Boolean)
    : null;

  const songData = {
    title: songTitleField.value,
    artist: songArtistField.value || null,
    song_key: songKeyField.value || null,
    bpm: songBpmField.value ? parseInt(songBpmField.value, 10) : null,
    youtube_link: songYoutubeField.value || null,
    chord_chart_link: songChartField.value || null,
    tags,
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
    songKeyField.value = song.song_key || '';
    songBpmField.value = song.bpm || '';
    songYoutubeField.value = song.youtube_link || '';
    songChartField.value = song.chord_chart_link || '';
    songTagsField.value = (song.tags || []).join(', ');
    songLastPlayedField.value = song.last_played_date || '';
    songNotesField.value = song.notes || '';

    songSubmitBtn.textContent = 'Update Song';
    songCancelBtn.classList.remove('hidden');
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
});

songSearch.addEventListener('input', () => {
  const term = songSearch.value.toLowerCase();
  const filtered = allSongs.filter((song) =>
    song.title.toLowerCase().includes(term) ||
    (song.artist || '').toLowerCase().includes(term) ||
    (song.tags || []).join(' ').toLowerCase().includes(term)
  );
  renderSongs(filtered);
});
