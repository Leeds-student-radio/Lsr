import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
// --- MODIFIED: Added getDocs and limit to the import below ---
import { getFirestore, collection, addDoc, serverTimestamp, Timestamp, query, orderBy, limitToLast, onSnapshot, doc, deleteDoc, getDocs, limit } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getDatabase, ref, onValue, set, remove } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. PLAYER & UI LOGIC (SYNCED) ---
    const radioPlayer = document.getElementById('radio-player');
    const bars = document.querySelectorAll('.bar'); 

    function updatePlayButtons(isPlaying) {
        const allPlayIcons = document.querySelectorAll('.play-toggle i, .play-toggle-main i');

        allPlayIcons.forEach(icon => {
            icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
        });

        bars.forEach(bar => {
            bar.style.animationPlayState = isPlaying ? 'running' : 'paused';
        });
    }

   function toggleAltStream(button) {
    const audio = document.getElementById('alt-audio');
    const icon = button.querySelector('i');

    if (audio.paused) {
        icon.className = 'fa-solid fa-circle-notch fa-spin'; 
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                icon.className = 'fas fa-pause';

                if ('mediaSession' in navigator) {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: "Alternative Stream",
                        artist: "Leeds Student Radio",
                        artwork: [
                            { src: '/ourlogo.jpeg', sizes: '512x512', type: 'image/jpeg' }
                        ]
                    });
                }
            }).catch(() => {
                icon.className = 'fas fa-play';
            });
        } else {
            icon.className = 'fas fa-pause';
        }
    } else {
        audio.pause();
        icon.className = 'fas fa-play';

        const realWeek = getCurrentWeekType();
        updateLiveNowUI(realWeek);
    }
}

    window.toggleAltStream = toggleAltStream;
    
    // Initialize state
    bars.forEach(bar => bar.style.animationPlayState = 'paused');

    function togglePlay() {
        if (radioPlayer.paused) {
            const allPlayIcons = document.querySelectorAll('.play-toggle i, .play-toggle-main i');
            allPlayIcons.forEach(icon => {
                icon.className = 'fa-solid fa-circle-notch fa-spin';
            });

            const playPromise = radioPlayer.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    updatePlayButtons(true);
                }).catch(() => {
                    updatePlayButtons(false);
                });
            } else {
                updatePlayButtons(true);
            }
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

    // --- SHAZAM IDENTIFICATION LOGIC ---
    document.body.addEventListener('click', async (e) => {
        const btn = e.target.closest('#shazam-btn');
        if (!btn) return; 

        const statusText = document.getElementById('shazam-status');
        const contentBox = document.getElementById('shazam-content');
        const skeleton = document.getElementById('shazam-skeleton'); 
        const coverArt = document.getElementById('shazam-cover');
        const titleText = document.getElementById('shazam-title');
        const artistText = document.getElementById('shazam-artist');

        btn.disabled = true;
        btn.innerHTML = `<span class="spinneractive"></span>`;
        if (statusText) statusText.innerText = ""; 
        
        if (contentBox) contentBox.style.display = "none"; 
        if (skeleton) skeleton.style.display = "flex"; 
        
        const renderApiUrl = "https://lsr-shazam-api.onrender.com/identify";
        const radioStreamUrl = "https://streamer.radio.co/s986435880/listen"; 

        try { 
            const response = await fetch(`${renderApiUrl}?stream_url=${encodeURIComponent(radioStreamUrl)}`);
            const data = await response.json();

            if (data.success) {
                if (titleText) titleText.innerText = data.title;
                if (artistText) artistText.innerText = data.artist;
                
                if (data.image && coverArt) {
                    coverArt.src = data.image;
                    coverArt.style.display = "block";
                } else if (coverArt) {
                    coverArt.style.display = "none";
                }

                if (contentBox) contentBox.style.display = "flex";

            } else {
                if (statusText) statusText.innerText = "No song detected.";
            }
        } catch (error) {
            if (statusText) statusText.innerText = "Connection error.";
        } finally {
            if (skeleton) skeleton.style.display = "none"; 
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-redo"></i>';
        }
    });  

  async function updateNowPlaying() {
    const apiUrl = 'https://public.radio.co/stations/seb5cdba5b/status';
    
    const titleElement = document.getElementById('np-title');
    if (!titleElement) return; 

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.status === 'online') {
            const currentTrackName = data.current_track.title;
            titleElement.textContent = currentTrackName;
        }
    } catch (error) {
        console.error('Error fetching Radio.co track info:', error);
        titleElement.textContent = "Stream Offline";
    }
}
// Run immediately on page load
updateNowPlaying();
setInterval(updateNowPlaying, 15000);
    
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
            const status = row[4] ? row[4].trim().toLowerCase() : 'open'; 

            if (!categoriesMap[category]) categoriesMap[category] = [];
            categoriesMap[category].push({ showName, formLink, status });
        });

        for (const [category, shows] of Object.entries(categoriesMap)) {
            const box = document.createElement('div');
            box.className = 'apply-box';
            
            box.style.position = 'relative'; 
            box.innerHTML = `<h3>${category}</h3>`;

            const allShowsClosed = shows.every(show => show.status === 'closed');

            if (allShowsClosed) {
                const layover = document.createElement('div');
                layover.className = 'closed-layover';
                layover.innerHTML = '<p>Thank you for your interest, unfortunately applications are now closed... Check again next semester!</p>';
                box.appendChild(layover);
            }

            const showsContainer = document.createElement('div');
            showsContainer.className = 'shows-container';

            shows.forEach(show => {
                const link = document.createElement('a');
                link.className = 'show-link';
                link.href = show.formLink;
                link.target = '_blank';
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

    // --- 5.5 AWARDS LOGIC ---
    const awardsSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRoXcefXiUOFuRnA6DpheBwR2CJ4Zs09o68IG9in3w2WwncXybxsbVDWwQY6u6MSpmFDiRrx83MO8M3/pub?gid=1358450835&output=csv';

    async function fetchAwardsData() {
        const grid = document.getElementById('award-grid');
        if (!grid) return; 

        try {
            const response = await fetch(awardsSheetUrl);
            const csvText = await response.text();
            const rows = parseCSV(csvText);
            
            const data = rows.slice(1).filter(r => r.length >= 3 && r[0].trim() !== '');

            const awardsByYear = {};
            data.forEach(row => {
                const year = row[0]?.trim();
                const place = row[1]?.trim();
                const award = row[2]?.trim();
                const subtitle = row[3]?.trim() || ''; 

                if (!awardsByYear[year]) {
                    awardsByYear[year] = [];
                }
                awardsByYear[year].push({ place, award, subtitle });
            });

            const sortedYears = Object.keys(awardsByYear).sort((a, b) => b - a);
            let html = '';

            sortedYears.forEach(year => {
                html += `
                    <div class="award-box">
                        <h3>${year}</h3>
                        <div class="award-container">
                `;

                awardsByYear[year].forEach(item => {
                    let iconClass = 'fa-solid fa-star'; 
                    if (item.place === '2') iconClass = 'fa-solid fa-2';
                    if (item.place === '3') iconClass = 'fa-solid fa-3';

                    const subtitleHtml = item.subtitle 
                        ? `<div class="award-subtitle">${item.subtitle}</div>` 
                        : '';

                    html += `
                        <a class="award">
                            <i class="${iconClass}"></i>
                            <div class="award-details">
                                ${item.award}
                                ${subtitleHtml}
                            </div>
                        </a>
                    `;
                });

                html += `
                        </div>
                    </div>
                `;
            });

            grid.innerHTML = html;
        } catch (error) {
            console.error('Error fetching awards:', error);
        }
    }


    // --- 6. ENHANCED SCHEDULE & MEDIASESSION LOGIC ---
    const scheduleSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRoXcefXiUOFuRnA6DpheBwR2CJ4Zs09o68IG9in3w2WwncXybxsbVDWwQY6u6MSpmFDiRrx83MO8M3/pub?output=csv&gid=0';
   
function getLondonTimeDetails() {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/London',
            weekday: 'long',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
        });
        
        const parts = formatter.formatToParts(now);
        let day = '', hour = 0, minute = 0;
        
        parts.forEach(part => {
            if (part.type === 'weekday') day = part.value;
            if (part.type === 'hour') hour = parseInt(part.value, 10);
            if (part.type === 'minute') minute = parseInt(part.value, 10);
        });
        
        if (hour === 24) hour = 0;
        
        return { 
            day: day, 
            minutes: (hour * 60) + minute 
        };
    }

    const TERM_START_DATE = new Date('2026-01-26T00:00:00Z').getTime(); 
    let currentViewWeek = 'A';
    let allScheduleRows = [];

    function timeToMinutes(timeStr) {
        if (!timeStr) return -1;
        const parts = timeStr.split(':').map(n => parseInt(n, 10));
        if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return -1;
        return parts[0] * 60 + parts[1];
    }

    function getCurrentWeekType() {
        const nowMs = Date.now(); 
        const diffInMs = nowMs - TERM_START_DATE;
        const diffInWeeks = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 7));
        return (diffInWeeks % 2 === 0) ? 'A' : 'B';
    }

    function isShowLive(showDay, startTime, endTime) {
        const london = getLondonTimeDetails();
        
        if (showDay.toLowerCase() !== london.day.toLowerCase()) return false;
        
        const currentMinutes = london.minutes;
        const start = timeToMinutes(startTime);
        const end = timeToMinutes(endTime);
        
        if (start <= end) {
            return currentMinutes >= start && currentMinutes < end;
        } else {
            return currentMinutes >= start || currentMinutes < end;
        }
    }

   function updateMediaSession(show) {
    if ('mediaSession' in navigator) {
        const title = show?.title || "OFF AIR";
        const artist = show?.host || "Leeds Student Radio";
        const rawArtworkUrl = show?.image || show?.img || "/ourlogo.jpeg";
        const absoluteArtworkUrl = new URL(rawArtworkUrl, window.location.origin).href;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: title, 
            artist: artist,
            artwork: [
                { 
                    src: absoluteArtworkUrl, 
                    sizes: '512x512' 
                }
            ]
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
            updateLiveNowUI(realWeek);

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
        const london = getLondonTimeDetails();
        const currentDay = london.day;
        const currentMinutes = london.minutes;

        const todayShows = allScheduleRows.filter(row => {
            const day = row[4]?.trim() || '';
            const week = row[5]?.trim().toUpperCase() || '';
            return day.toLowerCase() === currentDay.toLowerCase() && (week.includes(realWeek) || week.includes('EVERY'));
        });

        const parsedShows = todayShows.map(row => ({
            title: row[1] || "No show live",
            description: row[2] || "Check our schedule for the next show!",
            image: row[3] || "/ourlogo.jpeg",
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

        const lnTitle = document.getElementById('live-now-title');
        const lnImg = document.getElementById('live-now-img');
        const lnDesc = document.getElementById('live-now-desc');
        const mainTitle = document.getElementById('main-player-title');
        const defaultImg = "/ourlogo.jpeg";

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
                document.querySelector('#live-text').innerText = `LIVE NOW (${liveShow.rawStart} - ${liveShow.rawEnd})`;
            }
        } else {
            if(lnTitle) lnTitle.innerText = "No show currently live";
            if(lnImg) lnImg.src = defaultImg;
            if(lnDesc) lnDesc.innerText = "No show is live right now :(";

            updateMediaSession({
                title: "OFF AIR", 
                host: "Leeds Student Radio", 
                image: defaultImg
            });

            if (mainTitle) {
                mainTitle.innerText = "OFF AIR";
                document.getElementById('main-player-host').innerText = "ZZZ";
                document.getElementById('main-player-desc').innerText = "Our hosts are sleeping now (or out enjoying the Leeds nightlife 😉) Check the schedule for our next show!";
                document.getElementById('main-player-img').src = defaultImg;
                document.getElementById('main-player-time').innerText = `OFF AIR`;
            }
        }

        const nextT = document.getElementById('up-next-title');
        const nextI = document.getElementById('up-next-img');
        const nextD = document.getElementById('up-next-desc'); 

        if (nextShow) {
            if(nextT) nextT.innerText = nextShow.title;
            if(nextI) nextI.src = nextShow.image;
            if(nextD) nextD.innerText = nextShow.description;
        } else {
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
        grid.innerHTML = ''; 

        days.forEach(day => {
            const dayCol = document.createElement('div');
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
                    day: row[4], week: row[5], start: row[6], end: row[7], host: row[8],
                    color: row[9] 
                };
                const showEl = document.createElement('div');
                showEl.className = 'show-card';
                
                const hasTitle = show.title && show.title.trim() !== "";

                if (!hasTitle) {
                    showEl.classList.add('empty-show-slot');
                } else {
                    if (isShowLive(show.day, show.start, show.end) && weekLetter === realWeek) {
                        showEl.classList.add('is-live');
                    }
                    if (show.color && show.color.trim() !== "") {
                        showEl.style.backgroundColor = show.color.trim();
                    }
                    showEl.innerHTML = `
                        <img src="${show.img}" alt="${show.title}">
                        <div class="show-card-meta">
                            <h4>${show.title}</h4>
                            <p>${show.start} - ${show.end}</p>
                        </div>
                    `;
                    showEl.onclick = () => openShowModal(show);
                }
                dayCol.appendChild(showEl);
            });
            grid.appendChild(dayCol);
        });

        setTimeout(() => initMobileSchedule(), 50); 
    }

    function updateWeekUI(week) {
        const realCurrentWeek = getCurrentWeekType();
        document.querySelectorAll('.week-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.week === week);
            btn.classList.toggle('is-current-week', btn.dataset.week === realCurrentWeek);
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

        const modalInner = modal.querySelector('.modal-content') || modal; 

        if (show.color && show.color.trim() !== "") {
            modalInner.style.backgroundColor = show.color.trim();
        } else {
            modalInner.style.backgroundColor = ''; 
        }

        modal.style.display = 'block';
        
        const closeBtn = modal.querySelector('.close-modal');
        if(closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
        
        window.onclick = (e) => { 
            if(e.target == modal) modal.style.display = 'none'; 
        };
    }

    function initMobileSchedule() {
        const buttons = document.querySelectorAll('.day-btn');
        const columns = document.querySelectorAll('.schedule-day-column');
        const selector = document.querySelector('.day-selector-mobile');
        
        const todayName = new Intl.DateTimeFormat('en-GB', { 
            weekday: 'long', 
            timeZone: 'Europe/London' 
        }).format(new Date());
        
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
            link.classList.remove('active');
            const href = link.getAttribute('href');
            if (href && currentPath.includes(href.replace('.html', ''))) {
                link.classList.add('active');
            }
        });
    }


