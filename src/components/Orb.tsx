import clsx from "clsx";

export enum OrbSize {
  "large" = 12,
  "medium" = 8,
  "small" = 6,
  "extraSmall" = 4,
}

export default function Orb({ size }: { size: OrbSize }) {
  const classes = `w-${size} h-${size} md:w-${size + 2} md:h-${size + 2}`;
  const classesAlt = `w-${size - 2} h-${size - 2} md:w-${size} md:h-${size}`;

  const firstClasses = clsx(
    classes,
    `bg-gradient-to-br from-purple-400 via-blue-500 to-indigo-600 rounded-full shadow-lg animate-[pulse_10s_ease-in-out_infinite]`
  );

  const secondClasses = clsx(
    classes,
    "absolute inset-0 bg-gradient-to-br from-purple-300 via-blue-400 to-indigo-500 rounded-full opacity-60 animate-[ping_15s_ease-in-out_infinite]"
  );

  const thirdClasses = clsx(
    classesAlt,
    "absolute inset-1 bg-white rounded-full opacity-20"
  );

  return (
    <div className="relative flex-shrink-0">
      {/* Ethereal floating orb */}
      <div className={firstClasses}></div>
      <div className={secondClasses}></div>
      <div className={thirdClasses}></div>
    </div>
  );
}
