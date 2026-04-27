import React from "react";

const TestRender: React.FC = () => {
  return (
    <div
      style={{
        padding: "20px",
        background: "#1e293b",
        color: "white",
        border: "2px solid #3b82f6",
        borderRadius: "8px",
        margin: "20px",
      }}
    >
      <h1>🚀 App is Working!</h1>
      <p>If you can see this, the basic rendering is functional.</p>
      <div
        style={{ marginTop: "20px", padding: "10px", background: "#334155", borderRadius: "4px" }}
      >
        <h2>Debug Info:</h2>
        <ul>
          <li>React Version: Working</li>
          <li>Component Rendering: ✅</li>
          <li>Styles: Applied</li>
          <li>Time: {new Date().toLocaleString()}</li>
        </ul>
      </div>
    </div>
  );
};

export default TestRender;
