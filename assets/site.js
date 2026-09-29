const form = document.querySelector('#project-search');
const search = document.querySelector('#search');
const filters = [...document.querySelectorAll('[data-filter]')];
const cards = [...document.querySelectorAll('.project-card')];
const count = document.querySelector('#result-count');
const empty = document.querySelector('#empty-state');
const sort = document.querySelector('#sort');
const grid = document.querySelector('#project-grid');
let category = 'All projects';

function applyFilters() {
  const words = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  let visible = 0;
  cards.forEach(card => {
    const matches = (category === 'All projects' || card.dataset.category === category)
      && words.every(word => card.dataset.search.includes(word));
    card.hidden = !matches;
    if (matches) visible++;
  });
  filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
  count.textContent = `${visible} of ${cards.length} projects`;
  empty.hidden = visible !== 0;
  const query = new URLSearchParams();
  if (search.value.trim()) query.set('q', search.value.trim());
  if (category !== 'All projects') query.set('category', category);
  if (sort.value !== 'featured') query.set('sort', sort.value);
  history.replaceState(null, '', `${location.pathname}${query.size ? '?' + query : ''}${location.hash}`);
}
function applySort() {
  const ordered = [...cards].sort((a, b) => sort.value === 'az'
    ? a.dataset.name.localeCompare(b.dataset.name)
    : Number(a.dataset.order) - Number(b.dataset.order));
  ordered.forEach(card => grid.append(card));
}
function restore() {
  const query = new URLSearchParams(location.search);
  search.value = query.get('q') || '';
  category = filters.some(button => button.dataset.filter === query.get('category')) ? query.get('category') : 'All projects';
  sort.value = query.get('sort') === 'az' ? 'az' : 'featured';
  applySort();
  applyFilters();
}
form.addEventListener('submit', event => { event.preventDefault(); applyFilters(); });
search.addEventListener('input', applyFilters);
filters.forEach(button => button.addEventListener('click', () => { category = button.dataset.filter; applyFilters(); }));
sort.addEventListener('change', () => { applySort(); applyFilters(); });
document.querySelector('#clear-filters').addEventListener('click', () => {
  search.value = ''; category = 'All projects'; applyFilters(); search.focus();
});
window.addEventListener('popstate', restore);
restore();
document.querySelector('#directory-controls').hidden = false;
