import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
// --- MODIFIED: Added getDocs and limit to the import below ---
import { getFirestore, collection, addDoc, serverTimestamp, Timestamp, query, orderBy, limitToLast, onSnapshot, doc, deleteDoc, getDocs, limit } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getDatabase, ref, onValue, set, remove } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 0. AUTO-UPDATE ACADEMIC YEAR ---
    const yearSpan = document.getElementById('committee-year');
    if (yearSpan) {
        const now = new Date();
        const currentMonth = now.getMonth(); // 7 is August
        const currentYear = now.getFullYear();

        // If it's August (7) or later, the academic year starts this year. Otherwise, it started last year.
        const startYear = currentMonth >= 7 ? currentYear : currentYear - 1;
        
        // Grab the last two digits of the next year (e.g., 2027 becomes "27")
        const endYear = (startYear + 1).toString().slice(-2);

        yearSpan.textContent = `${startYear}/${endYear}`;
    }
    
    
   // --- 0.5 INIT PLAYER SKELETONS ---
    // Only init if the player bar hasn't already loaded in this session
    if (!window.__playerBarLoaded) {
        const playerUIElements = document.querySelectorAll(
            '#live-now-title, #live-now-desc, #live-now-img, #up-next-title, #up-next-desc, #up-next-img, .live-badge, .next-badge, .visualizer'
        );

        playerUIElements.forEach(el => {
            el.classList.add('player-is-loading', 'player-fade-transition');
        });
    }

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


    // --- SHARE BUTTON LOGIC ---
