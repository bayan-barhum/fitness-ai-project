const homeScreen = document.getElementById('home-screen');
const exerciseScreen = document.getElementById('exercise-screen');
const setupScreen = document.getElementById('setup-screen');
const startTrainingBtn = document.getElementById('start-training-btn');
const backBtn = document.getElementById('back-btn');
const backToExerciseBtn = document.getElementById('back-to-exercise-btn');
const startTrainingSetupBtn = document.getElementById('start-training-setup-btn');
const exerciseTitle = document.getElementById('exercise-title');
const exerciseBtns = document.querySelectorAll('.exercise-btn');

let selectedExercise = '';

startTrainingBtn.addEventListener('click', () => {
    homeScreen.classList.add('hidden');
    exerciseScreen.classList.remove('hidden');
});

backBtn.addEventListener('click', () => {
    exerciseScreen.classList.add('hidden');
    homeScreen.classList.remove('hidden');
});

exerciseBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        selectedExercise = e.target.dataset.exercise;
        exerciseTitle.textContent = selectedExercise + ' Setup';
        exerciseScreen.classList.add('hidden');
        setupScreen.classList.remove('hidden');
    });
});

backToExerciseBtn.addEventListener('click', () => {
    setupScreen.classList.add('hidden');
    exerciseScreen.classList.remove('hidden');
});

startTrainingSetupBtn.addEventListener('click', () => {
    alert('Training started! (This is a placeholder)');
});