import { useState, useEffect, useRef, useCallback } from "react";

/* ──────────────────────────────────────────
   🧭 useCompass Hook
   - iOS: DeviceOrientationEvent.requestPermission 처리
   - Android/기타: deviceorientationabsolute 우선, 없으면 deviceorientation
   - 부드러운 보간(lerp)으로 바늘 떨림 방지
────────────────────────────────────────── */
function useCompass() {
  const [heading, setHeading] = useState(null);       // 0~360° 북=0
  const [permission, setPermission] = useState("unknown"); // unknown|granted|denied|unsupported
  const [error, setError] = useState(null);
  const smoothRef = useRef(null);   // 보간용 현재값
  const rafRef = useRef(null);

  const LERP = 0.15; // 클수록 빠르게 반응, 작을수록 부드러움

  // 각도 최단 경로 보간 (359°→1° 시 180° 돌아가지 않게)
  const lerpAngle = (a, b, t) => {
    let diff = b - a;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return (a + diff * t + 360) % 360;
  };

  const handleOrientation = useCallback((e) => {
    let raw = null;
    if (e.webkitCompassHeading !== undefined) {
      // iOS Safari — webkitCompassHeading이 자북 기준 직접 제공
      raw = e.webkitCompassHeading;
    } else if (e.absolute && e.alpha !== null) {
      // Android absolute — alpha는 시계 반대 방향이므로 변환
      raw = (360 - e.alpha) % 360;
    } else if (e.alpha !== null) {
      // fallback
      raw = (360 - e.alpha) % 360;
    }
    if (raw === null) return;

    if (smoothRef.current === null) {
      smoothRef.current = raw;
      setHeading(Math.round(raw));
      return;
    }
    // rAF 기반 부드러운 보간
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      smoothRef.current = lerpAngle(smoothRef.current, raw, LERP);
      setHeading(Math.round(smoothRef.current));
    });
  }, []);

  const startListening = useCallback(() => {
    const absolute = window.DeviceOrientationEvent;
    if (!absolute) { setPermission("unsupported"); return; }

    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      // iOS 13+ 권한 요청
      DeviceOrientationEvent.requestPermission()
        .then(state => {
          if (state === "granted") {
            setPermission("granted");
            window.addEventListener("deviceorientation", handleOrientation, true);
          } else {
            setPermission("denied");
          }
        })
        .catch(err => { setError(err.message); setPermission("denied"); });
    } else {
      // Android / 데스크탑
      setPermission("granted");
      const eventName = "ondeviceorientationabsolute" in window
        ? "deviceorientationabsolute" : "deviceorientation";
      window.addEventListener(eventName, handleOrientation, true);
    }
  }, [handleOrientation]);

  useEffect(() => {
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
      window.removeEventListener("deviceorientationabsolute", handleOrientation, true);
      cancelAnimationFrame(rafRef.current);
    };
  }, [handleOrientation]);

  return { heading, permission, error, startListening };
}

/* ──────────────────────────────────────────
   💡 useWakeLock Hook
   - 관측 중 화면 꺼짐 방지
   - 브라우저 탭 숨김 시 자동 재취득
────────────────────────────────────────── */
function useWakeLock() {
  const [active, setActive] = useState(false);
  const [supported] = useState("wakeLock" in navigator);
  const lockRef = useRef(null);

  const request = useCallback(async () => {
    if (!supported) return;
    try {
      lockRef.current = await navigator.wakeLock.request("screen");
      setActive(true);
      lockRef.current.addEventListener("release", () => setActive(false));
    } catch (e) { console.warn("WakeLock 실패:", e); }
  }, [supported]);

  const release = useCallback(() => {
    lockRef.current?.release();
    lockRef.current = null;
    setActive(false);
  }, []);

  // 탭이 다시 보일 때 자동 재취득
  useEffect(() => {
    const onVisible = () => { if (active && document.visibilityState === "visible") request(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [active, request]);

  return { active, supported, request, release };
}

/* ── SHARED STYLES ── */
const S = {
  // ── 기본 색상 ──
  col: { muted:"#3a6a8a", body:"#90b8d0", emphasis:"#b0d0e8", dim:"#2a5070", link:"#70a0b8", bg:"#010810", bgCard:"rgba(4,15,30,.8)", bgPanel:"rgba(3,10,20,.9)", border:"#0d2040", borderLight:"#1a4060" },
  // ── 카드/패널 ──
  card: { background:"rgba(4,15,30,.8)", border:"1px solid #0d2040", borderRadius:"8px" },
  cardLg: { background:"rgba(4,15,30,.8)", borderRadius:"10px" },
  panel: { background:"linear-gradient(135deg,#040f1e,#030c18)", borderRadius:"12px" },
  // ── 버튼 공용 ──
  btnBase: { border:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:"700" },
  pillBtn: (active, activeColor) => ({
    padding:"4px 10px", borderRadius:"16px", border:"none", cursor:"pointer",
    fontSize:"11px", fontFamily:"inherit", fontWeight:"700",
    background: active ? activeColor : "#0d2040",
    color: active ? "#030B1A" : "#4a8aa8",
  }),
  tabBtn: (active, color) => ({
    padding:"3px 9px", borderRadius:"14px", border:"none", cursor:"pointer",
    fontSize:"10.5px", fontFamily:"inherit", fontWeight: active ? "700" : "400",
    background: active ? color : "#0d2040", color: active ? "#030B1A" : "#3a6a8a",
  }),
  // ── 텍스트 ──
  label: { fontSize:"10px", color:"#3a6a8a", marginBottom:"3px" },
  caption: { fontSize:"11px", color:"#3a6a8a", lineHeight:1.6 },
  bodyText: { fontSize:"13px", color:"#90b8d0", lineHeight:1.8 },
  serif: { fontFamily:"'Noto Serif KR',serif" },
  // ── 레이아웃 ──
  flexCol: (gap=10) => ({ display:"flex", flexDirection:"column", gap:`${gap}px` }),
  flexRow: (gap=6) => ({ display:"flex", alignItems:"center", gap:`${gap}px` }),
  infoHint: { fontSize:"11px", color:"#3a6a8a", padding:"8px 12px", background:"rgba(4,15,30,.8)", border:"1px solid #0d2040", borderRadius:"8px", lineHeight:1.6 },
  // ── 계절 색상 맵 ──
  seasonColor: (season) => ({spring:"#7EE8C8",summer:"#FFD166",autumn:"#F4845F",winter:"#89CFF0"})[season] || "#7EE8C8",
};

/* ── DATA PLACEHOLDER ── */
const CONST_DATA = {
  // ── SPRING ──
  leo:{season:"spring",name:"사자자리",latin:"Leo",symbol:"♌",mainStar:"레굴루스 (1.4등성, 청백색)",korInfo:"헌원(軒轅) — 황제의 별. 레굴루스는 '헌원대성(軒轅大星)'으로 천자를 상징했습니다.",korStars:{"레굴루스":"헌원대성 (軒轅大星)","데네볼라":"오제좌(五帝座)一"},direction:"남쪽",altitude:"약 55~65°",bestTime:"3~5월 밤 10시~자정",dso:[{name:"M65·M66 은하 쌍",mag:"9~9.5등",vis:"★★★",desc:"같은 시야에 나선은하 두 개! 8인치 저배율 최적 대상"},{name:"M96·M105 은하",mag:"9.3등",vis:"★★",desc:"타원은하 형태 감상"}],myth:"헤라클레스의 첫 과업, 네메아의 사자. 어떤 무기로도 상처 입힐 수 없는 황금 가죽의 사자를 맨손으로 목을 졸라 처치했습니다. 제우스가 용맹함을 기려 하늘에 올렸습니다.",howToFind:"봄 남쪽 하늘, 가장 밝은 청백색 별 레굴루스를 찾으세요. 그 위로 역물음표(낫 모양)이 사자의 머리·갈기입니다!",stars:[[50,80,5.5,"레굴루스"],[35,65,2.5,""],[33,52,3,"알기에바"],[42,40,2,""],[52,34,2,""],[60,26,2,""],[46,23,2,""],[37,29,2,""],[74,60,3.5,"데네볼라"],[60,52,2,""]],lines:[[0,1],[1,2],[2,7],[7,6],[6,5],[5,4],[4,3],[3,2],[2,9],[9,8]]},
  ursaMajor:{season:"spring",name:"큰곰자리",latin:"Ursa Major",symbol:"🐻",mainStar:"알리오스 (1.8등성, 북두칠성 중간)",korInfo:"북두칠성(北斗七星) — 탐랑·거문·녹존·문곡·염정·무곡·파군. 한국에서 일 년 내내 보이는 주극성입니다.",korStars:{"두베":"탐랑(貪狼) ①","메라크":"거문(巨門) ②","알리오스":"문곡(文曲) ④","미자르":"무곡(武曲) ⑥","알카이드":"파군(破軍) ⑦"},direction:"북쪽(주극성)",altitude:"약 65~80°",bestTime:"연중 가능, 봄 최적",dso:[{name:"M81 보데 은하",mag:"6.9등",vis:"★★★",desc:"나선팔 힌트, 8인치로 핵+원반 선명"},{name:"M82 시가 은하",mag:"8.4등",vis:"★★★",desc:"불규칙 형태 선명! M81과 같은 시야 가능"}],myth:"님프 칼리스토가 헤라의 저주로 곰이 되어 아들에게 죽임 당할 뻔했습니다. 제우스가 모자를 하늘에 올려 큰곰·작은곰자리로. 헤라의 저주로 바다 아래로 지지 않아 북두칠성은 서울에서 일 년 내내 보입니다!",howToFind:"국자 모양 7별. 국자 끝 두 별(두베·메라크)을 5배 연장하면 북극성!",stars:[[20,38,3,"두베"],[30,50,3,"메라크"],[45,52,2.5,""],[50,38,2,""],[62,33,3.5,"알리오스"],[74,24,3,"미자르"],[85,17,2.5,"알카이드"]],lines:[[0,1],[1,2],[2,3],[0,3],[3,4],[4,5],[5,6]]},
  virgo:{season:"spring",name:"처녀자리",latin:"Virgo",symbol:"♍",mainStar:"스피카 (1.0등성, 청백색 1등성)",korInfo:"각수(角宿) — 동양 28수 중 하나. 스피카는 '각수일(角宿一)'로 봄의 길잡이 별.",korStars:{"스피카":"각수일 (角宿一) — 봄의 대곡선 끝"},direction:"남동쪽",altitude:"약 30~45°",bestTime:"4~6월 밤 10시",dso:[{name:"M84·M86 은하 쌍",mag:"9~9.2등",vis:"★★",desc:"처녀자리 은하단 핵심, 같은 시야"},{name:"M87 타원은하",mag:"8.6등",vis:"★★",desc:"블랙홀 사진으로 유명한 그 은하!"}],myth:"정의의 여신 아스트라이아 또는 페르세포네. 하데스에게 납치된 페르세포네를 찾아 슬퍼하는 데메테르가 가을·겨울을 만듭니다. 처녀자리가 뜨면 봄이 시작됩니다.",howToFind:"봄의 대곡선! 북두칠성 손잡이 곡선을 따라 오렌지빛 아크투루스, 더 연장하면 청백색 스피카.",stars:[[65,72,5.5,"스피카"],[50,58,2.5,""],[38,50,2,""],[26,42,2.5,""],[22,58,2,""],[40,75,2,""],[72,60,2,""]],lines:[[0,1],[1,2],[2,3],[1,4],[0,5],[0,6]]},
  bootes:{season:"spring",name:"목동자리",latin:"Boötes",symbol:"🌾",mainStar:"아크투루스 (−0.05등성! 북반구 밤하늘 최밝은 별)",korInfo:"대각성(大角星) — 천자의 대리인을 상징. 봄의 대곡선 핵심.",korStars:{"아크투루스":"대각성 (大角星) — 봄의 대곡선 중간"},direction:"동쪽",altitude:"약 40~55°",bestTime:"4~6월 밤 10시",dso:[{name:"아크투루스 색채 감상",mag:"-0.05등",vis:"★★★",desc:"오렌지빛 K형 거성! 색채 감상이 곧 관측 목표"}],myth:"곰을 쫓는 사냥꾼. 봄의 대곡선(북두칠성→아크투루스→스피카) 위에 찬란하게 빛납니다.",howToFind:"북두칠성 손잡이 곡선 연장 → 오렌지빛 아크투루스! 절대 못 지나칩니다.",stars:[[50,70,6.5,"아크투루스"],[38,55,2.5,""],[32,42,2,""],[42,30,2,""],[60,30,2,""],[68,42,2.5,""],[62,55,2,""]],lines:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0]]},
  cancer:{season:"spring",name:"게자리",latin:"Cancer",symbol:"♋",mainStar:"알타르프 (3.5등성, 황도 12궁 중 가장 어두운 별자리)",korInfo:"귀수(鬼宿) — 동양 28수. M44 벌집성단 지역으로 동양에서도 특별히 여겼습니다.",direction:"남서쪽",altitude:"약 50~60°",bestTime:"2~4월 밤 10시",dso:[{name:"M44 벌집성단(프레세페)",mag:"3.7등",vis:"★★★",desc:"맨눈에 희뿌연 반점, 8인치 저배율로 수십 개 별 분해"},{name:"M67 산개성단",mag:"6.9등",vis:"★★",desc:"약 35억 년(!) 된 오래된 산개성단"}],myth:"헤라클레스가 히드라와 싸울 때 헤라가 보낸 게. 헤라클레스에게 밟혀 죽었지만 헤라는 충성심에 보답해 하늘에 올렸습니다.",howToFind:"쌍둥이자리와 사자자리 사이. M44 벌집성단이 맨눈으로 희뿌옇게 보이면 성공!",stars:[[50,50,2.5,""],[33,38,2,"알타르프"],[67,38,2,""],[40,65,2,""],[60,65,2,""]],lines:[[0,1],[0,2],[0,3],[0,4]]},
  coronaBorealis:{season:"spring",name:"왕관자리",latin:"Corona Borealis",symbol:"💫",mainStar:"알페카 (2.2등성, 청백색)",korInfo:"관삭(貫索) — 동양에서 감옥을 상징하는 C자 모양 7별.",direction:"동쪽(목동자리 옆)",altitude:"약 45~60°",bestTime:"4~6월 밤 10시",dso:[{name:"알페카 색채 감상",mag:"2.2등",vis:"★★",desc:"C자 모양 왕관 패턴 감상. 이중성 여부 확인 도전"}],myth:"디오니소스가 크레타 공주 아리아드네에게 선물한 황금 왕관. 아리아드네는 테세우스가 미노타우로스를 처치하도록 도왔지만 낙소스 섬에 버려진 비운의 공주입니다.",howToFind:"아크투루스 북동쪽 약 20~25°. C자(반원) 모양의 7별, 가장 밝은 알페카를 중심으로!",stars:[[50,35,4,"알페카"],[30,48,2,""],[18,62,1.8,""],[24,78,1.8,""],[70,48,2,""],[82,62,1.8,""],[76,78,1.8,""]],lines:[[3,2],[2,1],[1,0],[0,4],[4,5],[5,6]]},
  // ── SUMMER ──
  scorpius:{season:"summer",name:"전갈자리",latin:"Scorpius",symbol:"♏",mainStar:"안타레스 (1.0등성, 붉은 초거성 — '화성의 경쟁자')",korInfo:"심수(心宿) — 동양 28수. 안타레스는 '대화(大火)'로 여름 대표 붉은 별.",korStars:{"안타레스":"대화 (大火) — 심수이(心宿二)"},direction:"남쪽 지평선 가까이",altitude:"약 15~25°",bestTime:"6~8월 자정, 남쪽 낮은 하늘",dso:[{name:"M4 구상성단",mag:"5.4등",vis:"★★★",desc:"안타레스 바로 옆! 8인치로 별 분해 부분 가능"},{name:"M6 나비 성단",mag:"4.2등",vis:"★★★",desc:"나비 형태의 아름다운 산개성단"},{name:"M7 프톨레마이오스 성단",mag:"3.3등",vis:"★★★",desc:"맨눈 가능! 8인치로 장관"}],myth:"오리온의 숙적. 대지의 여신 가이아가 자만한 오리온을 처치하기 위해 보냈습니다. 제우스는 이 둘을 하늘 반대편에 배치 — 오리온이 지면 전갈이 뜨고, 전갈이 지면 오리온이 뜹니다.",howToFind:"여름 남쪽 지평선 근처. 불그스름한 안타레스 → S자 꼬리로 이어집니다.",stars:[[44,40,5.5,"안타레스"],[35,28,2.5,""],[27,22,2,""],[52,30,2.5,""],[58,40,2,""],[64,50,2.5,""],[70,60,2,""],[72,70,2,""],[66,80,2.5,""],[58,88,2,""],[52,92,2,""]],lines:[[2,1],[1,0],[0,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10]]},
  cygnus:{season:"summer",name:"백조자리",latin:"Cygnus",symbol:"🦢",mainStar:"데네브 (1.25등성 — 초거성! 2600광년)",korInfo:"오작교(烏鵲橋) — 칠석날 까마귀·까치가 은하수에 놓는 다리. 데네브가 그 다리의 주인공.",korStars:{"데네브":"오작 (烏鵲) — 칠석 전설 오작교","알비레오":"황금+청색 이중성 — 북반구 최고"},direction:"동쪽→머리 위",altitude:"약 60~80°",bestTime:"7~9월 밤 10시",dso:[{name:"알비레오 이중성",mag:"3.1·5.1등",vis:"★★★",desc:"황금색+청색 대비! 북반구 최고 아름다운 이중성"}],myth:"제우스가 레다에게 접근하기 위해 변한 백조. 레다와의 사이에서 쌍둥이 카스토르·폴룩스와 트로이 전쟁의 원인 헬레네가 태어났습니다.",howToFind:"여름 대삼각형 데네브(꼬리). 십자가 모양(북십자성)으로도 유명. 알비레오(부리)는 이중성 최고 대상!",stars:[[50,18,4.5,"데네브"],[50,50,3.5,"사드르"],[50,82,3,"알비레오"],[22,50,2.5,""],[78,50,2.5,""]],lines:[[0,1],[1,2],[3,4]]},
  lyra:{season:"summer",name:"거문고자리",latin:"Lyra",symbol:"🎵",mainStar:"베가 (0.03등성! 직녀성 織女星)",korInfo:"직녀(織女) — 음력 7월 7일 칠석, 은하수 건너 견우성(알타이르)을 만나는 별.",korStars:{"베가":"직녀성 (織女星) ★ 칠석 주인공"},direction:"동쪽→머리 위",altitude:"약 70~85°",bestTime:"7~9월 밤 10시",dso:[{name:"M57 반지 성운",mag:"8.8등",vis:"★★★",desc:"8인치로 고리 모양 확인 가능! 백색왜성의 마지막 숨결"}],myth:"오르페우스의 리라. 그의 연주는 강도 멈추게 할 만큼 아름다웠고, 죽은 아내 에우리디케를 되찾기 위해 지하세계까지 내려가 하데스를 감동시켰습니다.",howToFind:"여름 머리 위 가장 밝은 별 베가! 옆의 작은 평행사변형이 거문고입니다.",stars:[[50,20,6.5,"베가"],[38,55,2,""],[62,55,2,""],[32,72,2,"M57"],[68,72,2,""]],lines:[[0,1],[0,2],[1,2],[1,3],[2,4],[3,4]]},
  aquila:{season:"summer",name:"독수리자리",latin:"Aquila",symbol:"🦅",mainStar:"알타이르 (0.77등성 — 견우성 牽牛星)",korInfo:"견우(牽牛) — 은하수 건너편 직녀성(베가)을 그리워하는 칠석 주인공.",korStars:{"알타이르":"견우성 (牽牛星) ★ 칠석 주인공"},direction:"남동쪽",altitude:"약 40~55°",bestTime:"7~9월 밤 10시",dso:[{name:"알타이르 자체 감상",mag:"0.77등",vis:"★★★",desc:"자전속도가 극히 빨라 적도가 부풀어있는 별! 색채 감상"}],myth:"제우스의 독수리. 트로이의 미소년 가니메데스를 납치해 올림포스로 데려가 신들의 술시중을 들게 했습니다.",howToFind:"여름 대삼각형 중 가장 남쪽의 알타이르. 양쪽에 두 별을 거느린 독특한 3연성 모습!",stars:[[50,50,5.5,"알타이르"],[37,47,2.5,""],[63,47,2.5,""],[50,30,2,""],[50,70,2,""],[34,65,1.8,""],[66,65,1.8,""]],lines:[[1,0],[0,2],[3,0],[0,4],[4,5],[4,6]]},
  hercules:{season:"summer",name:"헤르쿨레스자리",latin:"Hercules",symbol:"⚡",mainStar:"코르네피로스 (2.8등성) / 라스알게티 (3.5등성)",korInfo:"동양에서 환자(宦者) 별자리 등으로 분류. M13은 예부터 은하수 안 밝은 구름으로 기록.",direction:"동쪽→머리 위",altitude:"약 60~75°",bestTime:"5~8월 밤 10시",dso:[{name:"M13 헤르쿨레스 구상성단",mag:"5.8등",vis:"★★★",desc:"8인치로 별 분해 가능! 북반구 최대 구상성단"},{name:"M92 구상성단",mag:"6.4등",vis:"★★★",desc:"M13보다 작지만 풍성. 비교 관측 추천"}],myth:"그리스 최고 영웅 헤라클레스. 12과업을 완수한 불멸의 영웅으로, 머리를 아래로 향한 채 하늘에 올려졌습니다.",howToFind:"왕관자리와 거문고 사이. 4별이 이루는 사다리꼴(키스톤)! 키스톤 변에 M13이 있습니다.",stars:[[50,48,3,"키스톤①"],[35,42,3,"키스톤②"],[35,58,2.5,"키스톤③"],[65,42,2.5,"키스톤④"],[65,58,2.5,""],[50,28,3,"베타"],[50,72,2,"알파"]],lines:[[0,1],[1,2],[2,3],[3,0],[0,5],[0,6],[1,3]]},
  delphinus:{season:"summer",name:"돌고래자리",latin:"Delphinus",symbol:"🐬",mainStar:"로타네프 (3.6등성) + 수알로킨 (3.8등성)",korInfo:"패과(敗瓜) — 동양에서 '썩은 박'. 마름모가 박을 닮았다고 여겼습니다.",direction:"남동쪽(독수리 근처)",altitude:"약 45~55°",bestTime:"8~9월 밤 10시",dso:[{name:"마름모 패턴 + γ 이중성",mag:"3.6등",vis:"★★",desc:"작고 선명한 마름모 형태 감상. 이중성 분리 도전"}],myth:"포세이돈의 구혼을 도운 공로로 하늘에 올려진 돌고래. 또는 음악가 아리온을 등에 태워 구한 돌고래.",howToFind:"알타이르 북동쪽 약 10°. 작지만 뚜렷한 마름모(욥의 관) 모양! 여름 밤 보석 같은 소별자리.",stars:[[50,30,2.5,""],[35,45,2.5,""],[50,60,3,"수알로킨"],[65,45,3,"로타네프"],[50,78,1.8,""]],lines:[[0,1],[1,2],[2,3],[3,0],[2,4]]},
};
Object.assign(CONST_DATA, {
  // ── AUTUMN ──
  pegasus:{season:"autumn",name:"페가수스자리",latin:"Pegasus",symbol:"🐴",mainStar:"에니브 (2.4등성)",korInfo:"실수(室宿)/벽수(壁宿) — 동양 28수. '가을의 대사각형'은 궁궐 마당을 상징.",direction:"남쪽",altitude:"약 55~70°",bestTime:"10~11월 밤 10시",dso:[{name:"M15 구상성단",mag:"6.2등",vis:"★★★",desc:"중심부 매우 조밀! 8인치로 별 분해 부분 가능"}],myth:"페르세우스가 메두사를 처치했을 때 피에서 태어난 천마. 발굽으로 헬리콘 산을 차 시인들에게 영감의 샘물 히포크레네를 만들었습니다.",howToFind:"가을 남쪽의 거대한 사각형(가을의 대사각형)! 한 변이 약 15°나 됩니다.",stars:[[28,28,3,""],[28,70,3,""],[72,28,3,""],[72,70,3,"알페라츠"],[15,48,2,""],[42,12,2,""]],lines:[[0,1],[0,2],[2,3],[1,3],[0,4],[2,5]]},
  andromeda:{season:"autumn",name:"안드로메다자리",latin:"Andromeda",symbol:"⛓️",mainStar:"알페라츠 (2.0등성, 페가수스 사각형 공유)",korInfo:"규수(奎宿) — 동양 28수. M31 안드로메다 은하는 동양 기록에도 남아 있습니다.",korStars:{"알페라츠":"규수일 (奎宿一)"},direction:"북동쪽",altitude:"약 60~75°",bestTime:"10~11월 밤 10시",dso:[{name:"M31 안드로메다 은하",mag:"3.4등",vis:"★★★",desc:"250만 광년! 8인치로 코어+나선팔 힌트, 맨눈 가능"},{name:"M32·M110 위성은하",mag:"8.7·8.9등",vis:"★★",desc:"M31 양쪽의 작은 위성 타원은하"}],myth:"에티오피아 공주. 어머니의 오만으로 바다 괴물의 제물이 됐지만 페르세우스가 구출. M31은 우리 은하와 충돌 코스 — 약 45억 년 후 합쳐집니다!",howToFind:"가을 대사각형 왼쪽 위에서 북동쪽으로 이어지는 별들. M31은 맑은 날 맨눈으로도 희뿌연 반점!",stars:[[30,72,3.5,"알페라츠"],[42,60,2.5,""],[58,48,2.5,""],[74,38,2,""]],lines:[[0,1],[1,2],[2,3]]},
  cassiopeia:{season:"autumn",name:"카시오페이아자리",latin:"Cassiopeia",symbol:"👑",mainStar:"쉐다르 (2.2등성)",korInfo:"왕량(王良) 등 동양 별자리 포함. W자는 하늘의 산처럼 보여 '천산(天山)'으로도 불렸습니다.",direction:"북쪽(주극성)",altitude:"약 70~90°",bestTime:"연중 가능(주극성), 가을 최적",dso:[{name:"NGC 457 ET 성단",mag:"6.4등",vis:"★★★",desc:"두 밝은 별이 ET의 눈처럼! 8인치 저배율 감상"},{name:"NGC 7789 캐롤라인의 장미",mag:"6.7등",vis:"★★★",desc:"8인치로 별들이 원형 배열 — 장관"},{name:"M52 산개성단",mag:"7.3등",vis:"★★",desc:"풍성한 별들의 모임"}],myth:"에티오피아 왕비. 딸 안드로메다가 바다 님프보다 아름답다고 자랑하다 포세이돈의 분노를 샀습니다. 하늘에서 의자에 앉아 때로는 거꾸로 매달린 채 북극성 주위를 돕니다.",howToFind:"북극성을 기준으로 북두칠성 반대편 W(또는 M) 모양 5별. 항상 보이는 주극성!",stars:[[15,50,2.5,""],[30,28,3.5,"쉐다르"],[50,42,3,""],[68,22,3,""],[82,45,2.5,""]],lines:[[0,1],[1,2],[2,3],[3,4]]},
  perseus:{season:"autumn",name:"페르세우스자리",latin:"Perseus",symbol:"🗡️",mainStar:"미르파크 (1.8등성) / 알골 (변광성! 2.1~3.4등성)",korInfo:"대릉(大陵) — 큰 능묘. 알골은 '대릉오(大陵五)'로 고대에도 밝기 변화가 기록되었습니다!",korStars:{"알골":"대릉오 (大陵五) — 2.87일 주기 변광성! 메두사의 눈"},direction:"북동쪽(카시오페이아 아래)",altitude:"약 55~70°",bestTime:"10~12월 밤 10시",dso:[{name:"NGC 869·884 이중 성단",mag:"4.3·4.4등",vis:"★★★",desc:"8인치 최고 대상! 두 성단이 한 시야에 — 경이로운 광경"},{name:"알골 변광성 관측",mag:"2.1~3.4등",vis:"★★★",desc:"2.87일마다 밝기 변화! 기간 두고 관측하는 프로젝트"}],myth:"제우스의 아들. 메두사의 머리를 잘라 바다 괴물로부터 안드로메다를 구했습니다. 알골(Algol)은 아랍어 '악마의 머리' — 메두사의 눈을 상징합니다.",howToFind:"카시오페이아 W자 아래. 알골 위치 파악 후 며칠 간격으로 밝기 변화 기록하는 재미있는 관측!",stars:[[50,30,5.5,"미르파크"],[32,50,4,"알골"],[38,64,2,""],[62,52,2,""],[72,38,2,""],[26,28,2,""]],lines:[[0,5],[0,4],[0,1],[1,2],[0,3],[3,4]]},
  aries:{season:"autumn",name:"양자리",latin:"Aries",symbol:"♈",mainStar:"하말 (2.0등성 — 황도 12궁 역사적 기준점)",korInfo:"루수(婁宿) — 동양 28수. 춘분점이 과거 양자리에 있어서 황도의 역사적 시작점.",direction:"남동쪽",altitude:"약 40~55°",bestTime:"10~12월 밤 10시",dso:[{name:"γ 메사르팀 이중성",mag:"4.8·4.8등",vis:"★★★",desc:"쌍둥이처럼 같은 밝기의 이중성! 8인치로 분리 가능"}],myth:"황금 양털의 주인공. 이아손과 아르고나우타이의 원정 목표가 이 양의 황금 양털이었습니다.",howToFind:"안드로메다자리와 황소자리 사이. 삼각형 모양의 3별 — 하말이 가장 밝습니다.",stars:[[40,42,4,"하말"],[55,50,3.5,"셰라탄"],[65,57,2.5,"메사르팀"],[28,32,2,""]],lines:[[3,0],[0,1],[1,2]]},
  // ── WINTER ──
  orion:{season:"winter",name:"오리온자리",latin:"Orion",symbol:"⚔️",mainStar:"베텔게우스 (0.5등성, 적색 초거성) + 리겔 (0.1등성, 청백 초거성)",korInfo:"삼수(參宿) — 동양 28수. 허리띠 3별은 '삼성(三星)' 또는 '삼태성(三台星)'으로 한국에서도 중요.",korStars:{"베텔게우스":"삼수대성 (參宿大星) — 적색 초거성","삼태성":"δ·ε·ζ 허리띠 3별 — 한국 전통 삼태성(三台星)","리겔":"삼수칠 (參宿七) — 청백 초거성"},direction:"남쪽",altitude:"약 40~55°",bestTime:"12~2월 밤 10시, 3월엔 서쪽으로 이동 중",dso:[{name:"M42 오리온 대성운",mag:"4.0등",vis:"★★★",desc:"8인치 안시 최고 대상! 성운 구조·트라페지움 분해"},{name:"M43 부속 성운",mag:"9.0등",vis:"★★",desc:"M42 바로 옆 작은 성운"},{name:"M78 반사 성운",mag:"8.3등",vis:"★★",desc:"빛을 반사하는 성운, 둥근 형태"}],myth:"그리스 최고의 사냥꾼, 포세이돈의 아들. '세상 모든 동물을 잡겠다'는 자만으로 전갈에게 죽었습니다. 아르테미스가 사랑했지만 아폴론의 속임수로 자신도 모르게 그를 쏘았다는 비극도 있습니다.",howToFind:"3개의 허리띠 별(삼태성)이 나란히 있는 것을 찾으면 됩니다. 허리띠 아래가 M42 오리온 대성운!",stars:[[30,28,5.5,"베텔게우스"],[70,72,6,"리겔"],[68,28,2.5,""],[30,72,2.5,""],[38,50,3,"삼태성①"],[50,50,3,""],[62,50,3,"삼태성③"],[50,68,2,"M42"],[80,42,2,""]],lines:[[0,2],[2,6],[6,5],[5,4],[4,3],[3,1],[2,8],[5,7]]},
  taurus:{season:"winter",name:"황소자리",latin:"Taurus",symbol:"♉",mainStar:"알데바란 (0.85등성, 붉은 거성 — 필수오 畢宿五)",korInfo:"필수(畢宿)·묘수(昴宿) — 동양 28수 두 개가 모여있는 특별한 지역. 좀생이별(M45)은 풍흉 점성술에 중요!",korStars:{"알데바란":"필수오 (畢宿五) — 겨울 붉은 별","플레이아데스":"묘수(昴宿) / 좀생이별 ★ 한국 풍흉 점성술"},direction:"남서쪽",altitude:"약 55~65°",bestTime:"12~2월 밤 10시",dso:[{name:"M45 플레이아데스(좀생이별)",mag:"1.6등",vis:"★★★",desc:"맨눈 7별 이상, 8인치로 수십 개+성운빛"},{name:"M1 게 성운",mag:"8.4등",vis:"★★★",desc:"1054년 초신성 잔해! 8인치로 타원형 희뿌연 덩어리"}],myth:"제우스가 페니키아 공주 에우로파를 납치하기 위해 변한 하얀 황소. 크레타에서 미노스 왕을 낳았고 훗날 미노타우로스가 탄생합니다.",howToFind:"오리온 허리띠에서 오른쪽 위로 연장하면 붉은 알데바란. 더 가면 플레이아데스(좀생이별)!",stars:[[50,55,5.5,"알데바란"],[37,45,2,""],[28,38,2,""],[63,45,2.5,""],[33,62,2,""],[74,30,2,""],[80,25,3.5,"M45"]],lines:[[0,1],[1,2],[0,3],[0,4],[3,5],[5,6]]},
  gemini:{season:"winter",name:"쌍둥이자리",latin:"Gemini",symbol:"♊",mainStar:"폴룩스 (1.14등성) + 카스토르 (1.58등성, 6중성계!)",korInfo:"정수(井宿)/북하(北河) — 카스토르는 '북하이(北河二)', 폴룩스는 '북하삼(北河三)'.",korStars:{"카스토르":"북하이 (北河二) — 실제 6중성계!","폴룩스":"북하삼 (北河三) — 겨울 대육각형"},direction:"동쪽→머리 위",altitude:"약 65~75°",bestTime:"1~3월 밤 10시",dso:[{name:"M35 산개성단",mag:"5.1등",vis:"★★★",desc:"8인치로 수백 개 별 분해! 뒤에 작은 NGC 2158도"},{name:"NGC 2392 에스키모 성운",mag:"9.9등",vis:"★★",desc:"8인치로 원형+중심성 확인 가능"}],myth:"카스토르가 죽자 폴룩스가 불멸의 삶을 나눠 달라고 제우스에게 간청. 이후 둘은 번갈아 올림포스와 하데스를 오가게 됩니다.",howToFind:"오리온 왼쪽 위. 나란히 있는 두 밝은 별 카스토르(위)·폴룩스(아래)가 쌍둥이의 머리!",stars:[[32,22,4.5,"카스토르"],[44,28,5,"폴룩스"],[28,38,2,""],[24,52,2,""],[22,68,2,""],[40,42,2,""],[38,58,2,""],[36,72,2,""]],lines:[[0,2],[2,3],[3,4],[1,5],[5,6],[6,7],[0,1]]},
  canisMajor:{season:"winter",name:"큰개자리",latin:"Canis Major",symbol:"🐕",mainStar:"시리우스 (−1.46등성! 전천 최밝은 별 — 천랑성 天狼星)",korInfo:"천랑(天狼) — '하늘의 이리'. 동양에서도 시리우스를 천랑성으로 불러 흉조로 여겼습니다.",korStars:{"시리우스":"천랑성 (天狼星) ★ 전천 최밝은 별"},direction:"남쪽",altitude:"약 25~35°",bestTime:"1~3월 밤 10시",dso:[{name:"M41 산개성단",mag:"4.5등",vis:"★★★",desc:"시리우스 바로 아래! 8인치로 수십 개 별"},{name:"NGC 2362 성단",mag:"4.1등",vis:"★★★",desc:"중심에 밝은 별이 있는 아름다운 성단"}],myth:"오리온의 사냥개. 무엇이든 잡을 수 있는 청동 개 라엘라프스가 절대 잡히지 않는 여우를 쫓는 역설에, 제우스가 둘 다 돌로 굳혀 하늘에 올렸다는 이야기도 있습니다.",howToFind:"오리온 허리띠에서 왼쪽 아래로 연장하면 밤하늘 최밝은 별 시리우스! 절대 못 지나칩니다.",stars:[[50,28,7.5,"시리우스"],[38,42,2.5,""],[62,42,2.5,""],[42,58,2,""],[58,58,2,""],[50,72,2,""]],lines:[[0,1],[0,2],[1,3],[2,4],[3,5],[4,5]]},
  auriga:{season:"winter",name:"마차부자리",latin:"Auriga",symbol:"🌟",mainStar:"카펠라 (0.08등성! 겨울 황금별 — 오거오 五車五)",korInfo:"오거(五車) — '5대의 수레'. 카펠라는 '오거오(五車五)'로 겨울 북쪽의 찬란한 황금빛 별.",korStars:{"카펠라":"오거오 (五車五) — 겨울 대육각형 북쪽 꼭짓점"},direction:"북동쪽",altitude:"약 65~80°",bestTime:"12~2월 밤 10시",dso:[{name:"M36·M37·M38 산개성단 삼총사",mag:"6~6.5등",vis:"★★★",desc:"세 성단이 같은 시야 범위! 8인치 비교 관측 최고"}],myth:"아테네 왕 에리크토니오스 또는 아말테아를 기르는 자. 카펠라(Capella)는 라틴어로 '암염소'. 제우스가 아기 때 아말테아의 젖을 먹고 자랐습니다.",howToFind:"겨울 대육각형의 북쪽 황금빛 꼭짓점! 오각형(마차바퀴) 모양, 카펠라가 가장 밝습니다.",stars:[[50,25,6.5,"카펠라"],[25,42,2.5,""],[30,65,3,""],[50,75,2.5,""],[70,65,3,""],[75,42,2.5,""]],lines:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]]},
  canisMinor:{season:"winter",name:"작은개자리",latin:"Canis Minor",symbol:"🐶",mainStar:"프로키온 (0.34등성! — 남하삼 南河三)",korInfo:"남하(南河) — 동양에서 '남쪽 강'. 프로키온은 '남하삼(南河三)'으로 겨울 대육각형 구성.",korStars:{"프로키온":"남하삼 (南河三) — 겨울 대육각형"},direction:"동남쪽",altitude:"약 35~45°",bestTime:"1~3월 밤 10시",dso:[{name:"프로키온 자체 감상",mag:"0.34등",vis:"★★★",desc:"흰빛 F형 별. 겨울 대육각형의 한 꼭짓점!"}],myth:"오리온의 작은 사냥개. 큰개자리 시리우스와 함께 오리온을 따라다닙니다.",howToFind:"쌍둥이자리 폴룩스 아래, 겨울 대육각형 안쪽. 프로키온·고메이사 두 별이 전부인 단순한 별자리!",stars:[[50,45,6,"프로키온"],[38,28,2.5,"고메이사"]],lines:[[0,1]]},
});

