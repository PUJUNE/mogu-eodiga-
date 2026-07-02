// levels.js — 스테이지(라이벌 AI) 파라미터
const M = window.MGV;

// 코트 상수 (logic·render 공유)
M.W = 480; M.H = 300;
M.GROUND = 272;                 // 바닥 y
M.NET_X = 240; M.NET_TOP = 176; M.NET_HW = 3;   // 네트 중심·상단·반폭
M.BALL_R = 12;
M.WIN_SCORE = 5;

M.THEMES = {
  1: { name: '뒷마당 코트', sky0: '#8ecdf0', sky1: '#d8f0fa', ground: '#5da24a', net: '#e8e8ee', accent: '#ffd83d', night: false },
  2: { name: '노을 해변',   sky0: '#f0a860', sky1: '#fad8a8', ground: '#e8d4a0', net: '#f4f4f8', accent: '#ff7d3c', night: false },
  3: { name: '꿈속 코트',   sky0: '#120a2a', sky1: '#3a2860', ground: '#54408c', net: '#b8a8e0', accent: '#e08fff', night: true },
};

const RIVALS = {
  1: { name: '재빠른 생쥐',   kind: 'mouse',  body: '#9aa2ad', ear: '#c8ccd4', eye: '#22262e' },
  2: { name: '심술 까마귀',   kind: 'bird',   body: '#3a3a48', ear: '#5a5a6c', eye: '#ffd83d' },
  3: { name: '그림자 고양이', kind: 'shadow', body: '#1a1424', ear: '#2a2038', eye: '#ffd83d' },
};

M.makeStage = function (no) {
  const world = Math.min(3, Math.ceil(no / 10));
  const t = (no - 1) / 29;                       // 전체 진행도 0..1
  const boss = no % 10 === 0;
  const rival = RIVALS[world];

  return {
    no, world, theme: M.THEMES[world],
    rival: { ...rival, name: boss ? rival.name + ' (각성)' : rival.name, boss },
    ai: {
      speed: 120 + t * 120 + (boss ? 18 : 0),    // 이동 속도 (px/s)
      react: 0.4 - t * 0.32 - (boss ? 0.03 : 0), // 목표 갱신 지연 (초)
      err: 46 - t * 40 - (boss ? 3 : 0),         // 예측 오차 (px)
      smashP: 0.25 + t * 0.65,                   // 스매시 적극성
    },
    ballSpeed: 1 + (world - 1) * 0.07,           // 공 속도 배율
  };
};
