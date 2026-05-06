// ===============================
// 1. DOM Elements
// ===============================
const homeScreen = document.getElementById('home-screen');
const exerciseScreen = document.getElementById('exercise-screen');
const setupScreen = document.getElementById('setup-screen');
const trainingScreen = document.getElementById('training-screen');

const selectExerciseBtn = document.getElementById('start-training-btn');
const startTrainingBtn = document.getElementById('start-training-setup-btn');
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

const canvasElement = document.getElementById('pose-canvas');
const canvasCtx = canvasElement.getContext('2d');


// ===============================
// 2. App State
// ===============================
let selectedExercise = '';
let currentStream = null;
let currentFacingMode = 'environment';
let currentScreen = 'home';

let videoDevices = [];
let currentCameraIndex = 0;
let exerciseSettings = {};

let pose = null;

// Stable feedback state
let lastFeedbackMessage = '';
let stableFeedbackCounter = 0;
let currentFeedbackMessage = '';
const FEEDBACK_STABILITY_FRAMES = 8;

history.replaceState({ screen: 'home' }, '');


// ===============================
// 3. Screen Navigation
// ===============================
function showScreen(screen) {
    [homeScreen, exerciseScreen, setupScreen, trainingScreen].forEach((section) => {
        section.classList.toggle('hidden', section !== screen);
    });

    currentScreen = screen.id.replace('-screen', '');
}

window.onpopstate = function (event) {
    if (!event.state || !event.state.screen) {
        return;
    }

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

    if (targetScreen !== 'training') {
        stopCamera();
    }
};


// ===============================
// 4. Camera Logic
// ===============================
async function loadVideoDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter((device) => device.kind === 'videoinput');

        console.log(`Found ${videoDevices.length} video device(s)`);

        if (videoDevices.length > 0) {
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

async function selectBestCamera() {
    if (videoDevices.length > 0) {
        return videoDevices[currentCameraIndex].deviceId;
    }

    return null;
}

async function openCamera() {
    stopCamera();

    try {
        const selectedDeviceId = await selectBestCamera();

        let constraints = {
            audio: false,
            video: selectedDeviceId
                ? {
                    deviceId: { exact: selectedDeviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    zoom: 1.0
                }
                : {
                    facingMode: currentFacingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    zoom: 1.0
                }
        };

        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraPreview.srcObject = currentStream;
        await cameraPreview.play();

        applyMirrorIfNeeded();
        applyZoomIfSupported();

        trainingFeedback.textContent = '';
    } catch (error) {
        console.error('Camera access failed:', error);
        trainingFeedback.textContent = 'Camera access failed. Please check permissions and try again.';
        cameraPreview.srcObject = null;
    }
}

function applyMirrorIfNeeded() {
    const currentDeviceLabel = videoDevices[currentCameraIndex]?.label?.toLowerCase() || '';

    const isFrontCamera =
        currentDeviceLabel.includes('front') ||
        currentDeviceLabel.includes('user') ||
        currentDeviceLabel.includes('selfie');

    if (isFrontCamera) {
        cameraPreview.classList.add('mirror');
        canvasElement.classList.add('mirror');
    } else {
        cameraPreview.classList.remove('mirror');
        canvasElement.classList.remove('mirror');
    }
}

async function applyZoomIfSupported() {
    const videoTrack = currentStream?.getVideoTracks()[0];

    if (!videoTrack) {
        return;
    }

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

    currentCameraIndex = (currentCameraIndex + 1) % videoDevices.length;

    console.log(`Switched to camera ${currentCameraIndex}: ${videoDevices[currentCameraIndex].label}`);

    localStorage.setItem('selectedCameraIndex', currentCameraIndex.toString());

    stopCamera();
    await openCamera();
}


// ===============================
// 5. Exercise Settings
// ===============================
function initializeExerciseSettings() {
    const exercises = ['Squat', 'Push-up', 'Plank', 'Lunge', 'Bicep Curl'];

    exercises.forEach((exercise) => {
        if (!exerciseSettings[exercise]) {
            exerciseSettings[exercise] = { sets: 3, reps: 10 };
        }
    });
}

function saveCurrentExerciseSettings() {
    if (!selectedExercise || !exerciseSettings[selectedExercise]) {
        return;
    }

    exerciseSettings[selectedExercise].sets = parseInt(setsInput.value, 10) || 3;
    exerciseSettings[selectedExercise].reps = parseInt(repsInput.value, 10) || 10;
}

function loadExerciseSettings(exerciseName) {
    if (!exerciseSettings[exerciseName]) {
        exerciseSettings[exerciseName] = { sets: 3, reps: 10 };
    }

    setsInput.value = exerciseSettings[exerciseName].sets;
    repsInput.value = exerciseSettings[exerciseName].reps;
}


// ===============================
// 6. Training Flow
// ===============================
function beginTraining() {
    saveCurrentExerciseSettings();

    trainingTitle.textContent = `${selectedExercise} Training`;
    showScreen(trainingScreen);

    loadVideoDevices().then(() => {
        openCamera();
        initPose();
        startPoseDetection();
    });

    history.pushState({ screen: 'training' }, '');
}


// ===============================
// 7. Pose Estimation
// ===============================
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

function startPoseDetection() {
    async function detect() {
        if (pose && cameraPreview.readyState >= 2) {
            await pose.send({ image: cameraPreview });
        }

        requestAnimationFrame(detect);
    }

    detect();
}

function onPoseResults(results) {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (!results.poseLandmarks) {
        updateStableFeedback('Position your body clearly in the camera');
        return;
    }

    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: '#f9f9f9',
        lineWidth: 3
    });

    drawLandmarks(canvasCtx, results.poseLandmarks, {
        color: '#465ee4',
        lineWidth: 2
    });

    handleExerciseFeedback(results.poseLandmarks);
}


