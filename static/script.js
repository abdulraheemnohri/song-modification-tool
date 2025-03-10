let uploadedFilename = "";
let wavesurfer = WaveSurfer.create({
    container: "#waveform",
    waveColor: "#007bff",
    progressColor: "#0056b3",
    cursorColor: "#0056b3",
    height: 100,
    responsive: true
});

// Add drag and drop support
const dropZone = document.querySelector('.file-upload');
const fileInput = document.getElementById('fileInput');
const progressBar = document.querySelector('.progress');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults (e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});

function highlight(e) {
    dropZone.classList.add('bg-light');
}

function unhighlight(e) {
    dropZone.classList.remove('bg-light');
}

dropZone.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    fileInput.files = dt.files;
    uploadFile();
}

document.getElementById("speed").addEventListener("input", (e) => {
    document.getElementById("speedValue").textContent = `${e.target.value}x`;
});

document.getElementById("pitch").addEventListener("input", (e) => {
    document.getElementById("pitchValue").textContent = `${e.target.value} semitones`;
});

// Add equalizer controls
['bass', 'mid', 'treble'].forEach(param => {
    document.getElementById(param).addEventListener('input', (e) => {
        document.getElementById(`${param}Value`).textContent = `${e.target.value} dB`;
    });
});

// Add reverb controls
['roomSize', 'damping'].forEach(param => {
    document.getElementById(param).addEventListener('input', (e) => {
        document.getElementById(`${param}Value`).textContent = e.target.value;
    });
});

// Upload functionality
let currentUpload = null;

function triggerFileInput() {
    document.getElementById('fileInput').click();
}

function cancelUpload() {
    if (currentUpload) {
        currentUpload.abort();
        currentUpload = null;
        resetUploadUI();
    }
}

function resetUploadUI() {
    const uploadStatus = document.querySelector('.upload-status');
    uploadStatus.classList.add('d-none');
    document.querySelector('.progress-bar').style.width = '0%';
    document.querySelector('.progress-text').textContent = '0%';
}

