# 웹프로그래밍 기말 270문제 퀴즈 사이트

정적 파일만으로 실행되는 웹프로그래밍 기말고사 대비 퀴즈 사이트입니다.

## 실행 방법

`index.html`을 브라우저에서 열면 바로 실행됩니다.

## 주요 기능

- 전체 270문제 풀이
- 단답형 / 4지선다형 분리 풀이
- 랜덤 문제 및 랜덤 30문제 풀이
- 정답 확인, 이전/다음 이동, 전체 결과 보기
- 오답노트 추가, 삭제, 전체 초기화
- 문제 상태값 제공: `verified`, `wrong_original_answer`, `no_correct_choice`, `multiple_correct_choices`, `ambiguous`, `needs_review`
- 오류/검수 필요 문제 모드 제공
- 오류/검수 필요 문제는 기본 채점 점수에서 제외
- 정답 단어노트 / 개념노트 제공
- 개념노트 검색, 카테고리 필터, 펼침 카드 제공
- 문제 정답 확인 시 연결된 개념 설명 함께 표시
- 새로고침 후 진행 상황과 오답 기록 유지
- PC / 모바일 반응형 레이아웃

## 문제 수 검증

브라우저 콘솔에서 다음 명령을 실행하면 `270`이 출력됩니다.

```javascript
console.log(QUESTIONS.length);
```

## 배포 방법

GitHub 저장소에 `index.html`, `style.css`, `script.js`, `questions.js`를 업로드한 뒤 Vercel에서 해당 저장소를 연결하면 정적 사이트로 배포할 수 있습니다.
