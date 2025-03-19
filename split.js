document.addEventListener('DOMContentLoaded', function() {
const livestreamElement = document.getElementById('livestream');

// Ensure the MediaSession API is supported
if ('mediaSession' in navigator) {
    // Set up metadata for the media session
    navigator.mediaSession.metadata = new MediaMetadata({
      
      
    });


}
 function refreshWidget() {
    const container = document.getElementById('widget-container1');

    // Clear the container
    container.innerHTML = '';

    // Re-add the WidgetBot widget and script
    const widgetBotElement = document.createElement('widgetbot');
    widgetBotElement.setAttribute('server', '1315795219559743488');
    widgetBotElement.setAttribute('channel', '1315795220603998293');
    widgetBotElement.setAttribute('width', '520px');
    widgetBotElement.setAttribute('height', '500px');
    container.appendChild(widgetBotElement);

    const scriptElement = document.createElement('script');
    scriptElement.src = 'https://cdn.jsdelivr.net/npm/@widgetbot/html-embed';
    container.appendChild(scriptElement);

    console.log('Widget refreshed!');
  }
   function refreshChat() {
      const iframe = document.getElementById('chilll');
      iframe.src = iframe.src; // Reload the iframe
      console.log('Chat iframe refreshed');
    }
    (function (c, l, a, r, i, t, y) {
        c[a] =
          c[a] ||
          function () {
            (c[a].q = c[a].q || []).push(arguments);
          };
        t = l.createElement(r);
        t.async = 1;
        t.src = "https://www.clarity.ms/tag/" + i;
        y = l.getElementsByTagName(r)[0];
        y.parentNode.insertBefore(t, y);
      })(window, document, "clarity", "script", "j1xid1iq0r");
      
      document.getElementById('menu-toggle').addEventListener('click', function (e) {
    const dropdownMenu = document.getElementById('dropdown-menufull');
    const normalIcon = this.querySelector('.menu-icon.normal');  // Normal icon (☰)
    const rotatedIcon = this.querySelector('.menu-icon.rotated'); // Rotated icon (x)

    // Toggle visibility of the menu icons
    normalIcon.classList.toggle('hidden');
    rotatedIcon.classList.toggle('show');

    // Toggle the visibility of the dropdown menu
    dropdownMenu.style.display =
        dropdownMenu.style.display === 'none' || dropdownMenu.style.display === ''
            ? 'block'
            : 'none';

    // Prevent the click event from propagating to avoid immediate closure of the menu
    e.stopPropagation();
});

// Close the dropdown menu and reset icons when clicking outside the menu
document.addEventListener('click', function (e) {
    const dropdownMenu = document.getElementById('dropdown-menufull');
    const menuToggleBtn = document.getElementById('menu-toggle');

    if (!menuToggleBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
        // Close the menu
        dropdownMenu.style.display = 'none';

        // Reset the icons
        const normalIcon = menuToggleBtn.querySelector('.menu-icon.normal');
        const rotatedIcon = menuToggleBtn.querySelector('.menu-icon.rotated');

        normalIcon.classList.remove('hidden');
        rotatedIcon.classList.remove('show');
    }
});

// Close the menu only when clicking on clickable elements inside the dropdown
document.getElementById('dropdown-menufull').addEventListener('click', function (e) {
    const dropdownMenu = document.getElementById('dropdown-menufull');
    const menuToggleBtn = document.getElementById('menu-toggle');

    // Check if the clicked element is a clickable element
    const isClickable = e.target.tagName === 'BUTTON' || 
                        e.target.tagName === 'A' || 
                        e.target.hasAttribute('onclick') || 
                        e.target.getAttribute('role') === 'button';

    if (isClickable) {
        // Close the dropdown menu
        dropdownMenu.style.display = 'none';

        // Reset the icons
        const normalIcon = menuToggleBtn.querySelector('.menu-icon.normal');
        const rotatedIcon = menuToggleBtn.querySelector('.menu-icon.rotated');

        normalIcon.classList.remove('hidden');
        rotatedIcon.classList.remove('show');
    }
});

document.querySelectorAll('.audio-button').forEach(button => {
    const audio = button.closest('.audio-container') ? 
        button.closest('.audio-container').querySelector('.livestream') : null; // Get the audio element (if present)
    const playIcon = button.querySelector('.play-icon');
    const pauseIcon = button.querySelector('.pause-icon');
    const spinnerIcon = button.querySelector('.spinner-icon');  // Get the spinner icon

    // Track if the spinner animation has already been shown (only on the first click)
    let isFirstClick = true;

    button.addEventListener('click', () => {
        if (audio) {
            if (audio.paused) {
                // When clicked, start playing the audio
                audio.play();
                playIcon.style.display = 'none';  // Hide Play Icon
                pauseIcon.style.display = 'none';  // Hide Pause Icon initially

                if (isFirstClick) {
                    // Only show the spinner and disable the button on the first click
                    spinnerIcon.style.display = 'block';  // Show Spinner
                    spinnerIcon.classList.add('loading'); // Start the spinner animation
                    button.disabled = true;  // Disable the button during loading

                    // After 4 seconds, hide the spinner and show the pause icon
                    setTimeout(() => {
                        spinnerIcon.classList.remove('loading'); // Remove loading class
                        spinnerIcon.style.display = 'none';  // Hide the spinner
                        pauseIcon.style.display = 'block';  // Show Pause Icon
                        button.disabled = false;  // Re-enable the button after the loading animation
                    }, 4000); // 4 seconds delay for the spinner

                    // After the first click, set flag to false so subsequent clicks won't show the spinner
                    isFirstClick = false;
                } else {
                    // No spinner animation, just show the pause icon immediately
                    spinnerIcon.style.display = 'none';  // Hide the spinner
                    pauseIcon.style.display = 'block';  // Show Pause Icon
                }
            } else {
                // If the audio is already playing, pause the audio
                audio.pause();
                playIcon.style.display = 'block';  // Show Play Icon
                pauseIcon.style.display = 'none';  // Hide Pause Icon
            }
        }
    });

    // Add an event listener to reset the spinner and show play icon if spinner is clicked
    spinnerIcon.addEventListener('click', () => {
        // This prevents the spinner from being shown on subsequent clicks
        spinnerIcon.classList.remove('loading'); // Stop animation if clicked
        spinnerIcon.style.display = 'none';  // Hide the spinner
        playIcon.style.display = 'block';  // Show the play icon again
        if (audio) {
            audio.pause();  // Pause the audio if spinner is clicked
        }
        button.disabled = false; // Re-enable the button immediately when the spinner is clicked
    });
});

 
  
    const carouselInputs = document.querySelectorAll('.carousel-open');
  let currentSlide = 0;
  let autoSlideTimeout;

  function nextSlide() {
    currentSlide = (currentSlide + 1) % carouselInputs.length;
    carouselInputs[currentSlide].checked = true;
    startAutoSlide(); // Schedule the next slide after a delay
  }

  function startAutoSlide() {
    clearTimeout(autoSlideTimeout); // Clear any existing timeout
    autoSlideTimeout = setTimeout(nextSlide, 8000); // Schedule next slide after 8 seconds
  }

  function stopAutoSlide() {
    clearTimeout(autoSlideTimeout); // Clear the timeout if manual navigation occurs
  }


  const interactiveElements = [...document.querySelectorAll('.carousel-control'), ...document.querySelectorAll('.carousel-bullet')];
  interactiveElements.forEach(element => element.addEventListener('click', stopAutoSlide));


  startAutoSlide(); // Start the automatic slideshow initially


   const schedules = document.getElementById('Schedule');
const overlay = document.getElementById('show-overlay');
const modal = document.getElementById('show-modal');
const closeButton = document.getElementById('close-show');
const showImage = document.getElementById('show-image');
const showTitle = document.getElementById('show-title');
const showDescription = document.getElementById('show-description');
const instagramContainer = document.getElementById('show-instagram');
const instagramLink = document.getElementById('instagram-link');
const instagramUsernameSpan = document.getElementById('instagram-username');

const column1 = document.getElementById('column-1');
const column2 = document.getElementById('column-2');
const showImage2 = document.getElementById('show-image-2');
const showTitle2 = document.getElementById('show-title-2');
const showDescription2 = document.getElementById('show-description-2');

const defaultModalWidth = '80%';  // Store the default width
const singleColumnModalWidth = '40%'; // Store the single-column width


schedules.addEventListener('click', function(event) {
    const target = event.target.closest('td');
    if (target) {

        const showId = target.id;

        const showInfo = target.querySelector('.show-info');

        if (showId && showInfo) {

            // **RESET COLUMN WIDTH AND MODAL WIDTH HERE**
            column1.style.width = '45%'; // Default width for two-column layout
            modal.style.width = defaultModalWidth; // Reset modal width

            const imageUrl = `./${showId}.jpg`;
            const title = showInfo.querySelector('h2:nth-of-type(1)')?.textContent || ''; //Get the first h2
            const description = showInfo.querySelector('p:nth-of-type(1)')?.textContent || ''; //Get the first p

            showImage.src = imageUrl;
            showTitle.textContent = title;
            showDescription.textContent = description;

            // Check for second set of content
            const title2 = showInfo.querySelector('h2:nth-of-type(2)')?.textContent;
            const description2 = showInfo.querySelector('p:nth-of-type(2)')?.textContent;

            if (title2 && description2) {
                // Display second column
                column2.style.display = 'block';
                showImage2.src = `./${showId}_2.jpg`; // Assuming second image has _2 suffix
                showTitle2.textContent = title2;
                showDescription2.textContent = description2;
            } else {
                // Hide second column if no second content
                column2.style.display = 'none';
                column1.style.width = '90%';  // Set column1 to take up more space
                modal.style.width = singleColumnModalWidth; // Set modal width for single column
            }

            let instagramLinkElement = target.querySelector('a[href*="instagram.com"]');


            if (instagramLinkElement) {
                const instagramUrl = instagramLinkElement.href;

                try {
                    const url = new URL(instagramUrl);
                    const pathname = url.pathname;
                    const parts = pathname.split('/').filter(Boolean);


                    const username = parts[0];


                    if (username) {
                        instagramUsernameSpan.textContent = username;
                        instagramLink.href = instagramUrl;
                        instagramContainer.style.display = "block";
                    } else {
                        instagramContainer.style.display = "none";
                    }


                } catch (e) {
                    instagramContainer.style.display = "none";
                }
            } else {
                instagramContainer.style.display = "none";
            }

            overlay.style.display = 'block';
        }


    }


});
closeButton.addEventListener('click', function() {
    overlay.style.display = 'none';
    column2.style.display = 'none'; // Also hide the second column on close
    column1.style.width = '45%'; // Reset width on close, too
    modal.style.width = defaultModalWidth; // Reset modal width on close
});

window.addEventListener('click', function(event) {
    if (event.target == overlay) {
        overlay.style.display = 'none';
        column2.style.display = 'none'; // Also hide the second column on outside click
        column1.style.width = '45%'; // Reset width on outside click too
        modal.style.width = defaultModalWidth; // Reset modal width on outside click
    }
});
const dayTabs = document.querySelectorAll('.day-tab');
const scheduleGrids = document.querySelectorAll('.mobile-schedule-grid');

// Get the current day name
const now = new Date();
const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });

  dayTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const selectedDay = tab.dataset.day;

      // Update active tab appearance
      dayTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Show/hide schedule grids
      scheduleGrids.forEach(grid => {
        grid.classList.remove('active');
        if (grid.dataset.day === selectedDay) {
          grid.classList.add('active');
        }
      });
    });
  });
  