let allData = []; 
let currentIndex = 0; 
const BATCH_SIZE = 15; 
let msnry; // Variable to hold our Masonry instance

// 1. Initialize Masonry on the skeletons immediately on page load
document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById('dynamic-archive-grid');
    
    // Build the skeleton grid
    msnry = new Masonry(grid, {
        itemSelector: '.archive-item',
        columnWidth: '.grid-sizer',
        gutter: '.gutter-sizer',
        percentPosition: true,
        transitionDuration: 0 // Keep at 0 so skeletons snap instantly into place
    });
    
    // Fetch the real data
    loadArchiveGrid();
});

function loadArchiveGrid() {
    const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRoXcefXiUOFuRnA6DpheBwR2CJ4Zs09o68IG9in3w2WwncXybxsbVDWwQY6u6MSpmFDiRrx83MO8M3/pub?gid=897108323&output=csv';

    Papa.parse(sheetUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            let data = results.data.filter(item => item.image_url);
            
            data.sort((a, b) => {
                const getYear = (str) => {
                    const match = str ? str.match(/\d{4}/) : null;
                    return match ? parseInt(match[0], 10) : 0;
                };
                return getYear(b.caption) - getYear(a.caption);
            });

            allData = data; 
            
            const grid = document.getElementById('dynamic-archive-grid');
            
            // 2. Destroy the skeleton Masonry instance BEFORE wiping the HTML
            if (msnry) {
                msnry.destroy(); // Resets the layout state
                msnry = null;    // Clears the variable so loadNextBatch() creates a new one
            }

            // 🔥 THE FIX: Clear skeletons, but inject the sizers back in! 🔥
            grid.innerHTML = `
              <div class="grid-sizer"></div>
              <div class="gutter-sizer"></div>
            `;
            
            loadNextBatch();
        }
    });
}
async function loadNextBatch() {
    const grid = document.getElementById('dynamic-archive-grid');
    const batch = allData.slice(currentIndex, currentIndex + BATCH_SIZE);
    
    if (batch.length === 0) return; 

    // Preload images to prevent layout jitter when Masonry calculates heights
    const preloadPromises = batch.map(item => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = item.image_url;
            img.onload = resolve; 
            img.onerror = resolve; 
        });
    });

    await Promise.all(preloadPromises);

    // Build HTML string for the new items
    let htmlContent = '';
    batch.forEach(item => {
        const titleHtml = item.title ? `<h3>${item.title}</h3>` : `<h3></h3>`;
        const captionHtml = item.caption ? `<p>${item.caption}</p>` : `<p></p>`;
        
        htmlContent += `
          <div class="archive-item">
            <img src="${item.image_url}" alt="LSR archive image" loading="lazy">
            <div class="caption">
              ${titleHtml}
              ${captionHtml}
            </div>
          </div>
        `;
    });

    // Convert the HTML string into actual DOM elements
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const newItems = Array.from(tempDiv.children);

    // 1. Append items to the grid FIRST
    grid.append(...newItems);

    // 2. Initialize or Update Masonry
 
    if (!msnry) {
        msnry = new Masonry(grid, {
            itemSelector: '.archive-item',
            columnWidth: '.grid-sizer', // Uses the CSS width of this element
            gutter: '.gutter-sizer',    // Uses the CSS width of this element
            percentPosition: true,      // Tells Masonry to respect percentages
            transitionDuration: '0.3s'
        });
    } else {
        msnry.appended(newItems);
        msnry.layout(); 
    }

    currentIndex += BATCH_SIZE;
    manageLoadMoreButton();
}