const shareBtn = document.getElementById('share-btn');
if (shareBtn) {
    shareBtn.addEventListener('click', () => {
        const title = document.getElementById('main-player-title')?.innerText || 'LSR';
        const liveText = document.getElementById('live-text')?.innerText || '';
        
        // Extract the end time from the text "LIVE NOW (10:00 - 11:00)"
        let endTime = 'later';
        const timeMatch = liveText.match(/- (.*?)\)/);
        if (timeMatch && timeMatch[1]) {
            endTime = timeMatch[1].trim();
        }

        const link = 'https://thisislsr.com/listen';
        const shareText = `hey! ${title} is live now until ${endTime}, listen here: ${link}`;

        // Uses Native Web Share API if available (Mobile), else copies to clipboard
        if (navigator.share) {
            navigator.share({
                title: 'Listen to LSR',
                text: shareText,
            }).catch((error) => console.log('Error sharing:', error));
        } else {
            navigator.clipboard.writeText(shareText).then(() => {
                const status = document.getElementById('shazam-status');
                if (status) {
                    status.innerText = "Link copied!";
                    setTimeout(() => status.innerText = "", 3000);
                }
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        }
    });
}

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
    
    
    
   // --- 4. COMMITTEE LOGIC (WITH MODAL SUPPORT & TRANSITION) ---
const committeeSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRoXcefXiUOFuRnA6DpheBwR2CJ4Zs09o68IG9in3w2WwncXybxsbVDWwQY6u6MSpmFDiRrx83MO8M3/pub?gid=2123499295&output=csv';

async function fetchCommitteeData() {
    const grid = document.getElementById('committee-grid-container');
    if (!grid) return;

    try {
        const response = await fetch(committeeSheetUrl);
        const data = await response.text();
        const rows = parseCSV(data);
        rows.shift(); 
        
        // 1. Trigger fade out of skeletons
        grid.style.opacity = '0';
        
        // 2. Wait for transition to complete before swapping DOM
        setTimeout(() => {
            grid.innerHTML = '';

            rows.forEach(row => {
                if (!row || !row[1] || row[1].trim() === '') return;
                const name = row[1].trim();
                const role = row[2] ? row[2].trim() : 'Committee Member';
                const imgLink = row[3] ? row[3].trim() : 'https://via.placeholder.com/300x300?text=No+Image';

                const card = document.createElement('div');
                card.className = 'committee-card';
                card.innerHTML = `
                    <img src="${imgLink}" alt="${name}" loading="lazy">
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
            
            // 3. Trigger fade back in with real data
            grid.style.opacity = '1';
        }, 300); // 300ms matches the CSS transition time

    } catch (error) {
        console.error("Failed to fetch committee data", error);
        grid.innerHTML = '<p style="color:white; text-align:center;">Failed to load committee members.</p>';
        grid.style.opacity = '1';
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

    // Clean up string: remove spaces, convert to lowercase (e.g. " 9:00 PM " -> "9:00pm")
    const cleanStr = timeStr.toString().trim().toLowerCase();

    // Match patterns like: "9pm", "9:30pm", "19:00", "7.30 pm", "12:00am", "9"
    const match = cleanStr.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);

    if (!match) return -1;

    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const meridian = match[3]; // 'am', 'pm', or undefined

    if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes > 59) return -1;

    // Handle 12-hour format with AM / PM
    if (meridian === 'pm') {
        if (hours < 12) hours += 12;
    } else if (meridian === 'am') {
        if (hours === 12) hours = 0;
    }

    // Standard 24h sanity check (e.g., 24:00 -> 0:00)
    if (hours === 24) hours = 0;
    if (hours < 0 || hours > 23) return -1;

    return hours * 60 + minutes;
}

    function getCurrentWeekType() {
        const nowMs = Date.now(); 
        const diffInMs = nowMs - TERM_START_DATE;
        const diffInWeeks = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 7));
        return (diffInWeeks % 2 === 0) ? 'A' : 'B';
    }
function matchesWeek(sheetWeek, targetWeek) {
    // If the cell is completely blank or undefined, assume it runs EVERY week
    if (!sheetWeek || sheetWeek.toString().trim() === '') {
        return true; 
    }
    
    const w = sheetWeek.toString().trim().toUpperCase();
    const target = (targetWeek || '').toString().toUpperCase();
    
    // Check for any keywords that imply the show runs both weeks
    if (w.includes('BOTH') || w.includes('EVERY') || w.includes('ALL') || w.includes('WEEKLY')) {
        return true;
    }
    
    // If they typed "A & B" or "A, B", this will ensure it matches regardless of the current week
    if (w.includes('A') && w.includes('B')) {
        return true;
    }
    
    // Otherwise, check if the specific week letter (A or B) is in the string
    return w.includes(target);
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
        const week = row[5]?.trim() || '';
        return day.toLowerCase() === currentDay.toLowerCase() && matchesWeek(week, realWeek);
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
let upcomingShows = []; // Holds the next 3 shows

for (let i = 0; i < parsedShows.length; i++) {
    const show = parsedShows[i];
    const isLive = (show.start <= show.end) 
        ? (currentMinutes >= show.start && currentMinutes < show.end)
        : (currentMinutes >= show.start || currentMinutes < show.end);

    if (isLive) {
        liveShow = show;
        nextShow = parsedShows[i + 1] || null;
        if (parsedShows[i + 1]) upcomingShows.push(parsedShows[i + 1]);
        if (parsedShows[i + 2]) upcomingShows.push(parsedShows[i + 2]);
        if (parsedShows[i + 3]) upcomingShows.push(parsedShows[i + 3]); // ADDED
        break;
    } else if (show.start > currentMinutes && !liveShow) {
        nextShow = show;
        upcomingShows.push(show);
        if (parsedShows[i + 1]) upcomingShows.push(parsedShows[i + 1]);
        if (parsedShows[i + 2]) upcomingShows.push(parsedShows[i + 2]); // ADDED
        break;
    }
}

    const intendedTitle = liveShow ? liveShow.title : "No show currently live";
    const lnTitle = document.getElementById('live-now-title');
    const mainTitle = document.getElementById('main-player-title');

    const safeIntended = intendedTitle.trim().toLowerCase();
    const currentBarText = lnTitle ? lnTitle.textContent.trim().toLowerCase() : "";
    const currentMainText = mainTitle ? mainTitle.textContent.trim().toLowerCase() : "";

    const isPlayerBarLoaded = window.__playerBarLoaded && lnTitle && currentBarText === safeIntended && !lnTitle.classList.contains('player-is-loading');
    const isMainPlayerLoaded = !mainTitle || (mainTitle && currentMainText === safeIntended);

    if (isPlayerBarLoaded && isMainPlayerLoaded) {
        return; 
    }

    const elementsToFade = [];

    if (!isPlayerBarLoaded) {
        const barEls = document.querySelectorAll(
            '#live-now-title, #live-now-desc, #live-now-img, #up-next-title, #up-next-desc, #up-next-img, .live-badge, .next-badge, .visualizer'
        );
        elementsToFade.push(...barEls);
    }

    if (!isMainPlayerLoaded) {
        const mainEls = document.querySelectorAll(
            '#main-player-title, #main-player-desc, #main-player-img, #main-player-host, #live-text, #main-player-time'
        );
        elementsToFade.push(...mainEls);

        // --- NEW: SKELETON TOGGLE ON ---
        const mainSkel = document.getElementById('main-card-skeleton');
        const altSkel = document.getElementById('alternative-card-skeleton');
        const realMain = document.querySelector('.main-card:not(.lsr-card-skeleton)');
        const realAlt = document.getElementById('alternative-card');

        if (mainSkel && realMain) {
            mainSkel.style.display = 'flex';
            realMain.style.display = 'none';
        }
        if (altSkel && realAlt) {
            altSkel.style.display = 'flex';
            realAlt.style.display = 'none';
        }
    }

   // 1. Trigger Fade Out for inner elements
    elementsToFade.forEach(el => el.style.opacity = '0');

    // --- NEW: Smooth fade out for skeletons ---
    const mainSkel = document.getElementById('main-card-skeleton');
    const altSkel = document.getElementById('alternative-card-skeleton');
    
    if (!isMainPlayerLoaded) {
        if (mainSkel) mainSkel.style.opacity = '0';
        if (altSkel) altSkel.style.opacity = '0';
    }

    // 2. Update Content and Fade In
  setTimeout(() => {
        const defaultImg = "/ourlogo.jpeg";

        if (!isPlayerBarLoaded) {
            const lnImg = document.getElementById('live-now-img');
            const lnDesc = document.getElementById('live-now-desc');

            if (liveShow) {
                if (lnTitle) lnTitle.textContent = liveShow.title;
                if (lnImg) lnImg.src = liveShow.image;
                if (lnDesc) lnDesc.textContent = liveShow.description;
                updateMediaSession(liveShow);
            } else {
                if (lnTitle) lnTitle.textContent = "No show currently live";
                if (lnImg) lnImg.src = defaultImg;
                if (lnDesc) lnDesc.textContent = "No show is live right now :(";
                updateMediaSession({
                    title: "OFF AIR", 
                    host: "Leeds Student Radio", 
                    image: defaultImg
                });
            }

            const nextT = document.getElementById('up-next-title');
            const nextI = document.getElementById('up-next-img');
            const nextD = document.getElementById('up-next-desc'); 

            if (nextShow) {
                if (nextT) nextT.textContent = nextShow.title;
                if (nextI) nextI.src = nextShow.image;
                if (nextD) nextD.textContent = nextShow.description;
            } else {
                if (nextT) nextT.textContent = "No show next";
                if (nextI) nextI.src = defaultImg;
                if (nextD) nextD.textContent = "Check the schedule for our next show!";
            }

           

            

            window.__playerBarLoaded = true;
        }
const nextContainer = document.getElementById('next-two-shows-container');
if (nextContainer) {
    nextContainer.innerHTML = '';
    if (upcomingShows.length > 0) {
        upcomingShows.slice(0, 3).forEach(s => { // CHANGED to 3
            nextContainer.innerHTML += `
                <div class="next-show-item">
                    <img src="${s.image}" alt="Show Art">
                    <div class="next-show-meta">
                        <h4>${s.title}</h4>
                        <p>${s.rawStart} - ${s.rawEnd} | With ${s.host}</p>
                    </div>
                </div>
            `;
        });
    } else {
        nextContainer.innerHTML = '<p style="font-size:0.85rem; opacity:0.8; padding:10px 0;">No more shows scheduled today.</p>';
    }
}

      
        if (!isMainPlayerLoaded && mainTitle) {
            if (liveShow) {
                mainTitle.textContent = liveShow.title;
                const hostEl = document.getElementById('main-player-host');
                if (hostEl) hostEl.textContent = "with " + liveShow.host;
                const descEl = document.getElementById('main-player-desc');
                if (descEl) descEl.textContent = liveShow.description;
                const imgEl = document.getElementById('main-player-img');
                if (imgEl) imgEl.src = liveShow.image;
                const liveTextEl = document.querySelector('#live-text');
                if (liveTextEl) liveTextEl.textContent = `LIVE NOW (${liveShow.rawStart} - ${liveShow.rawEnd})`;
            } else {
                mainTitle.textContent = "OFF AIR";
                const hostEl = document.getElementById('main-player-host');
                if (hostEl) hostEl.textContent = "ZZZ";
                const descEl = document.getElementById('main-player-desc');
                if (descEl) descEl.textContent = "Our hosts are sleeping now! Check the schedule for our next show.";
                const imgEl = document.getElementById('main-player-img');
                if (imgEl) imgEl.src = defaultImg;
                const timeEl = document.getElementById('main-player-time');
                if (timeEl) timeEl.textContent = `OFF AIR`;
            }

            // --- NEW: Smooth fade in for real cards ---
            const realMain = document.querySelector('.main-card:not(.lsr-card-skeleton)');
            const realAlt = document.getElementById('alternative-card');

            if (mainSkel && realMain) {
                mainSkel.style.display = 'none';
                realMain.style.display = ''; 
                void realMain.offsetWidth; // MAGIC TRICK: Forces browser to register display change before fading
                realMain.style.opacity = '1';
            }
            if (altSkel && realAlt) {
                altSkel.style.display = 'none';
                realAlt.style.display = ''; 
                void realAlt.offsetWidth; // MAGIC TRICK: Forces browser to register display change before fading
                realAlt.style.opacity = '1';
            }
        }

        // 3. Remove skeleton class and fade in revealed inner elements
        elementsToFade.forEach(el => {
            el.classList.remove('player-is-loading');
            el.classList.add('player-fade-transition');
            el.style.opacity = '1';
        });

    }, 300);
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
                const rowWeek = row[5]?.trim() || '';
                return rowDay.toLowerCase() === day.toLowerCase() && matchesWeek(rowWeek, weekLetter);
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
    // 1. Calculate duration in minutes
    let startMins = timeToMinutes(show.start);
    let endMins = timeToMinutes(show.end);
    
    // Handle shows that cross midnight (e.g., 23:00 to 01:00)
    if (endMins < startMins) endMins += (24 * 60); 
    let duration = endMins - startMins;

    // 2. Add dynamic classes
    if (isShowLive(show.day, show.start, show.end) && weekLetter === realWeek) {
        showEl.classList.add('is-live');
    }
    if (duration >= 120) {
        showEl.classList.add('show-card-2h');
    }
    if (show.color && show.color.trim() !== "") {
        showEl.style.backgroundColor = show.color.trim();
    }

    // 3. Conditionally render the duration label
    let durationText = '';
    if (duration >= 120) {
        let hours = Math.round(duration / 60);
        durationText = `<span class="duration-label">${hours} hour show</span>`;
    }

    // 4. Inject HTML
    showEl.innerHTML = `
        <img src="${show.img}" alt="${show.title}">
        <div class="show-card-meta">
            <h4>${show.title}</h4>
            <p>${show.start} - ${show.end}</p>
            ${durationText}
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
function loadArchiveGrid() {
  const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRoXcefXiUOFuRnA6DpheBwR2CJ4Zs09o68IG9in3w2WwncXybxsbVDWwQY6u6MSpmFDiRrx83MO8M3/pub?gid=897108323&output=csv';

  const grid = document.getElementById('dynamic-archive-grid');
  const loadMoreBtn = document.getElementById('load-more-btn');
  
  // Updated Modal Elements
  const modal = document.getElementById('archive-lightbox-modal');
  const modalImg = document.getElementById('archive-lightbox-img');
  const modalTitle = document.getElementById('archive-lightbox-title');
  const modalDesc = document.getElementById('archive-lightbox-desc');
  const closeBtn = document.querySelector('.archive-lightbox-close');

  if (!grid) return;

  let allData = [];
  let currentIndex = 0;
  const batchSize = 12;

  // --- Modal Logic ---
  function openModal(imgSrc, title, desc) {
    modalImg.src = imgSrc;
    modalTitle.textContent = title || '';
    modalDesc.innerHTML = desc || ''; 
    modal.classList.add('archive-lightbox-show');
    document.body.style.overflow = 'hidden'; 
  }

  function closeModal() {
    modal.classList.remove('archive-lightbox-show');
    document.body.style.overflow = ''; 
    setTimeout(() => { modalImg.src = ''; }, 300); 
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // --- Render Logic ---
  function renderBatch() {
    const slice = allData.slice(currentIndex, currentIndex + batchSize);

    slice.forEach(item => {
      if (!item.image_url) return;

      const div = document.createElement('div');
      div.className = 'archive-item';

      const img = document.createElement('img');
      img.src = item.image_url;
      img.loading = currentIndex < 12 ? "eager" : "lazy";

      div.addEventListener('click', () => {
        openModal(item.image_url, item.title, item.caption);
      });

      div.appendChild(img);
      grid.appendChild(div);
    });

    currentIndex += batchSize;

    if (currentIndex >= allData.length) {
      if(loadMoreBtn) loadMoreBtn.style.display = 'none';
    }
  }

  Papa.parse(sheetUrl, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      allData = results.data.reverse();
      grid.innerHTML = ''; 
      renderBatch();
      if(loadMoreBtn) loadMoreBtn.addEventListener('click', renderBatch);
    },
    error: function(error) {
      console.error("Error fetching data:", error);
      grid.innerHTML = "<p>Sorry, could not load the archive.</p>";
    }
  });
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

                // FIXED: Support missing titles for artists in Top 5 Card
                const displayTitle = viewType === 'artists' ? (item.artist || item.name || 'Unknown Artist') : (item.title || item.name || 'Unknown Song');
                const displaySubtitle = viewType === 'songs' ? (item.artist || 'Unknown Artist') : "Total Plays";

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

// --- 6.8 STATUS POPUP LOGIC ---
    async function fetchStatusPopupData() {
        // 1. Check if we've already checked for the popup this session
        if (sessionStorage.getItem('lsrPopupChecked')) {
            return; // Exit immediately, don't fetch or show anything
        }

        const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRoXcefXiUOFuRnA6DpheBwR2CJ4Zs09o68IG9in3w2WwncXybxsbVDWwQY6u6MSpmFDiRrx83MO8M3/pub?output=csv&gid=384985644";
        
        try {
            const response = await fetch(sheetUrl);
            const csvText = await response.text();
            
            // 2. Mark as checked so it doesn't run again on other pages or reloads
            sessionStorage.setItem('lsrPopupChecked', 'true');
            
            const rows = parseCSV(csvText);
            
            if (rows.length < 2) return; 
            
            const headers = rows[0].map(header => header ? header.trim().toLowerCase() : '');
            
            const statusIdx = headers.indexOf('status');
            const holidayTypeIdx = headers.indexOf('holiday_type');
            const returnDateIdx = headers.indexOf('return_date');

            if (statusIdx === -1 || holidayTypeIdx === -1 || returnDateIdx === -1) {
                console.error("LSR Popup: Missing required columns in sheet.");
                return;
            }

            const dataRow = rows[1].map(cell => cell ? cell.trim() : '');
            const status = dataRow[statusIdx].toLowerCase();

            if (status === 'away') {
                const holidayType = dataRow[holidayTypeIdx];
                const returnDate = dataRow[returnDateIdx];
                
                const popupText = document.getElementById('lsr-popup-text');
                const popup = document.getElementById('lsr-status-popup');

               if (popupText && popup) {
    popupText.innerHTML = `
        <h3>Thanks for tuning in!</h3>
        <p>(Un)fortunately, we are away on ${holidayType} and will be back ${returnDate}.</p>
    `;
   popup.classList.add('show');
}
            }
        } catch (error) {
            console.error('Error fetching LSR status:', error);
        }
    }

   const popupCloseBtn = document.getElementById('lsr-popup-close');
if (popupCloseBtn) {
    popupCloseBtn.addEventListener('click', () => {
        const popup = document.getElementById('lsr-status-popup');
        popup.classList.remove('show');
        // Optional: fully hide after transition
        setTimeout(() => { popup.style.visibility = 'hidden'; }, 300);
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
               // INSIDE: loadPage(url)

                // Initialize specific section data based on URL
                if (url.includes('apply')) fetchApplyData();
                if (url.includes('about')) fetchCommitteeData();
                if (url.includes('awards')) fetchAwardsData(); 
                
                if (url.includes('listen')) {
                    updateNowPlaying(); 
                    initChatSystem(); 
                    initChartSystem(); // <--- ADD THIS LINE
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
    fetchStatusPopupData();
    
  if (window.location.pathname.includes('listen')) {
    initChatSystem();
    initChartSystem(); // This triggers the top 5 to load!
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
  
    if (anonBtn) {
    anonBtn.addEventListener('click', () => enterChat(true));
}
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
    const isOwn = auth.currentUser && senderUid === auth.currentUser.uid;

    let timestampString = '';
    if (createdAt && typeof createdAt.toDate === 'function') {
        const date = createdAt.toDate();
        timestampString = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false
        }).format(date);
    }

    // Grouping: check the neighbouring message to decide if we hide avatar/name
    const neighbour = prepend ? chatMessages.firstElementChild : chatMessages.lastElementChild;
    const groupKey = senderUid || name;
    const isGrouped = neighbour && neighbour.dataset && neighbour.dataset.groupKey === groupKey;

    const msgDiv = document.createElement('div');
    msgDiv.className = `message-entry ${isOwn ? 'is-own' : ''} ${isGrouped ? 'is-grouped' : ''}`;
    msgDiv.id = `msg-${docId}`;
    msgDiv.dataset.groupKey = groupKey;

    const iconDiv = document.createElement('div');
    iconDiv.className = 'message-icon';
    const avatarImg = document.createElement('img');
    avatarImg.alt = `${name}'s Avatar`;
    avatarImg.style.width = '100%';
    avatarImg.style.height = '100%';
    avatarImg.style.objectFit = 'cover';
    avatarImg.loading = 'lazy';
    const fallbackImage = `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(name)}&randomizeIds=true&backgroundColor=FF9296&scale=85&mouth=lilSmile&eyes=closed2`;
    avatarImg.src = name === 'Anonymous'
        ? fallbackImage
        : `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(name)}&randomizeIds=true&backgroundColor=71cf62,fcbc34,FF595E,A1E197,FDD881,FDCA5C,89D67D&scale=90&mouth=cute,wideSmile,shout,smileLol,tongueOut&eyes=closed,cute,glasses,wink2,crying`;
    avatarImg.onerror = function () { if (this.src !== fallbackImage) this.src = fallbackImage; };
    iconDiv.appendChild(avatarImg);

    const colDiv = document.createElement('div');
    colDiv.className = 'message-col';

    const metaDiv = document.createElement('div');
    metaDiv.className = 'message-meta';
    metaDiv.innerHTML = `<strong class="message-author">${name}</strong><span class="message-timestamp">${timestampString}</span>`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    if (text) bubble.innerHTML = escapeHtml(text);
    if (gifUrl) {
        const gifImg = document.createElement('img');
        gifImg.src = gifUrl;
        gifImg.alt = 'GIF';
        gifImg.className = 'chat-message-gif';
        gifImg.onload = () => { chatMessages.scrollTop = chatMessages.scrollHeight; };
        bubble.appendChild(gifImg);
    }

    colDiv.appendChild(metaDiv);
    colDiv.appendChild(bubble);

    if (isOwn) {
        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'message-delete';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Delete message';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showDeleteConfirmation(docId);
        });
        msgDiv.appendChild(deleteBtn);
    }

    msgDiv.appendChild(iconDiv);
    msgDiv.appendChild(colDiv);

    if (prepend) {
        chatMessages.insertBefore(msgDiv, chatMessages.firstChild);
    } else {
        chatMessages.appendChild(msgDiv);
    }
}

// simple text-safety helper (put this near displayMessage)
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
