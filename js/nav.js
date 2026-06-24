const allNavBtns = document.querySelectorAll('.nav-btn, .mobile-nav-btn');
const appSections = document.querySelectorAll('.app-section');

function showSection(sectionId) {
  appSections.forEach((section) => section.classList.add('hidden'));
  allNavBtns.forEach((btn) => btn.classList.remove('active'));

  document.getElementById(sectionId).classList.remove('hidden');
  allNavBtns.forEach((btn) => {
    if (btn.dataset.section === sectionId) btn.classList.add('active');
  });
}

allNavBtns.forEach((btn) => {
  btn.addEventListener('click', () => showSection(btn.dataset.section));
});
