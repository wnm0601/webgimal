const STORAGE_KEY = "webprogrammingQuizState";

const state = {
  view: "home",
  sessionIds: [],
  sessionTitle: "전체 문제",
  currentIndex: 0,
  answers: {},
  checked: {},
  wrongIds: [],
  bookmarks: [],
};

const els = {};

function $(id) {
  return document.getElementById(id);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) Object.assign(state, saved);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalize(value) {
  return String(value || "")
    .trim()
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeNoteKey(value) {
  return String(value || "")
    .trim()
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .toLowerCase();
}

function questionById(id) {
  return QUESTIONS.find((q) => q.id === id);
}

function idsByMode(mode) {
  if (mode === "short") return QUESTIONS.filter((q) => q.type === "short").map((q) => q.id);
  if (mode === "choice") return QUESTIONS.filter((q) => q.type === "choice").map((q) => q.id);
  if (mode === "errors") return QUESTIONS.filter((q) => !isScorable(q)).map((q) => q.id);
  if (mode === "wrong" || mode === "wrong-retry") return state.wrongIds.filter(questionById);
  if (mode === "random") return shuffle(QUESTIONS.map((q) => q.id));
  if (mode === "random30") return shuffle(QUESTIONS.map((q) => q.id)).slice(0, 30);
  return QUESTIONS.map((q) => q.id);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function startMode(mode) {
  if (mode === "resume" && state.sessionIds.length) {
    showView("quiz");
    renderQuiz();
    return;
  }
  if (mode === "wrong") {
    renderWrongNote();
    showView("wrong");
    return;
  }

  const ids = idsByMode(mode);
  if (!ids.length) {
    renderWrongNote();
    showView("wrong");
    return;
  }
  state.sessionIds = ids;
  state.currentIndex = 0;
  state.sessionTitle = {
    all: "전체 문제",
    short: "단답형",
    choice: "4지선다형",
    random: "랜덤 문제",
    random30: "랜덤 30문제",
    errors: "오류 문제 모드",
    "wrong-retry": "오답 다시 풀기",
  }[mode] || "전체 문제";
  saveState();
  showView("quiz");
  renderQuiz();
}

function showView(name) {
  state.view = name;
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  $(`${name}View`).classList.add("active");
  if (name === "home") renderHome();
  saveState();
}

function renderHome() {
  const answeredIds = Object.keys(state.checked);
  const scorableAnsweredIds = answeredIds.filter((id) => isScorable(questionById(id)));
  const correctCount = scorableAnsweredIds.filter((id) => state.checked[id]?.correct).length;
  els.totalCount.textContent = QUESTIONS.length;
  els.answeredCount.textContent = answeredIds.length;
  els.wrongCount.textContent = state.wrongIds.length;
  els.errorCount.textContent = QUESTIONS.filter((q) => !isScorable(q)).length;
  els.accuracyRate.textContent = scorableAnsweredIds.length ? `${Math.round((correctCount / scorableAnsweredIds.length) * 100)}%` : "0%";
}

function isScorable(q) {
  return !!q && (q.status || "verified") === "verified";
}

function statusLabel(status) {
  return {
    verified: "검수 완료",
    wrong_original_answer: "원본 정답 오류",
    no_correct_choice: "정답 없음",
    multiple_correct_choices: "복수 정답 가능",
    ambiguous: "문항 애매함",
    needs_review: "검수 필요",
  }[status || "verified"] || "검수 필요";
}

function renderQuiz() {
  if (!state.sessionIds.length) state.sessionIds = QUESTIONS.map((q) => q.id);
  state.currentIndex = Math.max(0, Math.min(state.currentIndex, state.sessionIds.length - 1));
  const q = questionById(state.sessionIds[state.currentIndex]);
  if (!q) return showView("home");

  els.sessionTitle.textContent = state.sessionTitle;
  els.questionProgress.textContent = `${state.currentIndex + 1} / ${state.sessionIds.length}`;
  els.categoryBadge.textContent = q.category;
  els.typeBadge.textContent = `${q.type === "short" ? "단답형" : "4지선다형"} · ${statusLabel(q.status)}`;
  els.questionText.textContent = q.question;
  els.progressBar.style.width = `${((state.currentIndex + 1) / state.sessionIds.length) * 100}%`;
  els.bookmarkBtn.textContent = state.bookmarks.includes(q.id) ? "북마크 해제" : "북마크";
  els.wrongToggleBtn.textContent = state.wrongIds.includes(q.id) ? "오답노트 삭제" : "오답노트 추가";

  renderAnswerArea(q);
  renderFeedback(q);
  saveState();
}

function renderAnswerArea(q) {
  els.answerArea.innerHTML = "";
  if (q.type === "short") {
    const input = document.createElement("input");
    input.className = "short-input";
    input.placeholder = "정답 입력";
    input.value = state.answers[q.id] ?? "";
    input.addEventListener("input", () => {
      state.answers[q.id] = input.value;
      saveState();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") checkAnswer();
    });
    els.answerArea.append(input);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "choice-grid";
  q.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-btn";
    button.textContent = `${["①", "②", "③", "④"][index]} ${choice}`;
    if (state.answers[q.id] === index) button.classList.add("selected");
    button.addEventListener("click", () => {
      state.answers[q.id] = index;
      saveState();
      renderQuiz();
    });
    grid.append(button);
  });
  els.answerArea.append(grid);
}

function isCorrect(q) {
  if (!isScorable(q)) return false;
  const value = state.answers[q.id];
  if (q.type === "choice") return q.verifiedAnswerIndex !== null && Number(value) === q.verifiedAnswerIndex;
  const mine = normalize(value);
  return q.answers.some((answer) => normalize(answer) === mine);
}

function correctAnswerText(q) {
  if (q.type === "choice") {
    if (q.verifiedAnswerIndex === null || q.verifiedAnswerIndex === undefined) {
      return `정답 없음 / 원본 문제 오류${q.verifiedAnswerText ? ` (개념상 정답: ${q.verifiedAnswerText})` : ""}`;
    }
    return q.verifiedAnswerText || q.choices[q.verifiedAnswerIndex];
  }
  return q.answers[0];
}

function answerNoteCandidates(q) {
  const candidates = [];
  if (q.verifiedAnswerText) candidates.push(q.verifiedAnswerText);
  if (q.type === "choice" && q.verifiedAnswerIndex !== null && q.verifiedAnswerIndex !== undefined) {
    candidates.push(q.choices[q.verifiedAnswerIndex]);
  }
  if (q.type === "short" && Array.isArray(q.answers)) candidates.push(...q.answers);
  candidates.push(correctAnswerText(q));
  return candidates.filter(Boolean);
}

function findAnswerNote(q) {
  const notes = typeof ANSWER_NOTES !== "undefined" ? ANSWER_NOTES : [];
  const candidates = answerNoteCandidates(q).map(normalizeNoteKey);
  return notes.find((note) => {
    const keys = [note.term, note.id, ...(note.aliases || [])].map(normalizeNoteKey);
    return keys.some((key) => candidates.some((candidate) => candidate === key || candidate.includes(key) || key.includes(candidate)));
  }) || null;
}

function renderAnswerNoteBox(note) {
  if (!note) return "";
  return `
    <div class="answer-note-box">
      <strong>${escapeHtml(note.term)}란?</strong>
      <p>${escapeHtml(note.shortDefinition)}</p>
      <p><b>시험 포인트:</b> ${escapeHtml(note.examPoint)}</p>
      <button class="ghost-btn" type="button" data-action="glossary" data-glossary-term="${escapeHtml(note.term)}">개념노트에서 보기</button>
    </div>
  `;
}

function myAnswerText(q) {
  const value = state.answers[q.id];
  if (q.type === "choice") return value === undefined ? "미응답" : q.choices[value];
  return value || "미응답";
}

function checkAnswer() {
  const q = questionById(state.sessionIds[state.currentIndex]);
  if (!isScorable(q)) {
    state.checked[q.id] = { correct: false, skipped: true, at: Date.now() };
    saveState();
    renderQuiz();
    return;
  }
  const correct = isCorrect(q);
  state.checked[q.id] = { correct, at: Date.now() };
  if (!correct && !state.wrongIds.includes(q.id)) state.wrongIds.push(q.id);
  if (correct) state.wrongIds = state.wrongIds.filter((id) => id !== q.id);
  saveState();
  renderQuiz();
}

function renderFeedback(q) {
  const checked = state.checked[q.id];
  if (!checked) {
    els.feedback.className = "feedback hidden";
    els.feedback.innerHTML = "";
    return;
  }
  const scorable = isScorable(q);
  const note = findAnswerNote(q);
  els.feedback.className = `feedback ${!scorable ? "review" : checked.correct ? "correct" : "wrong"}`;
  els.feedback.innerHTML = `
    <strong>${!scorable ? "채점 제외 문제입니다" : checked.correct ? "정답입니다" : "오답입니다"}</strong>
    <p>내 답: ${escapeHtml(myAnswerText(q))}</p>
    <p>정답: ${escapeHtml(correctAnswerText(q))}</p>
    ${!scorable ? `<p>상태: ${escapeHtml(statusLabel(q.status))}</p>` : ""}
    ${q.verificationNote ? `<p>${escapeHtml(q.verificationNote)}</p>` : ""}
    ${q.fixedQuestion ? `<p>수정안: ${escapeHtml(q.fixedQuestion.question)} / 정답: ${escapeHtml(q.fixedQuestion.choices[q.fixedQuestion.answerIndex])}</p>` : ""}
    <p>${escapeHtml(q.explanation || "")}</p>
    ${renderAnswerNoteBox(note)}
  `;
}

function move(delta) {
  state.currentIndex += delta;
  if (state.currentIndex < 0) state.currentIndex = 0;
  if (state.currentIndex >= state.sessionIds.length) {
    renderResult();
    showView("result");
    return;
  }
  renderQuiz();
}

function renderResult() {
  const ids = state.sessionIds.length ? state.sessionIds : QUESTIONS.map((q) => q.id);
  const scorableIds = ids.filter((id) => isScorable(questionById(id)));
  const excludedIds = ids.filter((id) => !isScorable(questionById(id)));
  const done = scorableIds.filter((id) => state.checked[id]);
  const correct = done.filter((id) => state.checked[id].correct);
  const byCategory = {};
  scorableIds.forEach((id) => {
    const q = questionById(id);
    byCategory[q.category] ||= { total: 0, done: 0, correct: 0 };
    byCategory[q.category].total += 1;
    if (state.checked[id]) byCategory[q.category].done += 1;
    if (state.checked[id]?.correct) byCategory[q.category].correct += 1;
  });
  const shortIds = scorableIds.filter((id) => questionById(id).type === "short");
  const choiceIds = scorableIds.filter((id) => questionById(id).type === "choice");

  els.resultStats.innerHTML = [
    ["전체", ids.length],
    ["채점 대상", scorableIds.length],
    ["채점 제외", excludedIds.length],
    ["푼 문제", done.length],
    ["정답", correct.length],
    ["오답", done.length - correct.length],
    ["정답률", done.length ? `${Math.round((correct.length / done.length) * 100)}%` : "0%"],
    ["단답형", rateFor(shortIds)],
    ["객관식", rateFor(choiceIds)],
  ].map(([label, value]) => `<div class="result-item"><span>${label}</span><strong>${value}</strong></div>`).join("");

  els.categoryStats.innerHTML = Object.entries(byCategory)
    .map(([category, item]) => {
      const rate = item.done ? `${Math.round((item.correct / item.done) * 100)}%` : "0%";
      return `<div class="category-item"><strong>${category}</strong><span>${item.correct}/${item.done} 정답 · ${rate}</span></div>`;
    })
    .join("");
}

function rateFor(ids) {
  const done = ids.filter((id) => state.checked[id] && isScorable(questionById(id)));
  if (!done.length) return "0%";
  const correct = done.filter((id) => state.checked[id].correct);
  return `${Math.round((correct.length / done.length) * 100)}%`;
}

function renderWrongNote() {
  const showAnswers = els.showAnswersToggle.checked;
  const ids = state.wrongIds.filter(questionById);
  els.wrongList.innerHTML = ids.length
    ? ids.map((id) => {
        const q = questionById(id);
        return `
          <article class="wrong-item">
            <h3>${escapeHtml(q.id)}. ${escapeHtml(q.question)}</h3>
            <p>${escapeHtml(q.category)} · ${q.type === "short" ? "단답형" : "4지선다형"} · ${escapeHtml(statusLabel(q.status))}</p>
            ${showAnswers ? `<p><strong>정답:</strong> ${escapeHtml(correctAnswerText(q))}</p>` : ""}
            <button class="ghost-btn danger" type="button" data-remove-wrong="${q.id}">오답 삭제</button>
          </article>
        `;
      }).join("")
    : `<article class="wrong-item"><h3>저장된 오답이 없습니다.</h3><p>문제를 풀고 틀리면 자동으로 이곳에 쌓입니다.</p></article>`;
}

function glossarySearchText(note) {
  return [
    note.term,
    note.category,
    note.shortDefinition,
    note.detail,
    note.examPoint,
    ...(note.aliases || []),
    ...(note.commonPatterns || []),
    ...(note.relatedTerms || [])
  ].join(" ").toLowerCase();
}

function renderGlossary() {
  const notes = typeof ANSWER_NOTES !== "undefined" ? ANSWER_NOTES : [];
  const query = normalizeNoteKey(els.glossarySearch.value);
  const category = els.glossaryCategory.value;
  const filtered = notes.filter((note) => {
    const categoryOk = category === "all" || note.category === category;
    const queryOk = !query || normalizeNoteKey(glossarySearchText(note)).includes(query);
    return categoryOk && queryOk;
  });

  els.glossaryCount.textContent = `${filtered.length}개 개념`;
  els.glossaryList.innerHTML = filtered.length
    ? filtered.map((note) => `
      <article class="glossary-card" data-note-card="${escapeHtml(note.id)}">
        <button class="glossary-summary" type="button" data-action="toggle-note" data-note-id="${escapeHtml(note.id)}">
          <span>
            <strong>${escapeHtml(note.term)}</strong>
            <small>${escapeHtml(note.category)} · ${escapeHtml((note.aliases || []).slice(0, 3).join(", "))}</small>
          </span>
          <span class="badge muted">펼치기</span>
        </button>
        <p>${escapeHtml(note.shortDefinition)}</p>
        <div class="glossary-detail hidden" data-note-detail="${escapeHtml(note.id)}">
          <p>${escapeHtml(note.detail)}</p>
          <p><strong>시험 포인트:</strong> ${escapeHtml(note.examPoint)}</p>
          <div>
            <strong>자주 나오는 표현</strong>
            <ul>${(note.commonPatterns || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </div>
          <p><strong>관련 용어:</strong> ${escapeHtml((note.relatedTerms || []).join(", "))}</p>
        </div>
      </article>
    `).join("")
    : `<article class="glossary-card"><p>검색 결과가 없습니다.</p></article>`;
}

function openGlossary(term = "") {
  els.glossarySearch.value = term;
  renderGlossary();
  showView("glossary");
}

function toggleWrong() {
  const q = questionById(state.sessionIds[state.currentIndex]);
  if (state.wrongIds.includes(q.id)) {
    state.wrongIds = state.wrongIds.filter((id) => id !== q.id);
  } else {
    state.wrongIds.push(q.id);
  }
  saveState();
  renderQuiz();
}

function toggleBookmark() {
  const q = questionById(state.sessionIds[state.currentIndex]);
  if (state.bookmarks.includes(q.id)) {
    state.bookmarks = state.bookmarks.filter((id) => id !== q.id);
  } else {
    state.bookmarks.push(q.id);
  }
  saveState();
  renderQuiz();
}

function resetProgress() {
  if (!confirm("진행 상황과 오답 기록을 모두 초기화할까요?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state.sessionIds = [];
  state.currentIndex = 0;
  state.answers = {};
  state.checked = {};
  state.wrongIds = [];
  state.bookmarks = [];
  showView("home");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[ch]);
}

function bindEvents() {
  document.body.addEventListener("click", (event) => {
    const mode = event.target.closest("[data-mode]")?.dataset.mode;
    const action = event.target.closest("[data-action]")?.dataset.action;
    const glossaryTerm = event.target.closest("[data-glossary-term]")?.dataset.glossaryTerm;
    const removeWrong = event.target.closest("[data-remove-wrong]")?.dataset.removeWrong;

    if (mode) startMode(mode);
    if (removeWrong) {
      state.wrongIds = state.wrongIds.filter((id) => id !== removeWrong);
      saveState();
      renderWrongNote();
    }
    if (action === "home") showView("home");
    if (action === "glossary") openGlossary(glossaryTerm || "");
    if (action === "wrong-note") {
      renderWrongNote();
      showView("wrong");
    }
    if (action === "toggle-note") {
      const id = event.target.closest("[data-note-id]")?.dataset.noteId;
      const detail = document.querySelector(`[data-note-detail="${CSS.escape(id)}"]`);
      if (detail) detail.classList.toggle("hidden");
    }
    if (action === "reset-progress") resetProgress();
    if (action === "prev") move(-1);
    if (action === "next") move(1);
    if (action === "check") checkAnswer();
    if (action === "finish") {
      renderResult();
      showView("result");
    }
    if (action === "bookmark") toggleBookmark();
    if (action === "toggle-wrong") toggleWrong();
    if (action === "retry-wrong") startMode("wrong-retry");
    if (action === "clear-wrong") {
      if (confirm("오답노트를 모두 비울까요?")) {
        state.wrongIds = [];
        saveState();
        renderWrongNote();
      }
    }
  });
  els.showAnswersToggle.addEventListener("change", renderWrongNote);
  els.glossarySearch.addEventListener("input", renderGlossary);
  els.glossaryCategory.addEventListener("change", renderGlossary);
}

function init() {
  ["totalCount", "answeredCount", "accuracyRate", "wrongCount", "errorCount", "questionProgress", "categoryBadge", "typeBadge", "questionText", "answerArea", "feedback", "sessionTitle", "progressBar", "bookmarkBtn", "wrongToggleBtn", "resultStats", "categoryStats", "wrongList", "showAnswersToggle", "glossarySearch", "glossaryCategory", "glossaryCount", "glossaryList"].forEach((id) => {
    els[id] = $(id);
  });
  loadState();
  bindEvents();
  console.log(QUESTIONS.length);
  showView("home");
}

init();
