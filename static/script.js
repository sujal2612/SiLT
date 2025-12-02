// Smooth scroll to translator section
function scrollToTranslator() {
    document.getElementById('translator').scrollIntoView({
        behavior: 'smooth'
    });
}

// Mobile menu toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        hamburger.classList.toggle('active');
    });
}

// Close mobile menu when clicking on a link
const navLinks = document.querySelectorAll('.nav-menu a');
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
    });
});

// Camera functionality
const cameraBtn = document.getElementById('cameraBtn');
const videoStream = document.getElementById('videoStream');
const videoPlaceholder = document.querySelector('.video-placeholder');
const translateBtn = document.getElementById('translateBtn');
const outputText = document.getElementById('outputText');
const signLetters = document.getElementById('signLetters');
const canvas = document.getElementById('canvas');
const translatorContainer = document.querySelector('.translator-container');
const signToTextBtn = document.getElementById('signToTextBtn');
const textToSignBtn = document.getElementById('textToSignBtn');
const signToTextPanel = document.getElementById('signToTextPanel');
const signOutputSection = document.getElementById('signOutputSection');
const textInputSection = document.getElementById('textInputSection');
const textToSignInput = document.getElementById('textToSignInput');
const textSignOutput = document.getElementById('textSignOutput');
const clearBtn = document.getElementById('clearBtn');
const clearTextBtn = document.getElementById('clearTextBtn');
const signControls = clearBtn ? clearBtn.closest('.controls') : null;
const textControls = clearTextBtn ? clearTextBtn.closest('.controls') : null;
const speakBtn = document.getElementById('speakBtn');
const recentOutputHeading = document.getElementById('recentOutputHeading');
const DEFAULT_SIGN_PLACEHOLDER = '<div class="sign-letter">A</div><div class="sign-letter">B</div><div class="sign-letter">C</div>';
const TEXT_SIGN_PLACEHOLDER = '<p class="text-sign-placeholder">Enter text above to see the corresponding sign images.</p>';

let stream = null;
let isTranslating = false;
let translationInterval = null;
let currentSentence = '';
let lastPrediction = '';
let predictionCount = 0;
let isProcessing = false;
let predictionHistory = []; // Store recent predictions for stabilization
let currentAudio = null;
const HISTORY_SIZE = 5; // Number of predictions to consider
const MIN_HISTORY_SIZE = 3; // Minimum history needed for quick prediction
const MIN_CONFIDENCE_THRESHOLD = 30; // Minimum confidence to even consider a prediction
const MODES = {
    SIGN: 'sign-to-text',
    TEXT: 'text-to-sign'
};
let currentMode = MODES.SIGN;
let textToSignAssets = {};
const SPECIAL_TOKENS = ['NOTHING', 'SPACE', 'DEL'];
const SPECIAL_TOKEN_ORDER = [...SPECIAL_TOKENS].sort((a, b) => b.length - a.length);
const SPACE_BLOCK_MARKUP = '<div class="sign-gap blank" aria-label="Space"></div>';
const SPEAK_STATES = {
    IDLE: 'idle',
    LOADING: 'loading',
    PLAYING: 'playing'
};
let speakState = SPEAK_STATES.IDLE;

function clearPredictionState() {
    currentSentence = '';
    lastPrediction = '';
    predictionCount = 0;
    predictionHistory = [];
    isProcessing = false;
    applySpeakButtonState(SPEAK_STATES.IDLE);
    if (currentMode === MODES.SIGN) {
        renderDefaultSignLetters();
    }
}

function stopCameraStream() {
    stopTranslation();
    clearPredictionState();
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (videoStream) {
        videoStream.style.display = 'none';
    }
    if (videoPlaceholder) {
        videoPlaceholder.style.display = 'flex';
    }
    if (cameraBtn) {
        cameraBtn.textContent = 'Start Camera';
    }
    updateTranslateAvailability();
    applySpeakButtonState(SPEAK_STATES.IDLE);
    if (currentMode === MODES.SIGN) {
        renderDefaultSignLetters();
    }
}

