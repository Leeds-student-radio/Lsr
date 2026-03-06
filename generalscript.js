import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getDatabase, ref, onValue, set, remove } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";


document.addEventListener('DOMContentLoaded', () => {

    // --- 1. PLAYER & UI LOGIC (SYNCED) ---
    const radioPlayer = document.getElementById('radio-player');
    const bars = document.querySelectorAll('.bar');

    function updatePlayButtons(isPlaying) {
        const allPlayIcons = document.querySelectorAll('.play-toggle i, .play-toggle-main i');

        allPlayIcons.forEach(icon => {
            if (isPlaying) {
                icon.classList.replace('fa-play', 'fa-pause');
            } else {
                icon.classList.replace('fa-pause', 'fa-play');
            }
        });

        bars.forEach(bar => {
            bar.style.animationPlayState = isPlaying ? 'running' : 'paused';
        });
    }
function toggleAltStream(button) {
    const audio = document.getElementById('alt-audio');
    const icon = button.querySelector('i');

    if (audio.paused) {
        audio.play();
        icon.classList.remove('fa-play');
        icon.classList.add('fa-pause');
    } else {
        audio.pause();
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
    }
}

// ADD THIS LINE RIGHT HERE:
window.toggleAltStream = toggleAltStream;
    // Initialize state
    bars.forEach(bar => bar.style.animationPlayState = 'paused');

    function togglePlay() {
        if (radioPlayer.paused) {
            radioPlayer.play();
            updatePlayButtons(true);
        } else {
            radioPlayer.pause();
            updatePlayButtons(false);
        }
    }

    document.body.addEventListener('click', function (e) {
        const btn = e.target.closest('.play-toggle, .play-toggle-main');
        if (btn) {
            togglePlay();
        }
    });

    // --- 2. MOBILE MENU LOGIC ---
    const mobileBtn = document.querySelector('.mobile-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const navIcon = mobileBtn?.querySelector('i');
    const overlay = document.querySelector('.mobile-overlay');

    function toggleMenu() {
        const isActive = navMenu.classList.toggle('active');
        overlay.classList.toggle('active');

        if (navIcon) {
            if (isActive) {
                navIcon.classList.replace('fa-bars', 'fa-times');
            } else {
                navIcon.classList.replace('fa-times', 'fa-bars');
            }
        }
    }

    if (mobileBtn) mobileBtn.addEventListener('click', toggleMenu);
    if (overlay) overlay.addEventListener('click', () => {
        if (navMenu.classList.contains('active')) toggleMenu();
    });

    // --- 3. CSV PARSER ---
    function parseCSV(str) {
        const arr = [];
        let quote = false;
        let row = 0, col = 0;
        for (let c = 0; c < str.length; c++) {
            let cc = str[c], nc = str[c + 1];
            arr[row] = arr[row] || [];
            arr[row][col] = arr[row][col] || '';
            if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }
            if (cc == '"') { quote = !quote; continue; }
            if (cc == ',' && !quote) { ++col; continue; }
            if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }
            if (cc == '\n' && !quote) { ++row; col = 0; continue; }
            if (cc == '\r' && !quote) { ++row; col = 0; continue; }
            arr[row][col] += cc;
        }
        return arr;
    }

    // --- 4. COMMITTEE LOGIC (WITH MODAL SUPPORT) ---
    const committeeSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRoXcefXiUOFuRnA6DpheBwR2CJ4Zs09o68IG9in3w2WwncXybxsbVDWwQY6u6MSpmFDiRrx83MO8M3/pub?gid=2123499295&output=csv';

    async function fetchCommitteeData() {
        const grid = document.getElementById('committee-grid-container');
        if (!grid) return;

        try {
            const response = await fetch(committeeSheetUrl);
            const data = await response.text();
            const rows = parseCSV(data);
            rows.shift();
            grid.innerHTML = '';

            rows.forEach(row => {
                if (!row || !row[1] || row[1].trim() === '') return;
                const name = row[1].trim();
                const role = row[2] ? row[2].trim() : 'Committee Member';
                const imgLink = row[3] ? row[3].trim() : 'https://via.placeholder.com/300x300?text=No+Image';

                const card = document.createElement('div');
                card.className = 'committee-card';
                card.innerHTML = `
                    <img src="${imgLink}" alt="${name}">
                    <div class="committee-info">
                        <h3 class="committee-name">${name}</h3>
                        <p class="committee-role">${role}</p>
                    </div>
                `;
                card.addEventListener('click', () => {
                    if (typeof openModal === "function") openModal(name, role, imgLink);
                });
                grid.appendChild(card);
            });
        } catch (error) {
            console.error("Failed to fetch committee data", error);
        }
    }

    // --- 5. GET INVOLVED LOGIC (WITH SMART FOOTERS) ---
    const applySheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRoXcefXiUOFuRnA6DpheBwR2CJ4Zs09o68IG9in3w2WwncXybxsbVDWwQY6u6MSpmFDiRrx83MO8M3/pub?gid=2045188384&output=csv';

    async function fetchApplyData() {
        const grid = document.getElementById('apply-grid');
        if (!grid) return;

        try {
            const response = await fetch(applySheetUrl);
            const data = await response.text();
            const rows = parseCSV(data);
            rows.shift();
            grid.innerHTML = '';

            const categoriesMap = {};
            rows.forEach(row => {
                if (!row || row.length < 3 || !row[1] || row[1].trim() === '') return;
                const category = row[1].trim();
                const showName = row[2] ? row[2].trim() : '';
                const formLink = row[3] ? row[3].trim() : '#';
                if (!categoriesMap[category]) categoriesMap[category] = [];
                categoriesMap[category].push({ showName, formLink });
            });

            for (const [category, shows] of Object.entries(categoriesMap)) {
                const box = document.createElement('div');
                box.className = 'apply-box';
                box.innerHTML = `<h3>${category}</h3>`;

               const showsContainer = document.createElement('div');
showsContainer.className = 'shows-container';

shows.forEach(show => {
    const link = document.createElement('a');
    link.className = 'show-link';
    link.href = show.formLink;
    link.target = '_blank';
    
    // Use innerHTML to render the Font Awesome icon tag
    link.innerHTML = `<i class="fas fa-link"></i> ${show.showName}`;
    
    showsContainer.appendChild(link);
});

box.appendChild(showsContainer);

                let footerText = `*Find out more about ${category} on our Instagram @thisislsr`;
                const catLower = category.toLowerCase();
                if (catLower.includes('weekend')) footerText = '*Learn more about our weekend shows over at @thisislsr_weekend';
                else if (catLower.includes('daytime')) footerText = '*Find out more about any of LSR\'s daytime shows over on insta @thisislsr_daytime';
                else if (catLower.includes('news')) footerText = '*Find out more about LSR\'s news team head on our dedicated news insta @thisislsr_news';
                else if (catLower.includes('sports')) footerText = '*Got questions about our sports team? Head on over to insta @thisislsr_sport';
                else if (catLower.includes('breakfast') || catLower.includes('hometime')) footerText = '*Find out more about Breakfast or Hometime on Instagram @thisislsr_breakfast @thisislsr_hometime';
                else if (catLower.includes('podcast') || catLower.includes('own show')) footerText = 'Our schedule ranges from arts, comedy and music to sport, film and politics so no matter what you\'re interested in, we\'ll help you get it on-air!';

                const footer = document.createElement('p');
                footer.className = 'box-footer';
                footer.innerText = footerText;
                box.appendChild(footer);
                grid.appendChild(box);
            }
        } catch (error) {
            console.error("Failed to fetch apply forms", error);
        }
    }

    // --- 6. ENHANCED SCHEDULE & MEDIASESSION LOGIC ---
    const scheduleSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRoXcefXiUOFuRnA6DpheBwR2CJ4Zs09o68IG9in3w2WwncXybxsbVDWwQY6u6MSpmFDiRrx83MO8M3/pub?output=csv&gid=0';
    const TERM_START_DATE = new Date('2026-01-26');
    let currentViewWeek = 'A';
    let allScheduleRows = [];

    function timeToMinutes(timeStr) {
        if (!timeStr) return -1;
        const parts = timeStr.split(':').map(n => parseInt(n, 10));
        if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return -1;
        return parts[0] * 60 + parts[1];
    }

    function getCurrentWeekType() {
        const now = new Date();
        const diffInMs = now - TERM_START_DATE;
        const diffInWeeks = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 7));
        return (diffInWeeks % 2 === 0) ? 'A' : 'B';
    }

    function isShowLive(showDay, startTime, endTime) {
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[now.getDay()];
        if (showDay.toLowerCase() !== currentDay.toLowerCase()) return false;
        
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const start = timeToMinutes(startTime);
        const end = timeToMinutes(endTime);
        
        // Handle shows crossing midnight
        if (start <= end) {
            return currentMinutes >= start && currentMinutes < end;
        } else {
            return currentMinutes >= start || currentMinutes < end;
        }
    }

    function updateMediaSession(show) {
        if ('mediaSession' in navigator) {
            const title = show?.title || "LSR Non-Stop";
            const artist = show?.host || "Leeds Student Radio";
            const artworkUrl = show?.image || show?.img || "https://stepzach.github.io//leedstestradio/ab6765630000ba8a51445deb0fe8b8c4b173e6a1.jpeg";
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title, artist: artist,
                artwork: [{ src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
            });
        }
    }

    async function fetchScheduleData() {
        try {
            const response = await fetch(scheduleSheetUrl);
            const data = await response.text();
            allScheduleRows = parseCSV(data);
            allScheduleRows.shift();
            
            const realWeek = getCurrentWeekType();
            
            // Logic for the Player / Footer (Live Now)
            updateLiveNowUI(realWeek);

            // Logic for the Schedule Page Grid
            const grid = document.getElementById('schedule-grid');
            if (grid) {
                currentViewWeek = realWeek;
                updateWeekUI(currentViewWeek);
                renderSchedule(currentViewWeek);
            }
        } catch (error) {
            console.error("Schedule fetch error", error);
        }
    }

  function updateLiveNowUI(realWeek) {
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[now.getDay()];
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const todayShows = allScheduleRows.filter(row => {
            const day = row[4]?.trim() || '';
            const week = row[5]?.trim().toUpperCase() || '';
            return day.toLowerCase() === currentDay.toLowerCase() && (week.includes(realWeek) || week.includes('EVERY'));
        });

        const parsedShows = todayShows.map(row => ({
            title: row[1] || "LSR Show",
            description: row[2] || "Non-stop student radio.",
            image: row[3] || "https://stepzach.github.io//leedstestradio/ab6765630000ba8a51445deb0fe8b8c4b173e6a1.jpeg",
            start: timeToMinutes(row[6]),
            end: timeToMinutes(row[7]),
            rawStart: row[6],
            rawEnd: row[7],
            host: row[8] || "Leeds Student Radio"
        })).filter(s => s.start !== -1).sort((a, b) => a.start - b.start);

        let liveShow = null;
        let nextShow = null;

        for (let i = 0; i < parsedShows.length; i++) {
            const show = parsedShows[i];
            const isLive = (show.start <= show.end) 
                ? (currentMinutes >= show.start && currentMinutes < show.end)
                : (currentMinutes >= show.start || currentMinutes < show.end);

            if (isLive) {
                liveShow = show;
                nextShow = parsedShows[i + 1] || null;
                break;
            } else if (show.start > currentMinutes && !liveShow) {
                nextShow = show;
                break;
            }
        }

        // --- 1. LIVE SHOW FALLBACK LOGIC ---
        const lnTitle = document.getElementById('live-now-title');
        const lnImg = document.getElementById('live-now-img');
        const lnDesc = document.getElementById('live-now-desc');
        const mainTitle = document.getElementById('main-player-title');
        const defaultImg = "https://stepzach.github.io//leedstestradio/ab6765630000ba8a51445deb0fe8b8c4b173e6a1.jpeg";

        if (liveShow) {
            if(lnTitle) lnTitle.innerText = liveShow.title;
            if(lnImg) lnImg.src = liveShow.image;
            if(lnDesc) lnDesc.innerText = liveShow.description;
            
            updateMediaSession(liveShow);

            if (mainTitle) {
                mainTitle.innerText = liveShow.title;
                document.getElementById('main-player-host').innerText = "with " + liveShow.host;
                document.getElementById('main-player-desc').innerText = liveShow.description;
                document.getElementById('main-player-img').src = liveShow.image;
                document.getElementById('main-player-time').innerText = `LIVE NOW (${liveShow.rawStart} - ${liveShow.rawEnd})`;
            }
        } else {
            // NO LIVE SHOW: Load default non-stop data
            if(lnTitle) lnTitle.innerText = "LSR Non-Stop";
            if(lnImg) lnImg.src = defaultImg;
            if(lnDesc) lnDesc.innerText = "No show is live right now, enjoy our non-stop student radio mix.";

            updateMediaSession({
                title: "LSR Non-Stop", 
                host: "Leeds Student Radio", 
                image: defaultImg
            });

            if (mainTitle) {
                mainTitle.innerText = "LSR Non-Stop";
                document.getElementById('main-player-host').innerText = "with Leeds Student Radio";
                document.getElementById('main-player-desc').innerText = "No show is live right now, enjoy our non-stop student radio mix.";
                document.getElementById('main-player-img').src = defaultImg;
                document.getElementById('main-player-time').innerText = `LIVE NOW (24/7)`;
            }
        }

        // --- 2. NEXT SHOW FALLBACK LOGIC ---
        const nextT = document.getElementById('up-next-title');
        const nextI = document.getElementById('up-next-img');
        const nextD = document.getElementById('up-next-desc'); 

        if (nextShow) {
            if(nextT) nextT.innerText = nextShow.title;
            if(nextI) nextI.src = nextShow.image;
            if(nextD) nextD.innerText = nextShow.description;
        } else {
            // NO NEXT SHOW: Load default upcoming data
            if(nextT) nextT.innerText = "No show next";
            if(nextI) nextI.src = defaultImg;
            if(nextD) nextD.innerText = "Check the schedule for our next show!";
        }
    }

   function renderSchedule(weekLetter) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const grid = document.getElementById('schedule-grid');
    if (!grid) return; 

    const realWeek = getCurrentWeekType();
    grid.innerHTML = ''; // Clear previous

    days.forEach(day => {
        const dayCol = document.createElement('div');
        // Match the class used in your CSS
        dayCol.className = `schedule-day-column day-${day}`; 
        dayCol.innerHTML = `<h3 class="day-title">${day}</h3>`;

        const filteredShows = allScheduleRows.filter(row => {
            const rowDay = row[4]?.trim() || '';
            const rowWeek = row[5]?.trim().toUpperCase() || '';
            return rowDay.toLowerCase() === day.toLowerCase() && 
                   (rowWeek.includes(weekLetter) || rowWeek.includes('EVERY'));
        });

        filteredShows.sort((a, b) => timeToMinutes(a[6]) - timeToMinutes(b[6]));

        if (filteredShows.length === 0) {
            dayCol.innerHTML += `<p class="no-shows">No shows scheduled</p>`;
        }

        filteredShows.forEach(row => {
            const show = {
                title: row[1], desc: row[2], img: row[3] || "https://via.placeholder.com/300",
                day: row[4], week: row[5], start: row[6], end: row[7], host: row[8]
            };
            const showEl = document.createElement('div');
            showEl.className = 'show-card';
            if (isShowLive(show.day, show.start, show.end) && weekLetter === realWeek) {
                showEl.classList.add('is-live');
            }
            showEl.innerHTML = `
                <img src="${show.img}" alt="${show.title}">
                <div class="show-card-meta">
                    <h4>${show.title}</h4>
                    <p>${show.start} - ${show.end}</p>
                </div>
            `;
            showEl.onclick = () => openShowModal(show);
            dayCol.appendChild(showEl);
        });
        grid.appendChild(dayCol);
    });

    // Re-initialize mobile visibility after rendering
    setTimeout(() => initMobileSchedule(), 50); 
}

    function updateWeekUI(week) {
        document.querySelectorAll('.week-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.week === week);
        });
        const indicator = document.getElementById('current-week-indicator');
        if (indicator) indicator.innerText = `Viewing Schedule: Week ${week}`;
    }

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('week-btn')) {
            currentViewWeek = e.target.dataset.week;
            updateWeekUI(currentViewWeek);
            renderSchedule(currentViewWeek);
        }
    });

    function openShowModal(show) {
        const modal = document.getElementById('schedule-modal');
        if(!modal) return;
        document.getElementById('modal-show-img').src = show.img;
        document.getElementById('modal-show-title').innerText = show.title;
        document.getElementById('modal-show-time').innerText = `${show.start} - ${show.end}`;
        document.getElementById('modal-show-host').innerText = `With ${show.host}`;
        document.getElementById('modal-show-desc').innerText = show.desc;
        modal.style.display = 'block';
        const closeBtn = modal.querySelector('.close-modal');
        if(closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
        window.onclick = (e) => { if(e.target == modal) modal.style.display = 'none'; };
    }

    function initMobileSchedule() {
        const buttons = document.querySelectorAll('.day-btn');
        const columns = document.querySelectorAll('.schedule-day-column');
        const selector = document.querySelector('.day-selector-mobile');
        const todayName = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
        
        const setActiveDay = (dayName, clickedBtn = null) => {
            buttons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.day === dayName);
                if (btn.dataset.day === todayName) btn.classList.add('is-today');
            });
            columns.forEach(col => {
                col.classList.toggle('active', col.classList.contains(`day-${dayName}`));
            });
            const activeBtn = clickedBtn || [...buttons].find(b => b.dataset.day === dayName);
            if (activeBtn && selector) {
                const scrollLeft = activeBtn.offsetLeft - (selector.offsetWidth / 2) + (activeBtn.offsetWidth / 2);
                selector.scrollTo({ left: scrollLeft, behavior: 'smooth' });
            }
        };

        buttons.forEach(btn => {
            btn.onclick = () => setActiveDay(btn.dataset.day, btn);
        });
        setActiveDay(todayName);
    }
