const fs = require("fs");
const path = require("path");

const sourcePath = process.argv[2];
const outPath = process.argv[3] || path.join(process.cwd(), "questions.js");

if (!sourcePath) {
  console.error("Usage: node tools/parse_questions.js <source.md> [out]");
  process.exit(1);
}

const source = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");

function cleanText(value) {
  return (value || "")
    .replace(/\*\*/g, "")
    .replace(/^\s*[-*]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAnswer(value) {
  return cleanText(value)
    .replace(/^정답\s*[:：]?\s*/i, "")
    .replace(/^\(?정답\)?\s*/i, "")
    .replace(/^[:：]\s*/, "")
    .replace(/[.。]\s*$/g, "")
    .trim();
}

function splitSynonyms(answer) {
  const base = normalizeAnswer(answer)
    .replace(/^["'“”]|["'“”]$/g, "")
    .replace(/\s*\(정답\)\s*/g, "")
    .replace(/\s*\(or\s+/gi, " / ")
    .replace(/\)$/g, "");

  const extras = new Set();
  const add = (x) => {
    const v = normalizeAnswer(x);
    if (v) extras.add(v);
  };

  add(base);
  base.split(/\s*\/\s*|\s+or\s+|,\s*|\s*\bor\b\s*/i).forEach(add);

  const lower = base.toLowerCase();
  if (lower.includes("prompt") || base.includes("프롬프트")) {
    ["Prompt", "prompt", "프롬프트"].forEach(add);
  }
  if (lower.includes("semantic") || base.includes("시맨틱") || base.includes("의미론")) {
    ["Semantic Tag", "시맨틱 태그", "의미론적 태그", "Semantic HTML", "시맨틱"].forEach(add);
  }
  if (lower.includes("github") || base.includes("깃허브")) {
    ["GitHub", "github", "깃허브"].forEach(add);
  }
  if (lower.includes("vercel") || base.includes("버셀") || base.includes("버셸")) {
    ["Vercel", "vercel", "버셀", "버셸", "버셀/버셸"].forEach(add);
  }
  if (/^<?head>?$/i.test(base) || base.includes("<head>")) {
    ["<head>", "head"].forEach(add);
  }
  if (/^<?body>?$/i.test(base) || base.includes("<body>")) {
    ["<body>", "body"].forEach(add);
  }
  if (/^<?link>?$/i.test(base) || base.includes("<link>")) {
    ["<link>", "link"].forEach(add);
  }
  if (/^<?p>?$/i.test(base) || base.includes("<p>")) {
    ["<p>", "p"].forEach(add);
  }
  if (/^<?h1>?$/i.test(base) || base.includes("<h1>")) {
    ["<h1>", "h1"].forEach(add);
  }
  if (base.toLowerCase().includes("index")) {
    ["index.html", "index"].forEach(add);
  }

  return [...extras];
}

function answerIndex(answer, choices) {
  const raw = normalizeAnswer(answer);
  const circled = "①②③④".indexOf(raw[0]);
  if (circled >= 0) return circled;
  const n = raw.match(/([1-4])\s*번?/);
  if (n) return Number(n[1]) - 1;
  const letter = raw.match(/^([A-D])/i);
  if (letter) return letter[1].toUpperCase().charCodeAt(0) - 65;
  const exact = choices.findIndex((choice) => cleanText(choice).includes(raw) || raw.includes(cleanText(choice)));
  return exact >= 0 ? exact : null;
}

function makeFixedQuestion(item) {
  if (item.type !== "choice" || item.verifiedAnswerIndex !== null) return null;
  const choices = [...item.choices];
  choices[choices.length - 1] = item.verifiedAnswerText || "검수 필요";
  return {
    question: item.question,
    choices,
    answerIndex: choices.length - 1
  };
}

function categoryFromText(text) {
  const t = text.toLowerCase();
  if (/html|태그|head|body|div|span|h1|css|블록|인라인|시맨틱|semantic|url|img|href|link|p 태그/.test(t)) return "HTML/CSS";
  if (/github|vercel|배포|레포지토리|repository|온라인|인터넷/.test(t)) return "배포";
  if (/notebooklm|gemini|소스|기획|데이터 자산/.test(t)) return "AI 기획";
  if (/prompt|프롬프트|바이브|antigravity|앤티그래비티|디버깅|hero|히어로|반응형/.test(t)) return "바이브 코딩";
  if (/피지컬|로봇|wfm|rfm|sim2real|pinn|sdg|엣지|온디바이스|양자화|휴머노이드/.test(t)) return "피지컬 AI";
  return "웹프로그래밍";
}

function parseChoices(block) {
  const choices = [];
  const choiceRegex = /(?:^|\n)\s*(?:([A-D])|([①②③④]))[.)]?\s*([^\n]+)/g;
  let m;
  while ((m = choiceRegex.exec(block))) {
    let text = cleanText(m[3]).replace(/\s*\(정답\)\s*/g, "");
    if (text) choices.push(text);
  }
  if (choices.length < 4) {
    const inlineCircled = [...block.matchAll(/[①②③④]\s*([^①②③④\n]+)/g)].map((x) => cleanText(x[1]).replace(/\s*정답\s*[:：].*$/g, ""));
    if (inlineCircled.length >= 4) return inlineCircled.slice(0, 4);
  }
  return choices.slice(0, 4);
}

function stripQuestionNoise(block) {
  return cleanText(
    block
      .replace(/^\s*(?:문제\s*)?\d+[.)]?\s*/m, "")
      .replace(/^\s*\(질문\)\s*/m, "")
      .replace(/^\s*질문\s*[:：]\s*/m, "")
      .replace(/\n\s*(?:[A-D]|[①②③④])[.)]?\s*[^\n]+/g, "")
      .replace(/\?\s*[A-D]\s*$/m, "?")
      .replace(/\n?\s*(?:\(?정답\)?|정답)\s*[:：]?\s*[\s\S]*$/i, "")
  );
}

function extractInlineAnswer(block) {
  const angleAnswer = block.match(/<\s*정답\s*[:：]?\s*([^<>\n]+)\s*>/i);
  if (angleAnswer) return angleAnswer[1];
  const bareAngle = block.match(/(?:^|\n)\s*<\s*([^<>\n]+)\s*>/i);
  if (bareAngle) return bareAngle[1];
  const inline = block.match(/\((?:정답)\s*[:：]?\s*([^)]+)\)/i);
  if (inline) return inline[1];
  const afterInline = block.match(/\(정답\)\s*([①②③④A-D1-4][^\n]*)/i);
  if (afterInline) return afterInline[1];
  const line = block.match(/(?:^|\n)\s*(?:[-*]\s*)?(?:\(?정답\)?|정답)\s*[:：]?\s*([^\n]+)/i);
  if (line) return line[1];
  const inlineAnswer = block.match(/\s정답\s*[:：]\s*([^\n]+)/i);
  if (inlineAnswer) return inlineAnswer[1];
  const altLine = block.match(/(?:^|\n)\s*답\s*[:：]\s*([^\n]+)/i);
  if (altLine) return altLine[1];
  const embedded = block.match(/(?:^|\n)\s*([A-D])[.)]?\s*([^\n]*?)\s*\(정답\)/i);
  if (embedded) return embedded[1];
  const trailingLetter = block.match(/^[^\n?]*\?\s*([A-D])\s*(?:\n|$)/i);
  if (trailingLetter) return trailingLetter[1];
  const finalParen = block.match(/\(([^()\n]+)\)\s*$/);
  if (finalParen) return finalParen[1];
  return "";
}