function updateTranslateAvailability() {
    if (!translateBtn) return;
    if (currentMode !== MODES.SIGN) {
        translateBtn.disabled = true;
        translateBtn.textContent = 'Translate';
        translateBtn.style.backgroundColor = '';
        return;
    }
    translateBtn.disabled = !stream;
}

function setMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;
    applyModeUI();
}

function applyModeUI() {
    const isSignMode = currentMode === MODES.SIGN;

    if (signToTextBtn && textToSignBtn) {
        signToTextBtn.classList.toggle('active', isSignMode);
        textToSignBtn.classList.toggle('active', !isSignMode);
    }

    if (signToTextPanel) {
        signToTextPanel.classList.toggle('hidden', !isSignMode);
    }
    if (signOutputSection) {
        signOutputSection.classList.toggle('hidden', !isSignMode);
    }
    if (textInputSection) {
        textInputSection.classList.toggle('hidden', isSignMode);
    }
    if (signControls) {
        signControls.classList.toggle('hidden', !isSignMode);
    }
    if (textControls) {
        textControls.classList.toggle('hidden', isSignMode);
    }
    if (translatorContainer) {
        translatorContainer.classList.toggle('text-mode', !isSignMode);
    }
    if (textSignOutput) {
        textSignOutput.classList.toggle('hidden', currentMode === MODES.TEXT);
    }

    if (cameraBtn) {
        cameraBtn.disabled = !isSignMode;
        if (!isSignMode) {
            stopCameraStream();
        }
    }

    updateTranslateAvailability();

    if (!isSignMode) {
        renderTextToSign(textToSignInput ? textToSignInput.value : '');
    }
    applySpeakButtonState(SPEAK_STATES.IDLE);
    updateRecentOutputHeading(isSignMode);
    refreshRecentOutputArea();
}

function updateRecentOutputHeading(isSignMode) {
    if (!recentOutputHeading) return;
    recentOutputHeading.textContent = isSignMode ? 'Recent Text Output' : 'Recent Sign Output';
}

function refreshRecentOutputArea() {
    if (!signLetters) return;
    if (currentMode === MODES.SIGN) {
        signLetters.classList.remove('text-mode');
        displaySignLetters(currentSentence || '');
    } else {
        signLetters.classList.add('text-mode');
        renderTextToSign(textToSignInput ? textToSignInput.value : '');
    }
}

function renderDefaultSignLetters() {
    if (!signLetters) return;
    if (currentMode !== MODES.SIGN) return;
    signLetters.classList.remove('text-mode');
    signLetters.innerHTML = DEFAULT_SIGN_PLACEHOLDER;
}

// API endpoint
const API_URL = '/predict';

if (signToTextBtn) {
    signToTextBtn.addEventListener('click', () => setMode(MODES.SIGN));
}

if (textToSignBtn) {
    textToSignBtn.addEventListener('click', () => setMode(MODES.TEXT));
}

if (cameraBtn) {
    cameraBtn.addEventListener('click', async () => {
        if (currentMode !== MODES.SIGN) {
            return;
        }

        try {
            if (stream) {
                stopCameraStream();
            } else {
                // Start camera
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'user' } 
                });
                videoStream.srcObject = stream;
                videoStream.style.display = 'block';
                videoPlaceholder.style.display = 'none';
                cameraBtn.textContent = 'Stop Camera';
                updateTranslateAvailability();
            }
        } catch (error) {
            alert('Unable to access camera. Please ensure permissions are granted.');
            console.error('Camera error:', error);
            stopCameraStream();
        }
    });
}

