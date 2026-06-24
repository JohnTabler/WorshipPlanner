const modalBackdrop = document.getElementById('modal-backdrop');
let _activeForm = null;

function openModal(formEl) {
  if (_activeForm) closeModal();
  _activeForm = formEl;
  formEl.classList.remove('hidden');
  formEl.classList.add('modal-active');
  modalBackdrop.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeModal() {
  if (_activeForm) {
    _activeForm.classList.remove('modal-active');
    _activeForm.classList.add('hidden');
    _activeForm = null;
  }
  modalBackdrop.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function _triggerCancel() {
  if (!_activeForm) return;
  const cancelBtn = _activeForm.querySelector('[id$="-cancel-btn"]');
  if (cancelBtn) cancelBtn.click();
  else closeModal();
}

// Clicking the dark backdrop closes the modal
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) _triggerCancel();
});

// Escape key closes the modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && _activeForm) _triggerCancel();
});

// × buttons inside forms close the modal
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-x-btn')) _triggerCancel();
});
