(() => {
  "use strict";

  const bank = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];
  const letters = ["A", "B", "C", "D"];
  const wrongBookKey = "aiap-wrong-book-v1";

  const state = {
    questions: [],
    answers: {},
    current: 0,
    startedAt: null,
    elapsedSeconds: 0,
    timerId: null,
    reviewFilter: "all",
    lastConfig: null,
  };

  const el = {
    setupView: document.querySelector("#setup-view"),
    quizView: document.querySelector("#quiz-view"),
    resultView: document.querySelector("#result-view"),
    form: document.querySelector("#exam-form"),
    bankCount: document.querySelector("#bank-count"),
    heroTotal: document.querySelector("#hero-total"),
    subjectOptions: document.querySelector("#subject-options"),
    availableCount: document.querySelector("#available-count"),
    startButton: document.querySelector("#start-button"),
    questionNav: document.querySelector("#question-nav"),
    answeredCount: document.querySelector("#answered-count"),
    timer: document.querySelector("#timer"),
    questionLevel: document.querySelector("#question-level"),
    questionSubject: document.querySelector("#question-subject"),
    questionCounter: document.querySelector("#question-counter"),
    progressFill: document.querySelector("#progress-fill"),
    prompt: document.querySelector("#quiz-heading"),
    answerOptions: document.querySelector("#answer-options"),
    sourceNote: document.querySelector("#source-note"),
    prevButton: document.querySelector("#prev-button"),
    nextButton: document.querySelector("#next-button"),
    submitButton: document.querySelector("#submit-button"),
    exitButton: document.querySelector("#exit-button"),
    quizStatus: document.querySelector("#quiz-status"),
    dialog: document.querySelector("#submit-dialog"),
    dialogMessage: document.querySelector("#dialog-message"),
    confirmSubmit: document.querySelector("#confirm-submit"),
    scoreSeal: document.querySelector("#score-seal"),
    scorePercent: document.querySelector("#score-percent"),
    resultMessage: document.querySelector("#result-message"),
    correctCount: document.querySelector("#correct-count"),
    resultTime: document.querySelector("#result-time"),
    unansweredResult: document.querySelector("#unanswered-result"),
    reviewList: document.querySelector("#review-list"),
    retryButton: document.querySelector("#retry-button"),
    newExamButton: document.querySelector("#new-exam-button"),
    wrongCount: document.querySelector("#wrong-count"),
    clearWrongButton: document.querySelector("#clear-wrong-button"),
  };

  function readWrongBook() {
    try {
      const value = JSON.parse(localStorage.getItem(wrongBookKey) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch (_error) {
      return {};
    }
  }

  function writeWrongBook(value) {
    localStorage.setItem(wrongBookKey, JSON.stringify(value));
    updateWrongCount();
  }

  function updateWrongCount() {
    const count = Object.keys(readWrongBook()).length;
    el.wrongCount.textContent = count;
    el.clearWrongButton.disabled = count === 0;
  }

  function shuffle(values) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const remainder = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainder}`;
  }

  function setView(name) {
    el.setupView.hidden = name !== "setup";
    el.quizView.hidden = name !== "quiz";
    el.resultView.hidden = name !== "result";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectedLevel() {
    return el.form.elements.level.value;
  }

  function selectedMode() {
    return el.form.elements.mode.value;
  }

  function selectedSubjects() {
    return [...el.subjectOptions.querySelectorAll("input:checked")].map((input) => input.value);
  }

  function subjectsForLevel(level) {
    const mode = selectedMode();
    const wrongBook = readWrongBook();
    return [...new Set(bank.filter((q) => {
      const modeMatch = mode === "wrong" ? Boolean(wrongBook[q.id]) : (q.kind || "guide") === mode;
      return modeMatch && (level === "全部" || q.level === level);
    }).map((q) => q.subject))];
  }

  function renderSubjects() {
    const level = selectedLevel();
    const subjects = subjectsForLevel(level);
    el.subjectOptions.innerHTML = subjects
      .map(
        (subject) => `
          <label>
            <input type="checkbox" name="subjects" value="${escapeHtml(subject)}" checked />
            <span>${escapeHtml(subject)}</span>
          </label>`,
      )
      .join("");
    el.subjectOptions.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", updateAvailableCount);
    });
    updateAvailableCount();
  }

  function currentPool() {
    const level = selectedLevel();
    const subjects = selectedSubjects();
    const mode = selectedMode();
    const wrongBook = readWrongBook();
    return bank.filter((q) => {
      const modeMatch = mode === "wrong" ? Boolean(wrongBook[q.id]) : (q.kind || "guide") === mode;
      return modeMatch && (level === "全部" || q.level === level) && subjects.includes(q.subject);
    });
  }

  function updateAvailableCount() {
    const count = currentPool().length;
    el.availableCount.textContent = `可用 ${count} 題`;
    el.startButton.disabled = count === 0;
  }

  function startTimer() {
    clearInterval(state.timerId);
    state.startedAt = Date.now();
    state.elapsedSeconds = 0;
    el.timer.textContent = "00:00";
    state.timerId = window.setInterval(() => {
      state.elapsedSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
      el.timer.textContent = formatTime(state.elapsedSeconds);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(state.timerId);
    state.timerId = null;
    if (state.startedAt) {
      state.elapsedSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
    }
  }

  function beginExam(event) {
    event?.preventDefault();
    const pool = currentPool();
    if (!pool.length) return;
    const requestedCount = Number(el.form.elements.count.value);
    const count = Math.min(requestedCount, pool.length);
    state.questions = shuffle(pool).slice(0, count);
    state.answers = {};
    state.current = 0;
    state.reviewFilter = "all";
    state.lastConfig = {
      level: selectedLevel(),
      subjects: selectedSubjects(),
      count,
      mode: selectedMode(),
    };
    localStorage.setItem("aiap-last-config", JSON.stringify(state.lastConfig));
    renderQuestionNav();
    renderQuestion();
    startTimer();
    setView("quiz");
  }

  function renderQuestionNav() {
    el.questionNav.innerHTML = state.questions
      .map(
        (_, index) => `
          <button type="button" data-index="${index}" aria-label="前往第 ${index + 1} 題">
            ${index + 1}
          </button>`,
      )
      .join("");
    el.questionNav.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => goToQuestion(Number(button.dataset.index)));
    });
    updateQuestionNav();
  }

  function updateQuestionNav() {
    const answered = Object.keys(state.answers).length;
    el.answeredCount.textContent = `${answered} / ${state.questions.length}`;
    el.questionNav.querySelectorAll("button").forEach((button, index) => {
      button.classList.toggle("current", index === state.current);
      button.classList.toggle("answered", Boolean(state.answers[state.questions[index].id]));
      button.setAttribute("aria-current", index === state.current ? "step" : "false");
    });
  }

  function renderQuestion() {
    const question = state.questions[state.current];
    const answer = state.answers[question.id];
    el.questionLevel.textContent = question.level;
    el.questionSubject.textContent = question.subject;
    el.questionCounter.textContent = `QUESTION ${(state.current + 1).toString().padStart(2, "0")} / ${state.questions.length}`;
    el.progressFill.style.width = `${((state.current + 1) / state.questions.length) * 100}%`;
    el.prompt.textContent = question.prompt;
    el.sourceNote.textContent = `來源：${question.source}`;
    el.answerOptions.innerHTML = question.options
      .map(
        (option, index) => `
          <label class="answer-option">
            <input type="radio" name="answer" value="${letters[index]}" ${answer === letters[index] ? "checked" : ""} />
            <span class="option-letter">${letters[index]}</span>
            <span class="option-text">${escapeHtml(option)}</span>
          </label>`,
      )
      .join("");
    el.answerOptions.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => selectAnswer(input.value));
    });
    el.prevButton.disabled = state.current === 0;
    el.nextButton.disabled = state.current === state.questions.length - 1;
    updateQuestionNav();
  }

  function selectAnswer(value) {
    const question = state.questions[state.current];
    state.answers[question.id] = value;
    updateQuestionNav();
    el.quizStatus.textContent = `第 ${state.current + 1} 題已選擇 ${value}`;
  }

  function goToQuestion(index) {
    if (index < 0 || index >= state.questions.length) return;
    state.current = index;
    renderQuestion();
    el.prompt.focus({ preventScroll: true });
  }

  function openSubmitDialog() {
    const unanswered = state.questions.length - Object.keys(state.answers).length;
    el.dialogMessage.textContent = unanswered
      ? `還有 ${unanswered} 題未作答，交卷後會以答錯計算。`
      : "你已完成所有題目，交卷後即可查看答案與解析。";
    if (typeof el.dialog.showModal === "function") {
      el.dialog.showModal();
    } else if (window.confirm(el.dialogMessage.textContent)) {
      finishExam();
    }
  }

  function finishExam() {
    if (el.dialog.open) el.dialog.close();
    stopTimer();
    const correct = state.questions.filter((q) => state.answers[q.id] === q.correct).length;
    const unanswered = state.questions.filter((q) => !state.answers[q.id]).length;
    const percent = Math.round((correct / state.questions.length) * 100);
    updateWrongBookFromExam();
    el.scorePercent.textContent = percent;
    el.correctCount.textContent = `${correct} / ${state.questions.length}`;
    el.resultTime.textContent = formatTime(state.elapsedSeconds);
    el.unansweredResult.textContent = unanswered;
    el.resultMessage.textContent = scoreMessage(percent);
    el.scoreSeal.style.transform = `rotate(${percent >= 80 ? -3 : 2}deg)`;
    renderReview();
    setView("result");
  }

  function updateWrongBookFromExam() {
    const wrongBook = readWrongBook();
    state.questions.forEach((question) => {
      const isCorrect = state.answers[question.id] === question.correct;
      const previous = wrongBook[question.id];
      if (!isCorrect) {
        wrongBook[question.id] = {
          wrongCount: (previous?.wrongCount || 0) + 1,
          correctStreak: 0,
          lastAnswered: new Date().toISOString(),
        };
      } else if (previous) {
        const correctStreak = (previous.correctStreak || 0) + 1;
        if (correctStreak >= 2) delete wrongBook[question.id];
        else wrongBook[question.id] = { ...previous, correctStreak, lastAnswered: new Date().toISOString() };
      }
    });
    writeWrongBook(wrongBook);
  }

  function scoreMessage(percent) {
    if (percent >= 90) return "掌握度很高。接下來可以增加題數，或改練另一個科目。";
    if (percent >= 75) return "基礎已經穩定。優先複習錯題解析，再用同一份題目重測。";
    if (percent >= 60) return "已抓到部分重點。先把錯題對應的概念補齊，再重新組卷。";
    return "先不用追求速度。逐題讀完解析，回到學習指引建立概念會更有效。";
  }

  function renderReview() {
    const filtered = state.questions
      .map((question, index) => ({ question, index, userAnswer: state.answers[question.id] }))
      .filter(({ question, userAnswer }) => {
        const isCorrect = userAnswer === question.correct;
        if (state.reviewFilter === "correct") return isCorrect;
        if (state.reviewFilter === "wrong") return !isCorrect;
        return true;
      });

    el.reviewList.innerHTML = filtered
      .map(({ question, index, userAnswer }) => {
        const isCorrect = userAnswer === question.correct;
        const userLabel = userAnswer ? `${userAnswer}. ${question.options[letters.indexOf(userAnswer)]}` : "未作答";
        const correctLabel = `${question.correct}. ${question.options[letters.indexOf(question.correct)]}`;
        return `
          <article class="review-card ${isCorrect ? "correct" : "wrong"}">
            <header>
              <span class="review-number">QUESTION ${(index + 1).toString().padStart(2, "0")}</span>
              <span class="review-state ${isCorrect ? "correct-text" : "wrong-text"}">
                ${isCorrect ? "✓ 答對" : "✕ 需複習"}
              </span>
            </header>
            <h3>${escapeHtml(question.prompt)}</h3>
            <div class="review-answer-grid">
              <div class="review-answer ${isCorrect ? "correct-answer" : "user-wrong"}">
                <strong>你的答案</strong><br />${escapeHtml(userLabel)}
              </div>
              <div class="review-answer correct-answer">
                <strong>正確答案</strong><br />${escapeHtml(correctLabel)}
              </div>
            </div>
            <div class="explanation-box">
              <strong>WHY · 原因解析</strong>
              <p>${escapeHtml(question.explanation)}</p>
            </div>
            <p class="review-source">${escapeHtml(question.source)}</p>
          </article>`;
      })
      .join("");

    if (!filtered.length) {
      el.reviewList.innerHTML = '<p class="review-card">這個篩選條件下沒有題目。</p>';
    }
  }

  function retryExam() {
    state.answers = {};
    state.current = 0;
    renderQuestionNav();
    renderQuestion();
    startTimer();
    setView("quiz");
  }

  function resetToSetup() {
    stopTimer();
    setView("setup");
  }

  function bindEvents() {
    el.form.addEventListener("submit", beginExam);
    el.form.querySelectorAll('input[name="level"]').forEach((input) => {
      input.addEventListener("change", renderSubjects);
    });
    el.form.querySelectorAll('input[name="mode"]').forEach((input) => {
      input.addEventListener("change", renderSubjects);
    });
    el.clearWrongButton.addEventListener("click", () => {
      if (window.confirm("確定清空所有錯題紀錄嗎？")) {
        writeWrongBook({});
        renderSubjects();
      }
    });
    el.prevButton.addEventListener("click", () => goToQuestion(state.current - 1));
    el.nextButton.addEventListener("click", () => goToQuestion(state.current + 1));
    el.submitButton.addEventListener("click", openSubmitDialog);
    el.exitButton.addEventListener("click", () => {
      if (window.confirm("退出後本次作答紀錄不會保留，確定要離開嗎？")) resetToSetup();
    });
    el.confirmSubmit.addEventListener("click", finishExam);
    el.retryButton.addEventListener("click", retryExam);
    el.newExamButton.addEventListener("click", resetToSetup);
    document.querySelectorAll(".filter-button").forEach((button) => {
      button.addEventListener("click", () => {
        state.reviewFilter = button.dataset.filter;
        document.querySelectorAll(".filter-button").forEach((candidate) => {
          candidate.classList.toggle("active", candidate === button);
        });
        renderReview();
      });
    });
    document.addEventListener("keydown", (event) => {
      if (el.quizView.hidden || el.dialog.open) return;
      if (["1", "2", "3", "4"].includes(event.key)) {
        const value = letters[Number(event.key) - 1];
        const input = el.answerOptions.querySelector(`input[value="${value}"]`);
        if (input) {
          input.checked = true;
          selectAnswer(value);
        }
      } else if (event.key === "ArrowLeft") {
        goToQuestion(state.current - 1);
      } else if (event.key === "ArrowRight") {
        goToQuestion(state.current + 1);
      }
    });
  }

  function init() {
    el.bankCount.textContent = `${bank.length} 題解析題庫`;
    el.heroTotal.textContent = bank.length;
    updateWrongCount();
    if (!bank.length) {
      el.startButton.disabled = true;
      el.availableCount.textContent = "題庫載入失敗";
      return;
    }
    renderSubjects();
    bindEvents();
  }

  init();
})();
