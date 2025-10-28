// script.js (ES module)
const API_KEY = "dee2812c42ec2e60212b12f4a3587230"; // <-- הכנס כאן את המפתח שלך
const BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";

const minSearchLen = 3;
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const results = document.getElementById("results");
const genreSelect = document.getElementById("genreSelect");
const yearInput = document.getElementById("yearInput");
const sortSelect = document.getElementById("sortSelect");
const applyFiltersBtn = document.getElementById("applyFiltersBtn");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const trendingBtn = document.getElementById("trendingBtn");

const favoritesPage = document.getElementById("favoritesPage");
const favoritesPageBtn = document.getElementById("favoritesPageBtn");
const favoritesList = document.getElementById("favoritesList");
const favSearch = document.getElementById("favSearch");
const clearAllFavs = document.getElementById("clearAllFavs");
const backToMain = document.getElementById("backToMain");

const movieModal = new bootstrap.Modal(document.getElementById("movieModal"));
const modalTitle = document.getElementById("modalTitle");
const modalBodyContent = document.getElementById("modalBodyContent");

let genresMap = {};
let favorites = loadFavorites();

// --- עזרי API ---
async function tmdb(path, params = {}) {
  const url = new URL(BASE + path);
  params.api_key = API_KEY;
  Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
  const res = await fetch(url);
  if (!res.ok) throw new Error("API error");
  return res.json();
}

// --- מטמון ז'אנרים (קורא פעם אחת) ---
async function loadGenres() {
  try {
    const data = await tmdb("/genre/movie/list", { language: "he-IL" });
    data.genres.forEach(g => genresMap[g.id] = g.name);
    populateGenreSelect();
  } catch (e) {
    console.error("Failed to load genres", e);
  }
}
function populateGenreSelect() {
  Object.entries(genresMap).forEach(([id,name])=>{
    const opt = document.createElement("option");
    opt.value = id; opt.textContent = name;
    genreSelect.appendChild(opt);
  });
}

// --- חיפוש סרטים (מינימום 3 תווים) ---
async function searchMovies(query, page=1, extraParams={}) {
  if (!query || query.length < minSearchLen) {
    results.innerHTML = `<p class="text-warning">הקלד לפחות ${minSearchLen} תווים לחיפוש.</p>`;
    return;
  }
  try {
    const data = await tmdb("/search/movie", { query, language:"he-IL", page, include_adult:false, ...extraParams });
    if (!data.results || data.results.length === 0) {
      results.innerHTML = `<p class="text-muted">לא נמצאו תוצאות ל־"${query}".</p>`;
      return;
    }
    renderMovies(data.results);
  } catch (e) {
    results.innerHTML = `<p class="text-danger">שגיאה בשרת: ${e.message}</p>`;
  }
}

// --- Render list ---
function renderMovies(list) {
  results.innerHTML = "";
  list.forEach(movie => {
    const col = document.createElement("div");
    col.className = "col-6 col-md-4 col-lg-3";
    const card = document.createElement("div");
    card.className = "card bg-secondary text-light movie-card h-100";
    const poster = movie.poster_path ? `<img src="${IMG_BASE+movie.poster_path}" class="card-img-top movie-poster" alt="${movie.title}">`
      : `<div class="poster-placeholder">No Image</div>`;
    const genres = (movie.genre_ids||[]).map(id=>genresMap[id]).filter(Boolean).slice(0,3).join(", ");
    card.innerHTML = `
      ${poster}
      <div class="card-body d-flex flex-column">
        <h5 class="card-title mb-1">${movie.title}</h5>
        <p class="mb-1 small">${movie.release_date ? movie.release_date.slice(0,4) : "—" } • ${movie.vote_average ?? "—"}⭐</p>
        <p class="text-truncate small mb-2">${genres}</p>
        <div class="mt-auto d-flex gap-2">
          <button class="btn btn-sm btn-light viewBtn">פרטים</button>
          <button class="btn btn-sm btn-warning addFavBtn">${isFavorite(movie.id) ? "הוסר" : "הוסף"}</button>
        </div>
      </div>
    `;
    // event listeners
    card.querySelector(".viewBtn").addEventListener("click", ()=> openMovieDetails(movie.id));
    card.querySelector(".addFavBtn").addEventListener("click", (e)=>{
      toggleFavorite(movie);
      e.target.textContent = isFavorite(movie.id) ? "הוסר" : "הוסף";
      if (favoritesPage.classList.contains("d-block")) renderFavorites(); // ריענון אם בדף מועדפים
    });
    col.appendChild(card);
    results.appendChild(col);
  });
}