function manageLoadMoreButton() {
    let btn = document.getElementById('load-more-btn');
    
    // If there's more data to load, show/create the button
    if (currentIndex < allData.length) {
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'load-more-btn';
            btn.innerText = 'Load More';
            btn.className = 'load-more-button'; 
            btn.onclick = loadNextBatch;
            
            // Place it immediately after the grid
            document.getElementById('dynamic-archive-grid').after(btn);
        } else {
            btn.style.display = 'block'; // Ensure it's visible if it was hidden
        }
    } else if (btn) {
        // Hide button if we reached the end of the data
        btn.style.display = 'none'; 
    }
}
    
    // --- 6.5 CHART / LEADERBOARD LOGIC (NEW) ---
    let cachedSongs = null;
    let cachedArtists = null;

    async function fetchChartData(collectionName) {
        try {
            // Re-uses the shazamApp initialized globally at the bottom of the file
            const shazamDb = getFirestore(shazamApp);
            const q = query(
                collection(shazamDb, collectionName), 
                orderBy("count", "desc"), 
                limit(50) 
            );

            const querySnapshot = await getDocs(q);
            const results = [];
            querySnapshot.forEach((doc) => {
                results.push(doc.data());
            });
            return results;

        } catch (error) {
            console.error(`Error fetching ${collectionName}: `, error);
            return [];
        }
    }

    function displayLeaderboard(data, viewType, targetId) {
        const tableContainer = document.getElementById(targetId);
        if (!tableContainer) return;

        const mainColHeader = viewType === 'songs' ? 'Song' : 'Artist';

        const headerHtml = `
            <div class="lsr-trk-wgt-row lsr-trk-wgt-header-row">
                <div class="lsr-trk-wgt-cell lsr-trk-wgt-col-rank">#</div>
                <div class="lsr-trk-wgt-cell lsr-trk-wgt-col-song">${mainColHeader}</div>
                <div class="lsr-trk-wgt-cell lsr-trk-wgt-col-plays">Plays</div>
            </div>`;
        
        let rowsHtml = headerHtml;

        if (data.length === 0) {
            rowsHtml += `<div class="lsr-trk-wgt-row"><div class="lsr-trk-wgt-cell" colspan="3" style="text-align:center; padding:20px;">No ${viewType} found yet. Play some music!</div></div>`;
        } else {
            data.forEach((item, index) => {
                let rankDisplay;
                if (index === 0) {
                    rankDisplay = `<i class="fa-solid fa-star lsr-trk-wgt-rank-icon"></i>`;
                } else if (index === 1) {
                    rankDisplay = `<i class="fa-solid fa-2 lsr-trk-wgt-rank-icon"></i>`;
                } else if (index === 2) {
                    rankDisplay = `<i class="fa-solid fa-3 lsr-trk-wgt-rank-icon"></i>`;
                } else {
                    rankDisplay = `<span class="lsr-trk-wgt-rank-num">${index + 1}</span>`;
                }

                const displayTitle = item.title || item.name;
                const displaySubtitle = viewType === 'songs' ? item.artist : "Total Plays";

                rowsHtml += `
                    <div class="lsr-trk-wgt-row lsr-trk-wgt-song-item">
                        <div class="lsr-trk-wgt-cell lsr-trk-wgt-col-rank">
                            ${rankDisplay}
                        </div>
                        <div class="lsr-trk-wgt-cell lsr-trk-wgt-col-song">
                            <div class="lsr-trk-wgt-song-flex">
                                <img src="${item.image || 'https://via.placeholder.com/45'}" class="lsr-trk-wgt-song-image">
                                <div class="lsr-trk-wgt-song-text">
                                    <span class="lsr-trk-wgt-title">${displayTitle}</span>
                                    <span class="lsr-trk-wgt-artist">${displaySubtitle}</span>
                                </div>
                            </div>
                        </div>
                        <div class="lsr-trk-wgt-cell lsr-trk-wgt-col-plays">${item.count}</div>
                    </div>
                `;
            });
        }

        tableContainer.innerHTML = rowsHtml;
    }

    async function loadSongs() {
        const tableBody = document.getElementById('lsr-trk-wgt-song-table-body');
        if (!tableBody) return;

        if (!cachedSongs) {
            tableBody.innerHTML = '<div class="lsr-trk-wgt-row"><div class="lsr-trk-wgt-cell" style="text-align:center; padding:20px;">Loading songs...</div></div>';
            cachedSongs = await fetchChartData("detected_songs");
        }
        displayLeaderboard(cachedSongs, 'songs', 'lsr-trk-wgt-song-table-body');
    }

    async function loadArtists() {
        const tableBody = document.getElementById('lsr-trk-wgt-artist-table-body');
        if (!tableBody) return;

        if (!cachedArtists) {
            tableBody.innerHTML = '<div class="lsr-trk-wgt-row"><div class="lsr-trk-wgt-cell" style="text-align:center; padding:20px;">Loading artists...</div></div>';
            cachedArtists = await fetchChartData("artists");
        }
        displayLeaderboard(cachedArtists, 'artists', 'lsr-trk-wgt-artist-table-body');
    }

    function updateChartHeaderText() {
        const titleElement = document.getElementById('lsr-trk-wgt-chart-title');
        if (!titleElement) return;

        const isDesktop = window.innerWidth >= 1100;
        
        if (isDesktop) {
            titleElement.innerText = 'Most played songs and artists';
            loadArtists(); 
        } else {
            const btnSongs = document.getElementById('lsr-trk-wgt-btn-songs');
            const isSongsActive = btnSongs ? btnSongs.classList.contains('lsr-trk-wgt-active') : true;
            titleElement.innerText = isSongsActive ? 'Most played songs' : 'Most played artists';
        }
    }

    function initChartSystem() {
        loadSongs();
        updateChartHeaderText();
    }

    // Chart toggle logic mapped to document body for SPA safety
    document.body.addEventListener('click', (e) => {
        const btnSongs = e.target.closest('#lsr-trk-wgt-btn-songs');
        if (btnSongs) {
            btnSongs.classList.add('lsr-trk-wgt-active');
            document.getElementById('lsr-trk-wgt-btn-artists')?.classList.remove('lsr-trk-wgt-active');
            document.getElementById('lsr-trk-wgt-section-songs')?.classList.add('lsr-trk-wgt-active-section');
            document.getElementById('lsr-trk-wgt-section-artists')?.classList.remove('lsr-trk-wgt-active-section');
            updateChartHeaderText();
            loadSongs();
            return;
        }

        const btnArtists = e.target.closest('#lsr-trk-wgt-btn-artists');
        if (btnArtists) {
            btnArtists.classList.add('lsr-trk-wgt-active');
            document.getElementById('lsr-trk-wgt-btn-songs')?.classList.remove('lsr-trk-wgt-active');
            document.getElementById('lsr-trk-wgt-section-artists')?.classList.add('lsr-trk-wgt-active-section');
            document.getElementById('lsr-trk-wgt-section-songs')?.classList.remove('lsr-trk-wgt-active-section');
            updateChartHeaderText();
            loadArtists();
            return;
        }
    });

    window.addEventListener('resize', updateChartHeaderText);


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

                const metaTags = newDoc.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"], meta[name="description"]');
                metaTags.forEach(newMeta => {
                    const property = newMeta.getAttribute('property');
                    const name = newMeta.getAttribute('name');
                    const selector = property ? `meta[property="${property}"]` : `meta[name="${name}"]`;
                    const currentMeta = document.querySelector(selector);
                    
                    if (currentMeta) {
                        currentMeta.setAttribute('content', newMeta.getAttribute('content'));
                    }
                });
                
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                updateNavLinks();
             
                if (navMenu && navMenu.classList.contains('active')) toggleMenu();

                updatePlayButtons(!radioPlayer.paused);

                // Initialize specific section data based on URL
                if (url.includes('apply')) fetchApplyData();
                if (url.includes('about')) fetchCommitteeData();
                if (url.includes('awards')) fetchAwardsData(); 
                
                if (url.includes('listen')) {
                    updateNowPlaying(); 
                    initChatSystem(); 
                }

                // --- NEW: Hook for Chart ---
                if (url.includes('chart')) {
                    initChartSystem();
                }

                if (url.includes('archives')) { 
                    if (typeof Papa === 'undefined') {
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
                        
                        script.onload = () => {
                            console.log("PapaParse loaded. Building grid...");
                            loadArchiveGrid(); 
                        };
                        
                        document.head.appendChild(script);
                    } else {
                        console.log("PapaParse already exists. Building grid...");
                        loadArchiveGrid();
                    }
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
    fetchAwardsData(); 
    
    if (window.location.pathname.includes('listen')) {
        initChatSystem();
    }

    // --- NEW: Hook for Chart (Direct load check) ---
    if (window.location.pathname.includes('chart')) {
        initChartSystem();
    }

    if (window.location.pathname.includes('archives')) { 
        if (typeof Papa === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
            script.onload = () => loadArchiveGrid(); 
            document.head.appendChild(script);
        } else {
            loadArchiveGrid();
        }
    }

    setInterval(fetchScheduleData, 180000);
});