function splitQuestionBlocks(groupText) {
  const lines = groupText.split("\n");
  const blocks = [];
  let current = [];

  function isStart(line) {
    return /^\s*(?:문제\s*)?(?:0?[1-9]|10)(?:[.)]|:|\s)/.test(line) ||
      /^\s*(?:0?[1-9]|10)\.\s*\(질문\)/.test(line) ||
      /^\s*(?:문제|질문)\s*[:：]/.test(line);
  }

  for (const line of lines) {
    if (/^\s*(?:\[?\d\]?|파트|단답형|4지|선다형|선다형 작성 규칙)/.test(line) && !isStart(line)) {
      continue;
    }
    if (isStart(line) && current.length) {
      blocks.push(current.join("\n"));
      current = [line];
    } else if (isStart(line)) {
      current = [line];
    } else if (current.length) {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join("\n"));
  return blocks;
}

const chunks = source.split(/^## 문제 묶음\s+(\d+)\s*$/gm).slice(1);
const groups = [];
for (let i = 0; i < chunks.length; i += 2) {
  groups.push([null, chunks[i], chunks[i + 1] || ""]);
}
const questions = [];

for (const group of groups) {
  const groupNo = group[1];
  const blocks = splitQuestionBlocks(group[2]);
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];
    const manualAnswers = {
      "009": ["③", "③", "②", "③", "④", "마트료시카 상자 모델", "<title>", "<h1>", "href", "alt"],
      "012": ["Source", "Vibe Coding", "디버깅", "index.html", "반응형 디자인", "②", "②", "①", "③", "반응형 디자인"],
      "013": ["Sim2Real 격차", "PINN", "index.html", "title", "블록 요소", "②", "④", "③", "①", "④"]
    };
    const originalAnswer = extractInlineAnswer(block).replace(/^\(\s*\)$/, "");
    const usedManualAnswer = !originalAnswer && manualAnswers[groupNo] && manualAnswers[groupNo][blockIndex];
    const answer = originalAnswer || (usedManualAnswer ? manualAnswers[groupNo][blockIndex] : "");
    const choices = parseChoices(block);
    const type = choices.length === 4 ? "choice" : "short";
    const question = stripQuestionNoise(block);
    if (!question || !answer) continue;

    const item = {
      id: `Q${String(questions.length + 1).padStart(3, "0")}`,
      type,
      category: categoryFromText(`${question} ${answer}`),
      question,
      status: usedManualAnswer ? "needs_review" : "verified",
      originalAnswer: originalAnswer || null,
      verifiedAnswerText: normalizeAnswer(answer),
      explanation: type === "choice" ? `정답은 ${normalizeAnswer(answer)}입니다.` : `정답: ${normalizeAnswer(answer)}`,
      rawNote: `문제 묶음 ${groupNo}에서 변환됨`
    };

    if (type === "choice") {
      const originalIndex = originalAnswer ? answerIndex(originalAnswer, choices) : null;
      const verifiedIndex = answerIndex(answer, choices);
      item.choices = choices;
      item.originalAnswerIndex = originalIndex;
      item.verifiedAnswerIndex = verifiedIndex;
      item.answerIndex = verifiedIndex;
      if (!usedManualAnswer && verifiedIndex === null) {
        item.status = "no_correct_choice";
        item.verificationNote = "원본 정답이 선지와 일치하지 않아 채점에서 제외됩니다.";
      } else if (usedManualAnswer) {
        item.verificationNote = "원본에 정답 표기가 없거나 비어 있어 문맥상 정답을 보정했습니다.";
      }
      if (verifiedIndex !== null) {
        item.verifiedAnswerText = choices[verifiedIndex];
      }
      item.fixedQuestion = makeFixedQuestion(item);
    } else {
      item.answers = splitSynonyms(answer);
      item.verifiedAnswerText = item.answers[0];
      if (usedManualAnswer) {
        item.verificationNote = "원본에 정답 표기가 없거나 비어 있어 문맥상 정답을 보정했습니다.";
      }
    }

    questions.push(item);
  }
}

if (questions.length !== 270) {
  console.error(`Expected 270 questions, parsed ${questions.length}.`);
  fs.writeFileSync(path.join(path.dirname(outPath), "parse-debug.json"), JSON.stringify(questions, null, 2), "utf8");
  process.exit(2);
}

const body = `// Generated from 웹프로그래밍_270문제_정리파일.md\nconst QUESTIONS = ${JSON.stringify(questions, null, 2)};\n`;
fs.writeFileSync(outPath, body, "utf8");
console.log(`Wrote ${questions.length} questions to ${outPath}`);
