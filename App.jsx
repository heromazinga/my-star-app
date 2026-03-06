import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <div style={{ background: 'navy', color: 'white', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <h1>드디어 화면이 나옵니다! 🚀</h1>
    </div>
  );
}

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />);

export default App;
