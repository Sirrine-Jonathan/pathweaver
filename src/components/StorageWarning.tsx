interface StorageWarningProps {
  percentUsed: number;
  usage: number;
  quota: number;
}

const StorageWarning = ({ percentUsed, usage, quota }: StorageWarningProps) => {
  if (percentUsed < 75) {
    return null;
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i)) + " " + sizes[i];
  };

  const getWarningLevel = () => {
    if (percentUsed >= 90) {
      return {
        color: "red",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        textColor: "text-red-800",
        iconColor: "text-red-600",
        message: "Storage almost full! Delete old stories to free up space.",
      };
    }
    return {
      color: "yellow",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      textColor: "text-yellow-800",
      iconColor: "text-yellow-600",
      message: "Storage getting full. Consider deleting old stories.",
    };
  };

  const warning = getWarningLevel();

  return (
    <div
      className={`m-3 p-3 ${warning.bgColor} border ${warning.borderColor} rounded-lg`}
    >
      <div className="flex items-start space-x-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 ${warning.iconColor} flex-shrink-0 mt-0.5`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium ${warning.textColor} mb-1`}>
            {warning.message}
          </p>
          <div className="w-full bg-white rounded-full h-2 mb-1">
            <div
              className={`h-2 rounded-full ${
                percentUsed >= 90 ? "bg-red-600" : "bg-yellow-500"
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
          <p className={`text-xs ${warning.textColor}`}>
            {formatBytes(usage)} / {formatBytes(quota)} (
            {percentUsed.toFixed(0)}% used)
          </p>
        </div>
      </div>
    </div>
  );
};

export default StorageWarning;