// --- CONFIGS ---
const chatConfig = {
    apiKey: "#{FIREBASE_API_KEY}#",
    authDomain: "#{FIREBASE_AUTH_DOMAIN}#", 
    projectId: "#{FIREBASE_PROJECT_ID}#",
    storageBucket: "#{FIREBASE_STORAGE_BUCKET}#",
    messagingSenderId: "#{FIREBASE_MESSAGING_SENDER_ID}#",
    appId: "#{FIREBASE_APP_ID}#"
}; 

const counterConfig = {
    apiKey: "#{FIREBASE_API_KEY}#",
    authDomain: "lsrlivecount.firebaseapp.com",
    databaseURL: "https://lsrlivecount-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "lsrlivecount",
    storageBucket: "lsrlivecount.firebasestorage.app",
    messagingSenderId: "#{FIREBASE_MESSAGING_SENDER_ID2}#",
     appId: "#{FIREBASE_APP_ID2}#"
};
// 1. ADD YOUR SHAZAM CONFIG HERE
const shazamConfig = {
 apiKey: "#{FIREBASE_API_KEYSHAZ}",
  authDomain: "shazam-453c8.firebaseapp.com",
  projectId: "shazam-453c8",
  storageBucket: "shazam-453c8.firebasestorage.app",
  messagingSenderId: "765247641391",
  appId: "1:765247641391:web:87f011c239fbd808e033da"
};