dayTabs.forEach(tab => {
  if (tab.dataset.day === currentDay) {
    tab.classList.add('active');
  }
});
scheduleGrids.forEach(grid => {
  if (grid.dataset.day === currentDay) {
    grid.classList.add('active');
  }
});
  

      function highlightCurrentSlot() {
            const now = new Date();
            const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
            const slots = document.querySelectorAll(`.mobile-schedule-grid[data-day="${currentDay}"] .mobile-time-slot`); // Select only slots for current day
            
            // ... (Rest of highlightCurrentSlot logic - no changes needed)
        }
     
  const spinningImages = document.querySelectorAll('.spinning-image');

  spinningImages.forEach(image => {
    let audio = null; //Keep track of the audio element

    image.addEventListener('click', () => {
      const audioUrl = image.dataset.audio;

      if (!audio) {
        audio = new Audio(audioUrl);
        audio.onerror = () => {
          console.error("Audio loading error:", audioUrl);
          alert("There was an error loading the audio stream. Please try again later."); // Give User Feedback.
        };
      }


      if (image.classList.contains('playing')) {
        image.classList.remove('playing');
        image.style.animation = 'none';
        //Crucially: Stop the Audio playback. Add a timeout for the browser to properly stop playback, and also test for null state of the Audio Object.
          if (audio){
            audio.pause();
          }
          setTimeout(() => { // Allows a short delay for the browser to finalize audio pausing (important)
                if (audio && !audio.paused) {
                    audio.pause();
                  }
           }, 100);

      } else {
        image.classList.add('playing');
        image.style.animation = 'rotate 10s linear infinite';
        audio.play(); //Initiates Audio. 

      }
    });
  });


 const slattAudio = new Audio('https://streamer.radio.co/s986435880/listen.m3u');
  const slattPlayPauseButton = document.getElementById('slattPlayPauseButton');
  const slattPlayIcon = document.getElementById('slattPlayIcon');
  const slattPauseIcon = document.getElementById('slattPauseIcon');


  slattPlayPauseButton.addEventListener('click', () => {
    if (slattAudio.paused) {
      slattAudio.play();
      slattPlayIcon.style.display = 'none';
      slattPauseIcon.style.display = 'block';

    } else {
      slattAudio.pause();
      slattPlayIcon.style.display = 'block';
      slattPauseIcon.style.display = 'none';

    }
  });
  
  // Error handling for the audio stream
  slattAudio.addEventListener('error', (error) => {
        console.error("Error loading audio stream:", error);
        // Here you could display a message to the user, or try a different stream URL
  });
  
  
  
   const zzzlsr_audio = new Audio("https://s2.radio.co/seb5cdba5b/listen");
  const zzzlsr_playPauseBtn = document.getElementById("zzzlsr_playPauseBtn");
  const zzzlsr_playIcon = document.getElementById("zzzlsr_playIcon");
  const zzzlsr_pauseIcon = document.getElementById("zzzlsr_pauseIcon");

  let isPlaying = false;

  zzzlsr_playPauseBtn.addEventListener("click", () => {
    if (isPlaying) {
      zzzlsr_audio.pause();
      zzzlsr_playIcon.style.display = "block";
      zzzlsr_pauseIcon.style.display = "none";
    } else {
      zzzlsr_audio.play().catch(error => {
          console.error("Audio playback failed:", error);
          // Add error handling here, e.g., display a message to the user.
      });
      zzzlsr_playIcon.style.display = "none";
      zzzlsr_pauseIcon.style.display = "block";
    }
    isPlaying = !isPlaying;
  });


 function updateProgressBar() {
    const now = new Date();
    const minutesFromStart = now.getMinutes();
    const minutesToNextHour = 60 - minutesFromStart;
    const secondsSinceHourStart = (minutesFromStart * 60) + now.getSeconds();
    const percentage = (secondsSinceHourStart / 3600) * 100;

    document.getElementById('progressBar7778').style.width = percentage + '%';
    document.getElementById('minutesFromStart').textContent = minutesFromStart + 'm';
    document.getElementById('minutesToNextHour').textContent = minutesToNextHour + 'm';
  }
 
  setInterval(updateProgressBar, 1000);



   


  // Function to handle toggle logic
  function setupToggle(container) {
    const toggleHeader = container.querySelector('.toggle-header-container');
    const content = container.querySelector('.show-grid-container');
    // dynamically check for content class names
    const contentClass = content.classList.contains('music-content') ? 'music-content' : 'news-content';
    const instaLinks = container.querySelector(`.show-insta-links.${contentClass.replace('content', 'insta-links')}`);
    const arrow = container.querySelector('.toggle-arrow');
    let expanded = false; // initial state is collapsed, so false

    // IMPORTANT: Hide the content on initial load
    content.style.display = 'none';
    if (instaLinks) {
      instaLinks.style.display = 'none';
    }
    arrow.classList.remove('up-arrow'); // Ensure down-arrow class is set initially.
    arrow.classList.add('down-arrow');

    toggleHeader.addEventListener('click', function() {
      if (!expanded) {
        content.style.display = 'grid';
        if (instaLinks) {
          instaLinks.style.display = 'block';
        }
        arrow.classList.remove('down-arrow');
        arrow.classList.add('up-arrow');
        expanded = true;
      } else {
        content.style.display = 'none';
        if (instaLinks) {
          instaLinks.style.display = 'none';
        }
        arrow.classList.remove('up-arrow');
        arrow.classList.add('down-arrow');
        expanded = false;
      }
    });
  }

  // Loop through each section with a toggle
  document.querySelectorAll('.toggle-section').forEach(section => {
    setupToggle(section);
  });

 const containers = document.querySelectorAll('.expandable-container');

  containers.forEach(container => {
    const header = container.querySelector('.expandable-header');
    const content = container.querySelector('.expandable-content');
    const icon = container.querySelector('.expandable-icon');

    header.addEventListener('click', () => {
      if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block';
        icon.innerHTML = '▲';
      } else {
        content.style.display = 'none';
        icon.innerHTML = '▼';
      }
    });
  });
  
   const schedule = {
        Monday: [
            ["9:00 AM", "10:00 AM", "Breakfast"],
            ["10:00 AM", "11:00 AM", "Breakfast"],
            ["11:00 AM", "12:00 PM", "Terminally Online"],
            ["12:00 PM", "1:00 PM", "Sound Salad/The More You Know"],
            ["1:00 PM", "2:00 PM", "Sidilicious Selects"],
            ["2:00 PM", "3:00 PM", "SPORT"],
            ["3:00 PM", "4:00 PM", "LGBTQ+ SHOW"],
            ["4:00 PM", "5:00 PM", "Bangers and Trash"],
            ["5:00 PM", "6:00 PM", "HOMETIME"],
            ["6:00 PM", "7:00 PM", "HOMETIME"],
            ["7:00 PM", "8:00 PM", "LIVE AND LOCAL"],
            ["8:00 PM", "9:00 PM", "ROCK AND PUNK"],
            ["9:00 PM", "10:00 PM", "Campus Confessions"],
            ["10:00 PM", "11:00 PM", "Uni Music Library Finds"],
            ["11:00 PM", "11:59 PM", "Spiritual Guide"],
        ],
        
         Tuesday: [
        ["9:00 AM", "10:00 AM", "Breakfast"],
        ["10:00 AM", "11:00 AM", "Breakfast"],
        ["11:00 AM", "12:00 PM", "R-Kid Radio"],
        ["12:00 PM", "1:00 PM", "Top Of the Pops/ Continental Buffet"],
        ["1:00 PM", "2:00 PM", "The Tea Party/Archive to Airwaves"],
        ["2:00 PM", "3:00 PM", "Vanity Unfair's Oscar Party"],
        ["3:00 PM", "4:00 PM", "WOMEN'S HOUR"],
        ["4:00 PM", "5:00 PM", ""],
        ["5:00 PM", "6:00 PM", "HOMETIME"],
        ["6:00 PM", "7:00 PM", "HOMETIME"],
        ["7:00 PM", "8:00 PM", "JAZZ, FUNK AND SOUL"],
        ["8:00 PM", "9:00 PM", "Wisecrack"],
        ["9:00 PM", "10:00 PM", "Girlhood"],
        ["10:00 PM", "11:00 PM", "Thank You For The Music"],
        ["11:00 PM", "11:59 PM", "Jungle Gems with Mylania"],
    ],
    Wednesday: [
        ["9:00 AM", "10:00 AM", "Breakfast"],
        ["10:00 AM", "11:00 AM", "Breakfast"],
        ["11:00 AM", "12:00 PM", "Chattergories/Big Names on Campus"],
        ["12:00 PM", "1:00 PM", "Barbergeddon"],
        ["1:00 PM", "2:00 PM", "Feeling Noughtie/Old, New, Borrowed, Blue"],
        ["2:00 PM", "3:00 PM", "Don't Mug Me Off!"],
        ["3:00 PM", "4:00 PM", "POLITICS HOUR"],
        ["4:00 PM", "5:00 PM", "Pionners of the Playlist/Politics of Punk"],
        ["5:00 PM", "6:00 PM", "HOMETIME"],
        ["6:00 PM", "7:00 PM", "HOMETIME"],
        ["7:00 PM", "8:00 PM", "AFROBEATS"],
        ["8:00 PM", "9:00 PM", "INTERNATIONAL"],
        ["9:00 PM", "10:00 PM", "Antagonising Aunts/Lost in the Mix"],
        ["10:00 PM", "11:00 PM", "Low-Key with Rivah"],
        ["11:00 PM", "11:59 PM", "Disco Hour"],
    ],
    Thursday: [
        ["9:00 AM", "10:00 AM", "Breakfast"],
        ["10:00 AM", "11:00 AM", "Breakfast"],
        ["11:00 AM", "12:00 PM", "The Feel Good Files/ Jamie goes to Hollywood"],
        ["12:00 PM", "1:00 PM", "I'm just a Girl/The Heart-beat"],
        ["1:00 PM", "2:00 PM", "Black Girls Gone Alt/Birth of the Beat"],
        ["2:00 PM", "3:00 PM", "Sounds Like Team Spirit"],
        ["3:00 PM", "4:00 PM", "SAFE SPACE"],
        ["4:00 PM", "5:00 PM", "Last Days of Disco"],
        ["5:00 PM", "6:00 PM", "HOMETIME"],
        ["6:00 PM", "7:00 PM", "HOMETIME"],
        ["7:00 PM", "8:00 PM", "FOLK AND COUNTRY"],
        ["8:00 PM", "9:00 PM", "INDIE AND ALT"],
        ["9:00 PM", "10:00 PM", "From Latin America with Love"],
        ["10:00 PM", "11:00 PM", "Garcia's Weekly Round Up"],
        ["11:00 PM", "11:59 PM", "Beatscape"],
    ],
    Friday: [
        ["9:00 AM", "10:00 AM", "Breakfast"],
        ["10:00 AM", "11:00 AM", "Breakfast"],
        ["11:00 AM", "12:00 PM", "Hit Me With Your Best Pop"],
        ["12:00 PM", "1:00 PM", "Golden Hour/Space  Station"],
        ["1:00 PM", "2:00 PM", "NEWS OF THE WEEK"],
        ["2:00 PM", "3:00 PM", "SPORT"],
        ["3:00 PM", "4:00 PM", "'BUT WHERE ARE YOU REALLY FROM?'"],
        ["4:00 PM", "5:00 PM", "M&P Megamix"],
        ["5:00 PM", "6:00 PM", "HOMETIME"],
        ["6:00 PM", "7:00 PM", "HOMETIME"],
        ["7:00 PM", "8:00 PM", "HIP HOP, RAP & RnB"],
        ["8:00 PM", "9:00 PM", "ELECTRONIC"],
        ["9:00 PM", "10:00 PM", "The Midwest Emo Hour"],
        ["10:00 PM", "11:00 PM", "Behind The Beat (biweekly)"],
        ["11:00 PM", "11:59 PM", "Crank Wave"],
    ],
    Saturday: [
        ["10:00 AM", "11:00 AM", "Pixel Perfect"],
        ["11:00 AM", "12:00 PM", "Barricade Babe"],
        ["12:00 PM", "1:00 PM", ""],
        ["1:00 PM", "2:00 PM", "Fill in The Gaps"],
        ["2:00 PM", "3:00 PM", "The Leeds Music Role Call/Uni Music Library Finds"],
        ["3:00 PM", "4:00 PM", "(Not So) Dumb Blondes"],
        ["4:00 PM", "5:00 PM", ""],
        ["5:00 PM", "6:00 PM", ""],
        ["6:00 PM", "7:00 PM", "Tinfoil Tales"],
        ["7:00 PM", "8:00 PM", "SATURDAY NIGHT FEVER"],
        ["8:00 PM", "9:00 PM", "SATURDAY NIGHT FEVER"],
        ["9:00 PM", "10:00 PM", "Rags, Rebels, Records"],
        ["10:00 PM", "11:00 PM", "Tjaro x LSR"],
        ["11:00 PM", "11:59 PM", "Prog Ho!"],
    ],
    Sunday: [
        ["10:00 AM", "11:00 AM", "The Label Show"],
        ["11:00 AM", "12:00 PM", "Witching Hour"],
        ["12:00 PM", "1:00 PM", ""],
        ["1:00 PM", "2:00 PM", "It Takes A Village"],
        ["2:00 PM", "3:00 PM", "SRA CHART SHOW"],
        ["3:00 PM", "4:00 PM", "SRA CHART SHOW"],
        ["4:00 PM", "5:00 PM", "SUNDAY ROAST"],
        ["5:00 PM", "6:00 PM", "SUNDAY ROAST"],
        ["6:00 PM", "7:00 PM", "Syke Up Your Life / The Vinyl Frontier"],
        ["7:00 PM", "8:00 PM", "ALBUM REVIEW"],
        ["8:00 PM", "9:00 PM", "Space Age Love Songs"],
        ["9:00 PM", "10:00 PM", "Sleepytime Songs"],
        ["10:00 PM", "11:00 PM", "The Label Show"],
        ["11:00 PM", "11:59 PM", "EKBeats"],
        
    ]

        // Add the rest of the days here in the same format
    };


    function getCurrentShow() {
        const now = new Date(); // Get the current time
        const utcNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000);  //Correctly convert to UTC

        const day = utcNow.toLocaleDateString("en-US", { weekday: "long" });
        const currentTime = utcNow.getHours() * 60 + utcNow.getMinutes();

        const todaySchedule = schedule[day] || [];
        let liveNow = "No show live";
        let upNext = "No upcoming show";


        for (let i = 0; i < todaySchedule.length; i++) {
            const [start, end, showName] = todaySchedule[i];
            const [startHour, startMin] = parseTime(start);
            const [endHour, endMin] = parseTime(end);

            const startTime = startHour * 60 + startMin;
            const endTime = endHour * 60 + endMin;

            if (currentTime >= startTime && currentTime < endTime) {
                liveNow = showName;
                if (i + 1 < todaySchedule.length) {
                    upNext = todaySchedule[i + 1][2];
                } else if (day !== "Sunday"){ // Handle Saturday -> Sunday transition.
                    const nextDay = getNextDay(day);
                    if (schedule[nextDay]){
                        upNext = schedule[nextDay][0][2]; // First show of next day.
                    }

                }
                break;
            } else if (currentTime < startTime){  //Handle upNext when no live show.
                upNext = showName;
                break;
            }
        }

        return { liveNow, upNext };
    }

   function getNextDay(day){   // Helper function to get next day.
       const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
       const currentIndex = days.indexOf(day);
       return days[(currentIndex + 1) % days.length];
   }


    function parseTime(timeStr) {
        const [time, meridian] = timeStr.split(" ");
        let [hour, minute] = time.split(":").map(Number);



        return [
            (hour % 12) + (meridian === "PM" ? 12 : 0),
            minute
        ];
    }

  
    
      function updateUI() {
    const { liveNow, upNext } = getCurrentShow();

         const liveNowElement3 = document.getElementById("live-now-text3");
        if (liveNowElement3) {
            liveNowElement3.textContent = liveNow;
        }
    // First set of spans
    const liveNowElement1 = document.getElementById("live-now-text");
    const upNextElement1 = document.getElementById("up-next-text");

    // Second set of spans
    const liveNowElement2 = document.getElementById("live-now-text2");
    const upNextElement2 = document.getElementById("up-next-text2");

 

    // Update both sets if they exist
    if (liveNowElement1 && upNextElement1) {
        liveNowElement1.textContent = liveNow;
        upNextElement1.textContent = upNext;
    }

    if (liveNowElement2 && upNextElement2) {
        liveNowElement2.textContent = liveNow;
        upNextElement2.textContent = upNext;
    }
      if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: liveNow,
              artist: 'Leeds Student Radio', // Optional
       
        artwork: [
            { src: 'https://stepzach.github.io/leedstestradio/ab6765630000ba8a51445deb0fe8b8c4b173e6a1.jpeg', sizes: '96x96', type: 'image/jpeg' },
            { src: 'https://stepzach.github.io/leedstestradio/ab6765630000ba8a51445deb0fe8b8c4b173e6a1.jpeg', sizes: '128x128', type: 'image/jpeg' },
            { src: 'https://stepzach.github.io/leedstestradio/ab6765630000ba8a51445deb0fe8b8c4b173e6a1.jpeg', sizes: '256x256', type: 'image/jpeg' },
            { src: 'https://stepzach.github.io/leedstestradio/ab6765630000ba8a51445deb0fe8b8c4b173e6a1.jpeg', sizes: '512x512', type: 'image/jpeg' }
        ]
        
            });
             
    }
}

    
    
    

    updateUI();
    setInterval(updateUI, 60000);
    
    
     document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();

    const targetId = this.getAttribute('href');
    const targetElement = document.querySelector(targetId);

    if (targetElement) {
      const headerOffset = 0; // Adjust for fixed header if needed
      const elementPosition = targetElement.getBoundingClientRect().top;

      // Get custom offset from data-offset attribute
      const customOffset = parseInt(this.dataset.offset) || 0;

      const offsetPosition = elementPosition + window.pageYOffset - headerOffset + customOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  });
});

         

  // Get current time and day in GMT
  function updateOnAirStatus() {
    const now = new Date();
    const currentHour = now.getUTCHours(); // GMT hour
    const currentDay = now.getUTCDay(); // GMT day (0 = Sunday, 1 = Monday, ...)

    // Map days of the week to table columns (Monday = 1, ..., Sunday = 7)
    const dayToColumnIndex = [8, 2, 3, 4, 5, 6, 7];

    // Get all table rows
    const rows = document.querySelectorAll("tbody tr");

    // Remove existing 'on-air' class from all cells
    document
      .querySelectorAll(".on-air")
      .forEach((cell) => cell.classList.remove("on-air"));

    let skipNextRow = false; // Flag to skip next row if a rowspan cell was highlighted
    // Loop through the rows to find the matching time slot
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
      if (skipNextRow) {
        skipNextRow = false;
        continue; // Skip this row
      }
      const timeCell = row.querySelector("td:first-child"); // First column has the time
      const timeRange = timeCell.textContent.split(" - ");
      const startTime = parseTimeTo24Hour(timeRange[0]);
      const endTime = parseTimeTo24Hour(timeRange[1]);

      const dayColumnIndex = dayToColumnIndex[currentDay];
      const cell = row.querySelector(`td:nth-child(${dayColumnIndex})`);

      if (cell) {
         if (cell.hasAttribute('rowspan') && parseInt(cell.getAttribute('rowspan')) > 1) {
           //handle rowspan cells
          const nextRow = rows[rowIndex+1];
          const nextTimeCell = nextRow.querySelector('td:first-child');
           const nextTimeRange = nextTimeCell.textContent.split(" - ");
           const nextEndTime = parseTimeTo24Hour(nextTimeRange[1]);

           if (currentHour >= startTime && currentHour < nextEndTime) {
             cell.classList.add("on-air");
             skipNextRow = true;
           }
         } else {
           // regular cells
          if (currentHour >= startTime && currentHour < endTime) {
            cell.classList.add("on-air");
          }
        }
      }

    }
  }

  // Call the function immediately to update on page load
  updateOnAirStatus();

  // Set up an interval to refresh the logic every 2 minutes (120000ms)
  setInterval(updateOnAirStatus, 120000);

  // Utility function: Parse time in "hh:mm AM/PM" format to 24-hour format
  function parseTimeTo24Hour(time) {
    const [timePart, meridiem] = time.split(" ");
    let [hours, minutes] = timePart.split(":").map(Number);

    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;

    return hours; // Only hours are used for comparison
  }

  
  
   function updateTime() {
        const timeContainer = document.getElementById('time-text');
        const currentTime = new Date();

        // Get GMT hours and minutes
        let hours = currentTime.getUTCHours();
        const minutes = String(currentTime.getUTCMinutes()).padStart(2, '0');

        // Determine a.m. or p.m. and adjust hours for 12-hour format
        const period = hours >= 12 ? 'p.m.' : 'a.m.';
        hours = hours % 12 || 12; // Convert 0 to 12 for midnight, and keep 12 for noon

        // Format the time as HH:MM a.m./p.m.
        const formattedTime = `${hours}:${minutes} ${period}`;

        // Update the text content of the time container
        timeContainer.textContent = formattedTime;
    }

    // Update the time every minute (since seconds are not shown)
    setInterval(updateTime, 60000);

    // Call the function immediately to show the time on load
    updateTime();

     });



