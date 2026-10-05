const LEADERBOARD_KEY = "needle-drop-leaderboard";
const LEADERBOARD_LIMIT = 15;

const startScreen = document.querySelector("#start-screen");
const quizScreen = document.querySelector("#quiz-screen");
const completeScreen = document.querySelector("#complete-screen");
const startForm = document.querySelector("#start-form");
const answerForm = document.querySelector("#answer-form");
const playerNameInput = document.querySelector("#player-name");
const answerInput = document.querySelector("#album-answer");
const hintLabel = document.querySelector("#hint-label");
const hintText = document.querySelector("#album-hint");
const albumYear = document.querySelector("#album-year");
const albumTracks = document.querySelector("#album-tracks");
const albumRuntime = document.querySelector("#album-runtime");
const coverPlaceholder = document.querySelector("#cover-placeholder");
const coverImage = document.querySelector("#album-cover");
const feedback = document.querySelector("#feedback");
const nextButton = document.querySelector("#next-question");
const submitButton = document.querySelector("#submit-answer");
const scoreText = document.querySelector("#score");
const questionCount = document.querySelector("#question-count");
const progressTrack = document.querySelector(".progress-track");
const progressBar = document.querySelector("#progress-bar");
const toast = document.querySelector("#completion-toast");
const leaderboardList = document.querySelector("#leaderboard-list");
const leaderboardEmpty = document.querySelector("#leaderboard-empty");

let albums = [];
let questions = [];
let questionIndex = 0;
let score = 0;
let playerName = "";
let startedAt = 0;
let toastTimer;
let completed = false;
let questionAttempts = 0;

function getQuestionMaxPoints() {
  return Math.max(questions.length * 10, 10);
}

function getAttemptPoints(attemptNumber) {
  if (attemptNumber === 1) return 10;
  if (attemptNumber === 2) return 5;
  return 2;
}

function getAlbumHints(album) {
  return [album.hint, album.hint2, album.hint3]
    .filter((hint) => typeof hint === "string" && hint.trim());
}

function normalizeAnswer(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function getLeaderboard() {
  const saved = localStorage.getItem(LEADERBOARD_KEY);
  if (!saved) return [];

  const entries = JSON.parse(saved);
  if (!Array.isArray(entries)) throw new Error("Leaderboard data is invalid.");
  return entries;
}

function renderLeaderboard() {
  const entries = getLeaderboard()
    .sort((first, second) => second.score - first.score || first.duration - second.duration)
    .slice(0, LEADERBOARD_LIMIT);

  leaderboardList.replaceChildren();
  leaderboardEmpty.hidden = entries.length > 0;

  entries.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "leaderboard-entry";
    if (index === 0) item.classList.add("leaderboard-entry-first");

    const rank = document.createElement("span");
    rank.className = "rank-number";
    rank.textContent = String(index + 1).padStart(2, "0");

    const name = document.createElement("span");
    name.className = "rank-name";
    name.textContent = entry.name;

    const result = document.createElement("span");
    result.className = "rank-score";
    result.textContent = `${entry.score}/${entry.total}`;

    item.append(rank, name, result);
    leaderboardList.append(item);
  });
}

function updateProgress() {
  const completedCount = questionIndex + (completed ? 1 : 0);
  questionCount.textContent = `TRACK ${String(Math.min(questionIndex + 1, questions.length)).padStart(2, "0")} / ${questions.length}`;
  progressTrack.setAttribute("aria-valuemax", String(questions.length));
  progressTrack.setAttribute("aria-valuenow", String(completedCount));
  progressBar.style.width = `${(completedCount / questions.length) * 100}%`;
}

function showQuestion() {
  const album = questions[questionIndex];
  const albumDate = new Date(album.date);
  questionAttempts = 0;
  coverImage.removeAttribute("src");
  coverImage.hidden = true;
  coverImage.alt = "";
  coverPlaceholder.hidden = false;
  hintLabel.textContent = "HINT 1";
  hintText.textContent = getAlbumHints(album)[0] || "";
  albumYear.textContent = `Year ${albumDate.getFullYear()}`;
  albumTracks.textContent = `${album.songlist} tracks`;
  albumRuntime.textContent = `${album.length} min`;
  answerInput.value = "";
  answerInput.disabled = false;
  submitButton.disabled = false;
  feedback.textContent = "";
  feedback.className = "feedback";
  nextButton.hidden = true;
  updateProgress();
  answerInput.focus();
}