// 2. INITIALIZE SHAZAM DB (Safely handling SPA reloads)
const allApps = getApps();
const shazamApp = allApps.some(app => app.name === "shazam") 
    ? getApp("shazam") 
    : initializeApp(shazamConfig, "shazam");


// Global variables to be shared
let db, auth, messagesCollection;
let chatUnsubscribe = null; 

// --- CHAT & COUNTER SYSTEM ---
function initChatSystem() {
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const displayNameInput = document.getElementById('display-name');
    const messageInput = document.getElementById('message-input');
    const loadingSpinner = document.getElementById('loading-spinner');

    const gifPicker = document.getElementById('gif-picker');
    const gifToggleBtn = document.getElementById('gif-toggle-btn');
    const closeGifBtn = document.getElementById('close-gif-btn');
    const gifSearchInput = document.getElementById('gif-search-input');
    const gifResults = document.getElementById('gif-results');

  const joinArea = document.getElementById('join-area');
    const joinBtn = document.getElementById('join-btn');
    const anonBtn = document.getElementById('anon-btn');
  
    
    const chattingAsName = document.getElementById('chatting-as-name');
    const changeNameBtn = document.getElementById('change-name-btn');

    function enterChat(isAnonymous = false) {
        let finalName;
        
        if (isAnonymous) {
            finalName = 'Anonymous';
            displayNameInput.value = ''; 
        } else {
            finalName = displayNameInput.value.trim() || 'Anonymous';
        }

        if (chattingAsName) chattingAsName.innerText = finalName;
        
        if (joinArea) joinArea.style.display = 'none';
        if (chatForm) chatForm.style.display = 'flex';
        if (messageInput) messageInput.focus();
    }

const newMsgIndicator = document.createElement('div');
newMsgIndicator.id = 'new-message-indicator';
newMsgIndicator.innerHTML = '<span>1 new message</span> <i style="border: solid white; border-width: 0 2px 2px 0; display: inline-block; padding: 3px; transform: rotate(45deg); margin-bottom:2px; margin-left:5px;"></i>';
newMsgIndicator.style = `
    position: absolute; bottom: 70px; left: 50%; transform: translateX(-50%);
    background: #FF595E; color: white; padding: 8px 16px; border-radius: 20px;
    cursor: pointer; font-size: 13px; font-weight: bold; display: none; z-index: 10;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: opacity 0.3s;
`;
chatMessages.parentElement.appendChild(newMsgIndicator);

let unreadCount = 0;

newMsgIndicator.addEventListener('click', () => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
    hideIndicator();
});

