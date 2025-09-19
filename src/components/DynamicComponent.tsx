import React, { useState, useEffect, ErrorInfo } from 'react';

interface DynamicComponentProps {
  onEvent: (event: any) => void;
  componentString: string;
}

interface ErrorState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Error boundary component to catch and display syntax errors in dynamic components
 */
class DynamicComponentErrorBoundary extends React.Component<{children?: React.ReactNode}, ErrorState> {
  constructor(props: {children?: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dynamic Component Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Dynamic Component Error: </strong>
          <span className="block sm:inline">{this.state.errorMessage}</span>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Safely transpile and render a dynamic component string
 */
const transpileDynamicComponent = (componentString: string): React.FC<{onEvent: (event: any) => void}> | null => {
  try {
    // More comprehensive removal of import and export statements
    const sanitizedCode = componentString
      .replace(/^import\s+.*\s+from\s+['"].*['"];?/gm, '')  // Remove import statements
      .replace(/^export\s+default\s*/gm, '')  // Remove 'export default'
      .replace(/^export\s+/gm, '')  // Remove other export variations
      .replace(/export\s+default\s*.*$/gm, '');  // Remove trailing export default

    // Create a function that returns the component
    const componentFactory = new Function('React', `
      return (function(React) {
        ${sanitizedCode}
        
        // Ensure AiDynamicComponent is defined
        if (typeof AiDynamicComponent === 'undefined') {
          const AiDynamicComponent = () => React.createElement('div', null, 'No component defined');
        }
        
        // Wrap the component to ensure it receives onEvent prop
        return (props) => {
          return React.createElement(AiDynamicComponent, props);
        };
      })(React);
    `);

    // Pass React to the factory
    const wrappedComponent = componentFactory(React);
    
    // Validate the component
    if (typeof wrappedComponent !== 'function') {
      console.error('Transpilation failed: Invalid component type');
      return null;
    }

    return wrappedComponent;
  } catch (error) {
    console.error('Transpilation Error:', error);
    return null;
  }
};

/**
 * This is the entry point for AI-authored game UI.
 * The AI can create interactive game elements here.
 */
const DynamicComponent: React.FC<DynamicComponentProps> = ({ onEvent, componentString }) => {
  const [TranspiledComponent, setTranspiledComponent] = useState<React.FC<{onEvent: (event: any) => void}> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const transpiledComponent = transpileDynamicComponent(componentString);
      
      if (transpiledComponent) {
        setTranspiledComponent(transpiledComponent);
        setError(null);
      } else {
        setError('Failed to transpile the dynamic component');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred during component transpilation');
    }
  }, [componentString]);

  // Fallback to default component if transpilation fails
  if (error) {
    return (
      <div className="flex-1 h-full w-full flex items-center justify-center bg-red-50">
        <div className="text-center p-8 bg-red-100 rounded-lg">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-red-800 mb-4">Dynamic Component Error</h1>
          <p className="text-red-600 mb-6">{error}</p>
          <pre className="text-xs text-red-500 bg-red-50 p-2 rounded">
            Component String: {componentString}
          </pre>
        </div>
      </div>
    );
  }

  // If no component is transpiled, show default
  if (!TranspiledComponent) {
    return (
      <div className="flex-1 h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🎮</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Pathweaver</h1>
          <p className="text-gray-600 mb-6">
            Interactive storytelling powered by AI
          </p>
          <p className="text-sm text-gray-500">
            Waiting for AI to create interactive game elements...
          </p>
        </div>
      </div>
    );
  }

  // Render the transpiled component within an error boundary
  return (
    <DynamicComponentErrorBoundary>
      <TranspiledComponent onEvent={onEvent} />
    </DynamicComponentErrorBoundary>
  );
};

export default DynamicComponent;