// Function to get most common prediction from history with weighted confidence
function getStabilizedPrediction(history) {
    if (history.length < MIN_HISTORY_SIZE) return null;
    
    // Filter out very low-confidence predictions
    const filteredHistory = history.filter(p => p.confidence >= MIN_CONFIDENCE_THRESHOLD);
    if (filteredHistory.length < MIN_HISTORY_SIZE) return null;
    
    // Count occurrences of each prediction (weight recent predictions more)
    const counts = {};
    const confidences = {};
    
    filteredHistory.forEach((p, index) => {
        const weight = (index + 1) / filteredHistory.length; // More weight to recent predictions
        counts[p.prediction] = (counts[p.prediction] || 0) + weight;
        if (!confidences[p.prediction]) {
            confidences[p.prediction] = [];
        }
        confidences[p.prediction].push(p.confidence * weight);
    });
    
    // Find the most common prediction
    let maxWeight = 0;
    let mostCommon = null;
    for (const [pred, weight] of Object.entries(counts)) {
        if (weight > maxWeight) {
            maxWeight = weight;
            mostCommon = pred;
        }
    }
    
    // More lenient consistency requirement - 50% for quick response, 60% for better accuracy
    const requiredWeight = history.length >= HISTORY_SIZE 
        ? Math.ceil(HISTORY_SIZE * 0.6)  // 60% if we have full history
        : Math.ceil(filteredHistory.length * 0.5); // 50% if we have less history
    
    if (maxWeight >= requiredWeight && mostCommon) {
        // Calculate weighted average confidence
        const totalConfidence = confidences[mostCommon].reduce((sum, c) => sum + c, 0);
        const totalWeight = counts[mostCommon];
        const avgConfidence = totalConfidence / totalWeight;
        
        return { prediction: mostCommon, confidence: avgConfidence };
    }
    
    return null;
}

// Fallback function for quick prediction when history is small
function getQuickPrediction(history) {
    if (history.length < 2) return null;
    
    // Get the most recent prediction with good confidence
    const recent = history.slice(-3); // Last 3 predictions
    const highConf = recent.filter(p => p.confidence > 60);
    
    if (highConf.length >= 2) {
        // Check if last 2-3 predictions match
        const lastTwo = recent.slice(-2);
        if (lastTwo[0].prediction === lastTwo[1].prediction && lastTwo[0].confidence > 60) {
            return {
                prediction: lastTwo[0].prediction,
                confidence: (lastTwo[0].confidence + lastTwo[1].confidence) / 2
            };
        }
    }
    
    return null;
}