function hideIndicator() {
    unreadCount = 0;
    newMsgIndicator.style.display = 'none';
}
    
    if (joinBtn && joinArea) {
        joinBtn.addEventListener('click', () => enterChat(false));

        if (anonBtn) {
            anonBtn.addEventListener('click', () => enterChat(true));
        }

        if (displayNameInput) {
            displayNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    enterChat(false);
                }
            });
        }

        if (changeNameBtn) {
            changeNameBtn.addEventListener('click', () => {
                chatForm.style.display = 'none';
                joinArea.style.display = 'flex';
                displayNameInput.focus();
            });
        }
    }
    // --- CUSTOM DELETE POPUP ---
    function showDeleteConfirmation(docId) {
        const chatContainer = chatMessages.parentElement;
        
        if (window.getComputedStyle(chatContainer).position === 'static') {
            chatContainer.style.position = 'relative';
        }

        const modalOverlay = document.createElement('div');
        modalOverlay.style.position = 'absolute'; 
        modalOverlay.style.top = '0';
        modalOverlay.style.left = '0';
        modalOverlay.style.width = '100%'; 
        modalOverlay.style.height = '100%'; 
        modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
        modalOverlay.style.display = 'flex';
        modalOverlay.style.alignItems = 'center';
        modalOverlay.style.justifyContent = 'center';
        modalOverlay.style.zIndex = '99';
        modalOverlay.style.backdropFilter = 'blur(2px)';
        modalOverlay.style.borderRadius = '12px';
        
        const modalBox = document.createElement('div');
        modalBox.style.backgroundColor = 'rgb(205, 50, 50)';
        modalBox.style.padding = '24px';
        modalBox.style.borderRadius = '12px';
        modalBox.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
        modalBox.style.textAlign = 'center';
        modalBox.style.fontFamily = 'inherit';
    
        modalBox.style.maxWidth = '250px'; 

        const text = document.createElement('p');
        text.innerText = "Are you sure you want to delete your message?";
        text.style.margin = '0 0 20px 0';
        text.style.color = 'white';
        text.style.fontSize = '16px';
        text.style.fontWeight = '500';

        const confirmBtn = document.createElement('button');
        confirmBtn.innerText = "Delete";
        confirmBtn.style.marginRight = '12px';
        confirmBtn.style.padding = '10px 18px';
        confirmBtn.style.backgroundColor = 'rgb(160, 43, 43)';
        confirmBtn.style.color = '#fff';
        confirmBtn.style.border = 'solid 1px #8f1818';
        confirmBtn.style.borderRadius = '6px';
        confirmBtn.style.cursor = 'pointer';
        confirmBtn.style.fontWeight = 'bold';

        const cancelBtn = document.createElement('button');
        cancelBtn.innerText = "Cancel";
        cancelBtn.style.padding = '10px 18px';
        cancelBtn.style.backgroundColor = '#E0E0E0';
        cancelBtn.style.color = '#333';
        cancelBtn.style.border = 'solid 1px rgb(207 198 198)';
        cancelBtn.style.borderRadius = '6px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.fontWeight = 'bold';

        modalBox.appendChild(text);
        modalBox.appendChild(confirmBtn);
        modalBox.appendChild(cancelBtn);
        modalOverlay.appendChild(modalBox);
        
        chatContainer.appendChild(modalOverlay);
        
        confirmBtn.addEventListener('click', async () => {
            try {
                confirmBtn.innerText = "Deleting...";
                await deleteDoc(doc(db, "messages", docId));
            } catch (error) {
                console.error("Error deleting message:", error);
            } finally {
                if (chatContainer.contains(modalOverlay)) {
                    chatContainer.removeChild(modalOverlay);
                }
            }
        });

        cancelBtn.addEventListener('click', () => {
            if (chatContainer.contains(modalOverlay)) {
                chatContainer.removeChild(modalOverlay);
            }
        });
    }

    function displayMessage(messageDoc, prepend = false) {
        const messageData = messageDoc.data({ serverTimestamps: 'estimate' });
        const docId = messageDoc.id; 
        
        const name = messageData.name || 'Anonymous';
        const text = messageData.text || '';
        const gifUrl = messageData.gifUrl; 
        const createdAt = messageData.createdAt;
        const senderUid = messageData.uid; 
        let timestampString = '';
        
        if (createdAt && typeof createdAt.toDate === 'function') {
            const date = createdAt.toDate();
            const chatDateOptions = { 
                timeZone: 'Europe/London', 
                weekday: 'short', 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
            };
            timestampString = new Intl.DateTimeFormat('en-GB', chatDateOptions).format(date).replace(',', '');
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = 'message-entry';
        msgDiv.id = `msg-${docId}`; 
        
        const iconDiv = document.createElement('div');
        iconDiv.className = 'message-icon';
        iconDiv.style.background = 'transparent'; 
        
        const avatarImg = document.createElement('img');
        avatarImg.alt = `${name}'s Avatar`;
        avatarImg.style.width = '100%';
        avatarImg.style.height = '100%';
        avatarImg.style.borderRadius = '50%'; 
        avatarImg.style.objectFit = 'cover';
        avatarImg.loading = 'lazy';

        const fallbackImage = `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(name)}&randomizeIds=true&backgroundColor=FF9296&scale=85&mouth=lilSmile&eyes=closed2`; 

        if (name === 'Anonymous') {
            avatarImg.src = fallbackImage; 
        } else {
            avatarImg.src = `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(name)}&randomizeIds=true&backgroundColor=71cf62,fcbc34,FF595E,A1E197,FDD881,FDCA5C,89D67D&scale=90&mouth=cute,wideSmile,shout,smileLol,tongueOut&eyes=closed,cute,glasses,wink2,crying`;   
        }

        avatarImg.onerror = function() {
            if (this.src !== fallbackImage) {
                this.src = fallbackImage;
            }
        };

        iconDiv.appendChild(avatarImg);

        const textDiv = document.createElement('div');
        textDiv.className = 'message-content'; 
        
        let contentHtml = `
            <div class="message-header">
                <strong class="message-author">${name}</strong>
                <span class="message-timestamp">${timestampString}</span>
            </div>
            <div class="message-body">${text}</div>
        `;
        
        if (gifUrl) {
            contentHtml += `<img src="${gifUrl}" alt="GIF" class="chat-message-gif" onload="document.getElementById('chat-messages').scrollTop = document.getElementById('chat-messages').scrollHeight" style="max-width: 200px; min-height: 120px; border-radius: 8px; margin-top: 5px; display: block;" />`;
        }

        textDiv.innerHTML = contentHtml;
        
        if (auth.currentUser && senderUid === auth.currentUser.uid) {
            msgDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.04)'; 
            msgDiv.style.borderRadius = '8px';
            msgDiv.style.padding = '8px';
            
            const deleteBtn = document.createElement('span');
           deleteBtn.innerHTML = '&times;';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.fontSize = '19px';
            deleteBtn.style.color = '#FF595E';
            
            deleteBtn.style.alignSelf = 'center'; 
           
            deleteBtn.title = "Delete Message";
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                showDeleteConfirmation(docId);
            });

            msgDiv.appendChild(deleteBtn);
        }
        
        msgDiv.appendChild(iconDiv);
        msgDiv.appendChild(textDiv);

        if (prepend) {
            chatMessages.insertBefore(msgDiv, chatMessages.firstChild);
        } else {
            chatMessages.appendChild(msgDiv);
        }
    }
    

    if (gifToggleBtn && gifPicker && closeGifBtn) {
        gifToggleBtn.addEventListener('click', () => {
            gifPicker.style.display = gifPicker.style.display === 'none' ? 'flex' : 'none';
            if (gifPicker.style.display === 'flex') {
                fetchGifs(''); 
                if (gifSearchInput && window.innerWidth > 768) {
                    gifSearchInput.focus({ preventScroll: true }); 
                }
            }
        });

        closeGifBtn.addEventListener('click', () => {
            gifPicker.style.display = 'none';
        });
    }

    const GIPHY_API_KEY = "zhbz8Mvx3vRQHBkQo3nnWWbyHQMOVsFn"; 

    async function fetchGifs(searchTerm) {
        if (!gifResults) return;
        gifResults.innerHTML = '<p style="text-align:center; grid-column: 1 / -1;">Loading...</p>';
        
        const myFavoriteGifs = "l3vRlT2k2L35Cnn5C,mBdbauuNxUpnqr1B1u,FdRzET4jjKt4HVzri7,wW95fEq09hOI8,GWKQzZX7bNqRMO6bMw,mGK1g88HZRa2FlKGbz,SDeVLvFCqFsSA,RX7N03MEUafW8,gKHGnB1ml0moQdjhEJ,qzlUJOV5ON8XkHbO53,kCpg2FYkENfnuvXSsS,QxcSqRe0nllClKLMDn,g88xUM1rTwjfLhoRYP,13hxeOYjoTWtK8,3o72FcJmLzIdYJdmDe,ujTVMASREzuRbH6zy5"; 
        
        const endpoint = searchTerm.trim() === '' 
            ? `https://api.giphy.com/v1/gifs?api_key=${GIPHY_API_KEY}&ids=${myFavoriteGifs}`
            : `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchTerm)}&limit=12&rating=pg-13`;

        try {
            const response = await fetch(endpoint);
            const result = await response.json();
            
            gifResults.innerHTML = ''; 
            
            if (result.data && result.data.length > 0) {
                result.data.forEach(gif => {
                    const previewUrl = gif.images.fixed_height_small.url;
                    const fullUrl = gif.images.downsized.url;

                    const img = document.createElement('img');
                    img.src = previewUrl;
                    img.alt = gif.title || "GIF";
                    
                    img.addEventListener('click', () => {
                        sendGifMessage(fullUrl);
                        gifPicker.style.display = 'none'; 
                    });
                    
                    gifResults.appendChild(img);
                });
            } else {
                gifResults.innerHTML = '<p style="text-align:center; grid-column: 1 / -1;">No GIFs found.</p>';
            }
        } catch (error) {
            console.error("Error fetching GIFs:", error);
            gifResults.innerHTML = '<p style="text-align:center; grid-column: 1 / -1; color:red;">Failed to load GIFs.</p>';
        }
    }

    let typingTimer;
    if (gifSearchInput) {
        gifSearchInput.addEventListener('keyup', () => {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                fetchGifs(gifSearchInput.value);
            }, 500);
        });
    }

    async function sendGifMessage(gifUrl) {
        const displayName = displayNameInput.value.trim() || 'Anonymous';
        if (!messagesCollection) return;
        
        try {
            await addDoc(messagesCollection, {
                name: displayName,
                uid: auth.currentUser ? auth.currentUser.uid : null,
                text: "", 
                gifUrl: gifUrl,
                createdAt: serverTimestamp(),
                expiresAt: Timestamp.fromDate(new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)))
            });
        } catch (err) { 
            console.error("Send GIF Error:", err); 
        }
    }

    async function handleSendMessage(e) {
        e.preventDefault();
        const messageText = messageInput.value.trim();
        const displayName = displayNameInput.value.trim() || 'Anonymous';
        if (messageText === '' || !messagesCollection) return;
        try {
            await addDoc(messagesCollection, {
                name: displayName,
                uid: auth.currentUser ? auth.currentUser.uid : null, 
                text: messageText,
                createdAt: serverTimestamp(),
                expiresAt: Timestamp.fromDate(new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)))
            });
            messageInput.value = '';
        } catch (err) { console.error("Send Error:", err); }
    }

    chatForm.addEventListener('submit', handleSendMessage);
    
    const allApps = getApps();
    const chatApp = allApps.some(app => app.name === "chat") 
        ? getApp("chat") 
        : initializeApp(chatConfig, "chat");
        
    const counterApp = allApps.some(app => app.name === "counter") 
        ? getApp("counter") 
        : initializeApp(counterConfig, "counter");
    
    db = getFirestore(chatApp);
    auth = getAuth(chatApp);
    const rtdb = getDatabase(counterApp);

    chatMessages.addEventListener('scroll', () => {
    const isAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 20;
    if (isAtBottom) {
        hideIndicator();
    }
});

    
   const liveId = sessionStorage.getItem('liveId') || Math.random().toString(36).substring(2);
