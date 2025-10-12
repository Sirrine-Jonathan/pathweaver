interface CaptionsProps {
  text: string;
  isVisible: boolean;
}

const Captions = ({ text, isVisible }: CaptionsProps) => {
  if (!isVisible || !text) {
    return null;
  }

  return (
    <div
      className="w-full bg-gray-100 border-t border-gray-200 overflow-y-auto"
      style={{ maxHeight: "120px" }}
    >
      <div className="p-4 text-gray-800 text-sm leading-relaxed">{text}</div>
    </div>
  );
};

export default Captions;
