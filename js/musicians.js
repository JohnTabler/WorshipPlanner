const musicianForm = document.getElementById('musician-form');
const musicianIdField = document.getElementById('musician-id');
const musicianNameField = document.getElementById('musician-name');
const musicianEmailField = document.getElementById('musician-email');
const musicianPhoneField = document.getElementById('musician-phone');
const musicianInstrumentsField = document.getElementById('musician-instruments');
const musicianNotesField = document.getElementById('musician-notes');
const musicianSubmitBtn = document.getElementById('musician-submit-btn');
const musicianCancelBtn = document.getElementById('musician-cancel-btn');
const musicianError = document.getElementById('musician-error');
const addMusicianBtn = document.getElementById('add-musician-btn');
const musiciansTbody = document.getElementById('musicians-tbody');
const musicianSearch = document.getElementById('musician-search');

const unavailableForm = document.getElementById('unavailable-form');
const unavailableMusicianSelect = document.getElementById('unavailable-musician');
const unavailableDateField = document.getElementById('unavailable-date');
const unavailableReasonField = document.getElementById('unavailable-reason');
const unavailableError = document.getElementById('unavailable-error');
const unavailableTbody = document.getElementById('unavailable-tbody');

let allMusicians = [];

function resetMusicianForm() {
  musicianForm.reset();
  musicianIdField.value = '';
  musicianSubmitBtn.textContent = 'Add Musician';
  musicianCancelBtn.classList.add('hidden');
  musicianError.textContent = '';
  closeModal();
}

addMusicianBtn.addEventListener('click', () => {
  resetMusicianForm();
  musicianCancelBtn.classList.remove('hidden');
  openModal(musicianForm);
});

async function loadMusicians() {
  const { data, error } = await supabaseClient
    .from('musicians')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error loading musicians:', error);
    return;
  }

  allMusicians = data;
  renderMusicians(allMusicians);
  populateMusicianDropdown();
  if (typeof populateMusicianDropdownForOos === 'function') populateMusicianDropdownForOos();
}

function renderMusicians(musicians) {
  musiciansTbody.innerHTML = '';

  musicians.forEach((m) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${m.name}</td>
      <td>${(m.instruments || []).join(', ')}</td>
      <td>${m.email || ''}</td>
      <td>${m.phone || ''}</td>
      <td>
        <button class="edit-musician-btn" data-id="${m.id}">Edit</button>
        <button class="delete-musician-btn" data-id="${m.id}">Delete</button>
      </td>
    `;
    musiciansTbody.appendChild(row);
  });
}

function populateMusicianDropdown() {
  const previousValue = unavailableMusicianSelect.value;
  unavailableMusicianSelect.innerHTML = '<option value="">Select musician</option>' +
    allMusicians.map((m) => `<option value="${m.id}">${m.name}</option>`).join('');
  unavailableMusicianSelect.value = previousValue;
}

function findMusicianById(id) {
  return allMusicians.find((m) => m.id === id);
}

musicianSearch.addEventListener('input', () => {
  const term = musicianSearch.value.toLowerCase();
  const filtered = allMusicians.filter((m) =>
    m.name.toLowerCase().includes(term) ||
    (m.instruments || []).join(' ').toLowerCase().includes(term)
  );
  renderMusicians(filtered);
});

musicianForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  musicianError.textContent = '';

  const instruments = musicianInstrumentsField.value
    ? musicianInstrumentsField.value.split(',').map((t) => t.trim()).filter(Boolean)
    : null;

  const musicianData = {
    name: musicianNameField.value,
    email: musicianEmailField.value || null,
    phone: musicianPhoneField.value || null,
    instruments,
    skill_notes: musicianNotesField.value || null
  };

  const editingId = musicianIdField.value;

  const { error } = editingId
    ? await supabaseClient.from('musicians').update(musicianData).eq('id', editingId)
    : await supabaseClient.from('musicians').insert(musicianData);

  if (error) {
    musicianError.textContent = 'Could not save musician. ' + error.message;
    return;
  }

  resetMusicianForm();
  loadMusicians();
});

musicianCancelBtn.addEventListener('click', resetMusicianForm);

musiciansTbody.addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.classList.contains('edit-musician-btn')) {
    const musician = findMusicianById(id);
    if (!musician) return;

    musicianIdField.value = musician.id;
    musicianNameField.value = musician.name || '';
    musicianEmailField.value = musician.email || '';
    musicianPhoneField.value = musician.phone || '';
    musicianInstrumentsField.value = (musician.instruments || []).join(', ');
    musicianNotesField.value = musician.skill_notes || '';

    musicianSubmitBtn.textContent = 'Update Musician';
    musicianCancelBtn.classList.remove('hidden');
    openModal(musicianForm);
  }

  if (e.target.classList.contains('delete-musician-btn')) {
    const confirmed = confirm('Delete this musician? This also removes their unavailable dates.');
    if (!confirmed) return;

    const { error } = await supabaseClient.from('musicians').delete().eq('id', id);
    if (error) {
      alert('Could not delete musician: ' + error.message);
      return;
    }
    loadMusicians();
    loadUnavailableDates();
  }
});

async function loadUnavailableDates() {
  const { data, error } = await supabaseClient
    .from('musician_unavailable_dates')
    .select('*, musicians(name)')
    .order('unavailable_date', { ascending: true });

  if (error) {
    console.error('Error loading unavailable dates:', error);
    return;
  }

  renderUnavailableDates(data);
}

function renderUnavailableDates(dates) {
  unavailableTbody.innerHTML = '';

  dates.forEach((d) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${d.musicians ? d.musicians.name : ''}</td>
      <td>${d.unavailable_date}</td>
      <td>${d.reason || ''}</td>
      <td><button class="delete-unavailable-btn" data-id="${d.id}">Delete</button></td>
    `;
    unavailableTbody.appendChild(row);
  });
}

unavailableForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  unavailableError.textContent = '';

  const musicianId = unavailableMusicianSelect.value;
  if (!musicianId) {
    unavailableError.textContent = 'Please select a musician.';
    return;
  }

  const { error } = await supabaseClient.from('musician_unavailable_dates').insert({
    musician_id: musicianId,
    unavailable_date: unavailableDateField.value,
    reason: unavailableReasonField.value || null
  });

  if (error) {
    unavailableError.textContent = 'Could not save date. ' + error.message;
    return;
  }

  unavailableForm.reset();
  loadUnavailableDates();
});

unavailableTbody.addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  if (!id || !e.target.classList.contains('delete-unavailable-btn')) return;

  const confirmed = confirm('Delete this unavailable date?');
  if (!confirmed) return;

  const { error } = await supabaseClient.from('musician_unavailable_dates').delete().eq('id', id);
  if (error) {
    alert('Could not delete: ' + error.message);
    return;
  }
  loadUnavailableDates();
});
