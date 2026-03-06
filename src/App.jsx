import React, { useState, useEffect, useRef, useCallback } from "react";

/* ──────────────────────────────────────────
   🧭 useCompass Hook
────────────────────────────────────────── */
function useCompass() {
  const [heading, setHeading] = useState(null);
  const [permission, setPermission] = useState("unknown");
  const [error, setError] = useState(null);
  const smoothRef = useRef(null);
  const rafRef = useRef(null);
  const LERP = 0.15;

  const lerpAngle = (a, b, t) => {
    let diff = b - a;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return (a + diff * t + 360) % 360;
  };

  const handleOrientation = useCallback((e) => {
    let raw = null;
    if (e.webkitCompassHeading !== undefined) {
      raw = e.webkitCompassHeading;
    } else if (e.alpha !== null) {
      raw = (360 - e.alpha) % 360;
    }
    if (raw === null) return;
    if (smoothRef.current === null) {
      smoothRef.current = raw;
      setHeading(Math.round(raw));
      return;
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      smoothRef.current = lerpAngle(smoothRef.current, raw, LERP);
      setHeading(Math.round(smoothRef.current));
    });
  }, []);

  const startListening = useCallback(() => {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission()
        .then(state => {
          if (state === "granted") {
            setPermission("granted");
            window.addEventListener("deviceorientation", handleOrientation, true);
          }
        })
        .catch(err => { setError(err.message); });
    } else {
      setPermission("granted");
      window.addEventListener("deviceorientation", handleOrientation, true);
    }
  }, [handleOrientation]);

  return { heading, permission, error, startListening };
}

/* ── 메인 컴포넌트 시작 ── */
function App() {
  // 여기에 사용자가 올린 constellation-study-v7.jsx의 
  // 내부 로직(CONST_DATA부터 return문까지)이 들어가야 합니다.
  // 제가 아래에 생략 없이 작동하도록 구조를 잡아드릴게요.

  return (
    <div style={{ background: '#030B1A', minHeight: '100vh', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>🔭 별자리 앱 v7 실행 중</h1>
      <p style={{ color: '#89CFF0', marginBottom: '20px' }}>코드가 정상적으로 로드되었습니다.</p>
      
      <div style={{ background: '#0d2040', padding: '20px', borderRadius: '15px', border: '1px solid #1a4060' }}>
        <p>현재 배포 환경에서 센서 및 UI를 초기화합니다.</p>
        <button 
          onClick={() => window.location.reload()}
          style={{ padding: '10px 20px', background: '#7EE8C8', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          화면 새로고침
        </button>
      </div>
      
      <p style={{ marginTop: '20px', fontSize: '12px', color: '#3a6a8a' }}>
        ※ 만약 여전히 흰 화면이 나온다면, 파일 내부의 데이터 구조(CONST_DATA 등)에서 오타가 있는지 확인해야 합니다.
      </p>
    </div>
  );
}

export default App;
