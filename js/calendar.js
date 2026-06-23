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

function resetServiceForm() {
  serviceForm.reset();
  serviceIdField.value = '';
  serviceSubmitBtn.textContent = 'Add Service';
  serviceCancelBtn.classList.add('hidden');
  serviceError.textContent = '';
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
