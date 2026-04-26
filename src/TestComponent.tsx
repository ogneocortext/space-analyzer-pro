import React from 'react';

const TestComponent: React.FC = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: '#ff0000', color: 'white' }}>
      <h1>Basic React Test</h1>
      <p>This should render if React is working</p>
      <button onClick={() => alert('React is working!')}>Click me</button>
    </div>
  );
};

export default TestComponent;