// Function to capture frame and send to backend
async function captureAndPredict() {
    if (!stream || !videoStream || videoStream.readyState !== videoStream.HAVE_ENOUGH_DATA) {
        return;
    }

    // Skip if still processing (cooldown period)
    if (isProcessing) {
        return;
    }

    try {
        // Set processing flag
        isProcessing = true;
        
        // Set canvas dimensions to match video
        canvas.width = videoStream.videoWidth;
        canvas.height = videoStream.videoHeight;
        
        // Draw current video frame to canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoStream, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to base64 image
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Send to backend
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageData })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.error) {
            console.error('Prediction error:', result.error);
            isProcessing = false;
            return;
        }

        // Only add to history if confidence meets minimum threshold
        if (result.confidence >= MIN_CONFIDENCE_THRESHOLD) {
            // Add to prediction history
            predictionHistory.push({
                prediction: result.prediction,
                confidence: result.confidence
            });
            
            // Keep only recent predictions
            if (predictionHistory.length > HISTORY_SIZE) {
                predictionHistory.shift();
            }
        } else {
            // Low confidence - don't add to history but show it
            const statusText = `Low confidence: ${result.prediction} (${result.confidence.toFixed(1)}%)`;
            if (outputText) {
                const mainText = currentSentence || 'Your translation will appear here...';
                outputText.innerHTML = `<div style="font-size: 0.9em; color: #999; margin-bottom: 0.5rem;">${statusText}</div><div style="font-size: 1.2em; color: #4a90e2; font-weight: 600;">${mainText}</div>`;
            }
            
            isProcessing = false;
            return;
        }

        // Get stabilized prediction (preferred method)
        let stabilized = getStabilizedPrediction(predictionHistory);
        
        // Fallback to quick prediction if stabilized is not available
        if (!stabilized && predictionHistory.length >= 2) {
            stabilized = getQuickPrediction(predictionHistory);
        }
        
        if (!stabilized) {
            // Not enough consistent predictions yet, just show current
            const statusText = `Detecting: ${result.prediction} (${result.confidence.toFixed(1)}%)`;
            if (outputText) {
                const mainText = currentSentence || 'Your translation will appear here...';
                outputText.innerHTML = `<div style="font-size: 0.9em; color: #666; margin-bottom: 0.5rem;">${statusText}</div><div style="font-size: 1.2em; color: #4a90e2; font-weight: 600;">${mainText}</div>`;
            }
            
            isProcessing = false;
            return;
        }

        // Use stabilized prediction
        const prediction = stabilized.prediction;
        const confidence = stabilized.confidence;
        
        // Handle different prediction types
        if (prediction === 'nothing') {
            // Reset if we get 'nothing' multiple times
            if (lastPrediction === 'nothing') {
                predictionCount++;
                if (predictionCount > 3) {
                    lastPrediction = '';
                    predictionCount = 0;
                    predictionHistory = []; // Clear history
                }
            } else {
                lastPrediction = 'nothing';
                predictionCount = 1;
            }
        } else if (prediction === 'space') {
            // Add space to sentence (60% confidence threshold)
            if (confidence > 60 && currentSentence && !currentSentence.endsWith(' ')) {
                currentSentence += ' ';
                updateOutput();
                displaySignLetters(currentSentence);
            }
            lastPrediction = 'space';
            predictionCount = 0;
            predictionHistory = []; // Clear history after action
        } else if (prediction === 'del') {
            // Delete last character (60% confidence threshold)
            if (confidence > 60 && currentSentence.length > 0) {
                currentSentence = currentSentence.slice(0, -1);
                updateOutput();
                displaySignLetters(currentSentence);
            }
            lastPrediction = 'del';
            predictionCount = 0;
            predictionHistory = []; // Clear history after action
        } else {
            // Regular letter prediction
            // Check if it's a valid letter (not 'nothing', 'space', 'del')
            if (!/^[A-Z]$/.test(prediction)) {
                // Invalid prediction, skip
                isProcessing = false;
                return;
            }
            
            if (prediction !== lastPrediction) {
                // New prediction - require good confidence (60% for quick response, 65% for better accuracy)
                const threshold = predictionHistory.length >= HISTORY_SIZE ? 65 : 60;
                if (confidence > threshold) {
                    currentSentence += prediction;
                    updateOutput();
                    displaySignLetters(currentSentence);
                    lastPrediction = prediction;
                    predictionCount = 1;
                    predictionHistory = []; // Clear history after adding letter to prevent duplicates
                } else if (confidence > 50) {
                    // Medium confidence - track but don't add yet
                    lastPrediction = prediction;
                    predictionCount++;
                }
            } else {
                // Same prediction - increment count
                predictionCount++;
                // If we've seen the same prediction multiple times with good confidence, add it
                const threshold = predictionHistory.length >= HISTORY_SIZE ? 60 : 55;
                if (predictionCount >= 2 && confidence > threshold) {
                    if (!currentSentence.endsWith(prediction)) {
                        currentSentence += prediction;
                        updateOutput();
                        displaySignLetters(currentSentence);
                        predictionHistory = [];
                    }
                    predictionCount = 0;
                }
            }
        }

        // Update output text with stabilized prediction and confidence
        const statusText = `Detected: ${prediction} (${confidence.toFixed(1)}%)`;
        if (outputText) {
            const mainText = currentSentence || 'Your translation will appear here...';
            outputText.innerHTML = `<div style="font-size: 0.9em; color: #666; margin-bottom: 0.5rem;">${statusText}</div><div style="font-size: 1.2em; color: #4a90e2; font-weight: 600;">${mainText}</div>`;
        }
        
    } catch (error) {
        console.error('Error capturing frame:', error);
    } finally {
        isProcessing = false;
    }
}