const ASTERISMS = {};
Object.assign(ASTERISMS, {
  spring:[
    {name:"봄의 대곡선",color:"#7EE8C8",closed:false,dash:false,info:"북두칠성 손잡이 곡선을 호 모양으로 따라가면 아크투루스(오렌지·대각성), 이어서 스피카(청백·각수일)로 연결되는 봄 하늘의 길잡이 곡선. 약 120° 호!",vertices:[{az:18,alt:72,label:"북두칠성"},{az:98,alt:44,label:"아크투루스\n대각성"},{az:148,alt:35,label:"스피카\n각수일"}]},
    {name:"봄의 대삼각형",color:"#aaffcc",closed:true,dash:true,info:"아크투루스(목동)·스피카(처녀)·데네볼라(사자 꼬리)를 잇는 봄 하늘의 삼각형. 세 꼭짓점이 모두 1~2등성!",vertices:[{az:98,alt:44,label:"아크투루스"},{az:148,alt:35,label:"스피카"},{az:74,alt:58,label:"데네볼라"}]},
  ],
  summer:[
    {name:"여름 대삼각형",color:"#FFD166",closed:true,dash:false,info:"베가(직녀성)·알타이르(견우성)·데네브(오작교). 칠석 전설의 무대! 7~9월 머리 위에 형성. 베가와 알타이르 사이를 은하수가 흐릅니다.",vertices:[{az:78,alt:74,label:"베가\n직녀성"},{az:142,alt:50,label:"알타이르\n견우성"},{az:55,alt:65,label:"데네브\n오작교"}]},
  ],
  autumn:[
    {name:"가을의 대사각형",color:"#F4845F",closed:true,dash:false,info:"페가수스의 4별+안드로메다의 알페라츠로 이루어진 거대한 사각형. 한 변이 약 15°! 가을 별자리 찾기의 기준점. 사각형 안에 별이 거의 없어 한국 전통에서 '우물'로 불렸습니다.",vertices:[{az:155,alt:58,label:""},{az:195,alt:58,label:""},{az:195,alt:70,label:"알페라츠\n안드로메다"},{az:155,alt:70,label:""}]},
  ],
  winter:[
    {name:"겨울 대육각형",color:"#89CFF0",closed:true,dash:false,info:"시리우스(천랑성)·리겔·알데바란(필수오)·카펠라(오거오)·폴룩스(북하삼)·프로키온(남하삼). 모두 0~1등성! 오리온을 가운데 두고 형성. 겨울 밤 가장 웅장한 별 패턴.",vertices:[{az:162,alt:28,label:"시리우스\n천랑성"},{az:175,alt:48,label:"리겔"},{az:210,alt:58,label:"알데바란\n필수오"},{az:242,alt:68,label:"카펠라\n오거오"},{az:140,alt:70,label:"폴룩스\n북하삼"},{az:148,alt:38,label:"프로키온\n남하삼"}]},
    {name:"겨울 대삼각형",color:"#FFD166",closed:true,dash:true,info:"시리우스(큰개)·베텔게우스(오리온 왼팔)·프로키온(작은개). 대육각형 안에 형성되는 작고 밝은 삼각형으로, 초보자가 가장 먼저 찾기 좋은 겨울 패턴입니다.",vertices:[{az:162,alt:28,label:"시리우스"},{az:170,alt:56,label:"베텔게우스"},{az:148,alt:38,label:"프로키온"}]},
  ],
});

const SEASONS_CFG = [
  {id:"spring",label:"봄",emoji:"🌸",months:"3~5월",color:"#7EE8C8",nebula:"radial-gradient(ellipse 65% 45% at 15% 30%, rgba(0,180,140,0.18) 0%, transparent 60%), radial-gradient(ellipse 50% 60% at 85% 65%, rgba(0,120,180,0.15) 0%, transparent 55%), radial-gradient(ellipse 70% 40% at 55% 85%, rgba(60,200,120,0.1) 0%, transparent 50%), #030B1A"},
  {id:"summer",label:"여름",emoji:"☀️",months:"6~8월",color:"#FFD166",nebula:"radial-gradient(ellipse 70% 50% at 50% 20%, rgba(200,80,20,0.15) 0%, transparent 60%), radial-gradient(ellipse 40% 70% at 80% 70%, rgba(180,60,0,0.12) 0%, transparent 55%), radial-gradient(ellipse 60% 30% at 20% 80%, rgba(220,140,0,0.1) 0%, transparent 50%), #040810"},
  {id:"autumn",label:"가을",emoji:"🍂",months:"9~11월",color:"#F4845F",nebula:"radial-gradient(ellipse 55% 55% at 20% 25%, rgba(180,60,20,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 75%, rgba(160,80,0,0.15) 0%, transparent 55%), radial-gradient(ellipse 45% 50% at 55% 55%, rgba(120,40,10,0.1) 0%, transparent 50%), #040A08"},
  {id:"winter",label:"겨울",emoji:"❄️",months:"12~2월",color:"#89CFF0",nebula:"radial-gradient(ellipse 60% 50% at 25% 20%, rgba(20,100,200,0.18) 0%, transparent 60%), radial-gradient(ellipse 50% 65% at 75% 70%, rgba(0,80,180,0.15) 0%, transparent 55%), radial-gradient(ellipse 40% 35% at 55% 90%, rgba(100,180,220,0.1) 0%, transparent 50%), #010810"},
];

const SEASON_CONSTS = {
  spring:["leo","ursaMajor","virgo","bootes","cancer","coronaBorealis"],
  summer:["scorpius","cygnus","lyra","aquila","hercules","delphinus"],
  autumn:["pegasus","andromeda","cassiopeia","perseus","aries"],
  winter:["orion","taurus","gemini","canisMajor","auriga","canisMinor"],
};

const SKY_POS = {
  spring:{leo:{az:180,alt:58},ursaMajor:{az:18,alt:72},virgo:{az:148,alt:35},bootes:{az:98,alt:44},cancer:{az:215,alt:58},coronaBorealis:{az:82,alt:52}},
  summer:{scorpius:{az:182,alt:22},cygnus:{az:55,alt:65},lyra:{az:78,alt:74},aquila:{az:142,alt:50},hercules:{az:82,alt:65},delphinus:{az:118,alt:50}},
  autumn:{pegasus:{az:175,alt:62},andromeda:{az:42,alt:65},cassiopeia:{az:358,alt:76},perseus:{az:22,alt:62},aries:{az:138,alt:48}},
  winter:{orion:{az:175,alt:48},taurus:{az:210,alt:58},gemini:{az:140,alt:70},canisMajor:{az:162,alt:28},auriga:{az:242,alt:70},canisMinor:{az:148,alt:38}},
};

// 월별 서울 22:00 기준 관측 가능한 별자리 (고도 10° 이상)
const MONTHLY_VISIBLE = {
  1: ["orion","taurus","gemini","auriga","canisMajor","canisMinor","cancer","ursaMajor","cassiopeia","perseus","aries"],
  2: ["orion","taurus","gemini","auriga","canisMajor","canisMinor","cancer","leo","ursaMajor","cassiopeia","bootes"],
  3: ["gemini","taurus","auriga","cancer","leo","ursaMajor","virgo","bootes","cassiopeia","orion","canisMajor","canisMinor"],
  4: ["leo","virgo","bootes","cancer","ursaMajor","coronaBorealis","hercules","cassiopeia","gemini"],
  5: ["leo","virgo","bootes","coronaBorealis","hercules","ursaMajor","cassiopeia","scorpius"],
  6: ["scorpius","lyra","cygnus","aquila","hercules","bootes","virgo","ursaMajor","cassiopeia"],
  7: ["scorpius","lyra","cygnus","aquila","hercules","delphinus","cassiopeia","ursaMajor"],
  8: ["scorpius","lyra","cygnus","aquila","hercules","delphinus","pegasus","cassiopeia"],
  9: ["cygnus","lyra","aquila","delphinus","pegasus","andromeda","cassiopeia","aries"],
  10: ["pegasus","andromeda","cassiopeia","perseus","aries","cygnus","aquila"],
  11: ["pegasus","andromeda","cassiopeia","perseus","aries","taurus","auriga"],
  12: ["orion","taurus","gemini","auriga","canisMajor","cassiopeia","perseus","andromeda","aries"],
};

// 행성 현재 위치 (2026년 3월 서울 22:00 기준 근사값)
const PLANETS_NOW = [
  {name:"금성 ♀", nameEng:"Venus",   az:260, alt:12, color:"#FFFDE0", size:6, desc:"새벽 동쪽 지평선. '샛별' — 일출 1~2시간 전 가장 밝음. 밤 관측 시간대엔 안 보입니다."},
  {name:"목성 ♃", nameEng:"Jupiter", az:232, alt:38, color:"#FFD580", size:5, desc:"쌍둥이자리 안! 폴룩스 근처에서 가장 밝게 빛남. 도심에서도 맨눈으로 선명."},
  {name:"화성 ♂", nameEng:"Mars",    az:195, alt:52, color:"#FF6B4A", size:4, desc:"게자리 근처. 붉은빛으로 구별 가능. 현재 역행 중."},
  {name:"토성 ♄", nameEng:"Saturn",  az:270, alt:8,  color:"#F0E68C", size:4, desc:"새벽 동쪽 극저고도. 금성보다 먼저 뜸. 3월엔 관측 어려움 — 5월부터 본격 가능."},
];