function showUploadProgress(progress) {
    const uploadStatus = document.querySelector('.upload-status');
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress-text');
    
    if (uploadStatus.classList.contains('d-none')) {
        uploadStatus.classList.remove('d-none');
    }
    
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${progress}%`;
}

document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        showSelectedFile(file);
    }
});

function showSelectedFile(file) {
    const selectedFile = document.querySelector('.selected-file');
    const filename = document.querySelector('.selected-filename');
    selectedFile.classList.remove('d-none');
    filename.textContent = file.name;
    uploadedFilename = file.name; // Set the global filename
}

function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showNotification('Please select a file first', 'warning');
        return;
    }

    // Check file size
    const maxSize = 16 * 1024 * 1024; // 16MB
    if (file.size > maxSize) {
        showNotification('File too large. Maximum size is 16MB', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    // Show upload status
    const uploadStatus = document.querySelector('.upload-status');
    uploadStatus.classList.remove('d-none');
    
    // Hide selected file display during upload
    const selectedFile = document.querySelector('.selected-file');
    selectedFile.classList.add('d-none');

    // Create upload request
    currentUpload = new XMLHttpRequest();
    
    currentUpload.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const progress = Math.round((e.loaded * 100) / e.total);
            showUploadProgress(progress);
        }
    });

    currentUpload.addEventListener('load', function() {
        if (this.status === 200) {
            try {
                const response = JSON.parse(this.responseText);
                handleUploadSuccess(response);
            } catch (e) {
                handleUploadError('Invalid server response');
            }
        } else {
            handleUploadError('Upload failed');
        }
    });

    currentUpload.addEventListener('error', () => handleUploadError('Network error'));
    currentUpload.addEventListener('abort', () => handleUploadError('Upload cancelled'));

    currentUpload.open('POST', '/upload', true);
    currentUpload.send(formData);
}

function handleUploadSuccess(response) {
    uploadedFilename = response.filename;
    showNotification('File uploaded successfully', 'success');
    addToRecentFiles(response.filename);
    
    // Update player
    if (wavesurfer) {
        wavesurfer.load(`/uploads/${response.filename}`);
    }
    
    // Switch to player section
    switchSection('player');
    
    // Reset upload UI after delay
    setTimeout(() => {
        resetUploadUI();
        // Clear file input
        document.getElementById('fileInput').value = '';
    }, 1000);
}

function handleUploadError(message) {
    showNotification(message, 'error');
    currentUpload = null;
    resetUploadUI();
}

document.getElementById('fileInput').addEventListener('change', uploadFile);
document.getElementById('dropZone').addEventListener('drop', handleDrop);

function handleError(error, message) {
    console.error('Error:', error);
    toggleProcessing(false);
    alert(message || "An error occurred");
}

function modifyAudio() {
    if (!uploadedFilename) {
        alert("Please upload a file first");
        return;
    }

    let speed = document.getElementById("speed").value;
    let pitch = document.getElementById("pitch").value;

    toggleProcessing(true);

    fetch("/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            filename: uploadedFilename,
            speed: speed,
            pitch: pitch
        })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        document.getElementById("audioPlayer").src = `/processed/${data.modified_file}`;
        wavesurfer.load(`/processed/${data.modified_file}`);
    })
    .catch(error => handleError(error, "Modification failed"))
    .finally(() => toggleProcessing(false));
}

function separateVocals() {
    if (!uploadedFilename) {
        alert("Please upload a file first");
        return;
    }

    fetch("/separate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: uploadedFilename })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
    })
    .catch(error => {
        console.error('Error:', error);
        alert("Vocal separation failed");
    });
}

function reduceNoise() {
    if (!uploadedFilename) {
        alert("Please upload a file first");
        return;
    }

    toggleProcessing(true);

    fetch("/reduce_noise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: uploadedFilename })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        document.getElementById("audioPlayer").src = `/processed/${data.processed_file}`;
        wavesurfer.load(`/processed/${data.processed_file}`);
    })
    .catch(error => handleError(error, "Noise reduction failed"))
    .finally(() => toggleProcessing(false));
}

function applyEqualizer() {
    if (!uploadedFilename) {
        alert("Please upload a file first");
        return;
    }

    fetch("/eq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            filename: uploadedFilename,
            bass: document.getElementById("bass").value,
            mid: document.getElementById("mid").value,
            treble: document.getElementById("treble").value
        })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        document.getElementById("audioPlayer").src = `/processed/${data.processed_file}`;
        wavesurfer.load(`/processed/${data.processed_file}`);
    })
    .catch(error => {
        console.error('Error:', error);
        alert("Failed to apply equalizer");
    });
}

function applyReverb() {
    if (!uploadedFilename) {
        alert("Please upload a file first");
        return;
    }

    fetch("/reverb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            filename: uploadedFilename,
            room_size: document.getElementById("roomSize").value,
            damping: document.getElementById("damping").value
        })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        document.getElementById("audioPlayer").src = `/processed/${data.processed_file}`;
        wavesurfer.load(`/processed/${data.processed_file}`);
    })
    .catch(error => {
        console.error('Error:', error);
        alert("Failed to apply reverb");
    });
}

function analyzeAudio() {
    if (!uploadedFilename) {
        showNotification('Please upload a file first', 'warning');
        return;
    }

    showLoadingState('analysis');
    fetch("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: uploadedFilename })
    })
    .then(response => response.json())
    .then(data => {
        if (data.analysis) {
            animateAnalysisResults(data.analysis);
        }
    })
    .catch(error => handleError(error, "Analysis failed"))
    .finally(() => hideLoadingState('analysis'));
}

function animateAnalysisResults(analysis) {
    const elements = {
        tempo: { el: document.getElementById('tempoValue'), value: analysis.tempo },
        key: { el: document.getElementById('keyValue'), value: analysis.key },
        loudness: { el: document.getElementById('loudnessValue'), value: analysis.loudness }
    };

    for (const [key, {el, value}] of Object.entries(elements)) {
        animateValue(el, value);
    }
}

function applyStyle() {
    if (!uploadedFilename) {
        alert("Please upload a file first");
        return;
    }

    const style = document.getElementById("styleSelect").value;

    fetch("/style_transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            filename: uploadedFilename,
            style: style
        })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        document.getElementById("audioPlayer").src = `/processed/${data.processed_file}`;
        wavesurfer.load(`/processed/${data.processed_file}`);
    })
    .catch(error => {
        console.error('Error:', error);
        alert("Style transfer failed");
    });
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const switchElement = document.querySelector('.switch');
    switchElement.classList.toggle('active');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// Check for saved dark mode preference
if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    document.querySelector('.switch').classList.add('active');
}

// Update progress circle
function updateProgressCircle(percent) {
    const circle = document.querySelector('.progress-circle-bar');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percent / 100) * circumference;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = offset;
    document.querySelector('.progress-text').textContent = `${Math.round(percent)}%`;
}

// Show processing animation
function toggleProcessing(show) {
    const indicator = document.getElementById('processingIndicator');
    if (show) {
        indicator.classList.remove('d-none');
    } else {
        indicator.classList.add('d-none');
    }
}

function updateAudioStats(file) {
    const audioElement = document.getElementById('audioPlayer');
    
    // Update duration
    audioElement.addEventListener('loadedmetadata', () => {
        const minutes = Math.floor(audioElement.duration / 60);
        const seconds = Math.floor(audioElement.duration % 60);
        document.getElementById('audioDuration').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
    });

    // Update format
    document.getElementById('audioFormat').textContent = file.type.split('/')[1].toUpperCase();

    // Update other stats when processing is complete
    wavesurfer.on('ready', () => {
        const peaks = wavesurfer.backend.getPeaks(1000);
        const maxPeak = Math.max(...peaks.map(Math.abs));
        document.getElementById('peakVolume').textContent = 
            `${(20 * Math.log10(maxPeak)).toFixed(1)} dB`;
        document.getElementById('sampleRate').textContent = 
            `${(wavesurfer.backend.sampleRate / 1000).toFixed(1)} kHz`;
    });
}

function normalizeAudio() {
    if (!uploadedFilename) {
        alert("Please upload a file first");
        return;
    }

    toggleProcessing(true);
    fetch("/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: uploadedFilename })
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById("audioPlayer").src = `/processed/${data.processed_file}`;
        wavesurfer.load(`/processed/${data.processed_file}`);
    })
    .catch(error => handleError(error, "Normalization failed"))
    .finally(() => toggleProcessing(false));
}

function fadeEffect(type) {
    if (!uploadedFilename) {
        alert("Please upload a file first");
        return;
    }

    toggleProcessing(true);
    fetch("/fade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            filename: uploadedFilename,
            fade_type: type
        })
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById("audioPlayer").src = `/processed/${data.processed_file}`;
        wavesurfer.load(`/processed/${data.processed_file}`);
    })
    .catch(error => handleError(error, "Fade effect failed"))
    .finally(() => toggleProcessing(false));
}

// Enhanced menu functionality
function toggleMenu() {
    const menu = document.querySelector('.side-menu');
    const content = document.querySelector('.main-content');
    const menuIcon = document.querySelector('.menu-toggle i');
    
    menu.classList.toggle('collapsed');
    content.classList.toggle('expanded');
    
    if (menu.classList.contains('collapsed')) {
        menuIcon.classList.replace('fa-chevron-left', 'fa-chevron-right');
        document.querySelectorAll('.menu-item span').forEach(span => {
            span.style.opacity = '0';
        });
    } else {
        menuIcon.classList.replace('fa-chevron-right', 'fa-chevron-left');
        document.querySelectorAll('.menu-item span').forEach(span => {
            span.style.opacity = '1';
        });
    }
}

// Improved mobile menu handling
function toggleMobileMenu() {
    const menu = document.querySelector('.side-menu');
    const toggle = document.querySelector('.mobile-menu-toggle i');
    
    menu.classList.toggle('show');
    toggle.classList.toggle('fa-bars');
    toggle.classList.toggle('fa-times');
}

// Enhanced scroll behavior
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        const section = document.querySelector(`#${item.dataset.section}`);
        if (section) {
            section.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
            
            // Add highlight animation
            section.classList.add('highlight');
            setTimeout(() => section.classList.remove('highlight'), 1000);
        }
        
        if (window.innerWidth <= 768) {
            toggleMobileMenu();
        }
    });
});

