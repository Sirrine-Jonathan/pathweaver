import React, {
  useState,
  useEffect,
  ErrorInfo,
  useRef,
  ReactNode,
} from "react";
import * as Babel from "@babel/standalone";
import Orb, { OrbSize } from "./Orb";

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
class DynamicComponentErrorBoundary extends React.Component<
  { children?: React.ReactNode },
  ErrorState
> {
  constructor(props: { children?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Dynamic Component Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <FloatingOrb />;
    }

    return this.props.children;
  }
}

export function FloatingOrb() {
  return (
    <div className="flex-1 h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="flex flex-col items-center">
        <Orb size={OrbSize.large} />
      </div>
    </div>
  );
}

/**
 * This is the entry point for AI-authored game UI.
 * The AI can create interactive game elements here.
 */
const DynamicComponent: React.FC<DynamicComponentProps> = ({
  onEvent,
  componentString,
}) => {
  const [TranspiledComponent, setTranspiledComponent] =
    useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dynamicComponentWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dynamicComponentWrapperRef.current) {
      const allButtons =
        dynamicComponentWrapperRef.current.querySelectorAll("button");
      for (const button of allButtons) {
        const buttonParent = button.parentElement;
        if (buttonParent && buttonParent.classList.contains("flex")) {
          if (buttonParent.classList.contains("flex-row")) {
            buttonParent.classList.remove("flex-row");
          }
          if (!buttonParent.classList.contains("flex-col")) {
            buttonParent.classList.add("flex-col");
          }
          buttonParent.classList.add("gap-3");
        }
        button.style.margin = "0";
      }
    }
  });

  useEffect(() => {
    if (!componentString) {
      setTranspiledComponent(null);
      return;
    }

    try {
      // Fix common JSX syntax errors
      let fixedCode = componentString;

      // Fix case 1: return \n <div> (missing parentheses)
      if (
        /return\s*\n\s*</.test(fixedCode) &&
        !fixedCode.includes("return (")
      ) {
        fixedCode = fixedCode.replace(/return\s*\n\s*</, "return (\n    <");
        fixedCode = fixedCode.replace(/>\s*\n\s*\};\s*$/, ">\n  );\n}");
        console.log("🔧 Fixed missing return parentheses");
      }

      // Fix case 2: return ( ... ); } (correct ending with }; instead of );)
      fixedCode = fixedCode.replace(/\s*\};\s*\}$/, "\n  );\n}");

      // Fix case 3: return ( ... }; (missing closing parenthesis)
      fixedCode = fixedCode.replace(/\)\s*\};\s*$/, ");\n}");

      console.log("🔧 Component code ready for transpilation");

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
      // @ts-ignore
      const componentFactory = eval(transpiled);
      const Comp = componentFactory(React);
      setTranspiledComponent(() => Comp);
      setError(null);

      console.log("✅ Successfully loaded dynamic component");
    } catch (err) {
      console.error("💥 Error loading dynamic component:", err);
      console.error("💥 Problematic code:", componentString);
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error occurred during component transpilation"
      );
      setTranspiledComponent(null);
    }
  }, [componentString]);

  // Fallback to default component if transpilation fails
  if (error) {
    return (
      // <div className="flex-1 h-full w-full flex items-center justify-center bg-red-100">
      //   <div className="text-center p-8 rounded-lg">
      //     <h1 className="text-2xl font-bold text-red-800 mb-4">
      //       Dynamic Component Error
      //     </h1>
      //     <p className="text-red-600 mb-6 text-xl">transpilation failed</p>
      //   </div>
      // </div>
      <FloatingOrb />
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
      <div
        ref={dynamicComponentWrapperRef}
        className="ai-dynamic-content h-full overflow-y-auto"
      >
        <TranspiledComponent onEvent={onEvent} />
        {error && <FloatingOrb />}
      </div>
    </DynamicComponentErrorBoundary>
  );
};

export default DynamicComponent;