// ── 추가 학습 데이터 ── smallTalk / starSpecs / mythFull
// 기존 CONST_DATA에 Object.assign으로 조용히 병합
const EXTRA_DATA = {
  leo:{
    mythFull:"헤라클레스의 첫 번째 과업. 네메아 계곡을 공포에 떨게 한 이 사자는 어떤 무기로도 상처 입힐 수 없는 황금 가죽을 가지고 있었어요. 화살도, 창도, 칼도 튕겨나갔습니다. 결국 헤라클레스는 맨손으로 사자의 목을 조르는 방법을 택했습니다. 처치 후 황금 가죽을 벗겨 갑옷으로 입었는데, 이게 이후 헤라클레스의 트레이드마크가 됐어요. 제우스는 아들의 첫 과업 성공을 기려 사자를 하늘에 올렸습니다.",
    smallTalk:["레굴루스는 자전이 너무 빨라서 완벽한 구가 아닌 럭비공 모양이에요. 극보다 적도가 30% 더 부풀어 있어요 🏉","M66 은하는 이웃 은하 중력에 잡아당겨져 나선팔이 한쪽으로 비틀려 있어요. 우주 충돌의 흔적이 그대로!","레굴루스는 황도 바로 위에 있어서 달이 1년에 한 번 가리는 '달 엄폐' 현상을 볼 수 있어요","11월 사자자리 유성우는 33년마다 폭풍처럼 쏟아집니다. 1833년엔 시간당 10만 개가 떨어졌대요"],
    starSpecs:{"레굴루스":{dist:79,temp:12460,type:"B7V",radius:3.1,mag:1.40,note:"자전 주기 15.9시간. 너무 빨리 돌아 납작한 모양"},"데네볼라":{dist:36,temp:8720,type:"A3V",radius:1.73,mag:2.14,note:"행성 형성 가능성 있는 먼지 원반 보유"},"알기에바":{dist:130,temp:4470,type:"K0III",radius:23,mag:2.61,note:"황금+황록색 아름다운 이중성. 공전 주기 510년"}},
  },
  ursaMajor:{
    mythFull:"님프 칼리스토는 아르테미스를 따르는 순결 서약 집단의 일원이었어요. 제우스가 아르테미스로 변장해 접근한 탓에 아이를 임신하게 됩니다. 질투한 헤라가 칼리스토를 곰으로 만들어버렸어요. 수십 년 후 사냥꾼이 된 아들 아르카스가 자신의 어머니인 줄 모르고 창을 던지려는 순간, 제우스가 둘 다 하늘에 올려 큰곰·작은곰자리로 만들었습니다. 헤라는 이에도 화가 나서 '절대 바다에서 쉬지 못하게' 저주를 내렸고, 그래서 북두칠성은 서울에서 일 년 내내 지지 않는 주극성이 되었습니다.",
    smallTalk:["북두칠성 7별 중 5별은 같은 성단 소속! 두베·알카이드만 다른 거리에 있는 우연의 일치예요","미자르 바로 옆 알코르는 고대 로마 군대 시력 검사별. 맨눈으로 분리해 보이면 합격!","M81·M82는 1200만 광년 밖인데 쌍안경으로 보여요. 그게 얼마나 밝은 은하인지!","국자 끝 두 별에서 5배 연장하면 북극성 — 이 방법 하나로 어디서든 북쪽을 찾아요"],
    starSpecs:{"두베":{dist:123,temp:4660,type:"K0III",radius:17.0,mag:1.79,note:"오렌지 거성. 실제 이중성 시스템"},"미자르":{dist:78,temp:9000,type:"A2V",radius:2.4,mag:2.23,note:"세계 최초로 발견된 이중성 (1650년)"},"알카이드":{dist:104,temp:15400,type:"B3V",radius:3.4,mag:1.86,note:"국자 끝. 북두칠성 중 가장 뜨거운 별"}},
  },
  virgo:{
    mythFull:"처녀자리에는 두 신화가 겹칩니다. 첫째는 정의의 여신 아스트라이아. 황금 시대엔 신들이 인간과 함께 살았는데, 인간이 타락하자 하나둘 올림포스로 떠났어요. 아스트라이아가 마지막까지 남았다가 결국 하늘의 처녀자리가 되었습니다. 손에 든 저울이 옆의 천칭자리입니다. 둘째는 페르세포네. 곡물의 여신 데메테르의 딸이 하데스에게 납치되어 명계로 끌려가는 동안, 슬픔에 잠긴 데메테르가 곡물 자라게 하기를 거부해 겨울이 생겼습니다. 처녀자리가 뜨는 봄에 페르세포네가 돌아와 꽃이 피고, 지는 가을에 다시 명계로 내려가 겨울이 시작됩니다.",
    smallTalk:["처녀자리 방향에 은하 1300개 이상이 밀집한 처녀자리 은하단이 있어요. 우주에서 가장 가까운 거대 은하단!","M87은 2019년 인류 최초 블랙홀 사진을 찍은 그 은하예요. 이벤트 호라이즌 망원경 프로젝트 결과물","스피카는 두 별이 너무 가까이 붙은 분광쌍성 — 4일에 한 번 공전. 망원경으로도 분리 불가","스피카 덕분에 기원전 2세기 히파르코스가 분점 세차 운동을 발견했어요"],
    starSpecs:{"스피카":{dist:250,temp:22400,type:"B1V",radius:7.3,mag:1.04,note:"분광쌍성. 4.01일 공전. 두 별이 너무 가까워 서로 타원형으로 찌그러짐"}},
  },
  bootes:{
    mythFull:"아르크투루스는 '곰의 수호자'라는 뜻으로, 큰곰자리를 몰고 다니는 목동입니다. 가장 유명한 이야기는 이카리오스. 디오니소스에게 포도주 만드는 법을 전수받아 마을 사람들에게 나눠줬는데, 취한 적 없던 마을 사람들이 독약인 줄 알고 이카리오스를 죽였습니다. 그의 딸 에리고네가 아버지의 시신을 찾아 헤매다 목을 매 죽었고, 제우스가 부녀를 불쌍히 여겨 하늘에 올렸습니다. 에리고네가 처녀자리, 이카리오스가 목동자리, 그의 사냥개가 큰개자리라는 이야기도 있어요.",
    smallTalk:["아르크투루스는 우리 은하 헤일로 별 — 나머지 겨울 별들과 다른 방향으로 이동 중인 우주 방문자","1933년 시카고 세계박람회 개막을 아르크투루스 빛을 모아 점화했어요. '40년 전 박람회의 빛이 도착'이라는 연출!","약 500만 년 후 아르크투루스는 맨눈으로 안 보일 정도로 멀어져요. 별도 여행 중이에요","북반구에서 태양 다음으로 가장 밝게 보이는 별 (시리우스는 남쪽에서 더 높이 뜸)"],
    starSpecs:{"아르크투루스":{dist:37,temp:4286,type:"K1.5III",radius:25.4,mag:-0.05,note:"태양 직경의 25배. 초속 122km로 태양계를 스쳐 지나는 중"}},
  },
  scorpius:{
    mythFull:"오리온과 전갈은 영원한 숙적입니다. 자만심이 극에 달한 사냥꾼 오리온이 '세상 모든 동물을 다 잡겠다'고 큰소리치자, 대지의 여신 가이아가 전갈을 보내 처치했습니다. 또 다른 버전에서는 아폴론이 아르테미스를 꾀어 오리온을 쏘게 만들었습니다. 어느 쪽이든 결말은 같아요. 제우스는 이 둘이 하늘에서 마주치지 않도록 정반대편에 배치했습니다. 전갈이 동쪽에서 뜨면 오리온은 서쪽으로 집니다. 계절이 바뀌듯, 두 숙적은 영원히 번갈아 하늘을 지킵니다.",
    smallTalk:["안타레스(Antares)는 '화성의 라이벌'이라는 뜻. 색과 밝기가 비슷해 고대인들이 자주 헷갈렸어요","안타레스가 지금 폭발하면? 낮에도 보이는 밝기로 몇 주간 빛납니다. 그리고 중성자성이 남아요. 언제냐고요? 수십만 년 내 '언젠가'예요","안타레스 반지름은 태양의 700배. 태양 자리에 놓으면 화성 궤도까지 삼켜버려요","M4 구상성단은 지구에서 가장 가까운 구상성단. 7200광년 — 구상성단치고 코앞!"],
    starSpecs:{"안타레스":{dist:550,temp:3400,type:"M1.5Iab",radius:700,mag:1.09,note:"초신성 폭발 임박 후보 (수십만 년 내). 태양 700배 크기"}},
  },
  cygnus:{
    mythFull:"백조자리에는 두 이야기가 얽혀 있습니다. 첫째는 제우스 변신설. 제우스가 스파르타 왕비 레다에게 접근하기 위해 백조로 변신했고, 이 결합에서 태어난 알에서 쌍둥이 카스토르·폴룩스와 트로이 전쟁의 원인 헬레네가 나왔습니다. 둘째는 파에톤의 친구 퀴크노스. 태양신의 아들 파에톤이 마차를 몰다 지구를 불태울 위기에 처하자 제우스가 번개로 쳐 강에 빠뜨렸습니다. 친구 퀴크노스가 강에서 시신을 찾아 슬피 울며 잠수를 반복하다 목이 길어지고 하얗게 변해 백조가 됐습니다.",
    smallTalk:["데네브는 2600광년 거리인데도 1등성! 광도가 태양의 20만 배예요. 시리우스 거리에 있었다면 보름달만큼 밝았을 거예요 😱","백조자리 안에 최초로 발견된 블랙홀 후보 '백조자리 X-1'이 있어요. 1964년 X선 망원경이 잡아낸 강력한 X선 방출원","알비레오(부리)는 황금색+청색의 이중성. 색대비가 너무 아름다워서 '가을 밤하늘의 보석'이라 불려요","은하수가 백조자리를 정통으로 가로질러요. 폰을 들고 은하수 방향 확인해보세요"],
    starSpecs:{"데네브":{dist:2600,temp:8525,type:"A2Ia",radius:203,mag:1.25,note:"광도 태양의 20만 배. 정확한 거리 측정이 어려운 별"},"알비레오":{dist:430,temp:4270,type:"K3II+B",radius:17,mag:3.18,note:"황금+청색 이중성. 실제 물리적 쌍성인지 여전히 논란"}},
  },
  lyra:{
    mythFull:"오르페우스는 음악의 신 아폴론의 아들. 그의 리라 연주는 강물을 멈추게 하고 나무가 걸어오게 할 만큼 신비로웠습니다. 사랑하는 에우리디케가 뱀에 물려 죽자, 오르페우스는 산 채로 지하세계로 내려가 연주했습니다. 죽은 영혼들이 멈춰 서고, 하데스와 페르세포네도 눈물을 흘렸습니다. '지상에 나갈 때까지 절대 뒤를 돌아보지 말라'는 조건으로 에우리디케를 돌려받았지만, 출구 바로 앞에서 오르페우스는 결국 뒤를 돌아보고 말았습니다. 에우리디케는 다시 명계로 사라졌고, 오르페우스는 남은 생을 슬픔 속에 보냈습니다.",
    smallTalk:["베가는 약 12,000년 후 북극성이 됩니다. 지구 자전축 세차 운동으로 북극성은 2만 6천 년 주기로 바뀌어요","M57 반지성운은 태양 같은 별의 최후. 중심 백색왜성이 내뿜은 가스 껍데기예요. 우리 태양도 50억 년 후엔 이 모습","베가는 1850년 인류 역사상 처음으로 사진 찍힌 별이에요. 천체 사진의 원조!","1983년 IRAS 위성이 베가 주변 먼지 원반 발견 — 행성 형성 중인 증거. '베가 현상'이라는 용어가 생겼어요"],
    starSpecs:{"베가":{dist:25,temp:9602,type:"A0Va",radius:2.36,mag:0.03,note:"12,000년 후 북극성 후보. 먼지 원반 보유 = 행성 가능성"}},
  },
  aquila:{
    mythFull:"독수리자리의 알타이르는 한국 칠석 전설의 견우성. 은하수 건너편 직녀성(베가)을 그리워하는 주인공입니다. 그리스 신화에서 독수리는 제우스의 사자. 제우스가 트로이의 미소년 가니메데스를 올림포스로 데려오기 위해 독수리로 변하거나 독수리를 보냈습니다. 가니메데스는 신들의 술을 따르는 시종이 되었고, 이 모습이 물병자리입니다. 알타이르 양쪽의 두 별은 독수리가 날개를 펼친 3연성 모습으로 매우 독특합니다.",
    smallTalk:["알타이르는 자전 주기 9시간. 이 때문에 적도가 부풀어올라 납작 — 레굴루스와 같은 케이스","알타이르는 16.7광년으로 꽤 가까운 편. 맨눈 별 중에서 지구에서 가까운 축에 속해요","칠석에 은하수가 갈라진다는 전설 — 여름 대삼각형 사이를 실제 은하수 띠가 가로질러요","알타이르는 간섭계 관측으로 납작한 모양을 직접 확인한 몇 안 되는 별이에요"],
    starSpecs:{"알타이르":{dist:17,temp:7670,type:"A7V",radius:1.79,mag:0.77,note:"자전 주기 9시간. 적도 반지름이 극보다 20% 더 큼"}},
  },
  orion:{
    mythFull:"오리온은 포세이돈의 아들로, 바다 위를 걸을 수 있는 거인 사냥꾼이었습니다. 사냥의 여신 아르테미스와 사랑에 빠졌는데, 아폴론이 이를 못마땅히 여겼습니다. 어느 날 아폴론이 아르테미스에게 '저기 바다의 점을 맞혀보라'고 꾀었습니다. 아르테미스는 자신도 모르게 오리온에게 화살을 쏘았고, 파도에 밀려온 시신을 보고서야 알았습니다. 아르테미스는 오리온을 하늘에 올려 기렸고, 사냥개 시리우스도 함께 올라갔습니다. 오리온이 지면 전갈이 뜨고 전갈이 지면 오리온이 떠요 — 제우스가 두 숙적을 영원히 엇갈리게 배치했습니다.",
    smallTalk:["베텔게우스 초신성 폭발하면 낮에도 보이는 밝기로 몇 주간! 근데 '임박'이 수십만 년 후일 수도 있어요","2019년 베텔게우스가 갑자기 어두워져서 천문학자들이 긴장했어요. 폭발 전조인 줄! 사실 먼지 구름과 표면 냉각이었습니다","M42 오리온 대성운은 420광년 거리에서 지금도 별이 만들어지는 현장이에요. 중심 트라페지움 4중성이 성운을 밝히고 있어요","삼태성(민타카·알닐람·알니타크)은 거의 정확히 일직선. 민타카는 천구 적도 위 — 정동·정서 방향의 기준점"],
    starSpecs:{"베텔게우스":{dist:700,temp:3500,type:"M2Iab",radius:900,mag:0.50,note:"초신성 임박 후보. 2019년 대감광 사건으로 전 세계 주목"},"리겔":{dist:860,temp:12100,type:"B8Ia",radius:78,mag:0.13,note:"광도 태양의 12만 배. 3중성계"},"알닐람":{dist:1340,temp:27000,type:"B0Ia",radius:42,mag:1.69,note:"삼태성 가운데. 셋 중 가장 멀고 밝음"}},
  },
  taurus:{
    mythFull:"황소자리는 제우스가 페니키아 공주 에우로파를 납치하기 위해 변신한 하얀 황소입니다. 에우로파가 꽃밭에서 유난히 온순하고 아름다운 하얀 황소에 마음이 끌려 등에 올라타자, 황소는 바다를 건너 크레타 섬으로 달아났습니다. 이 결합에서 크레타의 왕 미노스가 태어났고, 훗날 미노타우로스가 탄생하는 씨앗이 됩니다. 플레이아데스 7자매는 아틀라스의 딸들로, 오리온에게 쫓기다 비둘기로 변해 하늘로 올라갔습니다. 그 중 한 자매가 슬픔으로 숨었다는 전설 때문에 맨눈으로는 6개만 보인다고 해요.",
    smallTalk:["좀생이별(플레이아데스) 맨눈으로 몇 개 보이는지가 시력 테스트였어요. 평균 6개, 시력 좋으면 9개까지","M1 게성운은 1054년 중국·한국 역사서에 기록된 초신성 잔해예요. 낮에도 보였다고 기록돼 있어요!","알데바란은 히아데스 성단 방향에 있지만 성단 소속이 아니에요. 성단은 150광년, 알데바란은 65광년","황소자리 방향이 지구가 6월에 공전하는 방향. 우리는 황소자리를 향해 달리고 있어요"],
    starSpecs:{"알데바란":{dist:65,temp:3910,type:"K5III",radius:44,mag:0.85,note:"히아데스 성단 배경별. 오렌지 거성. 달이 자주 가리는 별"}},
  },
  gemini:{
    mythFull:"카스토르와 폴룩스는 반쪽짜리 쌍둥이입니다. 어머니 레다는 같은 날 밤 남편 스파르타 왕과 제우스(백조 변신)를 동시에 만났어요. 카스토르는 인간의 피를, 폴룩스는 신의 피를 받았습니다. 전투에서 카스토르가 죽자, 폴룩스는 제우스에게 불멸의 삶 절반을 나눠달라고 간청했습니다. 이후 둘은 하루씩 번갈아 올림포스와 하데스를 오가게 됐습니다. 항해자들의 수호신으로, 뱃머리에 나타나는 '세인트 엘모의 불'이 이 형제의 현현이라 믿었습니다.",
    smallTalk:["카스토르는 망원경으로 보면 쌍성인데, 사실 6개 별이 3쌍의 이중성으로 얽힌 6중성계예요!","폴룩스 주변에서 목성 크기 행성이 발견됐어요. 진짜 쌍둥이자리에 행성이 있는 셈","쌍둥이자리 유성우(제미니드)는 연중 가장 풍성. 12월 중순 시간당 최대 150개 쏟아져요","1930년 명왕성이 쌍둥이자리 근처에서 처음 발견됐어요. 클라이드 톰보가 사진 비교로 발견"],
    starSpecs:{"폴룩스":{dist:34,temp:4666,type:"K0IIIb",radius:9.1,mag:1.14,note:"행성 폴룩스 b 보유. 목성 2.3배 크기"},"카스토르":{dist:51,temp:8842,type:"A2Vm",radius:2.09,mag:1.58,note:"실제 6중성계. A·B·C 각각 이중성으로 총 6개 별"}},
  },
  canisMajor:{
    mythFull:"시리우스는 오리온의 충직한 사냥개입니다. 그리스인들은 시리우스가 7월에 태양과 함께 뜨는 시기를 '개의 날들(Dog Days)'이라 불렀어요. 이 시기의 폭염이 시리우스의 열 때문이라고 믿었죠. 이집트에서는 시리우스의 일출이 나일 강 범람의 신호였습니다. 범람은 이집트 농업의 생명선이었기에, 시리우스는 이집트 달력의 출발점이 되었습니다. 기자 대피라미드의 주요 통로가 시리우스를 향한다는 이론도 있어요. 동양에선 '천랑성(天狼星)' — 하늘의 이리로 불리며 전쟁의 흉조로 여겼습니다.",
    smallTalk:["시리우스에는 지구만 한 크기에 태양 질량인 백색왜성 동반성이 있어요. 숟가락 하나가 5톤!","'Dog Days of Summer' — 영어 관용어의 유래가 큰개자리 시리우스예요","시리우스는 앞으로 지구에 가까워지는 중. 약 6만 년 후엔 지금보다 더 밝아질 거예요","이집트 달력은 시리우스 기준이었어요. 나일강 범람 예측에 딱 맞아떨어졌죠"],
    starSpecs:{"시리우스":{dist:8.6,temp:9940,type:"A1V",radius:1.71,mag:-1.46,note:"전천 최밝은 별. 백색왜성 동반성 시리우스 B 보유"}},
  },
  auriga:{
    mythFull:"카펠라(Capella)는 라틴어로 '암염소'. 제우스가 아기 시절 크레타의 님프 아말테아의 염소 젖을 먹으며 자랐는데, 어느 날 장난치다 염소의 뿔을 부러뜨렸습니다. 미안한 마음에 뿔을 풍요의 뿔(코르누코피아)로 만들었고, 아말테아를 하늘의 별로 올렸습니다. 마차부자리의 주인공은 다리가 불편해 스스로 네 마리 말이 끄는 전차를 발명한 아테네 왕 에리크토니오스라는 설도 있어요. 제우스가 이 창의성에 감탄해 하늘에 올렸다는 이야기입니다.",
    smallTalk:["카펠라는 실제로 두 노란 거성이 서로를 도는 이중성. 각각 태양보다 8~10배 크고, 104일에 한 번 공전","M36·M37·M38 세 산개성단은 쌍안경으로 같은 시야에 볼 수 있어요. 겨울 최고의 세트 메뉴!","카펠라는 북위 44도 이상에선 연중 안 지는 주극성이에요. 서울(37.5도)에서는 아슬아슬하게 짧게 져요","카펠라 방향이 우리 은하 페르세우스 팔. 성간 가스 많아 젊은 별들이 많이 모여 있어요"],
    starSpecs:{"카펠라":{dist:43,temp:4970,type:"G3III+G8III",radius:10,mag:0.08,note:"두 노란 거성의 이중성. 104.02일 공전 주기"}},
  },
  cassiopeia:{
    mythFull:"카시오페이아는 에티오피아의 왕비. 딸 안드로메다가 바다 님프들보다 아름답다고 자랑하다 포세이돈의 분노를 샀습니다. 포세이돈이 바다 괴물을 보내 에티오피아를 유린했고, 신탁은 '안드로메다를 제물로 바쳐야 한다'고 했습니다. 페르세우스가 안드로메다를 구출한 뒤에도 카시오페이아의 벌은 끝나지 않았어요. 허영심의 대가로 하늘에서 의자에 묶인 채 북극성 주위를 돌며, 1년의 절반은 거꾸로 매달린 모습으로 지냅니다.",
    smallTalk:["1572년 카시오페이아에서 초신성 폭발! 티코 브라헤가 관측해 '티코의 별'이라 불렸어요. '하늘은 불변'이라는 아리스토텔레스 우주관에 균열을 낸 사건","W자가 M자로 바뀌는 건 하루 중 시간 때문이에요. 북극성 주위를 24시간에 한 바퀴 돌아요","NGC 457은 두 별이 ET의 눈처럼 보이는 'ET 성단'. 아이들과 관측할 때 가장 반응 좋은 대상","카시오페이아 방향은 우리 은하 중심 반대편 — 성간 가스 적어 멀리까지 관측 가능"],
    starSpecs:{"쉐다르":{dist:228,temp:4530,type:"K0IIa",radius:42,mag:2.24,note:"약한 변광성. 밝기가 미세하게 변함. K형 오렌지 초거성"}},
  },
  andromeda:{
    mythFull:"안드로메다는 에티오피아의 공주. 어머니 카시오페이아의 허영 때문에 바다 괴물에게 제물이 될 위기에 처했어요. 페르세우스가 구출했고 둘은 결혼했습니다. M31 안드로메다 은하는 약 250만 광년 거리로, 맨눈으로 볼 수 있는 가장 먼 천체입니다. 그런데 이 은하가 우리 은하와 충돌 코스에 있어요. 약 45억 년 후 두 은하가 합쳐져 거대한 타원은하가 됩니다. 천문학자들은 이를 '밀코메다(Milkomeda)'라 부릅니다. 다행히 별들이 직접 부딪힐 확률은 거의 0 — 별 사이 거리가 너무 멀어요.",
    smallTalk:["M31은 초속 약 120km로 우리 은하를 향해 달려오는 중. 45억 년 후 충돌!","맨눈으로 보이는 M31의 겉보기 크기는 보름달의 6배! 그런데 그게 밝은 핵만이에요. 실제론 훨씬 더 넓어요","안드로메다 은하는 우리 은하보다 별이 2~3배 더 많아요. 합쳐지면 어마어마한 은하 탄생!","M32·M110 두 위성은하가 M31을 돌고 있어요. 우리 은하의 대·소마젤란 은하와 같은 구도"],
    starSpecs:{"알페라츠":{dist:97,temp:9000,type:"B9p",radius:2.5,mag:2.06,note:"원래 페가수스와 공유하던 별. 두 별자리 경계 변경 역사"}},
  },
  perseus:{
    mythFull:"페르세우스는 제우스와 다나에의 아들. 외할아버지 아크리시오스 왕은 '손자에게 죽임 당한다'는 신탁을 받고 다나에를 청동 탑에 가뒀지만, 황금 비가 되어 들어온 제우스로 인해 페르세우스가 태어났습니다. 메두사를 처치할 때 아테나의 방패를 거울로 써 시선을 피했고, 헤르메스의 날개 달린 신발로 날아다녔습니다. 알골(Algol)은 아랍어로 '악마의 머리'로 메두사의 눈을 상징해요. 놀랍게도 고대 이집트 파피루스에 이미 알골의 밝기 변화가 기록돼 있었다는 사실이 최근 밝혀졌습니다.",
    smallTalk:["알골은 '식쌍성' — 두 별이 서로를 가리며 2.87일에 한 번 밝기가 절반 가까이 떨어져요. 며칠 간격으로 관측해보세요","NGC 869·884 이중 성단은 실제로 1000광년 거리에 두 성단이 나란히 있어요. 같은 시야에서 보이는 경이로운 장면","페르세우스 유성우(8월)는 핼리 혜성 부스러기. 8월 12~13일 새벽 시간당 100개 이상","메두사 피에서 페가수스가 탄생했어요. 부모 없이 피에서 태어난 천마"],
    starSpecs:{"미르파크":{dist:590,temp:6350,type:"F5Ib",radius:68,mag:1.80,note:"페르세우스 OB 성협의 알파별"},"알골":{dist:93,temp:12100,type:"B8V",radius:2.73,mag:2.12,note:"식쌍성. 2.867일 주기. 고대 이집트 달력에 이미 기록!"}},
  },
  cancer:{
    mythFull:"헤라클레스가 레르나의 히드라와 사투를 벌일 때, 헤라가 보낸 게가 헤라클레스의 발을 물었습니다. 헤라클레스는 거들떠보지도 않고 밟아 죽였지만, 헤라는 이 게의 충성심을 높이 사 하늘에 올렸어요. 황도 12궁 중 가장 어둡지만, 그 안에 숨어있는 M44 벌집성단은 고대부터 맨눈으로 희뿌옇게 보여 동양에서는 '적시기(積屍氣, 쌓인 시체의 기운)'라 불렸습니다. 날씨 예보에도 쓰였는데, 맑은 밤에 이 흐릿한 반점이 안 보이면 곧 비가 온다고 했어요.",
    smallTalk:["M44 벌집성단은 갈릴레오가 처음 망원경으로 관측해 40개 별을 분해했어요. 맨눈에는 뿌연 반점 하나","게자리가 황도 12궁에 들어간 건 기원전 2000년경 하지점이 이 자리에 있었기 때문. 지금은 세차 운동으로 밀려남","M67 산개성단은 나이가 약 40억 년 — 우리 태양(46억 년)과 비슷! 태양의 형제별이 여기 있을지도","북회귀선의 영어 'Tropic of Cancer'는 게자리에서 유래. 2000년 전 하지 때 태양이 게자리에 있었거든요"],
    starSpecs:{"알타르프":{dist:290,temp:3990,type:"K4III",radius:50,mag:3.53,note:"게자리 최밝은 별이지만 3.5등급. 황도 12궁 중 가장 어두운 별자리"}},
  },
  coronaBorealis:{
    mythFull:"디오니소스(바쿠스)가 낙소스 섬에서 버림받은 크레타 공주 아리아드네를 발견했습니다. 아리아드네는 미궁에 갇힌 테세우스에게 실타래를 줘서 미노타우로스를 죽이고 나오게 도왔는데, 정작 테세우스는 그녀를 섬에 두고 떠났어요. 디오니소스는 슬픔에 빠진 아리아드네에게 반해 결혼했고, 결혼 선물로 준 보석 왕관을 하늘에 올려 왕관자리가 되었습니다. C자 반원 모양의 별 7개가 그 왕관이에요. 동양에서는 관삭(貫索) — 감옥의 사슬을 의미했습니다.",
    smallTalk:["왕관자리 안에 '블레이즈 스타(T CrB)'라는 반복 신성이 있어요. 약 80년 주기로 갑자기 2등성까지 밝아짐","C자 모양 7별이 워낙 깔끔해서 별자리 찾기 연습용으로 최고. 아크투루스 옆에서 작은 반원을 찾으면 됨","왕관자리는 적경 15~16시에 밀집 — 봄~여름 전환기에 동쪽에서 보이기 시작","동양에서 관삭(감옥)의 별이 밝으면 사면, 어두우면 형벌이라 해석했어요"],
    starSpecs:{"알페카":{dist:75,temp:9700,type:"A0V",radius:2.9,mag:2.23,note:"식쌍성. 17.36일 주기로 미세한 밝기 변화"}},
  },
  hercules:{
    mythFull:"헤라클레스는 제우스와 인간 알크메네 사이에서 태어난 반신. 헤라의 질투로 광기에 빠져 자신의 아이들을 죽이고, 속죄를 위해 12과업을 받습니다. 네메아의 사자, 레르나의 히드라, 케리네이아의 사슴, 에리만토스의 멧돼지, 아우게이아스의 외양간, 스팀팔로스의 새, 크레타의 황소, 디오메데스의 식인마, 아마존의 허리띠, 게리온의 소, 헤스페리데스의 사과, 지옥의 케르베로스. 모두 완수한 후 올림포스에 올라 불멸의 존재가 됩니다. 하늘에서는 머리를 아래로 향한 채 무릎 꿇고 있는 모습이에요.",
    smallTalk:["M13은 30만 개 별이 뭉친 구상성단. 8인치로 외곽 별 분해 가능! 북반구 안시 최고 대상","1974년 아레시보 전파망원경에서 M13 방향으로 외계 문명에 메시지를 보냈어요. 도착까지 2만 5천 년","키스톤(사다리꼴) 4별의 한 변을 따라가면 M13 위치. 이 패턴만 외우면 찾기 쉬움","M92는 M13보다 오래된 구상성단(약 130억 년!). M13에 가려 유명하지 않지만 질적으로 꿀리지 않아요"],
    starSpecs:{"라스알게티":{dist:360,temp:3300,type:"M5III",radius:280,mag:3.37,note:"적색 거성+청록색 동반성의 아름다운 이중성. 색대비 관측 추천"}},
  },
  delphinus:{
    mythFull:"포세이돈이 바다 님프 암피트리테에게 구혼했지만 거절당했습니다. 돌고래 한 마리가 중재에 나서 암피트리테를 설득해 결혼이 성사됐고, 포세이돈이 감사해서 돌고래를 하늘에 올렸다는 이야기. 또 다른 전설에서는 음악가 아리온이 해적에게 바다에 던져졌을 때, 그의 리라 연주에 반한 돌고래가 등에 태워 구했다고 해요. 별 이름도 재미있는데, 수알로킨(Sualocin)과 로타네프(Rotanev)는 이탈리아 천문학자 Nicolaus Venator를 거꾸로 쓴 것이에요!",
    smallTalk:["수알로킨·로타네프 이름의 비밀 — 19세기 팔레르모 천문대의 니콜라우스 베나토르가 몰래 자기 이름을 라틴어로 거꾸로 넣어버림","여름 밤 알타이르 북동쪽에 작고 선명한 마름모가 돌고래 — 별자리 중 가장 귀여운 형태","돌고래자리 감마별은 쌍안경으로도 분리 가능한 이중성. 주황+백색 색대비","전체 별자리 88개 중 면적 69위로 작지만, 패턴이 뚜렷해서 찾으면 뿌듯한 별자리"],
    starSpecs:{"로타네프":{dist:97,temp:6500,type:"F5IV",radius:2.0,mag:3.63,note:"수알로킨과 함께 이름에 숨은 장난이 있는 별"}},
  },
  pegasus:{
    mythFull:"페가수스는 페르세우스가 메두사를 참수했을 때 흘린 피에서 태어난 천마입니다. 날개 달린 말은 자유롭게 하늘을 날다가 발굽으로 헬리콘 산을 차서 시인들에게 영감의 샘 히포크레네를 만들었어요. 영웅 벨레로폰이 아테나에게 받은 황금 굴레로 페가수스를 길들여 키마이라를 물리쳤습니다. 하지만 자만해진 벨레로폰이 올림포스로 날아오르자 제우스가 등에 올라붙어 떨어뜨렸고, 페가수스만 올림포스에 올라 하늘의 별이 됩니다. '가을의 대사각형'이 페가수스의 몸통이에요.",
    smallTalk:["가을의 대사각형 안에 밝은 별이 거의 없어요. 사각형 안이 텅 비어있으면 맞게 찾은 거","M15는 중심이 극도로 밀집된 '핵 붕괴' 구상성단. 중심부에 블랙홀이 있을 수 있다는 연구도","대사각형 한 변이 약 15° — 주먹을 쭉 뻗었을 때 주먹 폭이 약 10°니까 주먹 1.5개 크기!","알페라츠는 원래 페가수스에 속했는데 1930년 IAU가 안드로메다로 넘겼어요. 두 별자리의 공유별"],
    starSpecs:{"에니프":{dist:690,temp:3650,type:"K2Ib",radius:185,mag:2.39,note:"페가수스 코끝의 주황 초거성. 불규칙 변광성"}},
  },
  aries:{
    mythFull:"양자리의 주인공은 황금 양모를 가진 크리소말로스. 보이오티아의 왕자 프릭소스와 공주 헬레가 계모의 음모로 제물이 될 위기에 처했을 때, 구름의 여신 네펠레가 황금 날개 양을 보냈습니다. 양은 남매를 등에 태우고 날아갔지만 헬레는 바다(헬레스폰토스, 지금의 다르다넬스 해협)에 빠져 죽었고, 프릭소스만 콜키스에 도착합니다. 프릭소스가 양을 제우스에게 바치고 양털을 나무에 걸어둔 것이 이아손과 아르고나우타이 원정의 목표 — 황금 양모입니다.",
    smallTalk:["춘분점이 기원전 2000년경 양자리에 있어서 황도의 시작점이 됐어요. 지금은 물고기자리로 이동","감마별 메사르팀은 같은 밝기(4.8등) 이중성. 작은 망원경으로 분리하면 쌍둥이 보석 같아요","양자리는 별이 어둡고(2~4등) 패턴이 단순해서 찾기 어려운 편. 안드로메다와 황소 사이 공백에서 찾을 것","아랍어로 '하말(Hamal)'은 양의 머리라는 뜻. 하말은 항해 시대 중요한 항법 별이었어요"],
    starSpecs:{"하말":{dist:66,temp:4480,type:"K2III",radius:15,mag:2.00,note:"오렌지 거성. 2011년 목성 크기 행성 발견"}},
  },
  canisMinor:{
    mythFull:"작은개자리는 오리온의 두 사냥개 중 작은 쪽입니다. 프로키온(Procyon)은 그리스어로 '개 앞에 뜨는 별'이라는 뜻 — 시리우스보다 먼저 떠오르기 때문이에요. 또 다른 전설에서는 이카리오스(목동자리)의 충직한 개 마이라. 주인이 살해당한 후 시신을 찾아 헤매다 슬퍼 죽었고, 제우스가 하늘에 올렸다는 이야기입니다. 프로키온과 시리우스를 잇는 선 위에 베텔게우스를 놓으면 겨울 대삼각형이 완성됩니다.",
    smallTalk:["프로키온은 시리우스와 마찬가지로 백색왜성 동반성이 있어요. 프로키온 B — 관측 극난이도","11.4광년 거리로 태양에서 매우 가까운 별. 밤하늘에서 8번째로 밝아요","겨울 대육각형 6개 꼭짓점 중 하나이면서 겨울 대삼각형의 한 꼭짓점. 겨울의 교차로 역할","프로키온+고메이사 딱 두 별이 전부. 88개 별자리 중 가장 단순한 축에 속해요"],
    starSpecs:{"프로키온":{dist:11.4,temp:6530,type:"F5IV-V",radius:2.05,mag:0.34,note:"백색왜성 동반성 보유. 태양계에서 7번째로 가까운 항성계"}},
  },
};
Object.keys(EXTRA_DATA).forEach(id => {
  if (CONST_DATA[id]) Object.assign(CONST_DATA[id], EXTRA_DATA[id]);
});