// Close menu when clicking outside on mobile
document.addEventListener('click', (e) => {
    const menu = document.querySelector('.side-menu');
    const menuButton = document.querySelector('.menu-toggle');
    if (window.innerWidth <= 768 && !menu.contains(e.target) && !menuButton.contains(e.target)) {
        menu.classList.remove('show');
    }
});

// Section Navigation
document.querySelectorAll('.section-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Update active button
        document.querySelectorAll('.section-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Show corresponding section
        const sectionId = btn.dataset.section;
        document.querySelectorAll('.feature-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionId).classList.add('active');
    });
});

// Handle deep linking
function handleDeepLink() {
    const hash = window.location.hash.slice(1);
    if (hash) {
        const btn = document.querySelector(`.section-btn[data-section="${hash}"]`);
        if (btn) btn.click();
    }
}

window.addEventListener('load', handleDeepLink);
window.addEventListener('hashchange', handleDeepLink);

// Menu and Section Handling
document.addEventListener('DOMContentLoaded', () => {
    const sideMenu = document.querySelector('.side-menu');
    const mainContent = document.querySelector('.main-content');
    const menuToggle = document.querySelector('.menu-toggle');
    const menuItems = document.querySelectorAll('.menu-item');
    const sectionBtns = document.querySelectorAll('.section-btn');

    function activateSection(sectionId) {
        // Hide all sections first
        document.querySelectorAll('.feature-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show selected section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
            
            // Update section navigation
            sectionBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.section === sectionId);
            });
        }
    }

    // Side Menu Item Click
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Update active state
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // Get section ID from data attribute
            const sectionId = item.dataset.section;
            activateSection(sectionId);
            
            // Close mobile menu if needed
            if (window.innerWidth <= 768) {
                sideMenu.classList.remove('show');
            }
        });
    });

    // Section Navigation
    sectionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionId = btn.dataset.section;
            activateSection(sectionId);
        });
    });

    // Menu Toggle
    menuToggle.addEventListener('click', () => {
        sideMenu.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        
        const icon = menuToggle.querySelector('i');
        if (sideMenu.classList.contains('collapsed')) {
            icon.classList.replace('fa-chevron-left', 'fa-chevron-right');
        } else {
            icon.classList.replace('fa-chevron-right', 'fa-chevron-left');
        }
    });

    // Mobile Menu Toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            sideMenu.classList.toggle('show');
            const icon = mobileMenuToggle.querySelector('i');
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-times');
        });
    }

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            const isMenuClick = sideMenu.contains(e.target);
            const isToggleClick = mobileMenuToggle?.contains(e.target);
            
            if (!isMenuClick && !isToggleClick) {
                sideMenu.classList.remove('show');
                if (mobileMenuToggle) {
                    const icon = mobileMenuToggle.querySelector('i');
                    icon.classList.replace('fa-times', 'fa-bars');
                }
            }
        }
    });

    // Handle initial section based on URL hash
    const hash = window.location.hash.slice(1);
    if (hash) {
        activateSection(hash);
        const menuItem = document.querySelector(`.menu-item[data-section="${hash}"]`);
        if (menuItem) {
            menuItems.forEach(i => i.classList.remove('active'));
            menuItem.classList.add('active');
        }
    }
});

