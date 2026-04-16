const homeScreen = document.getElementById('home-screen');
const exerciseScreen = document.getElementById('exercise-screen');
const setupScreen = document.getElementById('setup-screen');
const trainingScreen = document.getElementById('training-screen');
const selectExerciseBtn = document.getElementById('start-training-btn');
const backBtn = document.getElementById('back-btn');
const backToExerciseBtn = document.getElementById('back-to-exercise-btn');
const switchCameraBtn = document.getElementById('switch-camera-btn');
const endSessionBtn = document.getElementById('end-session-btn');
const exerciseTitle = document.getElementById('exercise-title');
const trainingTitle = document.getElementById('training-exercise-title');
const trainingFeedback = document.getElementById('training-feedback');
const exerciseBtns = document.querySelectorAll('.exercise-btn');
const cameraPreview = document.getElementById('camera-preview');
const setsInput = document.getElementById('sets');
const repsInput = document.getElementById('reps');

let selectedExercise = '';
let currentStream = null;
let currentFacingMode = 'environment'; // Start with rear camera for better pose detection
let currentScreen = 'home';
let videoDevices = [];
let currentCameraIndex = 0;
let exerciseSettings = {};

history.replaceState({ screen: 'home' }, '');

async function loadVideoDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log(`Found ${videoDevices.length} video device(s)`);
        if (videoDevices.length > 0) {
            // Try to restore the last selected camera
            const savedIndex = localStorage.getItem('selectedCameraIndex');
            if (savedIndex !== null) {
                const parsedIndex = parseInt(savedIndex, 10);
                if (parsedIndex >= 0 && parsedIndex < videoDevices.length) {
                    currentCameraIndex = parsedIndex;
                    console.log(`Restored camera index: ${currentCameraIndex}`);
                } else {
                    currentCameraIndex = 0;
                }
            } else {
                currentCameraIndex = 0;
            }
        }
    } catch (error) {
        console.error('Error enumerating devices:', error);
        videoDevices = [];
    }
}

async function getVideoDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
        console.error('Error enumerating devices:', error);
        return [];
    }
}

async function selectBestCamera() {
    // Use the current camera from the loaded devices
    if (videoDevices.length > 0) {
        return videoDevices[currentCameraIndex].deviceId;
    }
    return null;
}

function showScreen(screen) {
    [homeScreen, exerciseScreen, setupScreen, trainingScreen].forEach((section) => {
        section.classList.toggle('hidden', section !== screen);
    });
    currentScreen = screen.id.replace('-screen', '');
}

function getCameraConstraints() {
    return {
        video: { facingMode: currentFacingMode },
        audio: false,
    };
}

