interface CaptionsProps {
  text: string;
}

const Captions = ({ text }: CaptionsProps) => {
  if (!text) return null;

  // Always show captions area, even if empty
  return (
    <div
      className="w-full bg-gray-100 border-t border-gray-200 overflow-y-auto"
      style={{ maxHeight: "200px", minHeight: "60px" }}
    >
      <div className="p-4 text-gray-800 text-sm leading-relaxed">
        {text || "\u00A0"}
      </div>
    </div>
  );
};

export default Captions;
