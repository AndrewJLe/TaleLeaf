"use client";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width="48"
        height="48"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="64" height="64" rx="10" fill="#1f5a37" />
        <g transform="translate(8,12)">
          <path
            d="M6 6C18 2 36 2 48 6v22c-12-4-30-4-42 0V6z"
            fill="#fff"
            opacity="0.95"
          />
          <path
            d="M28 6c4 6 6 10 14 12-8 4-16 6-26 6v-18c4-1 6-1 12 0z"
            fill="#2f8a4a"
          />
          <path
            d="M36 0c6 4 8 10 6 18-6-8-12-10-18-12 6-2 8-4 12-6z"
            fill="#a7d48c"
          />
        </g>
      </svg>
      <div>
        <div className="text-2xl font-extrabold text-emerald-900">TaleLeaf</div>
        <div className="text-xs text-emerald-700">Your reading garden</div>
      </div>
    </div>
  );
}