// Fix menu and section handling
document.addEventListener('DOMContentLoaded', () => {
    const sideMenu = document.querySelector('.side-menu');
    const mainContent = document.querySelector('.main-content');
    const menuToggle = document.querySelector('.menu-toggle');
    const menuItems = document.querySelectorAll('.menu-item');
    const sectionBtns = document.querySelectorAll('.section-btn');
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');

    function activateSection(sectionId) {
        // Hide all sections with transition
        document.querySelectorAll('.feature-section').forEach(section => {
            section.style.opacity = '0';
            section.style.transform = 'translateY(20px)';
            setTimeout(() => {
                section.classList.remove('active');
                if (section.id === sectionId) {
                    section.classList.add('active');
                    // Trigger reflow
                    section.offsetHeight;
                    section.style.opacity = '1';
                    section.style.transform = 'translateY(0)';
                }
            }, 300);
        });

        // Update navigation states
        menuItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionId);
        });
        sectionBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionId);
        });
    }

    // Initialize first section
    const initialSection = window.location.hash.slice(1) || 'info';
    activateSection(initialSection);

    // Menu item clicks
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.dataset.section;
            activateSection(sectionId);
            
            if (window.innerWidth <= 768) {
                sideMenu.classList.remove('show');
                mobileMenuToggle.querySelector('i').classList.replace('fa-times', 'fa-bars');
            }
        });
    });

    // Section button clicks
    sectionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            activateSection(btn.dataset.section);
        });
    });

    // Menu toggle
    menuToggle?.addEventListener('click', () => {
        sideMenu.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        
        const icon = menuToggle.querySelector('i');
        if (sideMenu.classList.contains('collapsed')) {
            icon.classList.replace('fa-chevron-left', 'fa-chevron-right');
        } else {
            icon.classList.replace('fa-chevron-right', 'fa-chevron-left');
        }
    });

    // Mobile menu
    mobileMenuToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        sideMenu.classList.toggle('show');
        const icon = mobileMenuToggle.querySelector('i');
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
    });

    // Close menu on outside click
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            const isMenuClick = sideMenu.contains(e.target);
            const isToggleClick = mobileMenuToggle?.contains(e.target);
            
            if (!isMenuClick && !isToggleClick && sideMenu.classList.contains('show')) {
                sideMenu.classList.remove('show');
                mobileMenuToggle.querySelector('i').classList.replace('fa-times', 'fa-bars');
            }
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const sideMenu = document.querySelector('.side-menu');
    const mainContent = document.querySelector('.main-content');
    const menuToggle = document.querySelector('.menu-toggle');
    const menuItems = document.querySelectorAll('.menu-item');
    const sectionBtns = document.querySelectorAll('.section-btn');
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');

    function switchSection(sectionId, animate = true) {
        const sections = document.querySelectorAll('.feature-section');
        const targetSection = document.getElementById(sectionId);
        
        if (!targetSection) return;

        // Update navigation
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionId);
        });
        
        document.querySelectorAll('.section-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionId);
        });

        // Animate section change
        if (animate) {
            sections.forEach(section => {
                if (section.classList.contains('active')) {
                    section.style.transform = 'translateY(20px)';
                    section.style.opacity = '0';
                }
            });

            setTimeout(() => {
                sections.forEach(section => section.classList.remove('active'));
                targetSection.classList.add('active');
                targetSection.style.transform = 'translateY(0)';
                targetSection.style.opacity = '1';
            }, 300);
        } else {
            sections.forEach(section => section.classList.remove('active'));
            targetSection.classList.add('active');
        }

        // Update URL hash without scrolling
        history.replaceState(null, null, `#${sectionId}`);
    }

    // Initialize with saved or default section
    const savedSection = localStorage.getItem('currentSection') || 'upload';
    switchSection(savedSection, false);

    // Section navigation
    document.querySelectorAll('.menu-item, .section-btn').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = el.dataset.section;
            switchSection(sectionId);
            localStorage.setItem('currentSection', sectionId);
            
            if (window.innerWidth <= 768) {
                document.querySelector('.side-menu').classList.remove('show');
            }
        });
    });
});