async function openCamera() {
    stopCamera();

    try {
        let constraints = {
            audio: false,
        };
        
        // Try to get the best camera using deviceId
        const selectedDeviceId = await selectBestCamera();
        
        if (selectedDeviceId) {
            constraints.video = {
                deviceId: { exact: selectedDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
                zoom: 1.0
            };
        } else {
            // Fallback to facingMode if deviceId selection fails
            constraints.video = {
                facingMode: currentFacingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                zoom: 1.0
            };
        }
        
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraPreview.srcObject = currentStream;
        await cameraPreview.play();
        
        // Apply mirror effect for front camera based on device label
        const currentDeviceLabel = videoDevices[currentCameraIndex]?.label?.toLowerCase() || '';
        if (currentDeviceLabel.includes('front') || currentDeviceLabel.includes('user') || currentDeviceLabel.includes('selfie')) {
            cameraPreview.classList.add('mirror');
            canvasElement.classList.add('mirror');
        } else {
            cameraPreview.classList.remove('mirror');
            canvasElement.classList.remove('mirror');
        }
        
        // Apply advanced zoom constraint if supported
        const videoTrack = currentStream.getVideoTracks()[0];
        if (videoTrack) {
            try {
                const capabilities = videoTrack.getCapabilities();
                if (capabilities && capabilities.zoom) {
                    await videoTrack.applyConstraints({
                        advanced: [{ zoom: 1.0 }]
                    });
                }
            } catch (error) {
                console.warn('Zoom constraint not supported:', error);
            }
        }
        
        trainingFeedback.textContent = ''; // Clear any previous error message
    } catch (error) {
        console.error('Camera access failed:', error);
        trainingFeedback.textContent = 'Camera access failed. Please check permissions and try again.';
        cameraPreview.srcObject = null;
    }
}

function stopCamera() {
    if (!currentStream) {
        return;
    }

    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
    cameraPreview.srcObject = null;
}

async function switchCamera() {
    if (videoDevices.length === 0) {
        console.warn('No video devices available');
        return;
    }
    
    // Move to next camera
    currentCameraIndex = (currentCameraIndex + 1) % videoDevices.length;
    console.log(`Switched to camera ${currentCameraIndex}: ${videoDevices[currentCameraIndex].label}`);
    
    // Save the selected camera index to localStorage
    localStorage.setItem('selectedCameraIndex', currentCameraIndex.toString());
    
    stopCamera();
    await openCamera();
}

function beginTraining() {
    // Ensure exercise settings are saved before training
    if (selectedExercise && exerciseSettings[selectedExercise]) {
        exerciseSettings[selectedExercise].sets = parseInt(setsInput.value, 10) || 3;
        exerciseSettings[selectedExercise].reps = parseInt(repsInput.value, 10) || 10;
    }
    
    trainingTitle.textContent = `${selectedExercise} Training`;
    showScreen(trainingScreen);
    // Load video devices before opening camera
    loadVideoDevices().then(() => {
        openCamera();
        initPose();
        startPoseDetection();
    });
    history.pushState({ screen: 'training' }, '');
}

selectExerciseBtn.addEventListener('click', () => {
    showScreen(exerciseScreen);
    history.pushState({ screen: 'exercise' }, '');
});

backBtn.addEventListener('click', () => {
    stopCamera();
    history.back();
});

exerciseBtns.forEach((btn) => {
    btn.addEventListener('click', (event) => {
        selectedExercise = event.target.dataset.exercise;
        exerciseTitle.textContent = `${selectedExercise} Setup`;
        
        // Initialize exercise settings if not exists
        if (!exerciseSettings[selectedExercise]) {
            exerciseSettings[selectedExercise] = { sets: 3, reps: 10 };
        }
        
        // Load saved values into inputs
        setsInput.value = exerciseSettings[selectedExercise].sets;
        repsInput.value = exerciseSettings[selectedExercise].reps;
        
        showScreen(setupScreen);
        history.pushState({ screen: 'setup' }, '');
    });
});

// Add event listeners to save input changes
setsInput.addEventListener('input', (event) => {
    if (selectedExercise && exerciseSettings[selectedExercise]) {
        exerciseSettings[selectedExercise].sets = parseInt(event.target.value, 10) || 1;
    }
});

repsInput.addEventListener('input', (event) => {
    if (selectedExercise && exerciseSettings[selectedExercise]) {
        exerciseSettings[selectedExercise].reps = parseInt(event.target.value, 10) || 1;
    }
});

backToExerciseBtn.addEventListener('click', () => {
    stopCamera();
    history.back();
});

switchCameraBtn.addEventListener('click', switchCamera);

endSessionBtn.addEventListener('click', () => {
    stopCamera();
    history.back();
});

const startTrainingBtn = document.getElementById('start-training-setup-btn');
startTrainingBtn.addEventListener('click', beginTraining);

// Initialize exercise settings on page load
window.addEventListener('DOMContentLoaded', () => {
    // Pre-initialize common exercises
    const exercises = ['Squat', 'Push-up', 'Plank', 'Lunge', 'Bicep Curl'];
    exercises.forEach(exercise => {
        if (!exerciseSettings[exercise]) {
            exerciseSettings[exercise] = { sets: 3, reps: 10 };
        }
    });
});

window.onpopstate = function(event) {
    if (event.state && event.state.screen) {
        const targetScreen = event.state.screen;
        if (targetScreen === 'home') {
            showScreen(homeScreen);
        } else if (targetScreen === 'exercise') {
            showScreen(exerciseScreen);
        } else if (targetScreen === 'setup') {
            showScreen(setupScreen);
        } else if (targetScreen === 'training') {
            showScreen(trainingScreen);
            loadVideoDevices().then(() => {
                openCamera();
                initPose();
                startPoseDetection();
    });
}
        // Stop camera if not on training screen
        if (targetScreen !== 'training') {
            stopCamera();
        }
    }
};

let pose;
let canvasElement = document.getElementById('pose-canvas');
let canvasCtx = canvasElement.getContext('2d');

function initPose() {
    pose = new Pose({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
    });

    pose.setOptions({
        modelComplexity: 0,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults(onPoseResults);
}

function onPoseResults(results) {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;

    if (results.poseLandmarks) {
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
            color: '#f9f9f9',
            lineWidth: 3
        });

        drawLandmarks(canvasCtx, results.poseLandmarks, {
            color: '#465ee4',
            lineWidth: 2
        });
    }
}

function startPoseDetection() {
    async function detect() {
        if (pose && cameraPreview.readyState >= 2) {
            await pose.send({ image: cameraPreview });
        }
        requestAnimationFrame(detect);
    }
    detect();
}      
    