function updateNavLinks() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-menu .nav-link');

    navLinks.forEach(link => {
        // Remove active class from all first
        link.classList.remove('active');

        // Get the href attribute (e.g., "/DesignPortfolio/listen.html")
        const href = link.getAttribute('href');

        // If the current URL path contains the href of the link, make it active
        // This handles cases like 'listen.html' matching '/listen'
        if (href && currentPath.includes(href.replace('.html', ''))) {
            link.classList.add('active');
        }
    });
}
    // --- 7. ROUTING & INIT ---
    async function loadPage(url) {
        try {
            const response = await fetch(url);
            const htmlString = await response.text();
            const parser = new DOMParser();
            const newDoc = parser.parseFromString(htmlString, "text/html");
            const newMain = newDoc.querySelector('main');
            const currentMain = document.querySelector('main');

            if (newMain && currentMain) {
                currentMain.innerHTML = newMain.innerHTML;
                document.title = newDoc.title;
             window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
updateNavLinks();
             
                if (navMenu && navMenu.classList.contains('active')) toggleMenu();

                updatePlayButtons(!radioPlayer.paused);
 
                if (url.includes('apply')) fetchApplyData();
                if (url.includes('about')) fetchCommitteeData();
                if (url.includes('listen') || url.includes('schedule')) fetchScheduleData();
             if (url.includes('listen')) {
                initChatSystem(); 
            }

                fetchScheduleData();
            }
        } catch (e) {
            window.location.assign(url);
        }
    }

    document.body.addEventListener('click', e => {
        const link = e.target.closest('a');
        if (link && link.origin === window.location.origin && link.target !== '_blank' && !link.getAttribute('href').startsWith('#')) {
            e.preventDefault();
            window.history.pushState({}, "", link.href);
            loadPage(link.href);
        }
    });

    window.addEventListener('popstate', () => loadPage(window.location.href));

    // Start everything
    
    updateNavLinks();
    fetchScheduleData();
    fetchCommitteeData();
    fetchApplyData();
  if (window.location.pathname.includes('listen')) {
        initChatSystem();
    }
    setInterval(fetchScheduleData, 180000);
});