sessionStorage.setItem('liveId', liveId);

const userRef = ref(rtdb, 'active/' + liveId);
set(userRef, Date.now());
setInterval(() => set(userRef, Date.now()), 30000);
window.addEventListener("beforeunload", () => remove(userRef));

const activeRef = ref(rtdb, 'active');
const countEl = document.getElementById("live-count");

if (countEl) {
    countEl.innerHTML = '<span class="spinneractive"></span>'; 
}

onValue(activeRef, snap => {
    const data = snap.val() || {};
    const activeUsers = Object.values(data).filter(ts => Date.now() - ts < 300000).length;

    if (countEl) {
        countEl.textContent = activeUsers;
    }
});

    onAuthStateChanged(auth, (user) => {
        if (user) {
            messagesCollection = collection(db, "messages");
            const q = query(messagesCollection, orderBy("createdAt", "asc"), limitToLast(50));
            
            let isFirstLoad = true; 
          let newestMessageTime = 0; 
          
          if (chatUnsubscribe) {
              chatUnsubscribe();
          }
            
          chatUnsubscribe = onSnapshot(q, (snapshot) => {
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    
    const isAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 50;

    if (isFirstLoad) {
        chatMessages.innerHTML = snapshot.empty ? '<p style="text-align:center; color:#888;">No messages yet.</p>' : '';
    }

    snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
            const data = change.doc.data({ serverTimestamps: 'estimate' });
            const msgTime = data.createdAt ? data.createdAt.toMillis() : Date.now();

            if (isFirstLoad) {
                displayMessage(change.doc);
                if (msgTime > newestMessageTime) newestMessageTime = msgTime;
            } else {
                if (msgTime >= newestMessageTime) {
                    displayMessage(change.doc, false);
                    if (msgTime > newestMessageTime) newestMessageTime = msgTime;

                    if (isAtBottom) {
                        setTimeout(() => { chatMessages.scrollTop = chatMessages.scrollHeight; }, 50);
                        hideIndicator();
                    } else {
                        unreadCount++;
                        newMsgIndicator.querySelector('span').innerText = `${unreadCount} new message${unreadCount > 1 ? 's' : ''}`;
                        newMsgIndicator.style.display = 'block';
                    }
                } else {
                    displayMessage(change.doc, true);
                }
            }
        }
                    
                    if (change.type === "removed") {
                        const messageToRemove = document.getElementById(`msg-${change.doc.id}`);
                        if (messageToRemove) {
                            messageToRemove.remove();
                        }
                    }
                });

               if (isFirstLoad) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
        isFirstLoad = false;
    }
            });
        }
    });
    signInAnonymously(auth);
}

window.initChatSystem = initChatSystem;