function startQuiz() {
  playerName = playerNameInput.value.trim();
  if (!playerName) {
    playerNameInput.focus();
    return;
  }

  questions = shuffle(albums);
  questionIndex = 0;
  score = 0;
  startedAt = Date.now();
  completed = false;
  scoreText.textContent = "0";
  startScreen.hidden = true;
  completeScreen.hidden = true;
  quizScreen.hidden = false;
  showQuestion();
}

function revealAnswer(album, message = `That's it — ${album.album} by ${album.artist}.`, isCorrect = true) {
  const filename = album.path.split("/").pop().replace(/&/g, "and");
  coverImage.src = `Photos/${encodeURIComponent(filename)}`;
  coverImage.alt = album.alttext;
  coverImage.hidden = false;
  coverPlaceholder.hidden = true;
  answerInput.disabled = true;
  submitButton.disabled = true;
  feedback.textContent = message;
  feedback.className = isCorrect ? "feedback feedback-correct" : "feedback feedback-incorrect";
  nextButton.hidden = false;
  nextButton.focus();
}

function submitAnswer(event) {
  event.preventDefault();
  if (completed) return;

  const album = questions[questionIndex];
  const attemptNumber = questionAttempts + 1;
  if (normalizeAnswer(answerInput.value) === normalizeAnswer(album.album)) {
    score += getAttemptPoints(attemptNumber);
    scoreText.textContent = String(score);
    revealAnswer(album);
    return;
  }

  questionAttempts += 1;
  if (questionAttempts >= 3) {
    revealAnswer(album, `Nope — the answer was ${album.album} by ${album.artist}.`, false);
    return;
  }

  const nextHint = getAlbumHints(album)[questionAttempts];
  if (nextHint) {
    hintLabel.textContent = `HINT ${questionAttempts + 1}`;
    hintText.textContent = nextHint;
  }

  const triesRemaining = 3 - questionAttempts;
  feedback.textContent = `Not quite — ${triesRemaining} ${triesRemaining === 1 ? "try" : "tries"} left on this one.`;
  feedback.className = "feedback feedback-incorrect";
  answerInput.value = "";
  answerInput.select();
}

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function showCompletionToast() {
  window.clearTimeout(toastTimer);
  toast.hidden = false;
  toast.classList.remove("toast-visible");
  requestAnimationFrame(() => toast.classList.add("toast-visible"));
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("toast-visible");
    window.setTimeout(() => {
      toast.hidden = true;
    }, 250);
  }, 4500);
}

function finishQuiz() {
  completed = true;
  const duration = Date.now() - startedAt;
  const entry = {
    name: playerName,
    score,
    total: getQuestionMaxPoints(),
    duration,
    completedAt: new Date().toISOString()
  };
  const entries = [...getLeaderboard(), entry]
    .sort((first, second) => second.score - first.score || first.duration - second.duration)
    .slice(0, LEADERBOARD_LIMIT);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
  renderLeaderboard();

  quizScreen.hidden = true;
  completeScreen.hidden = false;
  document.querySelector("#final-score").textContent = `${score}/${getQuestionMaxPoints()}`;
  document.querySelector("#final-time").textContent = formatTime(duration);
  document.querySelector("#completion-message").textContent =
    `${playerName}, you earned ${score} of ${getQuestionMaxPoints()} points. ${score >= getQuestionMaxPoints() * 0.8 ? "Flawless listening." : "Every replay makes you a little sharper."}`;
  updateProgress();
  showCompletionToast();
  document.querySelector("#play-again").focus();
}

function advanceQuestion() {
  if (questionIndex === questions.length - 1) {
    finishQuiz();
    return;
  }
  questionIndex += 1;
  showQuestion();
}

async function loadAlbums() {
  const response = await fetch("albums.json");
  if (!response.ok) throw new Error(`Could not load albums (${response.status}).`);
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error("The album list is empty or invalid.");
  albums = data;
  renderLeaderboard();
}

startForm.addEventListener("submit", (event) => {
  event.preventDefault();
  startQuiz();
});
answerForm.addEventListener("submit", submitAnswer);
nextButton.addEventListener("click", advanceQuestion);
document.querySelector("#play-again").addEventListener("click", () => {
  completeScreen.hidden = true;
  startScreen.hidden = false;
  playerNameInput.value = playerName;
  playerNameInput.focus();
});

loadAlbums().catch((error) => {
  const startCopy = startScreen.querySelector(".card-description");
  startCopy.textContent = `The quiz could not start: ${error.message}`;
  startForm.hidden = true;
});
