const navButtons = document.querySelectorAll('.nav-btn');
const appSections = document.querySelectorAll('.app-section');

function showSection(sectionId) {
  appSections.forEach((section) => section.classList.add('hidden'));
  navButtons.forEach((btn) => btn.classList.remove('active'));

  document.getElementById(sectionId).classList.remove('hidden');
  document.querySelector(`.nav-btn[data-section="${sectionId}"]`).classList.add('active');
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => showSection(btn.dataset.section));
});
