// State → City/District selector used by signup.html and edit-user.html.
// Reads /india-districts.json ({ "UP": ["Agra", ...], ... }) and fills the district list for the chosen state.
(function () {
  let cache = null;
  async function loadDistricts() {
    if (cache) return cache;
    const r = await fetch('/india-districts.json');
    if (!r.ok) throw new Error('districts');
    cache = await r.json();
    return cache;
  }
  // opts: { state: <select>, city: <select name="city">, other: <input name="city_other">, initialCity?: string }
  async function initStateDistrict(opts) {
    const { state, city, other } = opts;
    if (!state || !city) return;
    let data = {};
    try { data = await loadDistricts(); } catch (e) { /* only the "not listed" option will be offered */ }
    const otherWrap = (other && other.closest('[data-city-other]')) || other;
    function showOther(on) {
      if (!other) return;
      otherWrap.hidden = !on;
      other.required = on;
      if (!on) other.value = '';
    }
    function fill(code, selected) {
      city.innerHTML = '';
      if (!code) {
        const ph = new Option('Select state first', '', true, true); ph.disabled = true;
        city.add(ph); city.disabled = true; showOther(false); return;
      }
      city.disabled = false;
      const ph = new Option('Select city / district', '', true, true); ph.disabled = true;
      city.add(ph);
      const list = data[code] || [];
      list.forEach(d => city.add(new Option(d, d)));
      city.add(new Option('Other — my city / district is not listed', '__other__'));
      showOther(false);
      if (selected) {
        if (list.includes(selected)) city.value = selected;
        else { city.value = '__other__'; showOther(true); if (other) other.value = selected; }
      }
    }
    state.addEventListener('change', () => fill(state.value, ''));
    city.addEventListener('change', () => { showOther(city.value === '__other__'); if (city.value === '__other__' && other) other.focus(); });
    fill(state.value, opts.initialCity || '');
    // Lets edit-user.html set state + city after it loads the saved account.
    return { set(code, savedCity) { state.value = code || ''; fill(state.value, savedCity || ''); } };
  }
  window.initStateDistrict = initStateDistrict;
})();