// --- פרטי סרט (כולל credits) ---
async function openMovieDetails(movieId) {
  try {
    const data = await tmdb(`/movie/${movieId}`, { language:"he-IL", append_to_response: "credits" });
    modalTitle.textContent = data.title;
    const genres = (data.genres || []).map(g=>g.name).join(", ");
    const cast = (data.credits?.cast || []).slice(0,8).map(c=>`${c.name} (${c.character || ""})`).join(", ");
    const poster = data.poster_path ? `<img src="${IMG_BASE+data.poster_path}" class="img-fluid rounded" style="max-height:400px" />` : "";
    modalBodyContent.innerHTML = `
      <div class="row">
        <div class="col-md-4">${poster}</div>
        <div class="col-md-8">
          <p><strong>שנה:</strong> ${data.release_date ? data.release_date.slice(0,4) : "—"}</p>
          <p><strong>דירוג:</strong> ${data.vote_average ?? "—"}</p>
          <p><strong>ז'אנרים:</strong> ${genres}</p>
          <p><strong>תקציר:</strong> ${data.overview || "אין תקציר"}</p>
          <p><strong>שחקנים מרכזיים:</strong> ${cast || "לא קיים"}</p>
          <div class="mt-3">
            <button id="favToggleModal" class="btn btn-warning">${isFavorite(data.id) ? "הסר מהמועדפים" : "הוסף למועדפים"}</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById("favToggleModal").addEventListener("click", ()=>{
      toggleFavorite({ id: data.id, title: data.title, poster_path: data.poster_path, release_date: data.release_date, vote_average: data.vote_average, genre_ids: data.genres?.map(g=>g.id)||[] });
      document.getElementById("favToggleModal").textContent = isFavorite(data.id) ? "הסר מהמועדפים" : "הוסף למועדפים";
    });
    movieModal.show();
  } catch (e) {
    alert("שגיאה בטעינת פרטי הסרט");
    console.error(e);
  }
}

// --- Trending ---
async function showTrending() {
  try {
    const data = await tmdb("/trending/movie/week", { language:"he-IL" });
    if (data.results?.length) renderMovies(data.results);
    else results.innerHTML = `<p class="text-muted">אין trending כרגע.</p>`;
  } catch (e) {
    results.innerHTML = `<p class="text-danger">שגיאה בטעינת Trending.</p>`;
  }
}

// --- Favorites (LocalStorage) ---
function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem("moviehub_favs") || "[]");
  } catch {
    return [];
  }
}
function saveFavorites() {
  localStorage.setItem("moviehub_favs", JSON.stringify(favorites));
}
function isFavorite(id) { return favorites.some(f=>f.id === id); }
function toggleFavorite(movie) {
  if (isFavorite(movie.id)) favorites = favorites.filter(f=>f.id !== movie.id);
  else favorites.push({ id:movie.id, title:movie.title, poster_path:movie.poster_path, release_date:movie.release_date, vote_average:movie.vote_average, genre_ids: movie.genre_ids || [] });
  saveFavorites();
}

// --- Favorites UI ---
function renderFavorites(filterText="") {
  favoritesList.innerHTML = "";
  const list = favorites.filter(f => f.title.toLowerCase().includes(filterText.toLowerCase()));
  if (!list.length) {
    favoritesList.innerHTML = `<p class="text-muted">אין פריטים ברשימת המועדפים.</p>`;
    return;
  }
  list.forEach(movie => {
    const col = document.createElement("div");
    col.className = "col-12 col-md-6 col-lg-4";
    const card = document.createElement("div");
    card.className = "card bg-secondary text-light d-flex flex-row gap-2 p-2 align-items-center";
    card.innerHTML = `
      <img src="${movie.poster_path ? IMG_BASE+movie.poster_path : ''}" style="height:90px; width:auto; border-radius:.5rem" alt="${movie.title}">
      <div class="flex-fill">
        <h5 class="mb-1">${movie.title}</h5>
        <p class="small mb-1">${movie.release_date ? movie.release_date.slice(0,4) : "—"} • ${movie.vote_average ?? "—"}⭐</p>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-light viewFav">צפה</button>
          <button class="btn btn-sm btn-danger removeFav">הסר</button>
        </div>
      </div>
    `;
    card.querySelector(".viewFav").addEventListener("click", ()=> openMovieDetails(movie.id));
    card.querySelector(".removeFav").addEventListener("click", ()=> {
      favorites = favorites.filter(f=>f.id !== movie.id); saveFavorites(); renderFavorites(favSearch.value);
    });
    col.appendChild(card); favoritesList.appendChild(col);
  });
}

// --- אירועים ו־Init ---
searchBtn.addEventListener("click", ()=> searchMovies(searchInput.value));
searchInput.addEventListener("keydown", (e)=> { if (e.key === "Enter") searchMovies(searchInput.value); });
applyFiltersBtn.addEventListener("click", async ()=>{
  const q = searchInput.value || "";
  if (!q || q.length < minSearchLen) {
    alert(`הקלד לפחות ${minSearchLen} תווים כדי לבצע חיפוש עם סינון.`);
    return;
  }
  // השתמש בפרמטרים מתקדם: discover יכול לשמש אך כאן נשתמש ב־search ואז נפילטר בצד הלקוח (פשוט ונוח)
  await searchMovies(q);
  filterClientSide();
});
clearFiltersBtn.addEventListener("click", ()=> { genreSelect.value=""; yearInput.value=""; sortSelect.value="pop_desc"; });
trendingBtn.addEventListener("click", ()=> showTrending());

favoritesPageBtn.addEventListener("click", ()=> {
  document.querySelector("main").querySelectorAll("section").forEach(s=>s.classList.add("d-none"));
  favoritesPage.classList.remove("d-none");
  favoritesPage.classList.add("d-block");
  renderFavorites();
});
backToMain.addEventListener("click", ()=> {
  favoritesPage.classList.add("d-none");
  document.getElementById("results").parentElement.querySelectorAll("section").forEach(s=>s.classList.remove("d-none"));
  document.getElementById("results").parentElement.querySelectorAll("section").forEach(s=>s.classList.remove("d-none"));
  favoritesPage.classList.remove("d-block");
  // show results area again
  document.getElementById("results").parentElement.querySelector("#results").parentElement.classList.remove("d-none");
});
favSearch.addEventListener("input", ()=> renderFavorites(favSearch.value));
clearAllFavs.addEventListener("click", ()=> { if (confirm("למחוק את כל המועדפים?")) { favorites = []; saveFavorites(); renderFavorites(); } });

// מיון/סינון בצד לקוח (פשוט)
function filterClientSide() {
  const genreId = genreSelect.value;
  const year = yearInput.value;
  const sort = sortSelect.value;
  // שלוף את הכרטיסים המוצגים וצלצל לפונקציות המיון/סינון
  let cards = Array.from(results.querySelectorAll(".card"));
  // filter by genre/year
  cards.forEach(c => {
    const title = c.querySelector(".card-title").textContent;
    const meta = c.querySelector("p").textContent;
    // בדיקה פשוטה: שנת פרסום בתוך ה-meta
    let show = true;
    if (year && !meta.includes(year)) show = false;
    if (genreId) {
      // genre ids לא שמורים כאן - מתנהג לפי הטקסט בז'אנרים
      const genresText = c.querySelector(".text-truncate")?.textContent || "";
      if (!genresText) show = false;
      else if (!genresText.includes(genresMap[genreId])) show = false;
    }
    c.parentElement.style.display = show ? "" : "none";
  });
  // מיון: נקבל מערך של אלמנטים נראים ואז נמיין לפי תוכן
  const visibleCols = Array.from(results.querySelectorAll("div.col-6, div.col-md-4")).filter(col => col.style.display !== "none");
  if (visibleCols.length) {
    const parent = results;
    const arr = visibleCols.slice();
    arr.sort((a,b)=>{
      const aMeta = a.querySelector("p").textContent;
      const bMeta = b.querySelector("p").textContent;
      // עבור פשטות: ניקח את הדירוג (מספר ראשון שנמצא)
      const getNum = str => {
        const m = str.match(/([\d\.]+)/);
        return m ? parseFloat(m[1]) : 0;
      };
      if (sort === "vote_desc") return getNum(bMeta) - getNum(aMeta);
      if (sort === "vote_asc") return getNum(aMeta) - getNum(bMeta);
      if (sort === "date_desc") return (b.querySelector(".card-title").textContent.localeCompare(a.querySelector(".card-title").textContent));
      return 0;
    });
    // ריענון סדר DOM
    parent.innerHTML = "";
    arr.forEach(c => parent.appendChild(c));
  }
}

// אתחול
(async function init(){
  await loadGenres(); // טען ז'אנרים
  // אפשר להציג סרטים פופולריים כבר בטעינה
  try { const pop = await tmdb("/movie/popular", { language:"he-IL" }); if (pop.results) renderMovies(pop.results); } catch(e){}
})();
