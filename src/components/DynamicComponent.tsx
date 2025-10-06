import React, { useState, useEffect, ErrorInfo } from 'react';
import * as Babel from '@babel/standalone';

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
 * This is the entry point for AI-authored game UI.
 * The AI can create interactive game elements here.
 */
const DynamicComponent: React.FC<DynamicComponentProps> = ({ onEvent, componentString }) => {
  const [TranspiledComponent, setTranspiledComponent] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!componentString) {
      setTranspiledComponent(null);
      return;
    }

    try {
      // Fix common JSX syntax errors
      let fixedCode = componentString;
      
      // Fix case 1: return \n <div> (missing parentheses)
      if (/return\s*\n\s*</.test(fixedCode) && !fixedCode.includes('return (')) {
        fixedCode = fixedCode.replace(/return\s*\n\s*</, 'return (\n    <');
        fixedCode = fixedCode.replace(/>\s*\n\s*\};\s*$/, '>\n  );\n}');
        console.log('🔧 Fixed missing return parentheses');
      }
      
      // Fix case 2: return ( ... ); } (correct ending with }; instead of );)
      fixedCode = fixedCode.replace(/\s*\};\s*\}$/, '\n  );\n}');
      
      // Fix case 3: return ( ... }; (missing closing parenthesis)
      fixedCode = fixedCode.replace(/\)\s*\};\s*$/, ');\n}');
      
      console.log('🔧 Component code ready for transpilation');

      // Wrap code in a function that returns a React component
      const wrappedCode = `
        (function(React) {
          ${fixedCode}
          return AiDynamicComponent;
        })
      `;

      // Transpile to ES5 using Babel
      const transpiled = Babel.transform(wrappedCode, {
        presets: ["react", "env"],
      }).code;

      // eslint-disable-next-line no-new-func
      const componentFactory = eval(transpiled);
      const Comp = componentFactory(React);
      setTranspiledComponent(() => Comp);
      setError(null);
      
      console.log('✅ Successfully loaded dynamic component');
    } catch (err) {
      console.error('💥 Error loading dynamic component:', err);
      console.error('💥 Problematic code:', componentString);
      setError(err instanceof Error ? err.message : 'Unknown error occurred during component transpilation');
      setTranspiledComponent(null);
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
          <pre className="text-xs text-red-500 bg-red-50 p-2 rounded max-w-md overflow-auto">
            {componentString}
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
      <div className="ai-dynamic-content">
        <TranspiledComponent onEvent={onEvent} />
      </div>
    </DynamicComponentErrorBoundary>
  );
};

export default DynamicComponent;