// Enhanced Player Controls
let isPlaying = false;

function togglePlay() {
    const playBtn = document.querySelector('.play-btn i');
    if (isPlaying) {
        wavesurfer.pause();
        playBtn.classList.replace('fa-pause', 'fa-play');
    } else {
        wavesurfer.play();
        playBtn.classList.replace('fa-play', 'fa-pause');
    }
    isPlaying = !isPlaying;
}

function updatePlaybackTime() {
    const currentTime = formatTime(wavesurfer.getCurrentTime());
    const totalTime = formatTime(wavesurfer.getDuration());
    document.getElementById('currentTime').textContent = currentTime;
    document.getElementById('totalTime').textContent = totalTime;
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Volume Control
document.getElementById('volume').addEventListener('input', (e) => {
    const volume = parseFloat(e.target.value);
    wavesurfer.setVolume(volume);
    updateVolumeIcon(volume);
});

function updateVolumeIcon(volume) {
    const icon = document.querySelector('.volume-control i');
    icon.className = 'fas ' + (
        volume === 0 ? 'fa-volume-mute' :
        volume < 0.5 ? 'fa-volume-down' : 
        'fa-volume-up'
    );
}

// Enhanced WaveSurfer setup
wavesurfer = WaveSurfer.create({
    container: "#waveform",
    waveColor: "#007bff",
    progressColor: "#0056b3",
    cursorColor: "#0056b3",
    height: 100,
    responsive: true,
    cursorWidth: 2,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    hideScrollbar: true,
    progressColor: '#4f46e5',
    waveColor: '#cbd5e1',
    cursorColor: '#818cf8'
});

wavesurfer.on('ready', updatePlaybackTime);
wavesurfer.on('audioprocess', updatePlaybackTime);
wavesurfer.on('finish', () => {
    isPlaying = false;
    document.querySelector('.play-btn i').classList.replace('fa-pause', 'fa-play');
});

// Mixer Controls
const mixer = {
    main: document.getElementById('mainVolume'),
    vocals: document.getElementById('vocalVolume'),
    instrumental: document.getElementById('instrumentalVolume')
};

Object.entries(mixer).forEach(([track, control]) => {
    control.addEventListener('input', (e) => {
        updateTrackVolume(track, e.target.value);
    });
});

function updateTrackVolume(track, value) {
    const normalizedValue = value / 100;
    switch(track) {
        case 'main':
            wavesurfer.setVolume(normalizedValue);
            break;
        case 'vocals':
            // Update vocals track volume
            break;
        case 'instrumental':
            // Update instrumental track volume
            break;
    }
}

// Color Effects
document.querySelectorAll('.color-preset').forEach(preset => {
    preset.addEventListener('click', () => {
        const color = preset.dataset.color;
        applyColorEffect(color);
    });
});

function applyColorEffect(color) {
    const effects = {
        warm: { waveColor: '#ffa07a', progressColor: '#ff7f50' },
        cool: { waveColor: '#87ceeb', progressColor: '#4169e1' },
        vibrant: { waveColor: '#ff1493', progressColor: '#9400d3' },
        mellow: { waveColor: '#98fb98', progressColor: '#3cb371' }
    };

    const effect = effects[color];
    if (effect) {
        wavesurfer.setWaveColor(effect.waveColor);
        wavesurfer.setProgressColor(effect.progressColor);
    }
}
