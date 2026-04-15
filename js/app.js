const homeScreen = document.getElementById('home-screen');
const exerciseScreen = document.getElementById('exercise-screen');
const setupScreen = document.getElementById('setup-screen');
const trainingScreen = document.getElementById('training-screen');
const startTrainingBtn = document.getElementById('start-training-btn');
const backBtn = document.getElementById('back-btn');
const backToExerciseBtn = document.getElementById('back-to-exercise-btn');
const switchCameraBtn = document.getElementById('switch-camera-btn');
const endSessionBtn = document.getElementById('end-session-btn');
const exerciseTitle = document.getElementById('exercise-title');
const trainingTitle = document.getElementById('training-exercise-title');
const trainingFeedback = document.getElementById('training-feedback');
const exerciseBtns = document.querySelectorAll('.exercise-btn');
const cameraPreview = document.getElementById('camera-preview');

let selectedExercise = '';
let currentStream = null;
let currentFacingMode = 'user';
let currentScreen = 'home';

history.replaceState({ screen: 'home' }, '');

function showScreen(screen) {
    [homeScreen, exerciseScreen, setupScreen, trainingScreen].forEach((section) => {
        section.classList.toggle('hidden', section !== screen);
    });
    currentScreen = screen;
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
        currentStream = await navigator.mediaDevices.getUserMedia(getCameraConstraints());
        cameraPreview.srcObject = currentStream;
        await cameraPreview.play();
    } catch (error) {
        console.error('Camera access failed:', error);
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
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    stopCamera();
    await openCamera();
}

function beginTraining() {
    trainingTitle.textContent = `${selectedExercise} Training`;
    history.replaceState({ screen: 'setup' }, '');
    showScreen(trainingScreen);
    openCamera();
    history.pushState({ screen: 'training' }, '');
}

startTrainingBtn.addEventListener('click', () => {
    showScreen(exerciseScreen);
    history.pushState({ screen: 'exercise' }, '');
});

backBtn.addEventListener('click', () => {
    stopCamera();
    showScreen(homeScreen);
    history.pushState({ screen: 'home' }, '');
});

exerciseBtns.forEach((btn) => {
    btn.addEventListener('click', (event) => {
        selectedExercise = event.target.dataset.exercise;
        exerciseTitle.textContent = `${selectedExercise} Setup`;
        showScreen(setupScreen);
        history.pushState({ screen: 'setup' }, '');
    });
});

backToExerciseBtn.addEventListener('click', () => {
    stopCamera();
    showScreen(exerciseScreen);
    history.pushState({ screen: 'exercise' }, '');
});

switchCameraBtn.addEventListener('click', switchCamera);
endSessionBtn.addEventListener('click', () => {
    stopCamera();
    showScreen(setupScreen);
});

const startTrainingSetupBtn = document.getElementById('start-training-setup-btn');
startTrainingSetupBtn.addEventListener('click', beginTraining);

window.onpopstate = function(event) {
    if (!trainingScreen.classList.contains('hidden')) {
        // Training screen active → click End Session
        endSessionBtn.click();
    } else if (!setupScreen.classList.contains('hidden')) {
        // Setup screen active → click Back to Exercise
        backToExerciseBtn.click();
    } else if (!exerciseScreen.classList.contains('hidden')) {
        // Exercise screen active → click Back to Home
        backBtn.click();
    }
};