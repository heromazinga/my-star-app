import React, { useState, useEffect, useRef, useCallback } from "react";

// 1. 센서 및 유틸리티 훅 (useCompass, useWakeLock)
function useCompass() {
  const [heading, setHeading] = useState(null);
  const [permission, setPermission] = useState("unknown");
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
    let raw = e.webkitCompassHeading !== undefined ? e.webkitCompassHeading : (e.alpha !== null ? (360 - e.alpha) % 360 : null);
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
      DeviceOrientationEvent.requestPermission().then(state => {
        if (state === "granted") {
          setPermission("granted");
          window.addEventListener("deviceorientation", handleOrientation, true);
        }
      });
    } else {
      setPermission("granted");
      window.addEventListener("deviceorientation", handleOrientation, true);
    }
  }, [handleOrientation]);

  return { heading, permission, startListening };
}

function useWakeLock() {
  const lockRef = useRef(null);
  const request = useCallback(async () => {
    if (!("wakeLock" in navigator)) return;
    try { lockRef.current = await navigator.wakeLock.request("screen"); } catch (e) {}
  }, []);
  const release = useCallback(() => { lockRef.current?.release(); lockRef.current = null; }, []);
  return { request, release };
}

// 2. 메인 App 컴포넌트
const App = () => {
  const [msg, setMsg] = useState("별자리 앱 로딩 중...");
  const { heading, permission, startListening } = useCompass();

  useEffect(() => {
    setMsg("🔭 별자리 앱 v7 정상 작동 중!");
  }, []);

  return (
    <div style={{
      background: '#040f1e',
      minHeight: '100vh',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1 style={{ color: '#7EE8C8' }}>{msg}</h1>
      <p style={{ color: '#89CFF0', fontSize: '14px' }}>배포 성공을 축하합니다!</p>
      
      <div style={{
        marginTop: '30px',
        padding: '20px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '15px',
        border: '1px solid #1a4060'
      }}>
        <p style={{ marginBottom: '15px' }}>나침반 센서 상태: <strong>{permission}</strong></p>
        <button 
          onClick={startListening}
          style={{
            padding: '12px 24px',
            background: '#7EE8C8',
            border: 'none',
            borderRadius: '25px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          🧭 나침반 및 센서 활성화
        </button>
        {heading !== null && (
          <h2 style={{ marginTop: '20px', color: '#FFD166' }}>현재 방향: {heading}°</h2>
        )}
      </div>

      <div style={{ marginTop: '40px', fontSize: '12px', color: '#3a6a8a' }}>
        <p>이제 이 화면이 보인다면 '흰 화면' 문제는 완전히 해결된 것입니다.</p>
        <p>이후에 아까의 복잡한 별자리 데이터들을 하나씩 다시 합치면 됩니다.</p>
      </div>
    </div>
  );
};

export default App; // 단 한 번만 선언!
