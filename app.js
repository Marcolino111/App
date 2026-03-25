document.addEventListener('DOMContentLoaded', () => {

    // ── Supabase ──
    const supabaseUrl = 'https://vjovnchdscshbubaufzm.supabase.co';
    const supabaseKey = 'sb_publishable_Sea3qVSBc2eI1TBZp--k8w_snIYm8tw';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);


    // ── DOM ──
    const authView       = document.getElementById('auth-view');
    const dashboardView  = document.getElementById('dashboard-view');
    const authTitle      = document.getElementById('auth-title');
    const authSubtitle   = document.getElementById('auth-subtitle');
    const authForm       = document.getElementById('auth-form');
    const emailInput     = document.getElementById('email');
    const passwordInput  = document.getElementById('password');
    const authBtn        = document.getElementById('auth-btn');
    const authError      = document.getElementById('auth-error');
    const authToggleText = document.getElementById('auth-toggle-text');

    const userDisplay       = document.getElementById('user-display');
    const logoutBtn         = document.getElementById('logout-btn');
    const cityTabs          = document.getElementById('city-tabs');
    const addCityBtn        = document.getElementById('add-city-btn');
    const addCityOverlay    = document.getElementById('add-city-overlay');
    const addCityForm       = document.getElementById('add-city-form');
    const cityInput         = document.getElementById('city-input');
    const cityError         = document.getElementById('city-error');
    const cancelAddBtn      = document.getElementById('cancel-add-btn');
    const addCitySubmit     = document.getElementById('add-city-submit');

    const emptyState        = document.getElementById('empty-state');
    const weatherLoading    = document.getElementById('weather-loading');
    const weatherContent    = document.getElementById('weather-content');
    const currentIcon       = document.getElementById('current-icon');
    const currentTemp       = document.getElementById('current-temp');
    const currentDesc       = document.getElementById('current-desc');
    const currentInfo       = document.getElementById('current-info');
    const deleteCityBtn     = document.getElementById('delete-city-btn');
    const forecastContainer = document.getElementById('forecast-container');

    // ── State ──
    let isLoginMode  = true;
    let currentUser  = null;
    let cities       = [];
    let activeCityId = null;

    // ── Auth ──
    checkAuthStatus();

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            showDashboard(currentUser.email);
            loadCities();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            cities = [];
            activeCityId = null;
            showAuth();
        }
    });

    async function checkAuthStatus() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            currentUser = session.user;
            showDashboard(currentUser.email);
            loadCities();
        } else {
            showAuth();
        }
    }

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email    = emailInput.value.trim();
        const password = passwordInput.value;
        authBtn.disabled = true;
        authBtn.textContent = 'Attendi...';
        clearMsg(authError);

        try {
            if (isLoginMode) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { emailRedirectTo: 'https://weatherappnew11.netlify.app' }
                });
                if (error) throw error;
                showMsg(authError, 'Controlla la tua email per il link di conferma!', 'success-msg');
            }
        } catch (err) {
            let msg = err.message;
            if (msg === 'Invalid login credentials') msg = 'Email o password errati.';
            if (msg === 'Email not confirmed') msg = 'Conferma prima la tua email!';
            showMsg(authError, msg, 'error-msg');
        } finally {
            authBtn.disabled = false;
            authBtn.textContent = isLoginMode ? 'Accedi' : 'Registrati';
        }
    });

    logoutBtn.addEventListener('click', () => supabase.auth.signOut());

    // Toggle auth mode
    function updateAuthMode() {
        authForm.reset();
        clearMsg(authError);
        if (isLoginMode) {
            authTitle.textContent = 'Bentornato';
            authSubtitle.textContent = 'Accedi per gestire le tue città del meteo';
            authBtn.textContent = 'Accedi';
            authToggleText.innerHTML = 'Non hai un account? <a href="#" id="toggle-auth-link" onclick="window.toggleAuthMode(event)">Registrati</a>';
        } else {
            authTitle.textContent = 'Nuovo Account';
            authSubtitle.textContent = 'Registrati per salvare le tue città';
            authBtn.textContent = 'Registrati';
            authToggleText.innerHTML = 'Hai già un account? <a href="#" id="toggle-auth-link" onclick="window.toggleAuthMode(event)">Accedi</a>';
        }
    }

    window.toggleAuthMode = function (e) {
        if (e) e.preventDefault();
        isLoginMode = !isLoginMode;
        updateAuthMode();
    };

    // ── Cities ──
    async function loadCities() {
        if (!currentUser) return;
        try {
            const { data, error } = await supabase
                .from('favorite_cities')
                .select('*')
                .order('id', { ascending: true });
            if (error) throw error;
            cities = data || [];
            renderTabs();
            if (cities.length === 0) {
                showEmpty();
            } else {
                const target = activeCityId ? cities.find(c => c.id === activeCityId) : null;
                const city   = target || cities[0];
                selectCity(city.id, city.city_name);
            }
        } catch (err) {
            console.error('loadCities error:', err);
        }
    }

    function renderTabs() {
        cityTabs.innerHTML = '';
        cities.forEach(city => {
            const btn = document.createElement('button');
            btn.className = 'city-tab' + (city.id === activeCityId ? ' active' : '');
            btn.textContent = city.city_name;
            btn.onclick = () => selectCity(city.id, city.city_name);
            cityTabs.appendChild(btn);
        });
    }

    async function selectCity(id, name) {
        activeCityId = id;
        renderTabs();
        showLoading();
        await fetchAndDisplay(name);
    }

    // Add city
    addCityBtn.addEventListener('click', () => {
        addCityOverlay.classList.remove('hidden');
        setTimeout(() => cityInput.focus(), 50);
    });

    cancelAddBtn.addEventListener('click', closeModal);
    addCityOverlay.addEventListener('click', e => { if (e.target === addCityOverlay) closeModal(); });

    function closeModal() {
        addCityOverlay.classList.add('hidden');
        addCityForm.reset();
        clearMsg(cityError);
    }

    addCityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = cityInput.value.trim();
        if (!name || !currentUser) return;
        addCitySubmit.disabled = true;
        clearMsg(cityError);

        try {
            // Verify city exists in OWM
            const res = await fetch(
                `/.netlify/functions/weather?city=${encodeURIComponent(name)}&type=weather`
            );
            if (!res.ok) throw new Error(`Città "${name}" non trovata.`);
            const owmData = await res.json();
            const cityName = owmData.name;

            const { error } = await supabase
                .from('favorite_cities')
                .insert([{ user_id: currentUser.id, city_name: cityName }]);
            if (error) {
                if (error.code === '23505') throw new Error('Hai già salvato questa città!');
                throw error;
            }
            closeModal();
            await loadCities();
        } catch (err) {
            showMsg(cityError, err.message, 'error-msg');
        } finally {
            addCitySubmit.disabled = false;
        }
    });

    // Delete city
    deleteCityBtn.addEventListener('click', async () => {
        if (!activeCityId) return;
        try {
            const { error } = await supabase
                .from('favorite_cities')
                .delete()
                .eq('id', activeCityId);
            if (error) throw error;
            activeCityId = null;
            await loadCities();
        } catch (err) {
            console.error('delete error:', err);
        }
    });

    // ── Weather ──
    async function fetchAndDisplay(cityName) {
        try {
            const [curRes, fcRes] = await Promise.all([
                fetch(`/.netlify/functions/weather?city=${encodeURIComponent(cityName)}&type=weather`),
                fetch(`/.netlify/functions/weather?city=${encodeURIComponent(cityName)}&type=forecast`)
            ]);
            if (!curRes.ok) throw new Error('Meteo non disponibile');
            const cur = await curRes.json();
            const fc  = await fcRes.json();

            renderCurrent(cur);
            renderForecast(fc.list);
            showWeather();
        } catch (err) {
            console.error('weather error:', err);
            showEmpty();
        }
    }

    function renderCurrent(data) {
        currentTemp.textContent = Math.round(data.main.temp) + '°C';
        currentDesc.textContent = data.weather[0].description;
        const windKph = Math.round(data.wind.speed * 3.6);
        currentInfo.textContent = `Vento ${windKph} km/h • Umidità ${data.main.humidity}%`;
        currentIcon.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
        currentIcon.alt = data.weather[0].description;
    }

    function renderForecast(list) {
        const days = processForecast(list);

        // Normalise bars to global temp range
        const allTemps  = days.flatMap(d => [d.minTemp, d.maxTemp]);
        const globalMin = Math.min(...allTemps);
        const globalMax = Math.max(...allTemps);
        const range     = globalMax - globalMin || 1;

        const dayNames = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
        forecastContainer.innerHTML = '';

        days.forEach((day, i) => {
            const date    = day.date;
            const dayName = i === 0 ? 'Oggi' : dayNames[date.getDay()];
            const dateStr = `${date.getDate()}/${date.getMonth()+1}/${String(date.getFullYear()).slice(2)}`;

            const maxW = Math.round((day.maxTemp - globalMin) / range * 80 + 20);
            const minW = Math.round((day.minTemp - globalMin) / range * 80 + 20);

            const rainLabel = day.rain > 0 ? `${day.rain.toFixed(1)} mm` : '–';
            const rainClass = day.rain > 20 ? 'stat-rain-heavy' : '';
            const windKph   = Math.round(day.wind * 3.6);
            const arrow     = windArrow(day.windDeg);

            const row = document.createElement('div');
            row.className = 'forecast-row';
            row.innerHTML = `
                <div>
                    <div class="day-name">${dayName}</div>
                    <div class="day-date">${dateStr}</div>
                </div>
                <img class="forecast-icon" src="https://openweathermap.org/img/wn/${day.icon}@2x.png" alt="">
                <div class="temp-bars">
                    <div class="temp-bar-row">
                        <span class="temp-val">${day.maxTemp}°</span>
                        <div class="bar-track"><div class="bar-fill" style="width:${maxW}%;background:${tempColor(day.maxTemp)}"></div></div>
                    </div>
                    <div class="temp-bar-row">
                        <span class="temp-val min">${day.minTemp}°</span>
                        <div class="bar-track"><div class="bar-fill" style="width:${minW}%;background:${tempColor(day.minTemp)}"></div></div>
                    </div>
                </div>
                <div class="forecast-stats">
                    <div class="stat-row"><span class="stat-icon">💧</span><span class="${rainClass}">${rainLabel}</span></div>
                    <div class="stat-row"><span class="stat-icon">☀️</span><span>${day.sunH} h</span></div>
                    <div class="stat-row"><span class="stat-icon">${arrow}</span><span>${windKph} km/h</span></div>
                </div>`;
            forecastContainer.appendChild(row);
        });
    }

    function processForecast(list) {
        const map = {};
        list.forEach(item => {
            const d    = new Date(item.dt * 1000);
            const key  = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!map[key]) map[key] = { date: d, temps: [], icons: {}, rain: 0, winds: [], windDegs: [], clear: 0 };
            const o = map[key];
            o.temps.push(item.main.temp);
            const ic = item.weather[0].icon.replace('n', 'd');
            o.icons[ic] = (o.icons[ic] || 0) + 1;
            o.rain    += (item.rain?.['3h'] || 0) + (item.snow?.['3h'] || 0);
            o.winds.push(item.wind.speed);
            o.windDegs.push(item.wind.deg || 0);
            if (item.clouds.all < 40) o.clear += 3;
        });

        return Object.values(map).slice(0, 7).map(o => ({
            date:    o.date,
            maxTemp: Math.round(Math.max(...o.temps)),
            minTemp: Math.round(Math.min(...o.temps)),
            icon:    Object.entries(o.icons).sort((a,b) => b[1]-a[1])[0][0],
            rain:    Math.round(o.rain * 10) / 10,
            wind:    o.winds.reduce((a,b)=>a+b,0) / o.winds.length,
            windDeg: o.windDegs.reduce((a,b)=>a+b,0) / o.windDegs.length,
            sunH:    Math.min(o.clear, 14),
        }));
    }

    function tempColor(t) {
        if (t >= 35) return 'linear-gradient(to right,#b71c1c,#e53935)';
        if (t >= 30) return 'linear-gradient(to right,#e64a19,#ff7043)';
        if (t >= 25) return 'linear-gradient(to right,#f57c00,#ffb300)';
        if (t >= 20) return 'linear-gradient(to right,#f9a825,#ffee58)';
        if (t >= 15) return 'linear-gradient(to right,#7cb342,#c5e1a5)';
        if (t >= 10) return 'linear-gradient(to right,#00897b,#80cbc4)';
        if (t >= 5)  return 'linear-gradient(to right,#0288d1,#81d4fa)';
        return 'linear-gradient(to right,#1565c0,#64b5f6)';
    }

    function windArrow(deg) {
        const a = ['↓','↙','←','↖','↑','↗','→','↘'];
        return a[Math.round(deg / 45) % 8];
    }

    // ── UI helpers ──
    function showAuth() {
        authView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
        authForm.reset();
        clearMsg(authError);
    }

    function showDashboard(email) {
        userDisplay.textContent = email;
        authView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
    }

    function showLoading() {
        emptyState.classList.add('hidden');
        weatherLoading.classList.remove('hidden');
        weatherContent.classList.add('hidden');
    }

    function showWeather() {
        emptyState.classList.add('hidden');
        weatherLoading.classList.add('hidden');
        weatherContent.classList.remove('hidden');
    }

    function showEmpty() {
        emptyState.classList.remove('hidden');
        weatherLoading.classList.add('hidden');
        weatherContent.classList.add('hidden');
    }

    function showMsg(el, text, cls) {
        el.textContent = text;
        el.className = cls;
    }

    function clearMsg(el) {
        el.textContent = '';
        el.className = 'hidden';
    }
});

