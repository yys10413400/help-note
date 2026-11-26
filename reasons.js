// 도움 요청 버튼 기본값. 선생님 화면의 "도움 버튼"에서 수업마다 바꿀 수 있어요.
// urgent: true 인 버튼은 기다린 시간과 상관없이 도움 요청 맨 위에 보여요.
export const DEFAULT_REASONS = [
  { icon: '🐢', label: '안 움직여요' },
  { icon: '🔍', label: '블록을 못 찾겠어요' },
  { icon: '🤔', label: '다음에 뭐 해요?' },
  { icon: '😵', label: '이상하게 돼요' },
  { icon: '💾', label: '저장·불러오기가 안 돼요', urgent: true },
  { icon: '🙋', label: '그냥 와 주세요' },
];

export const MAX_REASONS = 8;

export const reasonsOf = (task) =>
  task && Array.isArray(task.reasons) && task.reasons.length ? task.reasons : DEFAULT_REASONS;