// ===============================
// 8. Feedback Logic
// ===============================
function handleExerciseFeedback(landmarks) {
    if (selectedExercise === 'Bicep Curl') {
        handleBicepCurl(landmarks);
    } else if (selectedExercise === 'Squat') {
        handleSquat(landmarks);
    }
}

function updateStableFeedback(newMessage) {
    if (newMessage === lastFeedbackMessage) {
        stableFeedbackCounter++;
    } else {
        lastFeedbackMessage = newMessage;
        stableFeedbackCounter = 0;
    }

    if (stableFeedbackCounter >= FEEDBACK_STABILITY_FRAMES && currentFeedbackMessage !== newMessage) {
        currentFeedbackMessage = newMessage;
        trainingFeedback.innerText = currentFeedbackMessage;
    }
}

function calculateAngle(a, b, c) {
    const abx = a.x - b.x;
    const aby = a.y - b.y;

    const cbx = c.x - b.x;
    const cby = c.y - b.y;

    const dot = abx * cbx + aby * cby;

    const magAB = Math.sqrt(abx * abx + aby * aby);
    const magCB = Math.sqrt(cbx * cbx + cby * cby);

    if (magAB === 0 || magCB === 0) {
        return 0;
    }

    const cosine = Math.min(1, Math.max(-1, dot / (magAB * magCB)));
    const angle = Math.acos(cosine) * (180 / Math.PI);

    return Math.round(angle);
}

function handleBicepCurl(landmarks) {
    const shoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const elbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const wrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];

    let feedbackMessage = '';

    // 1. Visibility check
    if (!shoulder || !elbow || !wrist) {
        feedbackMessage = 'Keep your arm visible';
        updateStableFeedback(feedbackMessage);
        return;
    }

    // 2. Basic form check: keep elbow close to body
    const elbowDistanceFromShoulder = Math.abs(elbow.x - shoulder.x);

    if (elbowDistanceFromShoulder > 0.11) {
        feedbackMessage = 'Keep your elbow close to your body';
        updateStableFeedback(feedbackMessage);
        return;
    }

    // 3. Main movement feedback using elbow angle
    const angle = calculateAngle(shoulder, elbow, wrist);

    console.log('Bicep Curl Angle:', angle);

    if (angle > 140) {
        feedbackMessage = 'Curl your arm up ⬆️';
    } else if (angle > 90) {
        feedbackMessage = 'Good, keep going 👍';
    } else if (angle > 60) {
        feedbackMessage = 'Almost there 💪';
    } else {
        feedbackMessage = 'Great curl! ✅';
    }

    updateStableFeedback(feedbackMessage);
}

function handleSquat(landmarks) {
    const hip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const knee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
    const ankle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];

    let feedbackMessage = '';

    // 1. Visibility check
    if (!hip || !knee || !ankle) {
        feedbackMessage = 'Keep your legs visible';
        updateStableFeedback(feedbackMessage);
        return;
    }

    // 2. Main movement feedback using knee angle
    const kneeAngle = calculateAngle(hip, knee, ankle);

    console.log('Squat Knee Angle:', kneeAngle);

    if (kneeAngle > 150) {
        feedbackMessage = 'Start squatting down ⬇️';
    } else if (kneeAngle > 110) {
        feedbackMessage = 'Keep going down 👍';
    } else if (kneeAngle > 80) {
        feedbackMessage = 'Good squat depth ✅';
    } else {
        feedbackMessage = 'Control your movement';
    }

    updateStableFeedback(feedbackMessage);
}


// ===============================
// 9. Event Listeners
// ===============================
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

        loadExerciseSettings(selectedExercise);

        showScreen(setupScreen);
        history.pushState({ screen: 'setup' }, '');
    });
});

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

startTrainingBtn.addEventListener('click', beginTraining);

window.addEventListener('DOMContentLoaded', initializeExerciseSettings);