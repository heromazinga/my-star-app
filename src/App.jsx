import React, { useState, useEffect, useRef, useCallback } from "react";

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
  {name:"목성 ♃", nameEng:"Jupiter", az:232, alt:38, color:"#FFD580", size:5, desc:"쌍둥이자리 안! 폴룩스 근처에서 가장 밝게 빛남. 도심에서도 맨눈으로 선명."},
  {name:"화성 ♂", nameEng:"Mars",    az:195, alt:52, color:"#FF6B4A", size:4, desc:"게자리 근처. 붉은빛으로 구별 가능. 현재 역행 중."},
];

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

// ── 초보자 가이드 데이터 ──
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
function Planisphere({ season, selected, onSelect, color, showAst, todayMode, currentMonth, obsHour, fullscreen, heading }) {
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({x:0, y:0});
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({x:0,y:0,px:0,py:0});
  const size = fullscreen ? 520 : 300;
  const cx = size/2, cy = size/2, R = fullscreen ? 230 : 128;
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

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom(z => Math.min(2.8, Math.max(0.45, z - e.deltaY * 0.001)));
  };

  const startDrag = (clientX, clientY) => {
    setDragging(true);
    setDragStart({x:clientX, y:clientY, px:pan.x, py:pan.y});
  };
  const moveDrag = (clientX, clientY) => {
    if(!dragging) return;
    setPan({x: dragStart.px + (clientX - dragStart.x), y: dragStart.py + (clientY - dragStart.y)});
  };
  const endDrag = () => setDragging(false);

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
          style={{width:24,height:24,borderRadius:6,border:"none",background:"rgba(13,32,64,0.9)",color:"#3a6a8a",fontSize:"9px",cursor:"pointer",lineHeight:1.1,fontWeight:"600"}}>
          초기화
        </button>
      </div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{display:"block",margin:"0 auto",cursor:dragging?"grabbing":"grab"}}
        onWheel={handleWheel}
        onMouseDown={e=>{ if(e.button===0) startDrag(e.clientX,e.clientY); }}
        onMouseMove={e=>moveDrag(e.clientX,e.clientY)}
        onMouseUp={endDrag} onMouseLeave={endDrag}
        onTouchStart={e=>{ const t=e.touches[0]; startDrag(t.clientX,t.clientY); }}
        onTouchMove={e=>{ e.preventDefault(); const t=e.touches[0]; moveDrag(t.clientX,t.clientY); }}
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

          {/* Constellation markers */}
          {Object.entries(positions).map(([id,pos])=>{
            const [x,y]=toXY(pos.az,pos.alt);
            const isSel=id===selected;
            const c=CONST_DATA[id]||{};
            const seasonColor = {spring:"#7EE8C8",summer:"#FFD166",autumn:"#F4845F",winter:"#89CFF0"}[c.season]||color;
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
  const SEASON_OF_MONTH = [null,"winter","winter","spring","spring","spring","summer","summer","summer","autumn","autumn","autumn","winter"];
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
      <div style={{padding:"8px 11px",background:"rgba(4,15,30,.8)",border:"1px solid #0d2040",borderRadius:8,fontSize:"11px",color:"#3a6a8a",lineHeight:1.6}}>
        {guideMode==="season"
          ? `🌟 ${SEASON_NAMES[guideSeason]} 하늘에서 초보자가 찾기 쉬운 별 순서입니다.`
          : `🌙 ${MNAMES[guideMonth-1]} 밤 22:00 서울 기준, 지금 당장 찾을 수 있는 별입니다.`}
      </div>
      {items.map((g,i)=>(
        <div key={i} style={{display:"flex",gap:12,padding:"12px 13px",borderRadius:10,background:"rgba(4,15,30,.8)",border:`1px solid ${g.color}22`}}>
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
      <div style={{fontSize:"11px",color:"#3a6a8a",padding:"8px 12px",background:"rgba(4,15,30,0.8)",border:"1px solid #0d2040",borderRadius:"8px",lineHeight:1.6}}>
        💡 왼쪽 방위도에서 <strong style={{color:"#70a0b8"}}>아스테리즘 ON</strong> 버튼으로 하늘 위에 직접 표시됩니다.
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
  const [checklist, setChecklist] = useState({});       // {id: true/false}
  const [urbanFilter, setUrbanFilter] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [mobileTab, setMobileTab] = useState("map");
  const { heading, permission: compassPerm, startListening } = useCompass();
  const { active: wakeLockActive, supported: wakeLockSupported, request: requestWakeLock, release: releaseWakeLock } = useWakeLock();

  const toggleCheck = (id) => setChecklist(prev => ({...prev, [id]: !prev[id]}));

  const sc = SEASONS_CFG.find(s=>s.id===season) || {color:"#7EE8C8",nebula:"#030B1A",emoji:"🌸",label:"봄",months:"3~5월"};
  const c = CONST_DATA[selected] || {};
  const ids = SEASON_CONSTS[season] || [];
  const todayVisible = MONTHLY_VISIBLE[currentMonth] || [];
  const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

  const changeSeason=(s)=>{ setSeason(s); setSelected((SEASON_CONSTS[s]||[])[0]||""); setTab("info"); setShowAst(false); setTodayMode(false); };
  const selectConst=(id)=>{ setSelected(id); setTab("info"); if(CONST_DATA[id]) setSeason(CONST_DATA[id].season); };

  // today mode: show all visible consts across all seasons
  const displayIds = (todayMode ? todayVisible.filter(id=>CONST_DATA[id]) : ids)
    .filter(id => !urbanFilter || URBAN_VIS[id] === "urban");
  const activePlanet = todayMode ? PLANETS_NOW : [];


  return (
    <div style={{background:sc.nebula,minHeight:"100vh",color:"#d0e8f8",fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif",fontSize:"14px",transition:"background 0.8s"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600&family=Exo+2:wght@300;700;800&display=swap');
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#010810} ::-webkit-scrollbar-thumb{background:#1a3050;border-radius:3px}
        .cc{transition:all .15s} .cc:hover{background:rgba(255,255,255,.05)!important;transform:translateY(-1px)} .tb{transition:all .2s}
      `}</style>

      {/* HEADER */}
      <div style={{padding:"10px 18px",borderBottom:"1px solid #0d2040",background:"rgba(2,12,28,.92)",backdropFilter:"blur(10px)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",marginBottom:"8px"}}>
          <div>
            <div style={{fontSize:"16px",fontWeight:"800",color:"#c8e8ff",letterSpacing:"1px",fontFamily:"'Exo 2',sans-serif"}}>🔭 별자리 학습 가이드</div>
            <div style={{fontSize:"10px",color:"#3a6a8a",marginTop:"1px"}}>서울 37.5°N · 8인치 돕소니언 안시</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap",justifyContent:"flex-end"}}>
            {todayMode && (
              <select value={currentMonth} onChange={e=>setCurrentMonth(Number(e.target.value))}
                style={{padding:"4px 7px",borderRadius:"8px",border:"1px solid #1a4060",background:"#041020",color:"#7EE8C8",fontSize:"11px",cursor:"pointer",fontFamily:"inherit"}}>
                {["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"].map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
              </select>
            )}
            {/* Urban filter */}
            <button onClick={()=>setUrbanFilter(v=>!v)}
              style={{padding:"4px 10px",borderRadius:"16px",border:"none",cursor:"pointer",fontSize:"11px",fontFamily:"inherit",fontWeight:"700",
                background:urbanFilter?"#FFD166":"#0d2040",color:urbanFilter?"#030B1A":"#4a8aa8"}}>
              🏙️ {urbanFilter ? "도심만 ON" : "도심 필터"}
            </button>
            {/* Today mode */}
            <button onClick={()=>setTodayMode(v=>!v)}
              style={{padding:"4px 10px",borderRadius:"16px",border:"none",cursor:"pointer",fontSize:"11px",fontFamily:"inherit",fontWeight:"700",
                background:todayMode?"linear-gradient(135deg,#FFD166,#F4845F)":"#0d2040",
                color:todayMode?"#030B1A":"#4a8aa8",
                boxShadow:todayMode?"0 0 10px rgba(255,200,80,0.35)":"none"}}>
              🌙 {todayMode ? `${["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"][currentMonth-1]} 오늘 밤` : "오늘 밤 보기"}
            </button>
            {!todayMode && <div style={{fontSize:"11px",color:sc.color,fontWeight:"700"}}>{sc.emoji} {sc.label}철</div>}
          </div>
        </div>
        {/* Time slider */}
        <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"4px 0"}}>
          <span style={{fontSize:"10px",color:"#2a5070",flexShrink:0}}>🕙 관측 시간</span>
          <input type="range" min={19} max={25} step={0.5} value={obsHour}
            onChange={e=>setObsHour(Number(e.target.value))}
            style={{flex:1,accentColor:sc.color,cursor:"pointer",height:"3px"}}/>
          <span style={{fontSize:"12px",fontWeight:"700",color:sc.color,minWidth:"40px",textAlign:"right"}}>
            {(()=>{const h=obsHour>=24?obsHour-24:obsHour;const hh=Math.floor(h);const mm=h%1?'30':'00';return `${String(hh).padStart(2,'0')}:${mm}`;})()}
          </span>
        </div>
        {/* 나침반 + WakeLock 컨트롤 */}
        <div style={{display:"flex",gap:6,padding:"4px 0",alignItems:"center",flexWrap:"wrap"}}>
          {/* 나침반 버튼 */}
          {compassPerm === "granted" ? (
            <div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:14,
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
              style={{padding:"3px 10px",borderRadius:14,border:"1px solid #2a5070",background:"#0d2040",
                color:"#4a8aa8",fontSize:"11px",cursor:"pointer",fontFamily:"inherit",fontWeight:"600"}}>
              🧭 나침반 켜기
            </button>
          )}
          {/* WakeLock 버튼 */}
          {wakeLockSupported && (
            <button onClick={wakeLockActive ? releaseWakeLock : requestWakeLock}
              style={{padding:"3px 10px",borderRadius:14,border:`1px solid ${wakeLockActive?"#7EE8C8":"#2a5070"}`,
                background:wakeLockActive?"rgba(126,232,200,0.15)":"#0d2040",
                color:wakeLockActive?"#7EE8C8":"#4a8aa8",fontSize:"11px",cursor:"pointer",fontFamily:"inherit",fontWeight:"600"}}>
              {wakeLockActive ? "💡 화면 켜짐 유지 ON" : "💡 화면 꺼짐 방지"}
            </button>
          )}
          {heading !== null && <span style={{fontSize:"10px",color:"#3a6a8a"}}>방위도 화살표 활성</span>}
        </div>
      </div>

      {/* SEASON TABS */}
      <div style={{display:"flex",borderBottom:"1px solid #0d2040",background:"rgba(2,8,18,.9)"}}>
        {SEASONS_CFG.map(s=>(
          <button key={s.id} className="tb" onClick={()=>changeSeason(s.id)}
            style={{flex:1,padding:"10px 4px",border:"none",background:"none",cursor:"pointer",fontSize:"12px",fontWeight:s.id===season?"800":"400",color:s.id===season?s.color:"#2a5070",borderBottom:s.id===season?`2px solid ${s.color}`:"2px solid transparent",fontFamily:"inherit"}}>
            <div style={{fontSize:"16px"}}>{s.emoji}</div><div>{s.label}</div><div style={{fontSize:"10px",opacity:.6}}>{s.months}</div>
          </button>
        ))}
      </div>

      {/* FULLSCREEN OVERLAY */}
      {fullscreen && (
        <div style={{position:"fixed",inset:0,background:"#010810",zIndex:1000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <button onClick={()=>setFullscreen(false)}
            style={{position:"absolute",top:16,right:16,padding:"6px 14px",borderRadius:20,border:"none",background:"#0d2040",color:"#89CFF0",fontSize:"12px",cursor:"pointer",fontFamily:"inherit",fontWeight:"700",zIndex:10}}>
            ✕ 닫기
          </button>
          <div style={{fontSize:"11px",color:"#2a5070",marginBottom:"8px"}}>
            🕙 {obsHour>=24?`0${obsHour-24}:00`:`${Math.floor(obsHour)}:${obsHour%1?'30':'00'}`} 기준 · 드래그/줌 가능
          </div>
          <Planisphere season={season} selected={selected} onSelect={id=>{selectConst(id);setFullscreen(false);}}
            color={sc.color} showAst={showAst} todayMode={todayMode} currentMonth={currentMonth}
            obsHour={obsHour} fullscreen={true} heading={heading}/>
        </div>
      )}

      {/* DESKTOP LAYOUT */}
      <div style={{display:"flex",minHeight:"calc(100vh - 120px)"}}>

        {/* LEFT — 지도 패널 */}
        <div style={{width:"300px",flexShrink:0,borderRight:"1px solid #0d2040",display:"flex",flexDirection:"column"}}>
          <div style={{padding:"8px 6px 2px",background:"rgba(3,10,20,.8)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px",padding:"0 4px"}}>
              <span style={{fontSize:"10px",color:"#2a5070"}}>
                {todayMode?`🌙 ${["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"][currentMonth-1]} 밤하늘`:`📐 ${sc.months}`}
              </span>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>setShowAst(v=>!v)} style={{padding:"2px 7px",borderRadius:10,border:"none",cursor:"pointer",fontSize:"10px",fontFamily:"inherit",background:showAst?sc.color:"#0d2040",color:showAst?"#030B1A":"#4a8aa8",fontWeight:showAst?"700":"400"}}>
                  {showAst?"✦ON":"✦아스테리즘"}
                </button>
                <button onClick={()=>setFullscreen(true)} style={{padding:"2px 7px",borderRadius:10,border:"none",cursor:"pointer",fontSize:"10px",fontFamily:"inherit",background:"#0d2040",color:"#4a8aa8"}}>
                  ⛶ 크게
                </button>
              </div>
            </div>
            <Planisphere season={season} selected={selected} onSelect={selectConst}
              color={sc.color} showAst={showAst} todayMode={todayMode} currentMonth={currentMonth}
              obsHour={obsHour} fullscreen={false} heading={heading}/>
            {todayMode && (
              <div style={{padding:"4px 8px",display:"flex",gap:8,flexWrap:"wrap"}}>
                {PLANETS_NOW.map((p,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:3,fontSize:"10px",color:p.color}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:p.color,boxShadow:`0 0 4px ${p.color}`}}/>
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"6px"}}>
            {todayMode && (
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
              const sColor={spring:"#7EE8C8",summer:"#FFD166",autumn:"#F4845F",winter:"#89CFF0"}[cn.season]||sc.color;
              const dotColor=todayMode?sColor:sc.color;
              const uvis=URBAN_VIS[id]||"suburban";
              const isChecked=!!checklist[id];
              return (
              <div key={id} className="cc" onClick={()=>selectConst(id)}
                style={{padding:"7px 9px",marginBottom:"3px",borderRadius:"8px",cursor:"pointer",
                  background:isSel?`${dotColor}18`:"rgba(255,255,255,.02)",
                  border:`1px solid ${isSel?dotColor+"44":"#0d2040"}`,opacity:isChecked?0.5:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div onClick={e=>{e.stopPropagation();toggleCheck(id);}}
                    style={{flexShrink:0,width:15,height:15,borderRadius:3,border:`1.5px solid ${dotColor}66`,
                      background:isChecked?dotColor:"transparent",display:"flex",alignItems:"center",
                      justifyContent:"center",cursor:"pointer",fontSize:"9px",color:"#030B1A",fontWeight:"900"}}>
                    {isChecked&&"✓"}
                  </div>
                  <span style={{fontSize:"15px"}}>{cn.symbol||"★"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:isSel?"700":"400",color:isSel?dotColor:"#90b8d0",fontSize:"12px",
                      textDecoration:isChecked?"line-through":"none"}}>{cn.name||id}</div>
                    <div style={{fontSize:"9px",color:"#2a5070"}}>{cn.latin||""}</div>
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
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
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
            <div style={{display:"flex",gap:"4px",marginTop:"10px",flexWrap:"wrap"}}>
              {[["info","📍 관측"],["myth","📖 신화"],["dso","🔭 딥스카이"],["kor","🏮 동양"],["planet","🪐 행성"],["guide","🌟 초보가이드"],["ast","✦ 아스테리즘"]].map(([t,lbl])=>(
                <button key={t} className="tb" onClick={()=>setTab(t)}
                  style={{padding:"3px 9px",borderRadius:"14px",border:"none",cursor:"pointer",fontSize:"10.5px",background:t===tab?sc.color:"#0d2040",color:t===tab?"#030B1A":"#3a6a8a",fontWeight:t===tab?"700":"400",fontFamily:"inherit"}}>{lbl}</button>
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
              <div>
                <div style={{background:"linear-gradient(135deg,#040f1e,#030c18)",border:`1px solid ${sc.color}33`,borderRadius:"12px",padding:"20px",marginBottom:"12px"}}>
                  <div style={{fontSize:"32px",textAlign:"center",marginBottom:"12px"}}>{c.symbol||"★"}</div>
                  <div style={{fontSize:"13.5px",color:"#b8d8f0",lineHeight:1.95,fontFamily:"'Noto Serif KR',serif"}}>{c.myth||"-"}</div>
                </div>
                <div style={{padding:"12px 14px",background:"rgba(4,15,30,.8)",border:"1px solid #0d2040",borderRadius:"8px"}}>
                  <div style={{fontSize:"10px",color:"#3a6a8a",marginBottom:"4px"}}>📌 찾는 방법</div>
                  <div style={{fontSize:"12px",color:"#80aac0",lineHeight:1.7}}>{c.howToFind||"-"}</div>
                </div>
              </div>
            )}
            {tab==="dso" && (
              <div>
                <div style={{fontSize:"11px",color:"#3a6a8a",marginBottom:"12px",padding:"8px 12px",background:"rgba(4,15,30,.8)",border:"1px solid #0d2040",borderRadius:"8px",lineHeight:1.6}}>
                  💡 <strong style={{color:"#70a0b8"}}>8인치 돕소니언 안시</strong>로 딥스카이 충분히 볼 수 있습니다. ★★★=도심가능 ★★=근교추천
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
              <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                <div style={{padding:"12px 14px",background:"rgba(4,15,30,.8)",border:`1px solid ${sc.color}33`,borderRadius:"10px"}}>
                  <div style={{fontSize:"11px",fontWeight:"700",color:sc.color,marginBottom:"6px"}}>🔖 동양 별자리 정보</div>
                  <div style={{fontSize:"13px",color:"#b0d0e8",lineHeight:1.8,fontFamily:"'Noto Serif KR',serif"}}>{c.korInfo||"-"}</div>
                </div>
                {c.korStars && Object.entries(c.korStars).map(([star,korName])=>(
                  <div key={star} style={{display:"flex",gap:"12px",padding:"12px 13px",borderRadius:"10px",background:"rgba(4,15,30,.8)",border:`1px solid ${sc.color}22`}}>
                    <span style={{fontSize:"20px"}}>⭐</span>
                    <div>
                      <div style={{fontSize:"13px",fontWeight:"700",color:sc.color,marginBottom:"3px"}}>{star}</div>
                      <div style={{fontSize:"12px",color:"#80aac0",lineHeight:1.65}}>{korName}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab==="planet" && (
              <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                <div style={{fontSize:"11px",color:"#3a6a8a",padding:"8px 12px",background:"rgba(4,15,30,.8)",border:"1px solid #0d2040",borderRadius:"8px",lineHeight:1.6}}>
                  🪐 <strong style={{color:"#70a0b8"}}>2026년 3월 기준</strong> 서울 밤하늘 행성. 🌙 오늘밤 모드 ON 시 방위도에 표시.
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
            {tab==="ast" && <AsterismPanel season={season}/>}
          </div>
        </div>
      </div>

      <div style={{padding:"7px 18px",borderTop:"1px solid #0d2040",fontSize:"10px",color:"#1a3050",display:"flex",justifyContent:"space-between",background:"rgba(2,8,18,.9)"}}>
        <span>서울 37.5°N · 8인치 돕소니언 안시 · v4</span>
        <span>{Object.keys(CONST_DATA).length}개 별자리 · 줌/드래그/체크리스트 🌙</span>
      </div>
    </div>
  );
}
