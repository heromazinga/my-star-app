import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";

/* ──────────────────────────────────────────
   🧭 필수 기능 (나침반 & 화면꺼짐방지)
────────────────────────────────────────── */
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
      }).catch(() => setPermission("denied"));
    } else {
      setPermission("granted");
      window.addEventListener("deviceorientation", handleOrientation, true);
    }
  }, [handleOrientation]);

  return { heading, permission, startListening };
}

/* ──────────────────────────────────────────
   🌌 메인 별자리 앱 컴포넌트
────────────────────────────────────────── */
function App() {
  const { heading, permission, startListening } = useCompass();

  return (
    <div style={{ 
      background: '#040f1e', 
      minHeight: '100vh', 
      color: 'white', 
      fontFamily: 'sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <h1 style={{ color: '#7EE8C8', marginBottom: '10px' }}>🔭 내 손안의 별자리 v7</h1>
      <p style={{ color: '#89CFF0', marginBottom: '30px' }}>배포가 완료되었습니다!</p>

      <div style={{ 
        background: 'rgba(255,255,255,0.05)', 
        padding: '25px', 
        borderRadius: '20px', 
        border: '1px solid #1a4060',
        textAlign: 'center',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ fontSize: '40px', marginBottom: '20px' }}>🧭</div>
        <p style={{ marginBottom: '20px', fontSize: '14px' }}>
          스마트폰에서 접속 중이라면 아래 버튼을 눌러<br/>실시간 나침반을 활성화하세요.
        </p>
        
        <button 
          onClick={startListening}
          style={{
            padding: '15px 30px',
            background: '#7EE8C8',
            color: '#040f1e',
            border: 'none',
            borderRadius: '30px',
            fontWeight: 'bold',
            fontSize: '18px',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(126,232,200,0.3)'
          }}
        >
          나침반 활성화
        </button>

        {heading !== null && (
          <div style={{ marginTop: '30px' }}>
            <div style={{ fontSize: '12px', color: '#3a6a8a', marginBottom: '5px' }}>현재 방위각</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#FFD166' }}>{heading}°</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '40px', color: '#3a6a8a', fontSize: '12px' }}>
        ※ 사파리(iOS)는 배포된 사이트에서 버튼을 눌러야 센서가 작동합니다.
      </div>
    </div>
  );
}

// 렌더링 코드 (index.html의 root에 직접 붙이기)
const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />);

export default App;
