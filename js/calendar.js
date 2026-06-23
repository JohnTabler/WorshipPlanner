const serviceForm = document.getElementById('service-form');
const serviceIdField = document.getElementById('service-id');
const serviceDateField = document.getElementById('service-date');
const serviceTitleField = document.getElementById('service-title');
const serviceTypeField = document.getElementById('service-type');
const serviceNotesField = document.getElementById('service-notes');
const serviceSubmitBtn = document.getElementById('service-submit-btn');
const serviceCancelBtn = document.getElementById('service-cancel-btn');
const serviceError = document.getElementById('service-error');
const servicesTbody = document.getElementById('services-tbody');
const serviceSearch = document.getElementById('service-search');

let allServices = [];

// How many upcoming Sundays to keep auto-populated
const SUNDAY_LOOKAHEAD_COUNT = 8;

function resetServiceForm() {
  serviceForm.reset();
  serviceIdField.value = '';
  serviceSubmitBtn.textContent = 'Add Service';
  serviceCancelBtn.classList.add('hidden');
  serviceError.textContent = '';
}

// ---- Local-time date helpers ----
// Deliberately avoid toISOString() here: it converts to UTC and can shift
// the calendar date by a day depending on the browser's timezone offset.
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getNextSundayOnOrAfter(date) {
  const result = new Date(date);
  const day = result.getDay(); // 0 = Sunday
  const diff = (7 - day) % 7;
  result.setDate(result.getDate() + diff);
  return result;
}

function formatLocalISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNthSundayLabel(date) {
  const nth = Math.ceil(date.getDate() / 7);
  const labels = ['1st Sunday', '2nd Sunday', '3rd Sunday', '4th Sunday', '5th Sunday'];
  return labels[nth - 1] || `${nth}th Sunday`;
}

// Ensures the next SUNDAY_LOOKAHEAD_COUNT Sundays exist as services.
// Never overwrites an existing row for a date that's already there - so a
// Sunday you've renamed to "Easter" or "Christmas Eve" is never touched.
async function ensureUpcomingSundaysExist() {
  const cursor = getNextSundayOnOrAfter(startOfToday());
  const existingDates = new Set(allServices.map((s) => s.service_date));
  const missing = [];

  for (let i = 0; i < SUNDAY_LOOKAHEAD_COUNT; i++) {
    const isoDate = formatLocalISODate(cursor);
    if (!existingDates.has(isoDate)) {
      missing.push({
        service_date: isoDate,
        title: getNthSundayLabel(cursor),
        service_type: 'regular'
      });
    }
    cursor.setDate(cursor.getDate() + 7);
  }

  if (missing.length === 0) return;

  const { data, error } = await supabaseClient.from('services').insert(missing).select();
  if (error) {
    console.error('Error auto-creating upcoming Sundays:', error);
    return;
  }

  allServices = [...allServices, ...data].sort((a, b) => a.service_date.localeCompare(b.service_date));
}

async function loadServices() {
  const { data, error } = await supabaseClient
    .from('services')
    .select('*')
    .order('service_date', { ascending: true });

  if (error) {
    console.error('Error loading services:', error);
    return;
  }

  allServices = data;

  await ensureUpcomingSundaysExist();

  renderServices(allServices);
  if (typeof populateServiceDropdown === 'function') populateServiceDropdown();
  if (typeof populateEmailServiceDropdown === 'function') populateEmailServiceDropdown();
}

function renderServices(services) {
  servicesTbody.innerHTML = '';

  services.forEach((s) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${s.service_date}</td>
      <td>${s.title || ''}</td>
      <td>${s.service_type}</td>
      <td>${s.notes || ''}</td>
      <td>
        <button class="edit-service-btn" data-id="${s.id}">Edit</button>
        <button class="delete-service-btn" data-id="${s.id}">Delete</button>
      </td>
    `;
    servicesTbody.appendChild(row);
  });
}

function findServiceById(id) {
  return allServices.find((s) => s.id === id);
}

serviceSearch.addEventListener('input', () => {
  const term = serviceSearch.value.toLowerCase();
  const filtered = allServices.filter((s) =>
    s.service_date.includes(term) ||
    (s.title || '').toLowerCase().includes(term) ||
    s.service_type.toLowerCase().includes(term)
  );
  renderServices(filtered);
});

serviceForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  serviceError.textContent = '';

  const serviceData = {
    service_date: serviceDateField.value,
    title: serviceTitleField.value || null,
    service_type: serviceTypeField.value,
    notes: serviceNotesField.value || null
  };

  const editingId = serviceIdField.value;

  const { error } = editingId
    ? await supabaseClient.from('services').update(serviceData).eq('id', editingId)
    : await supabaseClient.from('services').insert(serviceData);

  if (error) {
    serviceError.textContent = 'Could not save service. ' + error.message;
    return;
  }

  resetServiceForm();
  loadServices();
});

serviceCancelBtn.addEventListener('click', resetServiceForm);

servicesTbody.addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.classList.contains('edit-service-btn')) {
    const service = findServiceById(id);
    if (!service) return;

    serviceIdField.value = service.id;
    serviceDateField.value = service.service_date;
    serviceTitleField.value = service.title || '';
    serviceTypeField.value = service.service_type;
    serviceNotesField.value = service.notes || '';

    serviceSubmitBtn.textContent = 'Update Service';
    serviceCancelBtn.classList.remove('hidden');
  }

  if (e.target.classList.contains('delete-service-btn')) {
    const confirmed = confirm('Delete this service? This also removes its song list and assignments.');
    if (!confirmed) return;

    const { error } = await supabaseClient.from('services').delete().eq('id', id);
    if (error) {
      alert('Could not delete service: ' + error.message);
      return;
    }
    loadServices();
  }
});