// 도심 가시성: 서울 도심(광해 심한 곳) 기준 관측 난이도
// urban: 맨눈 가능 / suburban: 근교 필요 / dark: 어두운 곳 필요
const URBAN_VIS = {
  // 밝기 -2~1등성: 도심 맨눈
  canisMajor:"urban", orion:"urban", bootes:"urban", lyra:"urban",
  auriga:"urban", gemini:"urban", taurus:"urban", scorpius:"urban",
  virgo:"urban", ursaMajor:"urban", aquila:"urban", cygnus:"urban",
  canisMinor:"urban", leo:"urban", cassiopeia:"urban", andromeda:"suburban",
  // 2~3등성 별자리
  perseus:"suburban", pegasus:"suburban", hercules:"suburban",
  coronaBorealis:"suburban", aries:"suburban", cancer:"suburban",
  delphinus:"dark",
};
const URBAN_LABELS = {urban:"🏙️ 도심 가능", suburban:"🌆 근교 추천", dark:"🌲 어두운 곳"};
const URBAN_COLORS = {urban:"#7EE8C8", suburban:"#FFD166", dark:"#F4845F"};

// 시간대별 방위각 보정 — 22:00 기준, 1시간 = 지구 자전 15°
// 별은 동→서로 이동 (방위각 증가)
function getTimedPos(baseAz, baseAlt, obsHour) {
  const hourOffset = obsHour - 22; // 22:00 기준
  const azShift = hourOffset * 15;
  // 고도는 남중 전후로 대칭 변화 (단순 근사: 남쪽 별은 시간에 따라 고도 변함)
  const newAz = (baseAz + azShift + 360) % 360;
  // 고도 보정: 남쪽(az≈180) 별은 자오선 통과 전후로 고도 변화
  const altDelta = -Math.abs(hourOffset) * 2.5;
  const newAlt = Math.max(5, baseAlt + altDelta);
  return { az: newAz, alt: newAlt };
}

/* ── 월령 계산기 (Synodic Month) ──
   기준 신월: 2000-01-06T18:14 UTC
   삭망 주기: 29.53059일
   API 불필요 — 순수 수학 공식 */
function getMoonPhase(date = new Date()) {
  const REF_NEW_MOON = new Date('2000-01-06T18:14:00Z').getTime();
  const SYNODIC = 29.53059;
  const daysSinceRef = (date.getTime() - REF_NEW_MOON) / 86400000;
  const phase = ((daysSinceRef % SYNODIC) + SYNODIC) % SYNODIC; // 0~29.53
  const pct = Math.round((phase / SYNODIC) * 100);
  const illum = Math.round((1 - Math.cos(2 * Math.PI * phase / SYNODIC)) / 2 * 100);
  let name, emoji, tip;
  if (phase < 1.85)       { name="신월(그믐)"; emoji="🌑"; tip="달빛 없음! 딥스카이 최적의 밤"; }
  else if (phase < 7.38)  { name="초승달"; emoji="🌒"; tip="저녁에 짧게 보이고 일찍 짐. 자정 이후 관측 좋음"; }
  else if (phase < 11.07) { name="상현달"; emoji="🌓"; tip="밤 전반부 밝음. 자정 이후 딥스카이 가능"; }
  else if (phase < 14.76) { name="상현망간"; emoji="🌔"; tip="밤 대부분 달빛. 밝은 별·행성 위주 관측"; }
  else if (phase < 16.61) { name="보름달"; emoji="🌕"; tip="밤새 밝음. 달 관측 자체는 최적!"; }
  else if (phase < 22.15) { name="하현망간"; emoji="🌖"; tip="늦게 뜸. 저녁~자정 관측 괜찮음"; }
  else if (phase < 25.84) { name="하현달"; emoji="🌗"; tip="자정 이후 뜸. 저녁 관측 좋음"; }
  else if (phase < 27.69) { name="그믐달"; emoji="🌘"; tip="새벽에만 보임. 저녁 관측 최적!"; }
  else                    { name="신월 직전"; emoji="🌑"; tip="달빛 거의 없음! 관측 적기"; }
  return { phase, pct, illum, name, emoji, tip, age: Math.floor(phase) };
}

/* ── 달 하늘 위치 추정기 ──
   월령(phase)과 관측시간으로 달의 대략적인 방위각/고도 계산
   서울 37.5°N 기준. 정밀 천문 계산이 아닌 시각적 표시용 근사 */
function getMoonSkyPosition(obsHour, moonPhase) {
  // 달 남중 시각: 신월=12시, 보름달=0시
  const transitHour = (12 + (moonPhase / 29.53) * 24) % 24;
  // 관측 시각과 남중 시각의 차이 (시간각)
  let ha = obsHour >= 24 ? obsHour - 24 : obsHour;
  let diff = ha - transitHour;
  if (diff > 12) diff -= 24;
  if (diff < -12) diff += 24;
  // 고도: 남중 시 최대 ~55°, 시간각에 따라 감소
  const maxAlt = 52 + Math.sin(moonPhase / 29.53 * 2 * Math.PI) * 8;
  const alt = maxAlt * Math.cos(diff * Math.PI / 6.5);
  // 방위각: 남중=180°(남), 동쪽에서 떠서 서쪽으로 짐
  let az;
  if (diff <= 0) az = 180 + diff * 15;  // 동→남
  else az = 180 + diff * 15;            // 남→서
  az = ((az % 360) + 360) % 360;
  return { az, alt: Math.round(alt), visible: alt > 5 };
}

/* ── 박명(薄明) 계산기 ──
   서울 37.5°N 기준 천문박명 종료 시각 (태양 고도 -18°)
   월별 고정 근사값 (매년 거의 동일) */
const TWILIGHT_TABLE = {
  1: {astEnd:"18:20",astStart:"05:10",note:"겨울. 6시 반이면 충분히 어두움"},
  2: {astEnd:"18:50",astStart:"05:00",note:"일몰 후 1시간 반이면 관측 시작"},
  3: {astEnd:"19:20",astStart:"04:40",note:"봄 전환기. 7시 반부터 관측 가능"},
  4: {astEnd:"19:55",astStart:"04:10",note:"날이 길어짐. 8시부터 본격 관측"},
  5: {astEnd:"20:25",astStart:"03:40",note:"늦은 일몰. 8시 반 이후 관측"},
  6: {astEnd:"20:50",astStart:"03:20",note:"여름. 9시 가까이 되어야 어두워짐"},
  7: {astEnd:"20:45",astStart:"03:25",note:"여름 피크. 관측 시작이 늦어짐"},
  8: {astEnd:"20:15",astStart:"03:50",note:"8시 반부터 서서히 어두워짐"},
  9: {astEnd:"19:35",astStart:"04:25",note:"가을. 7시 반이면 관측 가능"},
  10:{astEnd:"18:55",astStart:"04:55",note:"일찍 어두워짐. 7시부터 관측"},
  11:{astEnd:"18:25",astStart:"05:15",note:"겨울 접근. 6시 반부터 관측"},
  12:{astEnd:"18:10",astStart:"05:20",note:"가장 긴 밤. 관측 시간 최대"},
};

/* ── 이중성·변광성 관측 챌린지 ── */
const OBS_CHALLENGES = [
  {name:"알비레오 이중성",constellation:"백조자리",type:"이중성",color:"#FFD166",
    diff:"★☆☆",desc:"황금색+청색 대비. 북반구 최고 아름다운 이중성. 저배율 50×으로도 분리.",season:"summer"},
  {name:"미자르-알코르",constellation:"큰곰자리",type:"시력·이중성",color:"#7EE8C8",
    diff:"★☆☆",desc:"맨눈 분리 도전(시력 검사!). 미자르 자체도 이중성 — 망원경으로 두 번 분리.",season:"spring"},
  {name:"알골 변광성",constellation:"페르세우스자리",type:"식변광성",color:"#F4845F",
    diff:"★★☆",desc:"2.867일 주기. 극소 시 3.4등→2.1등. 며칠 간격 관측 프로젝트.",season:"autumn",
    period:"2.867일",minMag:3.4,maxMag:2.12},
  {name:"알기에바 이중성",constellation:"사자자리",type:"이중성",color:"#7EE8C8",
    diff:"★★☆",desc:"황금+황록색 이중성. 공전 주기 510년. 100× 이상으로 분리.",season:"spring"},
  {name:"감마 안드로메다 이중성",constellation:"안드로메다자리",type:"이중성",color:"#F4845F",
    diff:"★★☆",desc:"주황+청록색 대비. 알마크(Almach). 가을 밤의 보석.",season:"autumn"},
  {name:"메사르팀 이중성",constellation:"양자리",type:"이중성",color:"#F4845F",
    diff:"★★☆",desc:"같은 밝기(4.8등) 쌍둥이 이중성. 저배율로 깔끔하게 분리.",season:"autumn"},
  {name:"라스알게티 이중성",constellation:"헤르쿨레스자리",type:"이중성",color:"#FFD166",
    diff:"★★★",desc:"적색 거성+청록색 동반성. 색대비가 극적이지만 밝기 차이 커서 도전적.",season:"summer"},
  {name:"카스토르 삼중성",constellation:"쌍둥이자리",type:"다중성",color:"#89CFF0",
    diff:"★★★",desc:"실제 6중성계! 망원경으로 A·B 분리 → 고배율로 C까지 도전.",season:"winter"},
];

/* ── 별자리 간 스토리 연결 ── */
const STORY_LINKS = {
  perseus: [{id:"andromeda",rel:"구출한 공주 → 결혼"},{id:"pegasus",rel:"메두사에서 탄생"},{id:"cassiopeia",rel:"장모 카시오페이아"}],
  andromeda: [{id:"perseus",rel:"구출해준 영웅"},{id:"cassiopeia",rel:"어머니"},{id:"pegasus",rel:"대사각형 공유별"}],
  cassiopeia:[{id:"andromeda",rel:"딸"},{id:"perseus",rel:"사위"}],
  pegasus:   [{id:"perseus",rel:"메두사 피에서 탄생"},{id:"andromeda",rel:"대사각형 공유별"}],
  orion:     [{id:"scorpius",rel:"영원한 숙적"},{id:"canisMajor",rel:"사냥개"},{id:"canisMinor",rel:"작은 사냥개"},{id:"taurus",rel:"이웃 사냥감"}],
  scorpius:  [{id:"orion",rel:"영원한 숙적 — 동시에 안 보임"}],
  canisMajor:[{id:"orion",rel:"주인 오리온"},{id:"canisMinor",rel:"동료 사냥개"}],
  canisMinor:[{id:"orion",rel:"주인 오리온"},{id:"canisMajor",rel:"동료 사냥개"},{id:"bootes",rel:"이카리오스의 개 마이라 설"}],
  gemini:    [{id:"cygnus",rel:"레다의 아들들 (백조 제우스)"},{id:"lyra",rel:"헬레네 → 트로이 → 전쟁"}],
  cygnus:    [{id:"gemini",rel:"레다와 백조 → 쌍둥이 탄생"},{id:"lyra",rel:"여름 대삼각형"},{id:"aquila",rel:"여름 대삼각형"}],
  lyra:      [{id:"cygnus",rel:"여름 대삼각형"},{id:"aquila",rel:"칠석 — 직녀+견우"}],
  aquila:    [{id:"lyra",rel:"칠석 — 견우+직녀"},{id:"cygnus",rel:"여름 대삼각형 + 오작교"}],
  hercules:  [{id:"leo",rel:"첫 번째 과업 — 네메아 사자"},{id:"cancer",rel:"히드라 전투 중 게 등장"}],
  leo:       [{id:"hercules",rel:"첫 번째 과업의 사자"}],
  cancer:    [{id:"hercules",rel:"히드라 전투 중 헤라가 보냄"}],
  virgo:     [{id:"bootes",rel:"봄의 대곡선으로 연결"}],
  bootes:    [{id:"virgo",rel:"봄의 대곡선"},{id:"ursaMajor",rel:"곰을 쫓는 사냥꾼"},{id:"coronaBorealis",rel:"하늘 위 이웃"}],
  ursaMajor: [{id:"bootes",rel:"쫓기는 곰"},{id:"cassiopeia",rel:"북극성 반대편"}],
  coronaBorealis:[{id:"bootes",rel:"하늘 위 이웃"}],
  taurus:    [{id:"orion",rel:"하늘 위 이웃"},{id:"aries",rel:"황도 이웃"}],
  aries:     [{id:"taurus",rel:"황도 이웃"}],
  auriga:    [{id:"taurus",rel:"겨울 하늘 이웃 — 엘나트 공유"}],
};