document.addEventListener('DOMContentLoaded', function () {
        const dayTabs = document.querySelectorAll('.day-tab');
        const scheduleGrids = document.querySelectorAll('.mobile-schedule-grid');
        const timeSlots = document.querySelectorAll('.mobile-time-slot');
        const overlay = document.getElementById('MOBSHOWOverlay');
        const overlayContent = document.getElementById('MOBSHOWOverlayContent');
        const closeButton = document.querySelector('.MOBSHOWclose-button');
        const overlayTitle = document.getElementById('MOBSHOWOverlayTitle');

        // Function to hide all schedule grids
        function hideAllGrids() {
            scheduleGrids.forEach(grid => {
                grid.classList.remove('active');
            });
        }

        // Function to activate a day tab and show the corresponding schedule grid
        function activateDay(day) {
            hideAllGrids();
            dayTabs.forEach(tab => {
                tab.classList.remove('active');
            });

            const selectedTab = document.querySelector(`.day-tab[data-day="${day}"]`);
            if (selectedTab) {
                selectedTab.classList.add('active');
            }

            const selectedGrid = document.querySelector(`.mobile-schedule-grid[data-day="${day}"]`);
            if (selectedGrid) {
                selectedGrid.classList.add('active');
            }
        }

        // Event listener for day tabs
        dayTabs.forEach(tab => {
            tab.addEventListener('click', function () {
                const day = this.dataset.day;
                activateDay(day);
            });
        });
        // Data for each time slot (image and text)
        const timeSlotData = {
            'Monday-9:00am': {
                title1: 'Breakfast',
                image1: 'https://static.wixstatic.com/media/316c00_2b35f04ff0b04d9b830fc11dbc4eea99~mv2.jpg/v1/fill/w_1880,h_1070,al_c,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/316c00_2b35f04ff0b04d9b830fc11dbc4eea99~mv2.jpg',
                text1: 'Every week day 9-11am, four presenters wake up the students of Leeds with pop music, culture round-ups and blind rankings of the things that really matter first thing in the morning!',
                
                
            },
            'Monday-10:00am': {
                title1: 'Breakfast',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1TAuZYdHRBvmMWc_bjh0c-KP_mouGEzrE=w2940-h1680-iv1',
                text1: 'Every week day 9-11am, four presenters wake up the students of Leeds with pop music, culture round-ups and blind rankings of the things that really matter first thing in the morning!',
            },
            'Monday-11:00am': {
                title1: 'Terminally Online',
                
                image1: 'https://lh3.googleusercontent.com/u/0/d/1TAuZYdHRBvmMWc_bjh0c-KP_mouGEzrE=w2940-h1680-iv1',
                text1: 'Join Emily and Fleur as they procrastinate another hour from doing uni work to reminisce on the best bits of internet culture. Expect a nostalgia overdose as the girls traverse the history of the world wide web.',
               
            },
            'Monday-12:00pm': {
               title1: 'Sound Salad',
               title2: 'The more you Know',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1vu792GSFeI8KbzxAfcc2viTEoUlDqMt5=w2940-h1680-iv1',
                text1: 'Week 1 : Dive underground to explore the Leeds music scene. Listen out for guest appearances and a wide coverage of genre.',
                 image2: 'https://lh3.googleusercontent.com/u/0/d/1uZD4HXPZhATfDOeu7hewVh2h2lPpn7AB=w2940-h1680-iv1',
                text2: 'Week 2 : Ever wondered what really happened at Woodstock 99? Join Matt, Anna and Ella to learn more on some of pop culture’s most historical events.'
            },
            'Monday-1:00pm': {
                title1: 'Politics Hour',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/10TRTNzsdvEOZV70GER3_8PN4vgTaj4Kl=w2940-h1680-iv2',
                text1: 'Politics Hour',
               
            },
            'Monday-2:00pm': {
                title1: 'SPORT',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1fFrZWocMVROqqab_evU8w5EESOuUL4oi=w2940-h1680-iv1',
                text1: 'The sports team take to the airwaves, discussing weekly fixtures and sports news.',
                
            },
            'Monday-3:00pm': {
                title1: 'LGBTQ+ Show',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1Ap6WMfZ9jweSsqfjkxPB-3zbW85FMjkc=w2940-h1680-iv1',
                text1: 'Championing queer icons in Leeds and beyond, and celebrating the culture of being part of the LGBTQIA+ community.',
              
            },
            'Monday-4:00pm': {
                title1: 'Bangers and Trash',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'We aren’t popular, but our culture is! Each week we dissect our guilty pleasures, current faves (and least faves) and silly little stories. Get your ears into gear!',
               
            },
            'Monday-5:00pm': {
                title1: 'HOMETIME',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/17nlJo75YJZH1sWxXbd61Yg2lj05623Es=w2940-h1680-iv1',
                text1: 'Every week day 5-7pm, four presenters soundtrack students’ commutes home, sharing stories, doing challenges and prepping you for the nightlife landscape of Leeds day by day.',
               
            },
            'Monday-6:00pm': {
                title1: 'HOMETIME',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/17nlJo75YJZH1sWxXbd61Yg2lj05623Es=w2940-h1680-iv1',
                text1: 'Every week day 5-7pm, four presenters soundtrack students’ commutes home, sharing stories, doing challenges and prepping you for the nightlife landscape of Leeds day by day.',
               
            },
            'Monday-7:00pm': {
               title1: 'Live and Local',
               title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1S2l0e8DdpkAHIywbzrs6gfD9JJaFjcZ_=w2940-h1680-iv1',
                text1: 'LSR’s core music team dedicate this hour to the latest and greatest in Live & Local music. Tune in to broaden your horizons with the independent and student artists making their marks on the scene.',
               
            },
            'Monday-8:00pm': {
                title1: 'Rock and Punk',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1SLsNmfHGLR4UyiXCGlCx23eHD8UV0Vam=w2940-h1680-iv1',
                text1: 'LSR’s core music team dedicate this hour to the latest and greatest in Rock and Punk music. Tune in to broaden your horizons with the independent and student artists making their marks on the scene.',
             
            },
            'Monday-9:00pm': {
                title1: 'Campus Confessions',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'James and Katie are exposing the best of LeedsFess for an hour every week, saving only the juiciest ones for LSR. To get the latest scoop listen live!',
               
            },
            'Monday-10:00pm': {
                title1: 'Radio with Rosie',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'Live Dj set',
             
            },
            'Monday-11:00pm': {
                title1: '555',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'Live Dj set.',
               
            },
             'Tuesday-9:00am': {
                title1: 'Breakfast',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1QatdvsYmjHxw7ak5oHMMNNjx-SrSqTdy=w2940-h1680-iv1',
                text1: 'Every week day 9-11am, four presenters wake up the students of Leeds with pop music, culture round-ups and blind rankings of the things that really matter first thing in the morning!',
                
                
            },
            'Tuesday-10:00am': {
                title1: 'Breakfast',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1QatdvsYmjHxw7ak5oHMMNNjx-SrSqTdy=w2940-h1680-iv1',
                text1: 'Every week day 9-11am, four presenters wake up the students of Leeds with pop music, culture round-ups and blind rankings of the things that really matter first thing in the morning!',
            },
            'Tuesday-11:00am': {
                title1: 'R-Kid Radio',
                
                image1: 'https://lh3.googleusercontent.com/u/0/d/1tIlic5PMeY5MwRWP7ts_Aq5tayz6TpWi=w2940-h1680-iv1',
                text1: 'Two northern baddies take to the ariwaves to compare their music taste. Week by week they summarise their lives and soundtrack their weekly activities, so listen now to hear more!',
               
            },
            'Tuesday-12:00pm': {
               title1: 'Top Of The Pops',
               title2: 'Continental Buffet',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1k0lu70mfMkfw8Llv0Sl9-odgJUlEIMsm=w2940-h1680-iv1',
                text1: 'Week 1 : Amy and Ruby present the biweekly chart on LSR! Top 10 tracks of the day and everything you need to know and love about the artists!',
                 image2: 'https://lh3.googleusercontent.com/u/0/d/1IkQ3057bRXhCYgB6SUr7MB7kNM85CNgW=w2940-h1680-iv1',
                text2: 'Week 2 : A feast of delectable musical treats from across the globe, one country at a time. Jimmy is serving Conty B like no one else.'
            },
            'Tuesday-1:00pm': {
                title1: 'The Tea Party',
                title2: 'UML Presents: Archive to Airwaves',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'Week 1 : Matty and Haley compare UK and US culture on air! A classic LSR show aimed to educate the masses on American and British culture with a soundtrack of the best artists from each country. @theteaparty_lsr on instagram.',
                  image2: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text2:  'Week 2 : Union Music Library has taken over! Join the team each week to highlight which findings from their archive are deemed worthy enough for LSR airplay. Tune in to hear hidden gems and the context surrounding classic records.',
                    
            },
            'Tuesday-2:00pm': {
                title1: 'Vanity Unfair’s Oscar Party',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: '(Bi-Weekly) As we are very close to the Oscars, there are so many twists, turns, conflicts and dramas to talk about and we’d love to dive into this with listeners on LSR to share our passion for it. We’ll also get into the practical elements of filmmaking to ascertain if the nominees are deserving!',
                
            },
            'Tuesday-3:00pm': {
                title1: 'Womens Hour',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/17Psc3lr03AhwhXw_ZtyvfQ-sbN_PXZ9f=w2940-h1680-iv1',
                text1: 'Highlighting the work of women in Leeds and beyond. AN empowering discussion each week centred on women’s issues and celebrating women’s achievements.',
              
            },
            'Tuesday-4:00pm': {
                title1: 'Whats Poppin',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1R70ylM2DmNl3IWRdcXWF6W9KVlTG-e9-=w2940-h1680-iv1',
                text1: '',
               
            },
            'Tuesday-5:00pm': {
                title1: 'HOMETIME',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1aXq8unBzVghLue8DoI_kc5BnJAZvK9t0=w2940-h1680-iv1',
                text1: 'Every week day 5-7pm, four presenters soundtrack students’ commutes home, sharing stories, doing challenges and prepping you for the nightlife landscape of Leeds day by day.',
               
            },
            'Tuesday-6:00pm': {
                title1: 'HOMETIME',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1aXq8unBzVghLue8DoI_kc5BnJAZvK9t0=w2940-h1680-iv1',
                text1: 'Every week day 5-7pm, four presenters soundtrack students’ commutes home, sharing stories, doing challenges and prepping you for the nightlife landscape of Leeds day by day.',
               
            },
            'Tuesday-7:00pm': {
               title1: 'JAZZ, FUNK AND SOUL',
               title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1x4Sbn9MakIUMQFOtfIl4FE8KvUkBDwfp=w2940-h1680-iv1',
                text1: 'LSR’s core music team dedicate this hour to the latest and greatest in Jazz, Funk and Sould music. Tune in to broaden your horizons with the independent and student artists making their marks on the scene.',
               
            },
            'Tuesday-8:00pm': {
                title1: 'Wisecrack',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'We have local bands on to discuss their influences, upcoming shows and projects, and the local music scene as a whole, creating a sense of community for the artist and the listener.',
             
            },
            'Tuesday-9:00pm': {
                title1: 'Girlhood',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'Girlhood is a talk-based specialised music show all about our experiences as young women and popular culture. Millie and Amelie are diversifying the sound of LSR by highlighting female artists and soundtracking what it’s like to be a girl.',
               
            },
            'Tuesday-10:00pm': {
                title1: 'Multi-genre Madness',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'Live Dj Set',
             
            },
            'Tuesday-11:00pm': {
                title1: 'Beatscape',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'Live Dj set',
               
            },
                'Wednesday-9:00am': {
                title1: 'Breakfast',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1OfLVtIsaaGFcSz3NdCOTmee1RyTVrx_U=w2940-h1680-iv1',
                text1: 'Every week day 9-11am, four presenters wake up the students of Leeds with pop music, culture round-ups and blind rankings of the things that really matter first thing in the morning!',
                
                
            },
            'Wednesday-10:00am': {
                title1: 'Breakfast',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1OfLVtIsaaGFcSz3NdCOTmee1RyTVrx_U=w2940-h1680-iv1',
                text1: 'Every week day 9-11am, four presenters wake up the students of Leeds with pop music, culture round-ups and blind rankings of the things that really matter first thing in the morning!',
            },
            'Wednesday-11:00am': {
                title1: 'Chattergories',
                 title2: 'Big Names On Campus',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1dh4gpcFdSYmg9xBXuY5BO9QPfIsX9_0G=w2940-h1680-iv1',
               text1: 'Week 1 : A positive news show featuring student-focussed stories and songs. Highlighting the individual and mass change towards good in the world with guests!',
                image2: 'https://lh3.googleusercontent.com/u/0/d/1o37sYdSHo7-gl5S5ntLwbKkXbIEs_c-4=w2940-h1680-iv1',
                text2: 'Week 2 : Championing student-led events across Leeds’ campuses, Ruby has friendly chats with different guests each week as they share their light on air.',
              
            },
            'Wednesday-12:00pm': {
               title1: 'Barbergeddon',
              
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'Sidney pays homage to Barber FM with the end of educating fellow LSR members in the post-internet-jazzification of the music scene.',
                
            },
            'Wednesday-1:00pm': {
                title1: 'Feeling Noughtie',
                title2: 'Old, New, Borrowed, Blue',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1M3ImkQb71ldofpmKyi6F0ik4RPc2I5hH=w2940-h1680-iv1',
                text1: 'Week 1 : The pressure of being a Gen Z adult is unfathomable. Rather than addressing it, Rhys, Kiera and Ella are traversing back to the 2000s when life was simpler for us.',
                  image2: 'https://lh3.googleusercontent.com/u/0/d/1sm4ouF0Uz3_JO9oGTGO2daK9gGagYoBD=w2940-h1680-iv1',
                text2:  'Week 2 : Megan showcases songs from her past (old), that she recently discovered (new), that someone recommended (borrowed) and something mellow (blue), all centred around a unique theme per the show!',
                    
            },
            'Wednesday-2:00pm': {
                title1: 'Don’t Mug Me Off!',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1cKrvRuEOS2Nj3ZhHUB4gf8P3Gjc9JOAL=w2940-h1680-iv1',
                text1: 'As students, we know and love the petty drama that defines our lives. Will your flatmate ever clean up their dishes? Will the letting agents ever send a maintenance worker? Imogen and Charlotte make head and tail of all the drama in this Agony Aunt style show.',
                
            },
            'Wednesday-3:00pm': {
                title1: 'LST.MP3/ Gryph on Air',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'LST.MP3/Gryph-On Air',
              
            },
            'Wednesday-4:00pm': {
                title1: 'Pioneers of the Playlist',
                title2: 'Politics of Punk',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1Qv1I1wfHrBzI0NSNBsXl85cGrvsTb_ft=w2940-h1680-iv1',
                text1: 'Week 1 : This radio show will look into the stories of the most iconic artists and bands who have reshaped music history and influenced culture. Each episode will explore the groundbreaking contributions of musical legends by focusing on their discography, cultural relevance, and the far-reaching impact they’ve had across various aspects of society.',
                  image2: 'https://lh3.googleusercontent.com/u/0/d/1Iq3ovxY0ZbxaYyB4kGEewFOVBRa4QGrg=w2940-h1680-iv1',
                 text2: 'Week 2 : Politics of Punk is a show that aims to educate and entertain people on the wild and entertaining world of punk music and all its sub genres.',
               
            },
            'Wednesday-5:00pm': {
                title1: 'HOMETIME',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1QfIhvkJVJ_91JVoCq2LZxbgkIShI--5E=w2940-h1680-iv1',
                text1: 'Every week day 5-7pm, four presenters soundtrack students’ commutes home, sharing stories, doing challenges and prepping you for the nightlife landscape of Leeds day by day.',
               
            },
            'Wednesday-6:00pm': {
                title1: 'HOMETIME',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1QfIhvkJVJ_91JVoCq2LZxbgkIShI--5E=w2940-h1680-iv1',
                text1: 'Every week day 5-7pm, four presenters soundtrack students’ commutes home, sharing stories, doing challenges and prepping you for the nightlife landscape of Leeds day by day.',
               
            },
            'Wednesday-7:00pm': {
               title1: 'Afrobeats',
               title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1RpbnGb664ngOET2HjfHF5r7niAPl2X5H=w2940-h1680-iv1',
                text1: 'LSR’s core music team dedicate this hour to the latest and greatest in Afrobeats. Tune in to broaden your horizons with the independent and student artists making their marks on the scene.',
               
            },
            'Wednesday-8:00pm': {
                title1: 'International',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1V7zE4g6s61ajxmR6cThVYo-WaRtIps5Q=w2940-h1680-iv1',
                text1: 'LSR’s core music team dedicate this hour to the latest and greatest in international music. Tune in to broaden your horizons with the independent and student artists making their marks on the scene.',
             
            },
            'Wednesday-9:00pm': {
                title1: 'Antagonising Aunts',
                title2: 'Lost In The Mix',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'Send your anonymous queries to these two for some well-thought out advice! You might even be lucky enough to get a soundtrack to help you work through your dastardly dilemmas.',
               image2: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text2: 'Get ready for hidden gems from artists with under 100k monthly listeners on Spotify. Join our host as she introduces you to a plethora of secret sounds.',
               
            },
            'Wednesday-10:00pm': {
                title1: 'Urban Breaks',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'Live Dj Set',
             
            },
            'Wednesday-11:00pm': {
                title1: 'Weekly Wheelup',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'Live Dj Set',
               
            },
            
                'Thursday-9:00am': {
                title1: 'Breakfast',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1QatdvsYmjHxw7ak5oHMMNNjx-SrSqTdy=w2940-h1680-iv1',
                text1: 'Every week day 9-11am, four presenters wake up the students of Leeds with pop music, culture round-ups and blind rankings of the things that really matter first thing in the morning!',
                
                
            },
            'Thursday-10:00am': {
                title1: 'Breakfast',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1QatdvsYmjHxw7ak5oHMMNNjx-SrSqTdy=w2940-h1680-iv1',
                text1: 'Every week day 9-11am, four presenters wake up the students of Leeds with pop music, culture round-ups and blind rankings of the things that really matter first thing in the morning!',
            },
            'Thursday-11:00am': {
                title1: 'The Feel Good Files',
                 title2: 'Jamie goes to Hollywood',
                image1: 'https://lh3.googleusercontent.com/u/0/d/16gwlmU2ObXD_Uu95d84m4pWgG-6tORhU=w2940-h1680-iv1',
               text1: 'Week 1 : Once a fortnight Lili shares a space for you to take a break from the hustle and bustle. Join her live for quizzes, grooviness and a low-down of the latest positive events in Leeds.',
                image2: 'https://lh3.googleusercontent.com/u/0/d/10cr5U95lZHr6wMGKkMMz3ZFUGq3rs6je=w2940-h1680-iv1',
                text2: 'Week 2 : Jamie explores the latest and greatest of cinema once a fortnight. He’ll analyse the soundtracks, directorial choices or acting careers we know and love to tell you more about his faves.',
              
            },
            'Thursday-12:00pm': {
               title1: 'Im Just a Girl',
                title2: 'The Heart-Beat',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1we3RLM_LC3mD-ppTvXbfzZcBfzhiHxUA=w2940-h1680-iv1',
                text1: 'Week 1 : Tune in for all things girlypop! Join the girls to try and figure out female friendships, career plans, travel agendas and more.',
                  image2: 'https://lh3.googleusercontent.com/u/0/d/1SEn8iGmp4JrICA80fAIfTCTBrQ-vF8f4=w2940-h1680-iv1',
                text2:  'Week 2 : Ria writes a love letter to fan culture in this show. Diving into fandoms for books, films, TV Shows and musical artists and hearing why the fans love them so much live every other Thursday.',
                    
            },
            'Thursday-1:00pm': {
                 title1: 'Black girls gone Alt',
                title2: 'Birth of the Beat',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                  image2: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'Week 1 : Malaika highlights her fave Black female artists, with a focus on how they’ve created alternative sounds in genres where they are otherwise under-represented.',
                text2: 'Week 2 : Birth of the Beat is back! Join the hosts as they navigate the history and culture of various genres, eras, artists and movements, ranging from Ethiopian jazz to the role of the CIA in protest music, you’re sure to learn something new.'
         
            },
            'Thursday-2:00pm': {
                title1: 'Sounds Like Team Spirit',
               
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                
                text1: 'Incorporating sport and music as one, the boys explore historical and modern sporting events and play the tunes which accompany them. Tune in for chants and culture on air.',
                     },
            'Thursday-3:00pm': {
                title1: 'Safe Space',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1lZ5C6ASy_WkEBRrNTTlI93-9g-XF0-0V=w2940-h1680-iv1',
                text1: 'Exactly that! These presenters discuss the importance of mindfulness and taking care of your mental health at university as well as discussing how neurodiversity impacts student life.',
              
            },
            'Thursday-4:00pm': {
                title1: 'Last Days of Disco',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1Xeo6bn74JObZylqkFV54g2vSsMSuF-Gq=w2940-h1680-iv1',
                text1: 'Ruth identifies the greatest disco and disco-adjacent tracks in history. Tracing the origins of the genre back to before the dancefloors of 1970s New York, tune in to hear a love for disco.',
                 
            },
            'Thursday-5:00pm': {
                title1: 'HOMETIME',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1f1Cfr7819ygY6jULXwvd_f6P7CDgbaJc=w2940-h1680-iv1',
                text1: 'Every week day 5-7pm, four presenters soundtrack students’ commutes home, sharing stories, doing challenges and prepping you for the nightlife landscape of Leeds day by day.',
               
            },
            'Thursday-6:00pm': {
                title1: 'HOMETIME',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1f1Cfr7819ygY6jULXwvd_f6P7CDgbaJc=w2940-h1680-iv1',
                text1: 'Every week day 5-7pm, four presenters soundtrack students’ commutes home, sharing stories, doing challenges and prepping you for the nightlife landscape of Leeds day by day.',
               
            },
            'Thursday-7:00pm': {
               title1: 'Folk and Country',
               title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1EGlLkz8UhVCNF8JLjq2gXngALtP3eSXM=w2940-h1680-iv1',
                text1: 'LSR’s core music team dedicate this hour to the latest and greatest in Folk and Country music. Tune in to broaden your horizons with the independent and student artists making their marks on the scene.',
               
            },
            'Thursday-8:00pm': {
                title1: 'Indie and Alt',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1DuxS95td1NATK5FKvz4MISU8UKQecQIn=w2940-h1680-iv1',
                text1: 'LSR’s core music team dedicate this hour to the latest and greatest in Indie and Alt music. Tune in to broaden your horizons with the independent and student artists making their marks on the scene.',
             
            },
            'Thursday-9:00pm': {
                title1: 'From Latin America with Love',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'Centred around his experience as a child in Miami, the gateway to Latin America, [presenter name] explores Latin-Caribbean and South American discographies country by country.',
              
            },
            'Thursday-10:00pm': {
                title1: 'Roots to Rave',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'Live Dj Set',
             
            },
            'Thursday-11:00pm': {
                title1: 'Riddims w/ Riv da Jap',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'Live Dj Set',
               
            },
            
                'Friday-9:00am': {
                title1: 'Breakfast',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1Td5FYnJ0GIFE__FyFONecegEFzowGoYM=w2940-h1680-iv1',
                text1: 'Every week day 9-11am, four presenters wake up the students of Leeds with pop music, culture round-ups and blind rankings of the things that really matter first thing in the morning!',
                
                
            },
            'Friday-10:00am': {
                title1: 'Breakfast',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1Td5FYnJ0GIFE__FyFONecegEFzowGoYM=w2940-h1680-iv1',
                text1: 'Every week day 9-11am, four presenters wake up the students of Leeds with pop music, culture round-ups and blind rankings of the things that really matter first thing in the morning!',
            },
            'Friday-11:00am': {
                title1: 'Hit me with your Best Pop',
              
                image1: 'https://lh3.googleusercontent.com/u/0/d/1HMSLqbPw7RKBagrEH09oveNNOESottVb=w2940-h1680-iv1',
               text1: 'Anna unapologetically celebrates all things pop and guilty pleasures! From 00s anthems, to todays trending girlypop dnb tunes, this show champions all of the songs that we secretly love to blast in the kitchen through our headphones!',
              
            },
            'Friday-12:00pm': {
                title1: 'Golden Hour',
                title2: 'Space Station',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1WL_LzZVLD39qiF32Gm9c-kP2moUxskw5=w2940-h1680-iv1',
                text1: 'Week 1 : Sophie’s show is about showcasing music that inspires you to be creative in various forms, and music that channels "golden hour energy" - picture lying with your face in the sun in the summer and being the main character.',
                  image2: 'https://lh3.googleusercontent.com/u/0/d/1z8sfhsUSEimYBkArIUxFPIyd0HnGjFur=w2940-h1680-iv1',
                text2:  'Week 2 : Rory presents a show to space out to, centred around ethereal dreamy music with an emphasis on healing. Stay tuned for guided meditation at the end of each show!',
                    
            },
            'Friday-1:00pm': {
                title1: 'News of the Week',
              
                image1: 'https://lh3.googleusercontent.com/u/0/d/1jOYltooDjAzQ39zfbT4VZNogLlRYK1_w=w2940-h1680-iv1',
                text1: 'News of the week',
               
            },
            'Friday-2:00pm': {
                title1: 'Sport',
              
                image1: 'https://lh3.googleusercontent.com/u/0/d/1fFrZWocMVROqqab_evU8w5EESOuUL4oi=w2940-h1680-iv1',
                text1: 'The sports team take to the airwaves, discussing weekly fixtures and sports news.',
             
            },
            'Friday-3:00pm': {
                title1: 'But where are you really from?',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/11hwERjFTufaKMpU-79bo4q_oz7dDXFWb=w2940-h1680-iv1',
                text1: 'Discussing race relations on campus and the manifestation of identity for students of ethnic minority backgrounds and international students more broadly.',
              
            },
            'Friday-4:00pm': {
                title1: 'M&P Megamix',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv1',
                text1: 'LUU’s Music and Performance rep Kate highlights the best of those societies. With a different group each week you can get to know them and the projects they have under their belts this semester.',
                 
            },
            'Friday-5:00pm': {
                title1: 'HOMETIME',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xzjPo0ZcbrG9uezDQB7xxFI19MallFir=w2940-h1680-iv1',
                text1: 'Every week day 5-7pm, four presenters soundtrack students’ commutes home, sharing stories, doing challenges and prepping you for the nightlife landscape of Leeds day by day.',
               
            },
            'Friday-6:00pm': {
                title1: 'HOMETIME',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xzjPo0ZcbrG9uezDQB7xxFI19MallFir=w2940-h1680-iv1',
                text1: 'Every week day 5-7pm, four presenters soundtrack students’ commutes home, sharing stories, doing challenges and prepping you for the nightlife landscape of Leeds day by day.',
               
            },
            'Friday-7:00pm': {
               title1: 'Hip-Hop, Rap & RnB',
               title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1LIThm5ylQ6DOe6a_VXayS5bQCVCVH8Jn=w2940-h1680-iv1',
                text1: 'LSR’s core music team dedicate this hour to the latest and greatest in Hip-Hop, Rap & RnB music. Tune in to broaden your horizons with the independent and student artists making their marks on the scene.',
               
            },
            'Friday-8:00pm': {
                title1: 'Electronic',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1Y1SoyjIr9WnfOBbem4qvtCZiXge_6nIy=w2940-h1680-iv1',
                text1: 'LSR’s core music team dedicate this hour to the latest and greatest in Electronic music. Tune in to broaden your horizons with the independent and student artists making their marks on the scene.',
             
            },
            'Friday-9:00pm': {
                title1: 'Sleepytime songs',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                text1: 'Sleepytime songs',
              
            },
            'Friday-10:00pm': {
                title1: 'Optimistic soul',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                text1: 'Live Dj Set',
             
            },
            'Friday-11:00pm': {
                title1: 'Funky Frequencies',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                text1: 'Live Dj Set',
               
            },


            
                'Saturday-9:00am': {
                title1: 'No Show',
                image1: 'https://static.wixstatic.com/media/316c00_2b35f04ff0b04d9b830fc11dbc4eea99~mv2.jpg/v1/fill/w_1880,h_1070,al_c,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/316c00_2b35f04ff0b04d9b830fc11dbc4eea99~mv2.jpg',
                text1: 'Nothing..',
                    image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                
                
            },
            'Saturday-10:00am': {
                title1: 'Pixel Perfect',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                text1: 'Krish delves into a different video game each week, assessing the mechanics, the world in which the game exists, the soundtracks and more.',
            },
            'Saturday-11:00am': {
                title1: 'Barricade Babe',
              
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
               text1: 'Carys is the ultimate Barricade Babe, attending gigs regularly out of pure love for the music. She brings on guests to discuss the live music events that make or break them and highlights the joys of being a fan.',
              
            },
            'Saturday-12:00pm': {
                title1: 'Out and About',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                text1: 'Nothing..',
            },
            'Saturday-1:00pm': {
                title1: 'Fill In The Gaps',
              
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                text1: 'With a new genre each week, this show does what it says on the tin, adding historical and contextual cues to round off some of the most groundbreaking genres in history. Local musicians and DJs share their contributions and love for the music they create too.',
               
            },
            'Saturday-2:00pm': {
                title1: 'The Leeds Music Role Call',
               title2: 'Uni Music Library Finds',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                 image2: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                text1: 'Week 1 : Open your eyes to the Leeds Music scene with several guests including bands and label owners who are making waves across the city.',
              text2: 'Week 2 : With a new theme each week, two UML members present the best they can find in LUU’s Union Music Library.',
            },
            'Saturday-3:00pm': {
                title1: 'Soccer Punch',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1Vye6bcruDTIz8XJp-AErJgezBRE4Tkth=w2940-h1680-iv1',
                text1: 'The students answer to Soccer Saturday, a more laidback overview of Saturday game.',
              
            },
            'Saturday-4:00pm': {
                 title1: 'Soccer Punch',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1Vye6bcruDTIz8XJp-AErJgezBRE4Tkth=w2940-h1680-iv1',
                text1: 'Soccer Punch: The students answer to Soccer Saturday, a more laidback overview of Saturday game.',
            },
            'Saturday-5:00pm': {
                 title1: 'The Emo Hour',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                text1: 'The Emo Hour',
            },
            'Saturday-6:00pm': {
                title1: 'Tinfoil Tales',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                text1: 'Political conspiracies have been rife in pop culture for longer than we can remember, join the hosts to think critically about the impact of conspiracy theories and how they’ve evolved to be so mainstream today.',
               
            },
            'Saturday-7:00pm': {
               title1: 'SATURDAY NIGHT FEVER',
               title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1lCPY_7y0Gft2JG68vhZdqunyZeo6Vghd=w2940-h1680-iv2',
                text1: 'The ‘Saturday Night Fever’ (7-9pm) team curate the nighttime vibe with upbeat playlists and advertising new club nights.',
               
            },
            'Saturday-8:00pm': {
                title1: 'SATURDAY NIGHT FEVER',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1lCPY_7y0Gft2JG68vhZdqunyZeo6Vghd=w2940-h1680-iv2',
                text1: 'The ‘Saturday Night Fever’ (7-9pm) team curate the nighttime vibe with upbeat playlists and advertising new club nights.',
             
            },
            'Saturday-9:00pm': {
                title1: 'Rags, Rebels, Records',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                text1: 'If there are two things that Leeds Uni students have amazing taste in, it’s style and music. Rags, Rebels, Records is the premium fashion radio show which combines these two things, exploring how fashion and music have intersected throughout pop culture to create some of the most prevalent subcultures and styles.',
              
            },
            'Saturday-10:00pm': {
                title1: 'Rosie & Tom try to DJ',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                text1: 'Live Dj Set',
             
            },
            'Saturday-11:00pm': {
                title1: 'No Show',
                title2: null,
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                text1: 'Nothing..',
               
            },

            
            
                'Sunday-9:00am': {
                title1: 'No Show',
                image1: 'https://static.wixstatic.com/media/316c00_2b35f04ff0b04d9b830fc11dbc4eea99~mv2.jpg/v1/fill/w_1880,h_1070,al_c,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/316c00_2b35f04ff0b04d9b830fc11dbc4eea99~mv2.jpg',
                text1: 'Nothing..',
                
                
            },
            'Sunday-10:00am': {
                title1: 'The Label Show',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                text1: 'Join Poppy and Ally as they explore different record labels every week, from every genre, highlighting independent labels as well as big names in the industry.',
            },
            'Sunday-11:00am': {
                title1: 'Witching Hour',
              
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
               text1: 'Rory’s back in the studio to talk all things witchcraft! From crystals to candles to card readings you’ll learn the history of the practice and look at the modern iterations of witch life.',
              
            },
            'Sunday-12:00pm': {
                title1: 'Box Office',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1P6blYgwAzUgb5DogSu4vwkc52mzpgY-O=w2940-h1680-iv1',
                text1: 'Box Office',
            },
            'Sunday-1:00pm': {
                title1: 'It Takes A Village',
              
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                text1: 'Flora examines the nature vs nurture argument in music, interviewing someone new each week to discover how and why they discovered the music which defines their lives.',
               
            },
            'Sunday-2:00pm': {
                title1: 'SRA CHART SHOW',
             
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                
                text1: 'The SRA Chart Show',
            
            },
            'Sunday-3:00pm': {
                title1: 'SRA CHART SHOW',
             
                image1: 'https://lh3.googleusercontent.com/u/0/d/1xsBh4dZQwrBh09eFKZtmvNoJGcw6XlpZ=w2940-h1680-iv2',
                
                text1: 'The SRA Chart Show',
            },
            'Sunday-4:00pm': {
                 title1: 'SUNDAY ROAST',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1BlWo4E0TxsHK_Yue3kjTB-x5iOkOY2ZK=w2940-h1680-iv1',
                text1: '‘Sunday Roast’ (4-6pm) mocks the week and discusses student icks in a whole new light.',
            },
            'Sunday-5:00pm': {
                 title1: 'SUNDAY ROAST',
                image1: 'https://lh3.googleusercontent.com/u/0/d/1BlWo4E0TxsHK_Yue3kjTB-x5iOkOY2ZK=w2940-h1680-iv1',
                text1: '‘Sunday Roast’ (4-6pm) mocks the week and discusses student icks in a whole new light.',
            },
            'Sunday-6:00pm': {
                title1: '(Not So) Dumb Blondes',
             
                image1: 'image10.jpg',
              
                text1: 'LSR’s Best Show Winter 2024 returns for another season. Hannah and Rebecca decipher if life truly is more fun for blondes by dissecting their lives on air through fun themes!',
            
               
            },
            'Sunday-7:00pm': {
               title1: 'ALBUM REVIEW',
               title2: null,
                image1: 'image11.jpg',
                text1: 'Album Review',
               
            },
            'Sunday-8:00pm': {
                title1: 'Box! Box! Box!',
                title2: null,
                image1: 'image12.jpg',
                text1: 'Box! Box! Box!',
             
            },
            'Sunday-9:00pm': {
                title1: 'Alien Invasion',
                title2: null,
                image1: 'image13.jpg',
                text1: 'Alien Invasion',
              
            },
            'Sunday-10:00pm': {
                title1: 'Jems Jamborees',
                title2: null,
                image1: 'image14.jpg',
                text1: 'Live Dj Set',
             
            },
            'Sunday-11:00pm': {
                title1: 'Tjaro x LSR',
                title2: null,
                image1: 'image15.jpg',
                text1: 'Live Dj Set',
               
            },
        };

        timeSlots.forEach(slot => {
            slot.addEventListener('click', function () {
                const day = this.dataset.day;
                const time = this.dataset.time;
                const key = `${day}-${time}`;
                const data = timeSlotData[key];

                if (data) {
                    overlayTitle.textContent = data.title1;  // Set the main title

                    let contentHTML = `<img src="${data.image1}" alt="Image 1" style="max-width:99%; max-height: auto; margin-bottom: 10px;">
                                       <p style="font-size:15px;">${data.text1}</p>`;
                    
                    // Add the second title *after* the first image and text, if it exists.
                    if (data.title2) {
                       contentHTML += `<h4 style="margin-bottom: 5px; margin-top: 10px; font-size:18px;">${data.title2}</h4>`;
                    }

                    // Add a second image and text if they exist.
                    if (data.image2) {
                        contentHTML += `<img src="${data.image2}" alt="Image 2" style="max-width:99%; max-height: auto; margin-top: 10px; margin-bottom: 10px;">
                                        <p style="font-size:15px;">${data.text2}</p>`;
                    }

                    overlayContent.innerHTML = contentHTML;


                } else {
                    overlayTitle.textContent = "Details";
                    overlayContent.innerHTML = `<p>No details available for ${day} at ${time}.</p>`;
                }

                overlay.style.display = 'block';

                // Calculate the position of the schedule grid
                const rect = scheduleGrid.getBoundingClientRect();
                
                overlay.style.left = rect.left + 'px';
                overlay.style.width = rect.width + 'px';
                overlay.style.height = rect.height + 'px';
            });
        });

        closeButton.addEventListener('click', function () {
            overlay.style.display = 'none';
        });

       // Remove click outside to close.
    });