// --- FIREBASE IMPORTS ---

// --- CONFIGS ---
const chatConfig = { 
    apiKey: "AIzaSyDSGLLwH1BVYQVY1FLkAUe3XUmIYu2Nfhc", 
    authDomain: "lsrchat-6ffb1.firebaseapp.com", 
    projectId: "lsrchat-6ffb1", 
    storageBucket: "lsrchat-6ffb1.firebasestorage.app", 
    messagingSenderId: "333921149565", 
    appId: "1:333921149565:web:c5dcced8299b1527994714" 
}; 

const counterConfig = {
    apiKey: "AIzaSyAiqChgrcb4pn4LKjRO-zILVRs59CBCFes",
    authDomain: "lsrlivecount.firebaseapp.com",
    databaseURL: "https://lsrlivecount-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "lsrlivecount",
    storageBucket: "lsrlivecount.firebasestorage.app",
    messagingSenderId: "540310303767",
    appId: "1:540310303767:web:82125bd428eaee173c1852"
};

// Global variables to be shared
let db, auth, messagesCollection;

// --- CHAT & COUNTER SYSTEM ---
function initChatSystem() {
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const displayNameInput = document.getElementById('display-name');
    const messageInput = document.getElementById('message-input');
    const loadingSpinner = document.getElementById('loading-spinner');

    if (!chatMessages || !chatForm) return; // Guard for pages without chat

    const avatarColors = ['#ff4b2b', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#e91e63', '#00bcd4', '#607d8b'];

    function getAvatarColor(name) {
        let hash = 0;
        const searchName = name.toLowerCase().trim();
        for (let i = 0; i < searchName.length; i++) { hash = searchName.charCodeAt(i) + ((hash << 5) - hash); }
        return avatarColors[Math.abs(hash % avatarColors.length)];
    }

    function displayMessage(messageData) {
        const name = messageData.name || 'Anonymous';
        const text = messageData.text || '';
        const createdAt = messageData.createdAt;
        let timestampString = '';
        
        if (createdAt && typeof createdAt.toDate === 'function') {
            const date = createdAt.toDate();
            timestampString = `[${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}]`;
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = 'message-entry';
        
        const iconDiv = document.createElement('div');
        iconDiv.className = 'message-icon';
        iconDiv.style.backgroundColor = getAvatarColor(name);
        iconDiv.textContent = name.charAt(0).toUpperCase();

        const textDiv = document.createElement('div');
        textDiv.innerHTML = `<p><span class="message-timestamp">${timestampString}</span> <strong class="message-author">${name}</strong>: ${text}</p>`;
        
        msgDiv.appendChild(iconDiv);
        msgDiv.appendChild(textDiv);
        chatMessages.appendChild(msgDiv);
    }

    async function handleSendMessage(e) {
        e.preventDefault();
        const messageText = messageInput.value.trim();
        const displayName = displayNameInput.value.trim() || 'Anonymous';
        if (messageText === '' || !messagesCollection) return;
        try {
            await addDoc(messagesCollection, {
                name: displayName,
                text: messageText,
                createdAt: serverTimestamp(),
                expiresAt: Timestamp.fromDate(new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)))
            });
            messageInput.value = '';
        } catch (err) { console.error("Send Error:", err); }
    }

    chatForm.addEventListener('submit', handleSendMessage);
    
    // Initialize Apps
    const chatApp = initializeApp(chatConfig, "chat");
    const counterApp = initializeApp(counterConfig, "counter");

    db = getFirestore(chatApp);
    auth = getAuth(chatApp);
    const rtdb = getDatabase(counterApp);

    // --- LIVE COUNTER LOGIC ---
    const liveId = sessionStorage.getItem('liveId') || Math.random().toString(36).substring(2);
    sessionStorage.setItem('liveId', liveId);
    const userRef = ref(rtdb, 'active/' + liveId);
    
    set(userRef, Date.now());
    setInterval(() => set(userRef, Date.now()), 30000);
    window.addEventListener("beforeunload", () => remove(userRef));

    const activeRef = ref(rtdb, 'active');
    onValue(activeRef, snap => {
        const data = snap.val() || {};
        const activeUsers = Object.values(data).filter(ts => Date.now() - ts < 300000).length;
        const countEl = document.getElementById("live-count");
        if (countEl) countEl.textContent = activeUsers;
    });

    // --- AUTH & CHAT SNAPSHOT ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            messagesCollection = collection(db, "messages");
            const q = query(messagesCollection, orderBy("createdAt", "asc"));
            onSnapshot(q, (snapshot) => {
                if (loadingSpinner) loadingSpinner.style.display = 'none';
                chatMessages.innerHTML = snapshot.empty ? '<p style="text-align:center; color:#888;">No messages yet.</p>' : '';
                snapshot.forEach(doc => displayMessage(doc.data()));
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });
        }
    });
    signInAnonymously(auth);
}

// Ensure the function is available to your router
window.initChatSystem = initChatSystem;