/* ── 동양 28수 (二十八宿) 전체 데이터 ──
   4방(四方) × 7수(七宿) = 28수
   각 수: 이름, 한자, 대표별(서양), 서양 별자리, 의미, 계절, 방위도 위치(서울 22:00 춘분 기준 근사) */
const QUADRANTS = [
  {id:"east",name:"동방 청룡",hanja:"東方青龍",symbol:"🐉",color:"#7EE8C8",
    desc:"봄 하늘을 지배하는 청룡 7수. 용의 뿔(각)에서 시작해 꼬리(기)까지 이어집니다.",
    season:"spring"},
  {id:"north",name:"북방 현무",hanja:"北方玄武",symbol:"🐢",color:"#89CFF0",
    desc:"겨울 하늘의 거북+뱀. 두(국자)에서 시작해 벽(궁벽)으로 끝나는 7수.",
    season:"winter"},
  {id:"west",name:"서방 백호",hanja:"西方白虎",symbol:"🐅",color:"#F4845F",
    desc:"가을 하늘의 백호. 규(다리)에서 삼(삼태성)까지. 오리온 허리띠가 삼수!",
    season:"autumn"},
  {id:"south",name:"남방 주작",hanja:"南方朱雀",symbol:"🦅",color:"#FFD166",
    desc:"여름 하늘의 붉은 새. 정(우물)에서 진(수레)까지 7수가 이어집니다.",
    season:"summer"},
];
const TWENTY_EIGHT_SU = [
  // ── 동방 청룡 (봄) ──
  {num:1, name:"각",hanja:"角宿",quad:"east",stars:2,mainStar:"스피카 (α Vir)",
    western:"처녀자리",meaning:"용의 뿔. 봄의 시작을 알리는 별.",
    detail:"각수일(角宿一)이 스피카. 봄의 대곡선 끝점이자 동양 천문의 기준점 중 하나.",
    az:148,alt:35,appId:"virgo"},
  {num:2, name:"항",hanja:"亢宿",quad:"east",stars:4,mainStar:"κ Vir",
    western:"처녀자리",meaning:"용의 목. 가뭄과 관련된 별.",
    detail:"항수는 목에 해당. '항룡유회(亢龍有悔)' — 용이 너무 높이 오르면 후회한다는 주역의 구절.",
    az:155,alt:32,appId:"virgo"},
  {num:3, name:"저",hanja:"氐宿",quad:"east",stars:4,mainStar:"α Lib",
    western:"천칭자리",meaning:"용의 가슴/뿌리. 천자의 행차를 관장.",
    detail:"천칭자리 α·β별이 저수. 춘분점이 한때 이 근처에 있어 역법에 중요.",
    az:168,alt:28,appId:null},
  {num:4, name:"방",hanja:"房宿",quad:"east",stars:4,mainStar:"π Sco",
    western:"전갈자리",meaning:"용의 배. 천자의 거처(明堂)를 상징.",
    detail:"전갈 머리 부분 4별. 방수에 행성이 들어오면 큰 정치 변화를 예언했어요.",
    az:178,alt:22,appId:"scorpius"},
  {num:5, name:"심",hanja:"心宿",quad:"east",stars:3,mainStar:"안타레스 (α Sco)",
    western:"전갈자리",meaning:"용의 심장! 동양 천문의 가장 중요한 별 중 하나.",
    detail:"심수이(心宿二)가 안타레스='대화(大火)'. 여름의 상징. 이 별의 위치로 계절을 판단했어요.",
    az:182,alt:20,appId:"scorpius"},
  {num:6, name:"미",hanja:"尾宿",quad:"east",stars:9,mainStar:"μ Sco",
    western:"전갈자리",meaning:"용의 꼬리. 후궁·왕비를 상징.",
    detail:"전갈 꼬리의 S자 곡선. 미수에 혜성이 지나면 후궁에 변고가 있다고 해석.",
    az:188,alt:16,appId:"scorpius"},
  {num:7, name:"기",hanja:"箕宿",quad:"east",stars:4,mainStar:"γ Sgr",
    western:"궁수자리",meaning:"키(곡물 까부르는 도구). 바람을 관장.",
    detail:"기수가 밝으면 바람이 분다고 했어요. 입을 벌린 형태라 '기수는 말이 많다'는 속담도.",
    az:198,alt:12,appId:null},
  // ── 북방 현무 (겨울) ──
  {num:8, name:"두",hanja:"斗宿",quad:"north",stars:6,mainStar:"φ Sgr",
    western:"궁수자리",meaning:"국자(남두육성). 수명과 관직을 관장.",
    detail:"남두육성(南斗六星)으로 유명. '북두는 죽음, 남두는 삶을 관장한다'는 말이 있어요.",
    az:205,alt:15,appId:null},
  {num:9, name:"우",hanja:"牛宿",quad:"north",stars:6,mainStar:"β Cap",
    western:"염소자리",meaning:"소(견우). 칠석 전설의 견우가 여기!",
    detail:"견우성(牽牛星)의 원래 위치. 다만 견우성으로 더 유명한 건 하고(河鼓)의 알타이르.",
    az:218,alt:18,appId:null},
  {num:10,name:"녀",hanja:"女宿",quad:"north",stars:4,mainStar:"ε Aqr",
    western:"물병자리",meaning:"여인(수녀). 바느질·길쌈을 상징.",
    detail:"직녀(織女, 베가)와는 다른 별이에요. 녀수는 길쌈의 실무 담당자 같은 존재.",
    az:228,alt:22,appId:null},
  {num:11,name:"허",hanja:"虛宿",quad:"north",stars:2,mainStar:"β Aqr",
    western:"물병자리",meaning:"폐허/빈 곳. 죽음과 슬픔의 별.",
    detail:"허수가 남중하면 동지. 가장 긴 밤, 가장 쓸쓸한 별이라 울음·제사와 연관.",
    az:238,alt:28,appId:null},
  {num:12,name:"위",hanja:"危宿",quad:"north",stars:3,mainStar:"α Aqr",
    western:"물병자리",meaning:"지붕 꼭대기/위태로움. 건축과 관련.",
    detail:"높은 곳 = 위험. 성벽·지붕 건축에 관한 점성에 사용. '위수에 달이 들면 건축 불길'.",
    az:250,alt:38,appId:null},
  {num:13,name:"실",hanja:"室宿",quad:"north",stars:2,mainStar:"α Peg",
    western:"페가수스자리",meaning:"방(궁실). 왕궁의 핵심 건물.",
    detail:"페가수스 대사각형 서쪽 변. 실수가 남중하면 동지 전후 — 새 궁전 건축 시기.",
    az:265,alt:52,appId:"pegasus"},
  {num:14,name:"벽",hanja:"壁宿",quad:"north",stars:2,mainStar:"γ Peg",
    western:"페가수스자리",meaning:"담벼락. 서적·학문을 보관하는 곳.",
    detail:"대사각형 동쪽 변. 천자의 서고(書庫)를 상징. 학문·문학의 수호 별자리.",
    az:278,alt:58,appId:"pegasus"},
  // ── 서방 백호 (가을) ──
  {num:15,name:"규",hanja:"奎宿",quad:"west",stars:16,mainStar:"η And",
    western:"안드로메다자리",meaning:"두 다리를 벌린 모습. 무기고·문학의 별.",
    detail:"규수는 16별로 구성이 큰 편. 과거 시험·학문과 관련되어 선비들이 중시했어요.",
    az:300,alt:62,appId:"andromeda"},
  {num:16,name:"루",hanja:"婁宿",quad:"west",stars:3,mainStar:"β Ari",
    western:"양자리",meaning:"동물 우리. 제사용 가축을 기르는 곳.",
    detail:"하말·셰라탄 포함. 목축과 제사를 관장. 루수가 밝으면 풍년이라 했어요.",
    az:315,alt:50,appId:"aries"},
  {num:17,name:"위",hanja:"胃宿",quad:"west",stars:3,mainStar:"35 Ari",
    western:"양자리",meaning:"위장. 식량 창고를 관장.",
    detail:"북방 현무의 위(危)와 한자가 다릅니다. 여기는 胃=위장. 곡식 저장의 길흉을 봤어요.",
    az:325,alt:45,appId:"aries"},
  {num:18,name:"묘",hanja:"昴宿",quad:"west",stars:7,mainStar:"플레이아데스 (M45)",
    western:"황소자리",meaning:"좀생이별! 한국에서 가장 유명한 동양 별.",
    detail:"한국에서 '좀생이별'로 맨눈에 몇 개 보이는지로 풍흉을 점쳤어요. 7별이 모이면 풍년!",
    az:335,alt:55,appId:"taurus"},
  {num:19,name:"필",hanja:"畢宿",quad:"west",stars:8,mainStar:"알데바란 (α Tau)",
    western:"황소자리",meaning:"그물. 비를 관장하는 별.",
    detail:"히아데스 성단+알데바란. 필수오(畢宿五)가 알데바란. 필수에 달이 들면 비가 온다고.",
    az:345,alt:58,appId:"taurus"},
  {num:20,name:"자",hanja:"觜宿",quad:"west",stars:3,mainStar:"λ Ori",
    western:"오리온자리",meaning:"부리/주둥이. 군사 명령을 관장.",
    detail:"오리온 머리 부분의 작은 삼각형. 28수 중 가장 작은 영역을 차지해요.",
    az:355,alt:52,appId:"orion"},
  {num:21,name:"삼",hanja:"參宿",quad:"west",stars:7,mainStar:"베텔게우스·리겔·삼태성",
    western:"오리온자리",meaning:"삼태성! 오리온 허리띠가 바로 이것.",
    detail:"삼수칠성(參宿七星)이 오리온 주요 7별. 한국에서 삼태성(三台星)으로 불린 허리띠 3별이 핵심.",
    az:5,alt:48,appId:"orion"},
  // ── 남방 주작 (여름) ──
  {num:22,name:"정",hanja:"井宿",quad:"south",stars:8,mainStar:"μ Gem",
    western:"쌍둥이자리",meaning:"우물. 물·법률을 관장.",
    detail:"쌍둥이자리 하반부 별들. 정수가 밝으면 법이 바로 선다고 해석했어요.",
    az:18,alt:68,appId:"gemini"},
  {num:23,name:"귀",hanja:"鬼宿",quad:"south",stars:4,mainStar:"θ Cnc (M44)",
    western:"게자리",meaning:"귀신. M44 벌집성단이 '적시기(積屍氣)'.",
    detail:"적시기=쌓인 시체의 기운. 무섭지만 날씨 예보에 중요했어요. 안 보이면 비 예보!",
    az:32,alt:58,appId:"cancer"},
  {num:24,name:"류",hanja:"柳宿",quad:"south",stars:8,mainStar:"δ Hya",
    western:"바다뱀자리",meaning:"버드나무. 주작의 부리에 해당.",
    detail:"바다뱀자리 머리 부분. 음식과 요리를 관장. 궁중 주방의 별.",
    az:48,alt:42,appId:null},
  {num:25,name:"성",hanja:"星宿",quad:"south",stars:7,mainStar:"α Hya (알파르드)",
    western:"바다뱀자리",meaning:"별 중의 별. 주작의 목.",
    detail:"알파르드='외로운 자'. 주변에 밝은 별이 없어서 홀로 빛나요. 봄 남쪽 저고도.",
    az:58,alt:30,appId:null},
  {num:26,name:"장",hanja:"張宿",quad:"south",stars:6,mainStar:"υ¹ Hya",
    western:"바다뱀자리",meaning:"활을 당기다. 주작의 날개.",
    detail:"장수는 종묘 제사의 음악을 관장했어요. 음악과 천문의 연결점.",
    az:72,alt:25,appId:null},
  {num:27,name:"익",hanja:"翼宿",quad:"south",stars:22,mainStar:"α Crt",
    western:"컵자리/까마귀자리",meaning:"날개. 주작이 날개를 편 모습.",
    detail:"22별로 28수 중 가장 많은 별. 음악·연극·외교를 관장. 주작의 양 날개.",
    az:88,alt:22,appId:null},
  {num:28,name:"진",hanja:"軫宿",quad:"south",stars:4,mainStar:"γ Crv",
    western:"까마귀자리",meaning:"수레. 주작의 꼬리이자 수레바퀴.",
    detail:"진수는 바람·교통을 관장. 까마귀자리의 사다리꼴이 수레 모양. 28수의 마지막.",
    az:102,alt:20,appId:null},
];

// ── 28수 퀴즈 데이터 ──
const SU_QUIZ = [
  {q:"오리온 허리띠 3별의 동양 이름은?",a:"삼태성 (三台星) / 삼수(參宿)",hint:"참(參)자리"},
  {q:"안타레스의 동양 이름 '대화(大火)'는 어느 수에 속할까요?",a:"심수(心宿) — 용의 심장",hint:"심장 심(心)"},
  {q:"좀생이별(플레이아데스)은 28수 중 어디?",a:"묘수(昴宿)",hint:"한국 풍흉 점성술의 핵심"},
  {q:"북두칠성은 28수에 포함될까요?",a:"아니요! 28수는 황도·적도 부근 별자리. 북두칠성은 북극 근처 별도 체계.",hint:"28수는 적도 벨트"},
  {q:"시리우스의 동양 이름은?",a:"천랑성(天狼星) — 하늘의 이리",hint:"늑대를 뜻하는 이름"},
  {q:"직녀성(베가)과 견우성(알타이르)은 28수에서 각각 어디?",a:"직녀는 28수 밖(별도 성좌). 견우 근처는 우수(牛宿).",hint:"칠석 주인공"},
  {q:"'적시기(積屍氣)'라 불린 무시무시한 이름의 천체는?",a:"M44 벌집성단 — 귀수(鬼宿) 안에 있어요",hint:"게자리 안의 성단"},
  {q:"28수의 4방위 수호신은?",a:"동방 청룡, 북방 현무, 서방 백호, 남방 주작",hint:"사신(四神)"},
];

const SEASON_GUIDE = {
  spring: [
    {name:"아크투루스 (목동자리)", color:"#FFB347", desc:"봄 동쪽 하늘 오렌지빛 1등성. 북반구 밤하늘 최밝은 별!", tip:"북두칠성 손잡이 곡선을 따라가면 자연스럽게 만남"},
    {name:"레굴루스 (사자자리)",   color:"#7EE8C8", desc:"봄 남쪽 청백색 1등성. 역물음표(낫) 패턴 아래에 빛남.",  tip:"봄 남쪽에서 가장 밝은 청백색 별을 찾으면 됨"},
    {name:"스피카 (처녀자리)",     color:"#B0D8FF", desc:"봄의 대곡선 끝, 청백색 1등성. 아크투루스에서 연장.",     tip:"아크투루스에서 같은 방향으로 계속 가면 스피카"},
    {name:"북두칠성 (큰곰자리)",   color:"#7EE8C8", desc:"연중 북쪽. 국자 7별. 봄엔 머리 위 가까이 보임.",        tip:"북쪽 하늘 국자 모양, 끝 두 별 → 북극성 열쇠"},
  ],
  summer: [
    {name:"베가 직녀성 (거문고)",  color:"#FFD166", desc:"여름 머리 위 0.03등성. 칠석 주인공. 흰빛으로 압도적.", tip:"여름밤 머리 바로 위, 가장 밝고 흰 별"},
    {name:"알타이르 견우성 (독수리)",color:"#FFD580",desc:"베가 남동쪽. 칠석 주인공. 양쪽에 별 두 개가 특징.",     tip:"베가 아래 남동쪽, 양옆 별 두 개 거느린 3연성"},
    {name:"데네브 오작교 (백조)",  color:"#C8E8FF", desc:"여름 대삼각형 세 번째. 2600광년 초거성!",               tip:"베가-알타이르 잇는 선 위쪽, 북십자성 꼭대기"},
    {name:"안타레스 (전갈자리)",   color:"#FF6B4A", desc:"여름 남쪽 지평선 근처 붉은 1등성. 화성과 색 비교!",    tip:"여름 남쪽 낮은 곳, 붉은빛이면 안타레스"},
  ],
  autumn: [
    {name:"페가수스 대사각형",     color:"#F4845F", desc:"가을 남쪽 거대한 사각형. 한 변 15°! 기준점 역할.",     tip:"가을 남쪽 하늘에 큰 사각형이 보이면 그게 페가수스"},
    {name:"카시오페이아 W자",      color:"#C8A8FF", desc:"북쪽 주극성. W(또는 M) 모양 5별. 항상 북쪽에 보임.",  tip:"북쪽 하늘 W자, 북두칠성 반대편에서 항상 보임"},
    {name:"알페라츠 (안드로메다)", color:"#89CFF0", desc:"페가수스 사각형 왼쪽 위. M31 은하로 가는 길잡이.",     tip:"사각형 왼쪽 위 꼭짓점에서 북동쪽으로 별들 따라가기"},
    {name:"미라크·알골 (페르세우스)",color:"#FFD166",desc:"알골은 2.87일마다 밝기 변하는 변광성! 관찰 프로젝트.", tip:"카시오페이아 W자 아래쪽, 며칠 간격으로 밝기 비교"},
  ],
  winter: [
    {name:"카펠라 (마차부자리)",   color:"#FFD580", desc:"퇴근길 북동쪽 황금빛 0.08등성. 도심 최고 관측 대상!", tip:"북동쪽 높은 곳, 홀로 황금빛으로 빛나면 카펠라"},
    {name:"시리우스 (큰개자리)",   color:"#B0D8FF", desc:"전천 최밝은 별 -1.46등성. 파란빛 깜박임이 특징.",     tip:"오리온 허리띠에서 왼쪽 아래 연장 → 못 지나침"},
    {name:"오리온 삼태성",         color:"#89CFF0", desc:"일직선 나란한 3별. 겨울 별자리 찾기의 기준점.",        tip:"남쪽 하늘 일직선 3별, 밝기 비슷해서 눈에 띔"},
    {name:"알데바란 (황소자리)",   color:"#FF8C42", desc:"오리온 위쪽 붉은 거성. 좀생이별(플레이아데스) 이웃.",  tip:"오리온 허리띠에서 오른쪽 위 연장 → 붉은 별"},
  ],
};

const MONTH_GUIDE = {
  1:  [{name:"오리온 삼태성",color:"#89CFF0",tip:"겨울 남쪽, 일직선 3별이면 무조건 오리온"},{name:"카펠라",color:"#FFD580",tip:"북동쪽 황금빛, 도심에서도 잘 보임"},{name:"시리우스",color:"#B0D8FF",tip:"전천 최밝은 별, 오리온 아래쪽"}],
  2:  [{name:"오리온·시리우스",color:"#89CFF0",tip:"겨울 대표 별자리 2개를 같이 찾기"},{name:"카펠라",color:"#FFD580",tip:"북동쪽 황금빛"},{name:"폴룩스·카스토르",color:"#7EE8C8",tip:"쌍둥이 두 별, 오리온 왼쪽 위"}],
  3:  [{name:"카펠라·오리온",color:"#FFD580",tip:"서쪽으로 기울기 시작, 3월이 마지막 기회"},{name:"레굴루스",color:"#7EE8C8",tip:"봄 남쪽 청백색, 이달부터 잘 보임"},{name:"북두칠성",color:"#7EE8C8",tip:"봄엔 북쪽 높이 올라와 찾기 쉬움"}],
  4:  [{name:"아크투루스",color:"#FFB347",tip:"동쪽 오렌지빛, 봄의 신호탄"},{name:"레굴루스",color:"#7EE8C8",tip:"남쪽 청백색 1등성"},{name:"북두칠성",color:"#7EE8C8",tip:"머리 위 국자 모양"}],
  5:  [{name:"아크투루스",color:"#FFB347",tip:"봄 하늘 기준점, 오렌지빛"},{name:"스피카",color:"#B0D8FF",tip:"아크투루스 아래 청백색"},{name:"봄의 대곡선",color:"#7EE8C8",tip:"북두→아크투루스→스피카 연결해보기"}],
  6:  [{name:"아크투루스",color:"#FFB347",tip:"서쪽으로 이동 중, 봄 마지막"},{name:"베가 직녀성",color:"#FFD166",tip:"동쪽에서 밝게 떠오르는 중"},{name:"안타레스",color:"#FF6B4A",tip:"남쪽 지평선 붉은 별, 여름 시작"}],
  7:  [{name:"베가 직녀성",color:"#FFD166",tip:"머리 위 가장 밝은 별"},{name:"알타이르 견우성",color:"#FFD580",tip:"남동쪽, 베가와 함께 칠석 주인공"},{name:"데네브 오작교",color:"#C8E8FF",tip:"베가 옆 북십자성 꼭대기"}],
  8:  [{name:"여름 대삼각형",color:"#FFD166",tip:"베가·알타이르·데네브 연결해보기"},{name:"안타레스",color:"#FF6B4A",tip:"남쪽 붉은 별, 8월 피크"},{name:"M13 구상성단",color:"#89CFF0",tip:"헤르쿨레스 안, 8인치로 도전"}],
  9:  [{name:"여름 대삼각형",color:"#FFD166",tip:"아직 머리 위, 9월도 잘 보임"},{name:"페가수스 대사각형",color:"#F4845F",tip:"동쪽에서 커다란 사각형 찾기"},{name:"카시오페이아 W",color:"#C8A8FF",tip:"북쪽 W자, 가을부터 잘 보임"}],
  10: [{name:"페가수스 대사각형",color:"#F4845F",tip:"남쪽 거대한 사각형"},{name:"카시오페이아 W",color:"#C8A8FF",tip:"북쪽 W자"},{name:"M31 안드로메다",color:"#89CFF0",tip:"사각형 위에서 희뿌연 반점 찾기"}],
  11: [{name:"카시오페이아 W",color:"#C8A8FF",tip:"북쪽 주극성, 항상 보임"},{name:"페르세우스 이중성단",color:"#FFD166",tip:"카시오페이아 아래 희뿌연 두 점"},{name:"플레이아데스 좀생이별",color:"#89CFF0",tip:"동쪽에서 뜨기 시작, 맨눈 점성 확인"}],
  12: [{name:"오리온 삼태성",color:"#89CFF0",tip:"겨울 돌아옴! 동쪽에서 떠오르는 중"},{name:"플레이아데스 좀생이별",color:"#7EE8C8",tip:"남쪽에서 잘 보임, 맨눈으로 몇 개?"},{name:"카펠라",color:"#FFD580",tip:"북동쪽 황금빛, 퇴근길 반가운 별"}],
};

/* ── HELPERS ── */
const sz = (s) => ({ inner:s*0.55, mid:s*1.1, glow:s*3.8, glow2:s*6.5 });