function updateOutput() {
    if (outputText && currentSentence) {
        const statusText = `Current: ${lastPrediction || 'none'}`;
        outputText.innerHTML = `<div style="font-size: 0.9em; color: #666; margin-bottom: 0.5rem;">${statusText}</div><div style="font-size: 1.2em; color: #4a90e2; font-weight: 600;">${currentSentence}</div>`;
    }
    applySpeakButtonState(SPEAK_STATES.IDLE);
}

function displaySignLetters(text) {
    if (!signLetters || currentMode !== MODES.SIGN) return;
    signLetters.classList.remove('text-mode');
    
    // Filter out non-letters and spaces for display
    const letters = text.split('').filter(char => /[A-Z]/.test(char));
    
    if (letters.length === 0) {
        renderDefaultSignLetters();
        return;
    }
    
    // Display last 10 letters
    const displayLetters = letters.slice(-10);
    signLetters.innerHTML = displayLetters.map(letter => 
        `<div class="sign-letter">${letter}</div>`
    ).join('');
}

function tokenizeTextToSign(text) {
    if (!text) return [];
    const normalized = text.toUpperCase();
    const tokens = [];
    let index = 0;

    while (index < normalized.length) {
        let matchedToken = null;
        for (const token of SPECIAL_TOKEN_ORDER) {
            if (normalized.startsWith(token, index)) {
                matchedToken = token;
                break;
            }
        }

        if (matchedToken) {
            tokens.push(matchedToken);
            index += matchedToken.length;
            continue;
        }

        const char = normalized[index];
        if (char === ' ') {
            tokens.push(' ');
        } else if (/[A-Z]/.test(char)) {
            tokens.push(char);
        }

        index += 1;
    }

    return tokens;
}

function renderTextToSign(rawText) {
    const tokens = tokenizeTextToSign(rawText || '');
    const hasTokens = tokens.length > 0;
    const markup = hasTokens ? tokens.map(token => {
        if (token === ' ' || token === 'SPACE') {
            return SPACE_BLOCK_MARKUP;
        }

        const assetUrl = textToSignAssets[token];
        if (assetUrl) {
            return `
                <div class="sign-image-card">
                    <img src="${assetUrl}" alt="Sign for ${token}">
                </div>
            `;
        }

        return `<div class="sign-letter-card">${token}</div>`;
    }).join('') : TEXT_SIGN_PLACEHOLDER;

    if (textSignOutput) {
        textSignOutput.innerHTML = markup;
    }

    if (currentMode === MODES.TEXT && signLetters) {
        signLetters.classList.add('text-mode');
        signLetters.innerHTML = markup;
    }
}

async function loadSignAssets() {
    try {
        const response = await fetch('/sign-assets');
        if (!response.ok) {
            throw new Error(`Failed to fetch assets: ${response.status}`);
        }
        const data = await response.json();
        textToSignAssets = data.assets || {};
    } catch (error) {
        console.warn('Unable to load sign assets. Falling back to letters only.', error);
        textToSignAssets = {};
    } finally {
        renderTextToSign(textToSignInput ? textToSignInput.value : '');
    }
}

// Translate button - start/stop real-time translation
if (translateBtn) {
    translateBtn.addEventListener('click', () => {
        if (currentMode !== MODES.SIGN) {
            return;
        }

        if (!stream) {
            alert('Please start the camera first');
            return;
        }

        if (isTranslating) {
            stopTranslation();
        } else {
            startTranslation();
        }
    });
}

function startTranslation() {
    if (isTranslating) return;
    
    isTranslating = true;
    translateBtn.textContent = 'Stop Translation';
    translateBtn.style.backgroundColor = '#dc3545';
    clearPredictionState();
    
    // Capture and predict every 600ms
    translationInterval = setInterval(captureAndPredict, 600);
    
    // Start processing immediately
    captureAndPredict();
}