/* ── STAR MAP ── */
function StarMapSVG({ data, color }) {
  return (
    <svg viewBox="0 0 100 100" style={{width:"100%",maxHeight:"210px",display:"block"}}>
      <defs>
        <radialGradient id="smBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#041020"/>
          <stop offset="100%" stopColor="#010810"/>
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#smBg)" rx="10"/>
      {Array.from({length:30},(_,i)=>{ const a=i*137.5*Math.PI/180,r=((i*53+7)%85)/85*48; return <circle key={i} cx={50+r*Math.cos(a)} cy={50+r*Math.sin(a)} r={0.3} fill="white" opacity={0.07+((i%4)*0.04)}/>; })}
      {(data.lines||[]).map(([a,b],i)=>(
        <line key={i} x1={data.stars[a][0]} y1={data.stars[a][1]} x2={data.stars[b][0]} y2={data.stars[b][1]} stroke={color} strokeWidth="0.6" opacity="0.28"/>
      ))}
      {(data.stars||[]).map(([x,y,s,label],i)=>{
        const ss=sz(s);
        return (
          <g key={i}>
            {s>=5 && <circle cx={x} cy={y} r={ss.glow2} fill={color} opacity="0.05"/>}
            <circle cx={x} cy={y} r={ss.glow} fill={color} opacity="0.13"/>
            <circle cx={x} cy={y} r={ss.mid} fill={color} opacity="0.45"/>
            <circle cx={x} cy={y} r={ss.inner} fill="white" opacity="0.95"/>
            {label && s>=3.5 && <text x={x+ss.inner+1.5} y={y-ss.inner-1} fontSize="4.5" fill={color} opacity="0.9" style={{fontFamily:"sans-serif"}}>{label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/* ── PLANISPHERE ── */
function Planisphere({ season, selected, onSelect, color, showAst, show28su, todayMode, currentMonth, obsHour, fullscreen, heading, compassLock }) {
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({x:0, y:0});
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({x:0,y:0,px:0,py:0});
  const pinchRef = useRef(null); // 핀치 줌 상태
  const svgRef = useRef(null);   // SVG 엘리먼트 ref
  const size = fullscreen ? Math.min(typeof window!=='undefined'?window.innerWidth:520, typeof window!=='undefined'?window.innerHeight-140:520, 600) : 300;
  const cx = size/2, cy = size/2, R = fullscreen ? size*0.42 : 128;
  const zR = R * zoom;
  const ocx = cx + pan.x;
  const ocy = cy + pan.y;

  const toXY=(az,alt)=>{ const r=(1-alt/90)*zR,rad=az*Math.PI/180; return [ocx-r*Math.sin(rad),ocy-r*Math.cos(rad)]; };
  const bgStars=Array.from({length:70},(_,i)=>{ const a=i*137.5*Math.PI/180,r=((i*53+7)%90)/90*zR*0.97; return {x:ocx+r*Math.cos(a),y:ocy+r*Math.sin(a),s:0.35+((i*7)%3)*0.2,op:0.1+((i%5)*0.06)}; });

  const todayVisible = MONTHLY_VISIBLE[currentMonth] || [];
  const basePositions = todayMode
    ? Object.fromEntries(Object.entries(Object.assign({}, ...Object.values(SKY_POS))).filter(([id]) => todayVisible.includes(id)))
    : (SKY_POS[season]||{});
  // 시간 보정 적용
  const positions = Object.fromEntries(
    Object.entries(basePositions).map(([id, pos]) => [id, getTimedPos(pos.az, pos.alt, obsHour)])
  );
  const asts = showAst ? (todayMode ? Object.values(ASTERISMS).flat() : (ASTERISMS[season]||[])) : [];
  // 아스테리즘도 시간 보정
  const timedAsts = asts.map(ast => ({
    ...ast,
    vertices: ast.vertices.map(v => ({ ...v, ...getTimedPos(v.az, v.alt, obsHour) }))
  }));

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(z => Math.min(2.8, Math.max(0.45, z - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const startDrag = (clientX, clientY) => {
    setDragging(true);
    setDragStart({x:clientX, y:clientY, px:pan.x, py:pan.y});
  };
  const moveDrag = (clientX, clientY) => {
    if(!dragging) return;
    setPan({x: dragStart.px + (clientX - dragStart.x), y: dragStart.py + (clientY - dragStart.y)});
  };
  const endDrag = () => { setDragging(false); pinchRef.current = null; };

  // 핀치 줌 — 두 손가락 거리 변화로 줌
  const getTouchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      pinchRef.current = { dist: getTouchDist(e.touches), zoom };
    } else if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const newDist = getTouchDist(e.touches);
      const scale = newDist / pinchRef.current.dist;
      setZoom(Math.min(2.8, Math.max(0.45, pinchRef.current.zoom * scale)));
    } else if (e.touches.length === 1 && !pinchRef.current) {
      e.preventDefault();
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

    const compassRotation = compassLock && heading !== null ? -heading : 0;
    return (
    <div style={{position:"relative"}}>
      <div style={{position:"absolute",top:6,right:6,zIndex:10,display:"flex",flexDirection:"column",gap:3}}>
        {[["＋",0.25],["-",-0.25]].map(([lbl,delta])=>(
          <button key={lbl} onClick={()=>setZoom(z=>Math.min(2.8,Math.max(0.45,z+delta)))}
            style={{width:24,height:24,borderRadius:6,border:"none",background:"rgba(13,32,64,0.9)",color:color,fontSize:"15px",cursor:"pointer",lineHeight:1,fontWeight:"700"}}>
            {lbl}
          </button>
        ))}
        <button onClick={()=>{setZoom(1);setPan({x:0,y:0});}}
          style={{width:24,height:24,borderRadius:6,border:"none",background:"rgba(13,32,64,0.9)",color:"#3a6a8a",fontSize:"13px",cursor:"pointer",lineHeight:1,fontWeight:"700"}}>
          0
        </button>
      </div>
      <div style={{transform:`rotate(${compassRotation}deg)`,transition:compassLock?"transform 0.3s ease-out":"none"}}>
      <svg ref={svgRef} width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{display:"block",margin:"0 auto",cursor:dragging?"grabbing":"grab",touchAction:"none"}}
        onMouseDown={e=>{ if(e.button===0) startDrag(e.clientX,e.clientY); }}
        onMouseMove={e=>moveDrag(e.clientX,e.clientY)}
        onMouseUp={endDrag} onMouseLeave={endDrag}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={endDrag}>
        <defs>
          <radialGradient id="skyG" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#030d20"/><stop offset="100%" stopColor="#010810"/>
          </radialGradient>
          <filter id="gfx"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="agfx"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="pgfx"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <clipPath id="skyClip"><circle cx={cx} cy={cy} r={R+1}/></clipPath>
        </defs>
        <circle cx={cx} cy={cy} r={R+2} fill="url(#skyG)" stroke="#0d2040" strokeWidth="1"/>
        <g clipPath="url(#skyClip)">
          {bgStars.map((s,i)=><circle key={i} cx={s.x} cy={s.y} r={s.s} fill="white" opacity={s.op}/>)}
          {[30,60].map(alt=><circle key={alt} cx={ocx} cy={ocy} r={(1-alt/90)*zR} fill="none" stroke="#0d2845" strokeWidth="0.7" strokeDasharray="4,5"/>)}
          {[0,90,180,270].map(az=>{ const rad=az*Math.PI/180; return <line key={az} x1={ocx} y1={ocy} x2={ocx-zR*Math.sin(rad)} y2={ocy-zR*Math.cos(rad)} stroke="#0d2845" strokeWidth="0.5"/>; })}
          {/* Direction labels — always fixed at edge */}
          {[["N북",0],["S남",180],["E동",90],["W서",270]].map(([lbl,az])=>{ const rad=az*Math.PI/180,d=R+14; return <text key={az} x={cx-d*Math.sin(rad)} y={cy-d*Math.cos(rad)+4} textAnchor="middle" fontSize="9.5" fill="#2a5070" fontFamily="sans-serif" fontWeight="600">{lbl}</text>; })}
          {/* Altitude rings label */}
          <text x={ocx+3} y={ocy-(1-30/90)*zR+8} fontSize="6.5" fill="#1e4060" fontFamily="sans-serif">30°</text>
          <text x={ocx+3} y={ocy-(1-60/90)*zR+8} fontSize="6.5" fill="#1e4060" fontFamily="sans-serif">60°</text>

          {/* Asterisms with time correction */}
          {timedAsts.map((ast,ai)=>{
            const pts=ast.vertices.map(v=>toXY(v.az,v.alt));
            const pStr=(ast.closed?[...pts,pts[0]]:pts).map(([x,y])=>`${x},${y}`).join(" ");
            return (
              <g key={ai} filter="url(#agfx)">
                <polyline points={pStr} fill="none" stroke={ast.color} strokeWidth="2" opacity="0.5" strokeDasharray={ast.dash?"7,4":"none"}/>
                {pts.map(([x,y],vi)=>(
                  <g key={vi}>
                    <circle cx={x} cy={y} r={6} fill={ast.color} opacity="0.12"/>
                    <circle cx={x} cy={y} r={2.5} fill={ast.color} opacity="0.75"/>
                    {ast.vertices[vi].label && (
                      <text x={x} y={y-10} textAnchor="middle" fontSize="6.5" fill={ast.color} fontFamily="sans-serif" fontWeight="600" opacity="0.9">
                        {ast.vertices[vi].label.split("\n").map((l,li)=><tspan key={li} x={x} dy={li===0?0:8}>{l}</tspan>)}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            );
          })}

          {/* Planets */}
          {todayMode && PLANETS_NOW.map((p,i)=>{
            const [px,py]=toXY(p.az,p.alt);
            return (
              <g key={i} filter="url(#pgfx)">
                <circle cx={px} cy={py} r={p.size*2.5} fill={p.color} opacity="0.2"/>
                <circle cx={px} cy={py} r={p.size*1.2} fill={p.color} opacity="0.7"/>
                <circle cx={px} cy={py} r={p.size*0.6} fill="white" opacity="0.9"/>
                <text x={px} y={py-p.size*2-3} textAnchor="middle" fontSize="7.5" fill={p.color} fontFamily="sans-serif" fontWeight="700" opacity="0.95">{p.name}</text>
              </g>
            );
          })}

          {/* Moon */}
          {todayMode && (()=>{
            const moon = getMoonPhase();
            const moonPos = getMoonSkyPosition(obsHour, moon.phase);
            if (!moonPos.visible) return null;
            const [mx,my] = toXY(moonPos.az, moonPos.alt);
            return (
              <g filter="url(#pgfx)">
                <circle cx={mx} cy={my} r={14} fill="#FFE4A0" opacity="0.08"/>
                <circle cx={mx} cy={my} r={8} fill="#FFE4A0" opacity="0.15"/>
                <text x={mx} y={my+4.5} textAnchor="middle" fontSize="14">{moon.emoji}</text>
                <text x={mx} y={my-11} textAnchor="middle" fontSize="7" fill="#FFE4A0" fontFamily="sans-serif" fontWeight="700" opacity="0.9">
                  {moon.name} {moon.illum}%
                </text>
              </g>
            );
          })()}

          {/* Constellation markers */}
          {Object.entries(positions).map(([id,pos])=>{
            const [x,y]=toXY(pos.az,pos.alt);
            const isSel=id===selected;
            const c=CONST_DATA[id]||{};
            const seasonColor = S.seasonColor(c.season) || color;
            const markerColor = todayMode ? seasonColor : color;
            return (
              <g key={id} onClick={()=>{ if(!dragging) onSelect(id); }} style={{cursor:"pointer"}}>
                {isSel && <circle cx={x} cy={y} r={18} fill={markerColor} opacity="0.15"/>}
                <line x1={x-4} y1={y} x2={x+4} y2={y} stroke={isSel?markerColor:"rgba(130,200,255,0.5)"} strokeWidth="0.9"/>
                <line x1={x} y1={y-4} x2={x} y2={y+4} stroke={isSel?markerColor:"rgba(130,200,255,0.5)"} strokeWidth="0.9"/>
                <circle cx={x} cy={y} r={isSel?7.5:5} fill={isSel?markerColor:"rgba(100,180,255,0.7)"} filter={isSel?"url(#gfx)":undefined}/>
                <text x={x} y={y-12} textAnchor="middle" fontSize="8" fill={isSel?markerColor:todayMode?seasonColor:"#4a7a90"} fontFamily="sans-serif" fontWeight={isSel?"700":"400"}>{c.name||id}</text>
              </g>
            );
          })}

          {/* 🏮 28수 오버레이 */}
          {show28su && TWENTY_EIGHT_SU.map((su) => {
            const tpos = getTimedPos(su.az, su.alt, obsHour);
            const [sx, sy] = toXY(tpos.az, tpos.alt);
            const qd = QUADRANTS.find(q=>q.id===su.quad);
            const qcolor = qd?.color || "#888";
            return (
              <g key={`su${su.num}`} opacity="0.75">
                <rect x={sx-1.5} y={sy-1.5} width={3} height={3} fill={qcolor} transform={`rotate(45,${sx},${sy})`}/>
                <text x={sx} y={sy-5} textAnchor="middle" fontSize={fullscreen?"7":"5.5"} fill={qcolor}
                  fontFamily="sans-serif" fontWeight="600">{su.name}</text>
              </g>
            );
          })}

          {/* 🧭 나침반 헤딩 표시 */}
          {heading !== null && (() => {
            const rad = (heading * Math.PI) / 180;
            const needleLen = zR * 0.88;
            const nx = ocx - needleLen * Math.sin(rad);
            const ny = ocy - needleLen * Math.cos(rad);
            // 반대 방향 (남)
            const bx = ocx + (needleLen * 0.3) * Math.sin(rad);
            const by = ocy + (needleLen * 0.3) * Math.cos(rad);
            return (
              <g>
                {/* 시야 부채꼴 (±30°) */}
                {(() => {
                  const span = 30 * Math.PI / 180;
                  const r1 = zR * 0.92;
                  const a1 = rad - span, a2 = rad + span;
                  const x1 = ocx - r1 * Math.sin(a1), y1 = ocy - r1 * Math.cos(a1);
                  const x2 = ocx - r1 * Math.sin(a2), y2 = ocy - r1 * Math.cos(a2);
                  return <path d={`M ${ocx} ${ocy} L ${x1} ${y1} A ${r1} ${r1} 0 0 1 ${x2} ${y2} Z`}
                    fill="#FFD166" opacity="0.10"/>;
                })()}
                {/* 방향 화살표 */}
                <line x1={bx} y1={by} x2={nx} y2={ny}
                  stroke="#FFD166" strokeWidth="1.8" opacity="0.9"
                  strokeLinecap="round"/>
                {/* 화살촉 */}
                <circle cx={nx} cy={ny} r="3.5" fill="#FFD166" opacity="0.95"/>
                <circle cx={ocx} cy={ocy} r="3" fill="#FFD166" opacity="0.5"/>
                {/* 헤딩 수치 */}
                <text x={ocx} y={ocy + zR + 18} textAnchor="middle"
                  fontSize="10" fill="#FFD166" fontFamily="sans-serif" fontWeight="700">
                  🧭 {heading}° {["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(heading/22.5)%16]}
                </text>
              </g>
            );
          })()}
        </g>
        <circle cx={cx} cy={cy} r={2.5} fill="#102030"/>
        <text x={cx+4} y={cy-3} fontSize="5.5" fill="#1a3050" fontFamily="sans-serif">천정</text>
      </svg>
      </div>
      {/* 나침반 연동 시 방향 안내 */}
      {compassLock && heading !== null && (
        <div style={{textAlign:"center",fontSize:"10px",color:"#FFD166",marginTop:4,opacity:0.8}}>
          📱 폰이 향하는 방향 = 방위도 위쪽
        </div>
      )}
    </div>
  );
}

/* ── BEGINNER GUIDE PANEL ── */
function GuidePanel({ season, currentMonth, sc }) {
  const [guideMode, setGuideMode] = useState("season");
  const [guideSeason, setGuideSeason] = useState(season);
  const [guideMonth, setGuideMonth] = useState(currentMonth);
  const SEASON_NAMES = {spring:"🌸 봄",summer:"☀️ 여름",autumn:"🍂 가을",winter:"❄️ 겨울"};
  const SEASON_COLORS = {spring:"#7EE8C8",summer:"#FFD166",autumn:"#F4845F",winter:"#89CFF0"};
  const MNAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
  const SEASON_OF_MONTH = {1:"winter",2:"winter",3:"spring",4:"spring",5:"spring",6:"summer",7:"summer",8:"summer",9:"autumn",10:"autumn",11:"autumn",12:"winter"};
  const items = guideMode==="season" ? (SEASON_GUIDE[guideSeason]||[]) : (MONTH_GUIDE[guideMonth]||[]);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
      <div style={{display:"flex",gap:5}}>
        {[["season","🌸 계절별"],["month","🗓️ 월별"]].map(([m,lbl])=>(
          <button key={m} onClick={()=>setGuideMode(m)}
            style={{padding:"4px 12px",borderRadius:14,border:"none",cursor:"pointer",fontSize:"11px",fontFamily:"inherit",fontWeight:"700",
              background:guideMode===m?sc.color:"#0d2040",color:guideMode===m?"#030B1A":"#3a6a8a"}}>
            {lbl}
          </button>
        ))}
      </div>
      {guideMode==="season" ? (
        <div style={{display:"flex",gap:4}}>
          {Object.entries(SEASON_NAMES).map(([s,lbl])=>(
            <button key={s} onClick={()=>setGuideSeason(s)}
              style={{flex:1,padding:"4px 2px",borderRadius:10,border:"none",cursor:"pointer",fontSize:"10px",fontFamily:"inherit",
                background:guideSeason===s?`${SEASON_COLORS[s]}28`:"#0d2040",
                color:guideSeason===s?SEASON_COLORS[s]:"#3a6a8a",fontWeight:guideSeason===s?"700":"400"}}>
              {lbl}
            </button>
          ))}
        </div>
      ) : (
        <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
          {MNAMES.map((m,i)=>{
            const mIdx=i+1, mSeason=SEASON_OF_MONTH[mIdx], mColor=SEASON_COLORS[mSeason];
            return (
              <button key={mIdx} onClick={()=>setGuideMonth(mIdx)}
                style={{padding:"3px 6px",borderRadius:8,border:"none",cursor:"pointer",fontSize:"10px",fontFamily:"inherit",
                  background:guideMonth===mIdx?`${mColor}28`:"#0d2040",
                  color:guideMonth===mIdx?mColor:"#3a6a8a",fontWeight:guideMonth===mIdx?"700":"400"}}>
                {m}
              </button>
            );
          })}
        </div>
      )}
      <div style={{...S.infoHint, padding:"8px 11px"}}>
        {guideMode==="season"
          ? `🌟 ${SEASON_NAMES[guideSeason]} 하늘에서 초보자가 찾기 쉬운 별 순서입니다.`
          : `🌙 ${MNAMES[guideMonth-1]} 밤 22:00 서울 기준, 지금 당장 찾을 수 있는 별입니다.`}
      </div>
      {items.map((g,i)=>(
        <div key={i} style={{display:"flex",gap:12,padding:"12px 13px",...S.cardLg, border:`1px solid ${g.color}22`}}>
          <div style={{flexShrink:0,width:28,height:28,borderRadius:"50%",background:`${g.color}22`,border:`1px solid ${g.color}66`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:"800",color:g.color}}>{i+1}</div>
          <div>
            <div style={{fontSize:"13px",fontWeight:"700",color:g.color,marginBottom:3}}>{g.name}</div>
            {g.desc&&<div style={{fontSize:"12px",color:"#6a9ab0",lineHeight:1.6,marginBottom:4}}>{g.desc}</div>}
            <div style={{fontSize:"11px",color:"#3a6a8a",background:"rgba(255,255,255,.03)",padding:"4px 8px",borderRadius:6,lineHeight:1.5}}>💡 {g.tip}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── ASTERISM PANEL ── */
function AsterismPanel({ season }) {
  const asts=ASTERISMS[season]||[];
  if(!asts.length) return <div style={{color:"#3a6a8a",textAlign:"center",padding:"30px"}}>준비 중</div>;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
      <div style={S.infoHint}>
        💡 왼쪽 방위도에서 <strong style={{color:S.col.link}}>아스테리즘 ON</strong> 버튼으로 하늘 위에 직접 표시됩니다.
      </div>
      {asts.map((ast,i)=>(
        <div key={i} style={{background:"linear-gradient(135deg,#040f1e,#030c18)",border:`1px solid ${ast.color}44`,borderRadius:"12px",padding:"16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
            <div style={{width:12,height:12,borderRadius:"50%",background:ast.color}}/>
            <span style={{fontWeight:"700",color:ast.color,fontSize:"15px"}}>{ast.name}</span>
            {ast.dash && <span style={{fontSize:"10px",color:ast.color,border:`1px solid ${ast.color}44`,padding:"1px 6px",borderRadius:"10px"}}>점선</span>}
          </div>
          <div style={{fontSize:"12px",color:"#5a8a9a",marginBottom:"6px"}}>{ast.vertices.filter(v=>v.label).map(v=>v.label.replace("\n"," ")).join(" → ")}</div>
          <div style={{fontSize:"13px",color:"#90b8d0",lineHeight:1.75}}>{ast.info}</div>
        </div>
      ))}
    </div>
  );
}

/* ── 28수 전체 패널 ── */
function SuPanel({ sc, onSelect }) {
  const [activeQuad, setActiveQuad] = useState("all");
  const [expandedSu, setExpandedSu] = useState(null);
  const items = activeQuad === "all" ? TWENTY_EIGHT_SU : TWENTY_EIGHT_SU.filter(s => s.quad === activeQuad);
  const quadObj = QUADRANTS.find(q => q.id === activeQuad);
  return (
    <div style={S.flexCol(10)}>
      <div style={S.infoHint}>
        🏮 동양 28수(二十八宿) — 하늘을 4방위 × 7수로 나눈 동아시아 전통 천문 체계입니다.
      </div>
      {/* 4방 탭 */}
      <div style={{display:"flex",gap:4}}>
        <button onClick={()=>setActiveQuad("all")} style={S.tabBtn(activeQuad==="all", sc.color)}>전체 28수</button>
        {QUADRANTS.map(q=>(
          <button key={q.id} onClick={()=>setActiveQuad(q.id)}
            style={{...S.tabBtn(activeQuad===q.id, q.color), flex:1}}>
            {q.symbol} {q.name.split(" ")[1]}
          </button>
        ))}
      </div>
      {/* 방위 설명 */}
      {quadObj && (
        <div style={{padding:"10px 14px",...S.panel, border:`1px solid ${quadObj.color}33`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span style={{fontSize:"24px"}}>{quadObj.symbol}</span>
            <div>
              <div style={{fontSize:"14px",fontWeight:"700",color:quadObj.color}}>{quadObj.name}</div>
              <div style={{fontSize:"10px",color:S.col.muted}}>{quadObj.hanja} · {quadObj.season==="spring"?"봄":quadObj.season==="summer"?"여름":quadObj.season==="autumn"?"가을":"겨울"}</div>
            </div>
          </div>
          <div style={{fontSize:"12px",color:S.col.body,lineHeight:1.7}}>{quadObj.desc}</div>
        </div>
      )}
      {/* 28수 목록 */}
      {items.map((su) => {
        const qd = QUADRANTS.find(q=>q.id===su.quad);
        const isExpanded = expandedSu === su.num;
        return (
          <div key={su.num} onClick={()=>setExpandedSu(isExpanded?null:su.num)}
            style={{padding:"12px 14px",...S.cardLg, border:`1px solid ${qd.color}22`, cursor:"pointer",
              transition:"all 0.2s"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{flexShrink:0,width:32,height:32,borderRadius:"50%",
                background:`${qd.color}22`,border:`1px solid ${qd.color}55`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:"12px",fontWeight:"800",color:qd.color}}>{su.num}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:"16px",fontWeight:"800",color:qd.color,...S.serif}}>{su.name}</span>
                  <span style={{fontSize:"11px",color:S.col.muted}}>{su.hanja}</span>
                  <span style={{fontSize:"10px",color:S.col.dim,marginLeft:"auto"}}>{su.stars}별 · {su.western}</span>
                </div>
                <div style={{fontSize:"11px",color:S.col.body,marginTop:2}}>{su.meaning}</div>
              </div>
              <span style={{fontSize:"10px",color:S.col.dim,flexShrink:0}}>{isExpanded?"▲":"▼"}</span>
            </div>
            {isExpanded && (
              <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${qd.color}22`}}>
                <div style={{fontSize:"12px",color:S.col.emphasis,lineHeight:1.8,...S.serif,marginBottom:8}}>{su.detail}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{fontSize:"10px",color:S.col.muted}}>⭐ {su.mainStar}</span>
                  {su.appId && (
                    <button onClick={(e)=>{e.stopPropagation();onSelect(su.appId);}}
                      style={{...S.tabBtn(false,qd.color),fontSize:"9px"}}>
                      {CONST_DATA[su.appId]?.symbol} {CONST_DATA[su.appId]?.name} 보기 →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── 퀴즈 패널 ── */
function QuizPanel({ sc }) {
  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const quiz = SU_QUIZ[current];

  const handleReveal = () => setRevealed(true);
  const handleCorrect = () => {
    setScore(s=>s+1);
    next();
  };
  const handleWrong = () => next();
  const next = () => {
    setRevealed(false);
    if (current + 1 >= SU_QUIZ.length) { setFinished(true); }
    else { setCurrent(c=>c+1); }
  };
  const restart = () => { setCurrent(0); setRevealed(false); setScore(0); setFinished(false); };

  if (finished) return (
    <div style={{...S.panel, padding:"30px", textAlign:"center", border:`1px solid ${sc.color}33`}}>
      <div style={{fontSize:"36px",marginBottom:12}}>🎉</div>
      <div style={{fontSize:"18px",fontWeight:"800",color:sc.color,marginBottom:8}}>퀴즈 완료!</div>
      <div style={{fontSize:"14px",color:S.col.body,marginBottom:16}}>{SU_QUIZ.length}문제 중 {score}개 맞았어요</div>
      <div style={{height:8,borderRadius:4,background:"#0d2040",marginBottom:16}}>
        <div style={{width:`${score/SU_QUIZ.length*100}%`,height:"100%",borderRadius:4,background:sc.color}}/>
      </div>
      <button onClick={restart} style={{...S.pillBtn(true,sc.color),padding:"8px 20px",fontSize:"13px"}}>
        다시 도전 🔄
      </button>
    </div>
  );

  return (
    <div style={S.flexCol(12)}>
      <div style={S.infoHint}>🧠 28수 퀴즈 — 동양 천문 지식을 테스트해보세요!</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:"11px",color:S.col.muted}}>Q{current+1} / {SU_QUIZ.length}</span>
        <span style={{fontSize:"11px",color:sc.color,fontWeight:"700"}}>✅ {score}점</span>
      </div>
      <div style={{...S.panel, padding:"20px", border:`1px solid ${sc.color}33`}}>
        <div style={{fontSize:"15px",fontWeight:"700",color:S.col.emphasis,lineHeight:1.8,...S.serif,marginBottom:12}}>
          {quiz.q}
        </div>
        {!revealed ? (
          <div style={S.flexCol(8)}>
            <div style={{fontSize:"11px",color:S.col.muted}}>💡 힌트: {quiz.hint}</div>
            <button onClick={handleReveal}
              style={{...S.pillBtn(true,sc.color),padding:"10px",fontSize:"13px",width:"100%",textAlign:"center"}}>
              정답 보기 👀
            </button>
          </div>
        ) : (
          <div style={S.flexCol(10)}>
            <div style={{padding:"12px",...S.card, borderLeft:`3px solid ${sc.color}`}}>
              <div style={{fontSize:"13px",fontWeight:"700",color:sc.color,marginBottom:4}}>정답</div>
              <div style={{fontSize:"13px",color:S.col.emphasis,lineHeight:1.7,...S.serif}}>{quiz.a}</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={handleCorrect}
                style={{...S.pillBtn(true,"#7EE8C8"),flex:1,padding:"8px",fontSize:"12px",textAlign:"center"}}>
                ⭕ 맞았어요
              </button>
              <button onClick={handleWrong}
                style={{...S.pillBtn(true,"#F4845F"),flex:1,padding:"8px",fontSize:"12px",textAlign:"center"}}>
                ❌ 틀렸어요
              </button>
            </div>
          </div>
        )}
      </div>
      {/* 진행 바 */}
      <div style={{height:4,borderRadius:2,background:"#0d2040"}}>
        <div style={{width:`${(current+1)/SU_QUIZ.length*100}%`,height:"100%",borderRadius:2,
          background:sc.color,transition:"width 0.3s"}}/>
      </div>
    </div>
  );
}

/* ── OBSERVATION CONDITIONS PANEL ── */
function ObsCondPanel({ currentMonth, sc }) {
  const moon = getMoonPhase();
  const tw = TWILIGHT_TABLE[currentMonth];
  return (
    <div style={S.flexCol(12)}>
      <div style={S.infoHint}>
        🌙 달과 박명 — 오늘 관측 조건을 한눈에. 월령은 실시간 계산, 박명은 서울 기준.
      </div>
      {/* 월령 */}
      <div style={{padding:"16px",...S.panel, border:`1px solid ${sc.color}33`}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
          <span style={{fontSize:"38px"}}>{moon.emoji}</span>
          <div>
            <div style={{fontSize:"16px",fontWeight:"800",color:sc.color}}>{moon.name}</div>
            <div style={{fontSize:"11px",color:S.col.muted}}>월령 {moon.age}일 · 밝기 {moon.illum}%</div>
          </div>
        </div>
        <div style={{...S.card, padding:"10px 12px", marginBottom:8}}>
          <div style={{fontSize:"12px",color:S.col.body,lineHeight:1.7}}>💡 {moon.tip}</div>
        </div>
        {/* 월령 바 */}
        <div style={{height:6,borderRadius:3,background:"#0d2040",overflow:"hidden"}}>
          <div style={{width:`${moon.illum}%`,height:"100%",borderRadius:3,
            background:`linear-gradient(90deg, ${sc.color}44, ${sc.color})`,transition:"width 0.5s"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          <span style={{fontSize:"9px",color:S.col.dim}}>🌑 신월</span>
          <span style={{fontSize:"9px",color:S.col.dim}}>🌕 보름</span>
        </div>
      </div>
      {/* 박명 */}
      <div style={{padding:"14px",...S.cardLg, border:`1px solid ${sc.color}22`}}>
        <div style={{fontSize:"12px",fontWeight:"700",color:sc.color,marginBottom:8}}>🌅 {currentMonth}월 박명 시각 (서울)</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div style={{...S.card, padding:"8px 10px",textAlign:"center"}}>
            <div style={S.label}>천문박명 종료</div>
            <div style={{fontSize:"15px",fontWeight:"700",color:S.col.body}}>{tw.astEnd}</div>
            <div style={{fontSize:"9px",color:S.col.dim}}>이 시각 이후 관측 시작</div>
          </div>
          <div style={{...S.card, padding:"8px 10px",textAlign:"center"}}>
            <div style={S.label}>천문박명 시작</div>
            <div style={{fontSize:"15px",fontWeight:"700",color:S.col.body}}>{tw.astStart}</div>
            <div style={{fontSize:"9px",color:S.col.dim}}>이 시각 전까지 관측 가능</div>
          </div>
        </div>
        <div style={{fontSize:"11px",color:S.col.muted,lineHeight:1.6}}>📝 {tw.note}</div>
      </div>
      {/* 관측 팁 */}
      <div style={{padding:"12px 14px",...S.cardLg, border:`1px solid ${sc.color}22`}}>
        <div style={{fontSize:"11px",fontWeight:"700",color:sc.color,marginBottom:6}}>📋 일반 관측 팁</div>
        <div style={{fontSize:"12px",color:S.col.body,lineHeight:1.8,...S.serif}}>
          {"• 음력 그믐 전후 3~4일이 딥스카이 관측 최적기입니다.\n• 달이 떠 있어도 달 반대편 하늘은 관측 가능합니다.\n• 망원경은 야외에 20~30분 두어 온도 순응 후 사용하세요.\n• 적색 손전등(빨간 셀로판)으로 암순응을 보호하세요.".split("\n").map((line,i) => <div key={i}>{line}</div>)}
        </div>
      </div>
    </div>
  );
}

/* ── CHALLENGE PANEL ── */
function ChallengePanel({ season, sc, onSelect }) {
  const [filter, setFilter] = useState("all"); // all | season
  const items = filter === "all" ? OBS_CHALLENGES : OBS_CHALLENGES.filter(c => c.season === season);
  return (
    <div style={S.flexCol(10)}>
      <div style={S.infoHint}>
        🔭 이중성·변광성 관측 챌린지 — 안시 관측으로 도전할 수 있는 목표들입니다.
      </div>
      <div style={{display:"flex",gap:5}}>
        {[["all","전체"],["season",`이번 계절`]].map(([f,lbl])=>(
          <button key={f} onClick={()=>setFilter(f)} style={S.tabBtn(filter===f, sc.color)}>{lbl}</button>
        ))}
      </div>
      {items.map((ch,i)=>(
        <div key={i} style={{padding:"14px",...S.panel, border:`1px solid ${ch.color}33`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
            <span style={{fontSize:"14px",fontWeight:"700",color:ch.color}}>{ch.name}</span>
            <span style={{fontSize:"10px",color:S.col.muted,...S.card,padding:"1px 6px",borderRadius:8}}>{ch.type}</span>
            <span style={{fontSize:"11px",marginLeft:"auto"}}>{ch.diff}</span>
          </div>
          <div style={{fontSize:"12px",color:S.col.body,lineHeight:1.7,marginBottom:6}}>{ch.desc}</div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:"10px",color:S.col.dim}}>📍 {ch.constellation}</span>
            {ch.period && <span style={{fontSize:"10px",color:ch.color}}>⏱️ 주기 {ch.period}</span>}
            <button onClick={()=>{
              const constId = Object.keys(CONST_DATA).find(id => CONST_DATA[id]?.name === ch.constellation);
              if(constId) onSelect(constId);
            }} style={{...S.tabBtn(false,ch.color),fontSize:"9px",marginLeft:"auto"}}>
              별자리 보기 →
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── MAIN APP ── */
export default function App() {
  const now = new Date();
  const [season, setSeason] = useState("spring");
  const [selected, setSelected] = useState("leo");
  const [tab, setTab] = useState("info");
  const [showAst, setShowAst] = useState(false);
  const [todayMode, setTodayMode] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [obsHour, setObsHour] = useState(22);          // 관측 시간 21~01
  const [checklist, setChecklist] = useState(()=>{
    try{ const s=localStorage.getItem('constellation-checklist'); return s?JSON.parse(s):{}; }catch{return{};}
  });
  const [urbanFilter, setUrbanFilter] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [nightMode, setNightMode] = useState(false);  // 야간 적색 필터
  const [mobileTab, setMobileTab] = useState("map");
  const [isMobile, setIsMobile] = useState(typeof window!=='undefined' && window.innerWidth < 768);
  useEffect(()=>{
    const onResize=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener('resize',onResize);
    return ()=>window.removeEventListener('resize',onResize);
  },[]);
  const [searchQuery, setSearchQuery] = useState("");    // 검색어
  const [korSubTab, setKorSubTab] = useState("this");   // this | 28su | quiz
  const [show28su, setShow28su] = useState(false);       // 방위도 28수 오버레이
  const [compassLock, setCompassLock] = useState(false);  // 나침반-방위도 연동
  const { heading, permission: compassPerm, startListening } = useCompass();
  const { active: wakeLockActive, supported: wakeLockSupported, request: requestWakeLock, release: releaseWakeLock } = useWakeLock();

  const toggleCheck = (id) => setChecklist(prev => ({...prev, [id]: !prev[id]}));
  useEffect(()=>{try{localStorage.setItem('constellation-checklist',JSON.stringify(checklist));}catch{}},[checklist]);

  const sc = SEASONS_CFG.find(s=>s.id===season) || {color:"#7EE8C8",nebula:"#030B1A",emoji:"🌸",label:"봄",months:"3~5월"};
  const c = CONST_DATA[selected] || {};
  const ids = SEASON_CONSTS[season] || [];
  const todayVisible = MONTHLY_VISIBLE[currentMonth] || [];
  const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

  const changeSeason=(s)=>{ setSeason(s); setSelected((SEASON_CONSTS[s]||[])[0]||""); setTab("info"); setShowAst(false); setTodayMode(false); };
  const selectConst=(id)=>{ setSelected(id); setTab("info"); if(CONST_DATA[id]) setSeason(CONST_DATA[id].season); if(isMobile) setMobileTab("detail"); };

  // 검색 모드: 전체 별자리에서 검색
  const searchMode = searchQuery.trim().length > 0;
  const allIds = Object.keys(CONST_DATA);
  const matchSearch = (id) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const c = CONST_DATA[id] || {};
    return (c.name||"").toLowerCase().includes(q) || (c.latin||"").toLowerCase().includes(q)
      || (c.mainStar||"").toLowerCase().includes(q) || id.toLowerCase().includes(q)
      || (c.korInfo||"").toLowerCase().includes(q);
  };

  // today mode: show all visible consts across all seasons
  const displayIds = searchMode
    ? allIds.filter(matchSearch)
    : (todayMode ? todayVisible.filter(id=>CONST_DATA[id]) : ids)
      .filter(id => !urbanFilter || URBAN_VIS[id] === "urban");
  const activePlanet = todayMode ? PLANETS_NOW : [];


  return (
    <div style={{background:sc.nebula,minHeight:"100vh",color:"#d0e8f8",fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif",fontSize:isMobile?"15px":"14px",transition:"background 0.8s",paddingTop:"env(safe-area-inset-top)"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600&family=Exo+2:wght@300;700;800&display=swap');
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#010810} ::-webkit-scrollbar-thumb{background:#1a3050;border-radius:3px}
        .mobile-scroll::-webkit-scrollbar{display:none} .mobile-scroll{-ms-overflow-style:none;scrollbar-width:none}
        .cc{transition:all .15s} .cc:hover{background:rgba(255,255,255,.05)!important;transform:translateY(-1px)} .tb{transition:all .2s}
      `}</style>

      {/* HEADER */}
      <div style={{padding:isMobile?"14px 16px":"10px 18px",borderBottom:"1px solid #0d2040",background:"rgba(2,12,28,.92)",backdropFilter:"blur(10px)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",marginBottom:"8px"}}>
          <div>
            <div style={{fontSize:isMobile?"14px":"16px",fontWeight:"800",color:"#c8e8ff",letterSpacing:"1px",fontFamily:"'Exo 2',sans-serif",whiteSpace:"nowrap"}}>🔭 별자리 학습 가이드</div>
            <div style={{fontSize:"10px",color:"#3a6a8a",marginTop:"1px"}}>서울 37.5°N · 도심 5% 관측 웹앱</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:isMobile?"8px":"6px",flexWrap:"wrap",justifyContent:"flex-end"}}>
            {todayMode && (
              <select value={currentMonth} onChange={e=>setCurrentMonth(Number(e.target.value))}
                style={{padding:isMobile?"8px 10px":"4px 7px",borderRadius:"8px",border:"1px solid #1a4060",background:"#041020",color:"#7EE8C8",fontSize:isMobile?"13px":"11px",cursor:"pointer",fontFamily:"inherit"}}>
                {["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"].map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
              </select>
            )}
            {/* Urban filter */}
            <button onClick={()=>setUrbanFilter(v=>!v)}
              style={{...S.pillBtn(urbanFilter, "#FFD166"), padding:isMobile?"8px 14px":"4px 10px", fontSize:isMobile?"13px":"11px"}}>
              🏙️ {urbanFilter ? "도심만 ON" : "도심 필터"}
            </button>
            {/* Today mode */}
            <button onClick={()=>setTodayMode(v=>!v)}
              style={{padding:isMobile?"8px 14px":"4px 10px",borderRadius:"16px",border:"none",cursor:"pointer",fontSize:isMobile?"13px":"11px",fontFamily:"inherit",fontWeight:"700",
                background:todayMode?"linear-gradient(135deg,#FFD166,#F4845F)":"#0d2040",
                color:todayMode?"#030B1A":"#4a8aa8",
                boxShadow:todayMode?"0 0 10px rgba(255,200,80,0.35)":"none"}}>
              🌙 {todayMode ? `${["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"][currentMonth-1]} 오늘 밤` : "오늘 밤 보기"}
            </button>
            {!todayMode && <div style={{fontSize:"11px",color:sc.color,fontWeight:"700"}}>{sc.emoji} {sc.label}철</div>}
          </div>
        </div>
        {/* Time slider */}
        <div style={{display:"flex",alignItems:"center",gap:"10px",padding:isMobile?"8px 0":"4px 0"}}>
          <span style={{fontSize:isMobile?"12px":"10px",color:"#2a5070",flexShrink:0}}>🕙 관측 시간</span>
          <input type="range" min={19} max={25} step={0.5} value={obsHour}
            onChange={e=>setObsHour(Number(e.target.value))}
            style={{flex:1,accentColor:sc.color,cursor:"pointer",height:isMobile?"6px":"3px"}}/>
          <span style={{fontSize:"12px",fontWeight:"700",color:sc.color,minWidth:"40px",textAlign:"right"}}>
            {(()=>{const h=obsHour>=24?obsHour-24:obsHour;const hh=Math.floor(h);const mm=h%1?'30':'00';return `${String(hh).padStart(2,'0')}:${mm}`;})()}
          </span>
        </div>
        {/* 나침반 + WakeLock 컨트롤 */}
        <div style={{display:"flex",gap:isMobile?10:6,padding:isMobile?"8px 0":"4px 0",alignItems:"center",flexWrap:"wrap"}}>
          {/* 나침반 버튼 */}
          {compassPerm === "granted" ? (
            <div style={{display:"flex",alignItems:"center",gap:5,padding:isMobile?"6px 12px":"3px 10px",borderRadius:14,
              background:"rgba(255,209,102,0.15)",border:"1px solid rgba(255,209,102,0.4)"}}>
              <span style={{fontSize:"11px",color:"#FFD166",fontWeight:"700"}}>
                🧭 {heading !== null ? `${heading}° ${["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(heading/22.5)%16]}` : "측정 중…"}
              </span>
            </div>
          ) : compassPerm === "denied" ? (
            <span style={{fontSize:"10px",color:"#F4845F"}}>🧭 나침반 권한 거부됨</span>
          ) : compassPerm === "unsupported" ? (
            <span style={{fontSize:"10px",color:"#3a6a8a"}}>🧭 나침반 미지원 기기</span>
          ) : (
            <button onClick={startListening}
              style={{padding:isMobile?"8px 14px":"3px 10px",borderRadius:14,border:"1px solid #2a5070",background:"#0d2040",
                color:"#4a8aa8",fontSize:isMobile?"13px":"11px",cursor:"pointer",fontFamily:"inherit",fontWeight:"600"}}>
              🧭 나침반 켜기
            </button>
          )}
          {/* WakeLock 버튼 */}
          {wakeLockSupported && (
            <button onClick={wakeLockActive ? releaseWakeLock : requestWakeLock}
              style={{padding:isMobile?"8px 14px":"3px 10px",borderRadius:14,border:`1px solid ${wakeLockActive?"#7EE8C8":"#2a5070"}`,
                background:wakeLockActive?"rgba(126,232,200,0.15)":"#0d2040",
                color:wakeLockActive?"#7EE8C8":"#4a8aa8",fontSize:isMobile?"13px":"11px",cursor:"pointer",fontFamily:"inherit",fontWeight:"600"}}>
              {wakeLockActive ? "💡 화면 켜짐 유지 ON" : "💡 화면 꺼짐 방지"}
            </button>
          )}
          {heading !== null && <span style={{fontSize:"10px",color:"#3a6a8a"}}>방위도 화살표 활성</span>}
          {/* 나침반 연동 */}
          {heading !== null && (
            <button onClick={()=>setCompassLock(v=>!v)}
              style={{padding:isMobile?"8px 14px":"3px 10px",borderRadius:14,
                border:`1px solid ${compassLock?"#FFD166":"#2a5070"}`,
                background:compassLock?"rgba(255,209,102,0.2)":"#0d2040",
                color:compassLock?"#FFD166":"#4a8aa8",fontSize:isMobile?"13px":"11px",
                cursor:"pointer",fontFamily:"inherit",fontWeight:"600"}}>
              {compassLock ? "🧭 연동 ON" : "🧭 방위도 연동"}
            </button>
          )}
          {/* 야간 적색 필터 */}
          <button onClick={()=>setNightMode(v=>!v)}
            style={{padding:isMobile?"8px 14px":"3px 10px",borderRadius:14,
              border:`1px solid ${nightMode?"#FF4444":"#2a5070"}`,
              background:nightMode?"rgba(255,50,50,0.2)":"#0d2040",
              color:nightMode?"#FF6B6B":"#4a8aa8",fontSize:isMobile?"13px":"11px",
              cursor:"pointer",fontFamily:"inherit",fontWeight:"600"}}>
            {nightMode ? "🔴 야간모드 ON" : "🔴 야간모드"}
          </button>
        </div>
      </div>

      {/* SEASON TABS */}
      <div style={{display:"flex",borderBottom:"1px solid #0d2040",background:"rgba(2,8,18,.9)"}}>
        {SEASONS_CFG.map(s=>(
          <button key={s.id} className="tb" onClick={()=>changeSeason(s.id)}
            style={{flex:1,padding:isMobile?"14px 4px":"10px 4px",border:"none",background:"none",cursor:"pointer",fontSize:isMobile?"13px":"12px",fontWeight:s.id===season?"800":"400",color:s.id===season?s.color:"#2a5070",borderBottom:s.id===season?`2px solid ${s.color}`:"2px solid transparent",fontFamily:"inherit"}}>
            <div style={{fontSize:"16px"}}>{s.emoji}</div><div>{s.label}</div><div style={{fontSize:"10px",opacity:.6}}>{s.months}</div>
          </button>
        ))}
      </div>

      {/* FULLSCREEN OVERLAY */}
      {fullscreen && (
        <div style={{position:"fixed",inset:0,background:"#010810",zIndex:1000,display:"flex",flexDirection:"column"}}>
          {/* 상단 컨트롤 바 */}
          <div style={{display:"flex",alignItems:"center",gap:8,padding:isMobile?"12px 14px":"10px 18px",
            paddingTop:`calc(env(safe-area-inset-top) + ${isMobile?12:10}px)`,
            background:"rgba(2,12,28,.95)",borderBottom:"1px solid #0d2040",flexWrap:"wrap"}}>
            <button onClick={()=>setShowAst(v=>!v)}
              style={{padding:isMobile?"8px 12px":"4px 10px",borderRadius:12,border:"none",cursor:"pointer",
                fontSize:isMobile?"12px":"11px",fontFamily:"inherit",fontWeight:"700",
                background:showAst?sc.color:"#0d2040",color:showAst?"#030B1A":"#4a8aa8"}}>
              {showAst?"✦ON":"✦아스테리즘"}
            </button>
            <button onClick={()=>setShow28su(v=>!v)}
              style={{padding:isMobile?"8px 12px":"4px 10px",borderRadius:12,border:"none",cursor:"pointer",
                fontSize:isMobile?"12px":"11px",fontFamily:"inherit",fontWeight:"700",
                background:show28su?"#F4845F":"#0d2040",color:show28su?"#030B1A":"#4a8aa8"}}>
              {show28su?"🏮ON":"🏮28수"}
            </button>
            <button onClick={()=>setTodayMode(v=>!v)}
              style={{padding:isMobile?"8px 12px":"4px 10px",borderRadius:12,border:"none",cursor:"pointer",
                fontSize:isMobile?"12px":"11px",fontFamily:"inherit",fontWeight:"700",
                background:todayMode?"linear-gradient(135deg,#FFD166,#F4845F)":"#0d2040",
                color:todayMode?"#030B1A":"#4a8aa8"}}>
              🌙 {todayMode?"오늘밤 ON":"오늘밤"}
            </button>
            <div style={{flex:1}}/>
            <span style={{fontSize:isMobile?"13px":"12px",fontWeight:"700",color:sc.color,minWidth:"40px"}}>
              🕙 {(()=>{const h=obsHour>=24?obsHour-24:obsHour;const hh=Math.floor(h);const mm=h%1?'30':'00';return `${String(hh).padStart(2,'0')}:${mm}`;})()}
            </span>
          </div>
          {/* 시간 슬라이더 */}
          <div style={{display:"flex",alignItems:"center",gap:10,padding:isMobile?"8px 14px":"6px 18px",background:"rgba(2,12,28,.9)"}}>
            <span style={{fontSize:"10px",color:"#2a5070",flexShrink:0}}>19시</span>
            <input type="range" min={19} max={25} step={0.5} value={obsHour}
              onChange={e=>setObsHour(Number(e.target.value))}
              style={{flex:1,accentColor:sc.color,cursor:"pointer",height:isMobile?"6px":"4px"}}/>
            <span style={{fontSize:"10px",color:"#2a5070",flexShrink:0}}>01시</span>
          </div>
          {/* 방위도 — 화면 꽉 차게 */}
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
            <Planisphere season={season} selected={selected} onSelect={id=>{selectConst(id);setFullscreen(false);}}
              color={sc.color} showAst={showAst} show28su={show28su} todayMode={todayMode} currentMonth={currentMonth}
              obsHour={obsHour} fullscreen={true} heading={heading} compassLock={compassLock}/>
          </div>
          {/* 하단 닫기 버튼 */}
          <div style={{padding:isMobile?"14px 14px":"10px 18px",
            paddingBottom:`calc(env(safe-area-inset-bottom) + ${isMobile?14:10}px)`,
            background:"rgba(2,12,28,.95)",borderTop:"1px solid #0d2040",
            display:"flex",justifyContent:"center"}}>
            <button onClick={()=>setFullscreen(false)}
              style={{padding:isMobile?"14px 40px":"10px 30px",borderRadius:20,border:"1px solid #1a4060",
                background:"#0d2040",color:"#89CFF0",fontSize:isMobile?"15px":"13px",
                cursor:"pointer",fontFamily:"inherit",fontWeight:"700"}}>
              ✕ 닫기
            </button>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT */}
      <div style={{display:"flex",flexDirection:isMobile?"column":"row",minHeight:isMobile?"calc(100vh - 180px)":"calc(100vh - 120px)"}}>

        {/* LEFT — 지도 패널 */}
        <div style={{width:isMobile?"100%":"300px",flexShrink:0,borderRight:isMobile?"none":"1px solid #0d2040",display:isMobile && mobileTab!=="map"?"none":"flex",flexDirection:"column"}}>
          <div style={{padding:"8px 6px 2px",background:"rgba(3,10,20,.8)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px",padding:"0 4px"}}>
              <span style={{fontSize:"10px",color:"#2a5070"}}>
                {todayMode?`🌙 ${["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"][currentMonth-1]} 밤하늘`:`📐 ${sc.months}`}
              </span>
              <div style={{display:"flex",gap:isMobile?8:4}}>
                <button onClick={()=>setShowAst(v=>!v)} style={{padding:isMobile?"6px 12px":"2px 7px",borderRadius:10,border:"none",cursor:"pointer",fontSize:isMobile?"12px":"10px",fontFamily:"inherit",background:showAst?sc.color:"#0d2040",color:showAst?"#030B1A":"#4a8aa8",fontWeight:showAst?"700":"400"}}>
                  {showAst?"✦ON":"✦아스테리즘"}
                </button>
                <button onClick={()=>setShow28su(v=>!v)} style={{padding:isMobile?"6px 12px":"2px 7px",borderRadius:10,border:"none",cursor:"pointer",fontSize:isMobile?"12px":"10px",fontFamily:"inherit",background:show28su?"#F4845F":"#0d2040",color:show28su?"#030B1A":"#4a8aa8",fontWeight:show28su?"700":"400"}}>
                  {show28su?"🏮ON":"🏮28수"}
                </button>
                <button onClick={()=>setFullscreen(true)} style={{padding:isMobile?"6px 12px":"2px 7px",borderRadius:10,border:"none",cursor:"pointer",fontSize:isMobile?"12px":"10px",fontFamily:"inherit",background:"#0d2040",color:"#4a8aa8"}}>
                  ⛶ 크게
                </button>
              </div>
            </div>
            <Planisphere season={season} selected={selected} onSelect={selectConst}
              color={sc.color} showAst={showAst} show28su={show28su} todayMode={todayMode} currentMonth={currentMonth}
              obsHour={obsHour} fullscreen={false} heading={heading} compassLock={compassLock}/>
            {todayMode && (
              <div style={{padding:"4px 8px",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                {(()=>{const moon=getMoonPhase();const mp=getMoonSkyPosition(obsHour,moon.phase);return(
                  <div style={{display:"flex",alignItems:"center",gap:3,fontSize:"10px",color:"#FFE4A0"}}>
                    <span>{moon.emoji}</span> {moon.name} {moon.illum}%{!mp.visible&&" (지평선 아래)"}
                  </div>
                );})()}
                {PLANETS_NOW.map((p,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:3,fontSize:"10px",color:p.color}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:p.color,boxShadow:`0 0 4px ${p.color}`}}/>
                    {p.name}
                  </div>
                ))}
              </div>
            )}
            {show28su && (
              <div style={{padding:"4px 8px",display:"flex",gap:6,flexWrap:"wrap"}}>
                {QUADRANTS.map(q=>(
                  <div key={q.id} style={{display:"flex",alignItems:"center",gap:3,fontSize:"10px",color:q.color}}>
                    <div style={{width:5,height:5,background:q.color,transform:"rotate(45deg)"}}/>{q.symbol}{q.name.split(" ")[1]}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"6px"}}>
            {/* 검색 바 */}
            <div style={{padding:"2px 2px 6px",position:"relative"}}>
              <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                placeholder="🔍 별자리 검색 (이름·라틴명·별)"
                style={{width:"100%",padding:isMobile?"10px 14px":"6px 10px",paddingRight:searchQuery?"28px":"10px",borderRadius:8,
                  border:"1px solid #1a3050",background:"#040f1e",color:"#90b8d0",fontSize:isMobile?"14px":"11px",
                  fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
              {searchQuery && (
                <button onClick={()=>setSearchQuery("")}
                  style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",
                    background:"none",border:"none",color:"#3a6a8a",cursor:"pointer",fontSize:"14px",padding:0,lineHeight:1}}>
                  ✕
                </button>
              )}
            </div>
            {searchMode && <div style={{fontSize:"10px",color:sc.color,padding:"2px 4px 4px",fontWeight:"600"}}>
              🔍 전체에서 {displayIds.length}개 일치
            </div>}
            {todayMode && !searchMode && (
              <div style={{display:"flex",gap:4,marginBottom:6,flexWrap:"wrap",padding:"0 2px"}}>
                {SEASONS_CFG.map(s=>(
                  <div key={s.id} style={{display:"flex",alignItems:"center",gap:2,fontSize:"10px",color:s.color}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:s.color}}/>{s.emoji}
                  </div>
                ))}
                <span style={{fontSize:"10px",color:"#2a5070",marginLeft:2}}>= 계절</span>
              </div>
            )}
            {displayIds.map(id=>{ const cn=CONST_DATA[id]||{}; const isSel=id===selected;
              const sColor=S.seasonColor(cn.season);
              const dotColor=(todayMode||searchMode)?sColor:sc.color;
              const uvis=URBAN_VIS[id]||"suburban";
              const isChecked=!!checklist[id];
              return (
              <div key={id} className="cc" onClick={()=>selectConst(id)}
                style={{padding:isMobile?"11px 12px":"7px 9px",marginBottom:isMobile?"5px":"3px",borderRadius:"8px",cursor:"pointer",
                  background:isSel?`${dotColor}18`:"rgba(255,255,255,.02)",
                  border:`1px solid ${isSel?dotColor+"44":"#0d2040"}`,opacity:isChecked?0.5:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div onClick={e=>{e.stopPropagation();toggleCheck(id);}}
                    style={{flexShrink:0,width:isMobile?22:15,height:isMobile?22:15,borderRadius:isMobile?4:3,border:`1.5px solid ${dotColor}66`,
                      background:isChecked?dotColor:"transparent",display:"flex",alignItems:"center",
                      justifyContent:"center",cursor:"pointer",fontSize:"9px",color:"#030B1A",fontWeight:"900"}}>
                    {isChecked&&"✓"}
                  </div>
                  <span style={{fontSize:"15px"}}>{cn.symbol||"★"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:isSel?"700":"400",color:isSel?dotColor:"#90b8d0",fontSize:isMobile?"14px":"12px",
                      textDecoration:isChecked?"line-through":"none"}}>{cn.name||id}</div>
                    <div style={{fontSize:isMobile?"11px":"9px",color:"#2a5070"}}>{cn.latin||""}</div>
                  </div>
                  <span style={{fontSize:"9px",color:URBAN_COLORS[uvis],flexShrink:0,
                    background:`${URBAN_COLORS[uvis]}18`,padding:"1px 4px",borderRadius:8}}>
                    {uvis==="urban"?"🏙️":uvis==="suburban"?"🌆":"🌲"}
                  </span>
                </div>
              </div>
            );})}
            {displayIds.length>0&&(
              <div style={{marginTop:6,padding:"6px 10px",borderRadius:8,background:"rgba(4,15,30,.8)",border:"1px solid #0d2040",fontSize:"11px",color:"#3a6a8a",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>관측 완료</span>
                <span style={{color:sc.color,fontWeight:"700"}}>{displayIds.filter(id=>checklist[id]).length}/{displayIds.length}</span>
                {Object.keys(checklist).length>0&&<button onClick={()=>setChecklist({})} style={{fontSize:"9px",color:"#2a5070",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"inherit"}}>초기화</button>}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — 상세 패널 */}
        <div style={{flex:1,display:isMobile && mobileTab!=="detail"?"none":"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
          <div style={{padding:"14px 18px",borderBottom:"1px solid #0d2040",background:"rgba(3,10,20,.7)",backdropFilter:"blur(8px)"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:"12px"}}>
              <span style={{fontSize:"38px",lineHeight:1}}>{c.symbol||"★"}</span>
              <div style={{flex:1}}>
                <h2 style={{margin:0,fontSize:"21px",fontWeight:"800",color:sc.color,fontFamily:"'Noto Serif KR',serif"}}>{c.name||selected}</h2>
                <div style={{fontSize:"12px",color:"#3a6a8a"}}>{c.latin||""} · {c.bestTime||""}</div>
                <div style={{fontSize:"11px",color:"#2a5a70",marginTop:"2px"}}>⭐ {c.mainStar||""}</div>
                {c.korInfo && <div style={{fontSize:"11px",color:sc.color,marginTop:"4px",opacity:.85}}>🔖 {c.korInfo}</div>}
                {selected && URBAN_VIS[selected] && (
                  <div style={{marginTop:"6px",display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:12,
                    background:`${URBAN_COLORS[URBAN_VIS[selected]]}18`,border:`1px solid ${URBAN_COLORS[URBAN_VIS[selected]]}44`}}>
                    <span style={{fontSize:"11px",color:URBAN_COLORS[URBAN_VIS[selected]],fontWeight:"700"}}>
                      {URBAN_LABELS[URBAN_VIS[selected]]}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className={isMobile?"mobile-scroll":""} style={{display:"flex",gap:"4px",marginTop:"10px",flexWrap:isMobile?"nowrap":"wrap",overflowX:isMobile?"auto":"visible",paddingBottom:isMobile?"4px":"0",WebkitOverflowScrolling:"touch"}}>
              {[["info","📍 관측"],["myth","📖 신화"],["talk","💬 스몰토크"],["specs","⭐ 별 스펙"],["dso","🔭 딥스카이"],["kor","🏮 동양"],["planet","🪐 행성"],["cond","🌙 관측조건"],["challenge","🎯 챌린지"],["guide","🌟 초보가이드"],["ast","✦ 아스테리즘"]].map(([t,lbl])=>(
                <button key={t} className="tb" onClick={()=>setTab(t)}
                  style={{...S.tabBtn(t===tab, sc.color),flexShrink:0,whiteSpace:"nowrap",padding:isMobile?"8px 14px":"3px 9px",fontSize:isMobile?"12px":"10.5px"}}>{lbl}</button>
              ))}
            </div>
          </div>

          <div style={{flex:1,overflowY:"auto",padding:"16px 18px"}}>
            {tab==="info" && (
              <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
                <div style={{background:"rgba(1,12,26,.8)",border:`1px solid ${sc.color}22`,borderRadius:"12px",padding:"12px",maxWidth:"260px",alignSelf:"center",width:"100%"}}>
                  <div style={{fontSize:"10px",color:"#2a5070",marginBottom:"8px",textAlign:"center"}}>✦ 별자리 패턴 — 밝기별 크기 차이</div>
                  {c.stars && <StarMapSVG data={c} color={sc.color}/>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"7px"}}>
                  {[["🧭 방향",c.direction],["📐 최적 고도",c.altitude],["🕙 최적 시각",c.bestTime],["⭐ 주요 별",c.mainStar]].map(([k,v])=>(
                    <div key={k} style={{background:"rgba(4,15,30,.8)",border:"1px solid #0d2040",borderRadius:"8px",padding:"10px"}}>
                      <div style={{fontSize:"10px",color:"#3a6a8a",marginBottom:"3px"}}>{k}</div>
                      <div style={{fontSize:"11.5px",color:"#90b8d0",lineHeight:1.5}}>{v||"-"}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:"linear-gradient(135deg,#030f1e,#020c18)",border:`1px solid ${sc.color}33`,borderRadius:"10px",padding:"13px"}}>
                  <div style={{fontSize:"11px",fontWeight:"700",color:sc.color,marginBottom:"6px"}}>🔍 찾는 방법</div>
                  <div style={{fontSize:"13px",color:"#90b8d0",lineHeight:1.8}}>{c.howToFind||"-"}</div>
                </div>
              </div>
            )}
            {tab==="myth" && (
              <div style={S.flexCol(12)}>
                <div style={{...S.panel, border:`1px solid ${sc.color}33`, padding:"20px"}}>
                  <div style={{fontSize:"32px",textAlign:"center",marginBottom:"12px"}}>{c.symbol||"★"}</div>
                  <div style={{fontSize:"13.5px",color:"#b8d8f0",lineHeight:2.0,...S.serif}}>
                    {c.mythFull || c.myth || "-"}
                  </div>
                </div>
                {/* 별자리 간 스토리 링크 */}
                {STORY_LINKS[selected] && STORY_LINKS[selected].length > 0 && (
                  <div style={{...S.cardLg, border:`1px solid ${sc.color}22`, padding:"12px 14px"}}>
                    <div style={{fontSize:"11px",fontWeight:"700",color:sc.color,marginBottom:8}}>🔗 이어지는 이야기</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {STORY_LINKS[selected].map((link,i) => {
                        const lc = CONST_DATA[link.id];
                        return lc ? (
                          <button key={i} onClick={()=>selectConst(link.id)}
                            style={{padding:"5px 10px",borderRadius:10,cursor:"pointer",fontSize:"11px",
                              background:`${S.seasonColor(lc.season)}15`,border:`1px solid ${S.seasonColor(lc.season)}44`,
                              color:S.seasonColor(lc.season),fontFamily:"inherit",fontWeight:"600"}}>
                            {lc.symbol} {lc.name} — {link.rel}
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
                <div style={{...S.card, padding:"12px 14px"}}>
                  <div style={{fontSize:"10px",color:S.col.muted,marginBottom:"4px"}}>📌 찾는 방법</div>
                  <div style={{fontSize:"12px",color:"#80aac0",lineHeight:1.7}}>{c.howToFind||"-"}</div>
                </div>
                {/* 나무위키 더 알아보기 */}
                <a href={`https://namu.wiki/w/${encodeURIComponent(c.name||"")}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{display:"block",textAlign:"center",padding:"8px",fontSize:"11px",
                    color:S.col.muted,textDecoration:"none",borderRadius:8,
                    background:"rgba(255,255,255,.02)"}}>
                  📖 나무위키에서 더 보기 →
                </a>
              </div>
            )}
            {tab==="talk" && (
              <div style={S.flexCol(10)}>
                <div style={{...S.infoHint, border:`1px solid ${sc.color}22`}}>
                  💬 관측하면서 옆 사람한테 툭 던질 수 있는 얘기들이에요. 전부 사실입니다!
                </div>
                {(c.smallTalk||["아직 스몰토크 데이터가 없어요. 조만간 추가 예정!"]).map((talk,i)=>(
                  <div key={i} style={{display:"flex",gap:12,padding:"13px 14px",borderRadius:10,
                    ...S.panel, border:`1px solid ${sc.color}22`}}>
                    <div style={{flexShrink:0,fontSize:"18px",lineHeight:1}}>
                      {["🌟","💥","🔭","😱","🤔","✨","🌌","⚡"][i%8]}
                    </div>
                    <div style={{...S.bodyText, color:S.col.emphasis, lineHeight:1.85, ...S.serif}}>
                      {talk}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab==="specs" && (
              <div style={S.flexCol(10)}>
                <div style={{...S.infoHint, border:`1px solid ${sc.color}22`}}>
                  ⭐ 주요 별 물리 데이터 — 거리(광년)·표면온도(K)·분류·반지름(태양=1)
                </div>
                {c.starSpecs ? Object.entries(c.starSpecs).map(([starName, s])=>(
                  <div key={starName} style={{padding:"13px 14px",borderRadius:10,
                    background:"rgba(4,15,30,.8)",border:`1px solid ${sc.color}22`}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:"14px",fontWeight:"700",color:sc.color}}>{starName}</span>
                      <span style={{fontSize:"10px",color:"#4a8aa8",background:"rgba(4,15,30,.8)",
                        border:"1px solid #0d2040",padding:"1px 6px",borderRadius:8}}>{s.type}</span>
                      <span style={{fontSize:"10px",color:"#FFD166",marginLeft:"auto"}}>
                        {s.mag >= 0 ? `+${s.mag}등` : `${s.mag}등`}
                      </span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
                      {[["📏 거리",`${s.dist}광년`],["🌡️ 온도",`${s.temp.toLocaleString()}K`],["⭕ 반지름",`태양의 ${s.radius}배`]].map(([k,v])=>(
                        <div key={k} style={{background:"rgba(1,12,26,.8)",borderRadius:8,padding:"7px 8px",textAlign:"center"}}>
                          <div style={{fontSize:"9px",color:"#3a6a8a",marginBottom:3}}>{k}</div>
                          <div style={{fontSize:"11px",color:"#90b8d0",fontWeight:"600"}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {s.note && <div style={{fontSize:"11px",color:"#3a6a8a",background:"rgba(255,255,255,.02)",
                      padding:"6px 8px",borderRadius:6,lineHeight:1.5,borderLeft:`2px solid ${sc.color}44`}}>
                      💡 {s.note}
                    </div>}
                  </div>
                )) : (
                  <div style={{textAlign:"center",color:"#2a5070",padding:"30px",fontSize:"12px"}}>
                    이 별자리의 스펙 데이터가 아직 없어요
                  </div>
                )}
              </div>
            )}
            {tab==="dso" && (
              <div>
                <div style={{...S.infoHint, marginBottom:"12px"}}>
                  💡 <strong style={{color:S.col.link}}>8인치 돕소니언 안시</strong>로 딥스카이 충분히 볼 수 있습니다. ★★★=도심가능 ★★=근교추천
                </div>
                {(c.dso||[]).map((d,i)=>(
                  <div key={i} style={{display:"flex",gap:"12px",alignItems:"flex-start",padding:"12px 13px",marginBottom:"8px",borderRadius:"10px",background:"rgba(4,15,30,.8)",border:`1px solid ${sc.color}22`}}>
                    <div style={{flexShrink:0,width:34,height:34,borderRadius:"50%",background:`${sc.color}18`,border:`1px solid ${sc.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",color:sc.color,fontWeight:"700"}}>{i+1}</div>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"3px",flexWrap:"wrap"}}>
                        <span style={{fontSize:"13px",fontWeight:"700",color:"#a8d0e8"}}>{d.name}</span>
                        <span style={{fontSize:"10px",color:sc.color,border:`1px solid ${sc.color}44`,padding:"1px 6px",borderRadius:"8px"}}>{d.mag}</span>
                        <span style={{fontSize:"12px"}}>{d.vis}</span>
                      </div>
                      <div style={{fontSize:"12px",color:"#6a9ab0",lineHeight:1.6}}>{d.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab==="kor" && (
              <div style={S.flexCol(10)}>
                {/* 서브탭 */}
                <div style={{display:"flex",gap:4}}>
                  {[["this","🏮 이 별자리"],["28su","🐉 28수 전체"],["quiz","🧠 퀴즈"]].map(([k,lbl])=>(
                    <button key={k} onClick={()=>setKorSubTab(k)} style={S.tabBtn(korSubTab===k, sc.color)}>{lbl}</button>
                  ))}
                </div>
                {korSubTab === "this" && (
                  <div style={S.flexCol(12)}>
                    <div style={{padding:"12px 14px",...S.cardLg, border:`1px solid ${sc.color}33`}}>
                      <div style={{fontSize:"11px",fontWeight:"700",color:sc.color,marginBottom:"6px"}}>🔖 동양 별자리 정보</div>
                      <div style={{...S.bodyText, color:S.col.emphasis, ...S.serif}}>{c.korInfo||"-"}</div>
                    </div>
                    {c.korStars && Object.entries(c.korStars).map(([star,korName])=>(
                      <div key={star} style={{display:"flex",gap:"12px",padding:"12px 13px",...S.cardLg, border:`1px solid ${sc.color}22`}}>
                        <span style={{fontSize:"20px"}}>⭐</span>
                        <div>
                          <div style={{fontSize:"13px",fontWeight:"700",color:sc.color,marginBottom:"3px"}}>{star}</div>
                          <div style={{fontSize:"12px",color:"#80aac0",lineHeight:1.65}}>{korName}</div>
                        </div>
                      </div>
                    ))}
                    {/* 이 별자리와 관련된 28수 */}
                    {(()=>{
                      const related = TWENTY_EIGHT_SU.filter(su => su.appId === selected);
                      if (!related.length) return null;
                      const qd = QUADRANTS.find(q=>q.id===related[0].quad);
                      return (
                        <div style={{padding:"12px 14px",...S.cardLg, border:`1px solid ${qd?.color||sc.color}22`}}>
                          <div style={{fontSize:"11px",fontWeight:"700",color:qd?.color||sc.color,marginBottom:8}}>
                            {qd?.symbol} 관련 28수
                          </div>
                          {related.map(su=>(
                            <div key={su.num} style={{marginBottom:6}}>
                              <span style={{fontSize:"14px",fontWeight:"700",color:qd?.color,...S.serif}}>{su.num}. {su.name} ({su.hanja})</span>
                              <div style={{fontSize:"11px",color:S.col.body,lineHeight:1.7,marginTop:2}}>{su.detail}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {korSubTab === "28su" && <SuPanel sc={sc} onSelect={selectConst}/>}
                {korSubTab === "quiz" && <QuizPanel sc={sc}/>}
              </div>
            )}
            {tab==="planet" && (
              <div style={S.flexCol(12)}>
                <div style={S.infoHint}>
                  🪐 <strong style={{color:S.col.link}}>2026년 3월 기준</strong> 서울 밤하늘 행성. 🌙 오늘밤 모드 ON 시 방위도에 표시.
                </div>
                {PLANETS_NOW.map((p,i)=>(
                  <div key={i} style={{display:"flex",gap:"12px",alignItems:"flex-start",padding:"14px",borderRadius:"12px",background:"rgba(4,15,30,.8)",border:`2px solid ${p.color}44`}}>
                    <div style={{flexShrink:0,width:42,height:42,borderRadius:"50%",background:`radial-gradient(circle at 35% 35%, white, ${p.color})`,boxShadow:`0 0 14px ${p.color}88`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px"}}>
                      {p.name.split(" ")[1]}
                    </div>
                    <div>
                      <div style={{fontWeight:"800",color:p.color,fontSize:"15px",marginBottom:"4px"}}>{p.name}</div>
                      <div style={{fontSize:"12px",color:"#6a9ab0",lineHeight:1.7}}>{p.desc}</div>
                      <div style={{fontSize:"10px",color:"#2a5070",marginTop:6}}>방위 {p.az}° · 고도 {p.alt}°</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab==="guide" && <GuidePanel season={season} currentMonth={currentMonth} sc={sc}/>}
            {tab==="cond" && <ObsCondPanel currentMonth={currentMonth} sc={sc}/>}
            {tab==="challenge" && <ChallengePanel season={season} sc={sc} onSelect={selectConst}/>}
            {tab==="ast" && <AsterismPanel season={season}/>}
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM TAB BAR */}
      {isMobile && (
        <div style={{display:"flex",borderTop:"1px solid #0d2040",background:"rgba(2,8,18,.95)",backdropFilter:"blur(10px)",position:"sticky",bottom:0,zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
          {[["map","🗺️ 지도"],["detail","📋 상세"]].map(([t,lbl])=>(
            <button key={t} onClick={()=>setMobileTab(t)}
              style={{flex:1,padding:"14px 4px",border:"none",background:"none",cursor:"pointer",
                fontSize:"14px",fontWeight:mobileTab===t?"700":"400",
                color:mobileTab===t?sc.color:"#2a5070",
                borderTop:mobileTab===t?`2px solid ${sc.color}`:"2px solid transparent",
                fontFamily:"inherit"}}>
              {lbl}
            </button>
          ))}
        </div>
      )}

      <div style={{padding:"7px 18px",borderTop:"1px solid #0d2040",fontSize:"10px",color:"#1a3050",display:isMobile?"none":"flex",justifyContent:"space-between",background:"rgba(2,8,18,.9)"}}>
        <span>서울 37.5°N · 도심 5% 관측 · v9c</span>
        <span>{Object.keys(CONST_DATA).length}개 별자리 · 28수 · 줌/핀치/체크리스트 🌙</span>
      </div>

      {/* 야간 적색 필터 오버레이 */}
      {nightMode && (
        <div style={{position:"fixed",inset:0,background:"rgba(80,0,0,0.55)",mixBlendMode:"multiply",pointerEvents:"none",zIndex:9999}}/>
      )}
    </div>
  );
}