function stopTranslation() {
    if (!isTranslating) {
        updateTranslateAvailability();
        return;
    }
    
    isTranslating = false;
    translateBtn.textContent = 'Translate';
    translateBtn.style.backgroundColor = '';
    clearPredictionState();
    
    if (translationInterval) {
        clearInterval(translationInterval);
        translationInterval = null;
    }
}

// Clear Translation button
if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        clearPredictionState();

        if (outputText) {
            outputText.textContent = 'Your translation will appear here...';
            outputText.style.color = '';
            outputText.innerHTML = 'Your translation will appear here...';
        }

        renderDefaultSignLetters();
    });
}

if (textToSignInput) {
    textToSignInput.addEventListener('input', () => {
        renderTextToSign(textToSignInput.value);
    });
}

if (clearTextBtn) {
    clearTextBtn.addEventListener('click', () => {
        if (textToSignInput) {
            textToSignInput.value = '';
        }
        renderTextToSign('');
    });
}

if (speakBtn) {
    speakBtn.addEventListener('click', () => {
        const text = currentSentence.trim();
        if (!text) {
            return;
        }
        requestSpeech(text);
    });
}

function applySpeakButtonState(state) {
    if (!speakBtn) return;
    const hasText = Boolean(currentSentence.trim());
    speakState = state;
    speakBtn.classList.toggle('loading', state === SPEAK_STATES.LOADING);
    speakBtn.setAttribute('aria-busy', state === SPEAK_STATES.LOADING ? 'true' : 'false');
    setSpeakLabel(
        state === SPEAK_STATES.PLAYING
            ? 'Playing...'
            : state === SPEAK_STATES.LOADING
                ? 'Preparing...'
                : 'Listen'
    );
    if (state === SPEAK_STATES.LOADING) {
        setSpeakIcon('⏳');
        speakBtn.disabled = true;
    } else if (state === SPEAK_STATES.PLAYING) {
        setSpeakIcon('🔉');
        speakBtn.disabled = false;
    } else {
        setSpeakIcon('🔊');
        speakBtn.disabled = !hasText;
    }
}

function setSpeakIcon(symbol) {
    if (!speakBtn) return;
    const iconEl = speakBtn.querySelector('.mic-icon');
    if (iconEl) {
        iconEl.textContent = symbol;
    }
}

function setSpeakLabel(text) {
    if (!speakBtn) return;
    const labelEl = speakBtn.querySelector('.speak-label');
    if (labelEl) {
        labelEl.textContent = text;
    }
}

async function requestSpeech(text) {
    if (!speakBtn) return;
    applySpeakButtonState(SPEAK_STATES.LOADING);
    try {
        const response = await fetch('/speak', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        if (result.error || !result.audio) {
            throw new Error(result.error || 'No audio data received');
        }
        const audioSrc = `data:${result.content_type || 'audio/mpeg'};base64,${result.audio}`;
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        currentAudio = new Audio(audioSrc);
        currentAudio.onended = () => {
            currentAudio = null;
            applySpeakButtonState(SPEAK_STATES.IDLE);
        };
        currentAudio.onerror = () => {
            currentAudio = null;
            applySpeakButtonState(SPEAK_STATES.IDLE);
        };
        await currentAudio.play();
        applySpeakButtonState(SPEAK_STATES.PLAYING);
    } catch (error) {
        console.error('Speech synthesis error:', error);
        alert('Unable to generate voice-over right now. Please try again.');
        applySpeakButtonState(SPEAK_STATES.IDLE);
    }
}

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe feature cards and steps
document.addEventListener('DOMContentLoaded', () => {
    applyModeUI();
    loadSignAssets();
    applySpeakButtonState(SPEAK_STATES.IDLE);

    const featureCards = document.querySelectorAll('.feature-card');
    const steps = document.querySelectorAll('.step');
    
    featureCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'all 0.6s ease';
        observer.observe(card);
    });
    
    steps.forEach(step => {
        step.style.opacity = '0';
        step.style.transform = 'translateY(20px)';
        step.style.transition = 'all 0.6s ease';
        observer.observe(step);
    });
});

