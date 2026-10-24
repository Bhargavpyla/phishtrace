export function Mascot({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="PhishTrace mascot"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-teal-500 via-teal-700 to-slate-950 p-1 shadow-sm ring-1 ring-white/10 ${className}`}
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        {/* Fish Body */}
        <path
          d="M6 18C10 11 20 10 28 15C32 17.5 34 20 34 20C34 20 31.5 21 28 21.5C20 22.5 10 25 6 18Z"
          fill="#38BDF8"
        />
        {/* Fish Tail */}
        <path
          d="M6 18L1 12C3 16 3 20 1 24L6 18Z"
          fill="#0284C7"
        />
        {/* Underbelly Highlight */}
        <path
          d="M10 20C15 22.5 22 21.5 28 20.5C24 23 16 23.5 10 20Z"
          fill="#BAE6FD"
        />
        {/* Detective Sunglasses / Visor */}
        <path
          d="M18 14.5C21 14.5 25 15 27 16.5C26 18 24 19 21.5 19C19 19 17.5 17.5 18 14.5Z"
          fill="#0F172A"
          stroke="#F8FAFC"
          strokeWidth="0.75"
        />
        {/* Visor Glint */}
        <path
          d="M20 16L24 17"
          stroke="#38BDF8"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        {/* Detective Hat */}
        <path
          d="M15 13.5C17 11 23 11 25.5 13.5L27 14H14L15 13.5Z"
          fill="#334155"
        />
        <rect
          x="12"
          y="13.5"
          width="16"
          height="1.5"
          rx="0.75"
          fill="#1E293B"
          stroke="#475569"
          strokeWidth="0.5"
        />
        {/* Security Verified Shield Badge in corner */}
        <circle cx="28" cy="24" r="3.5" fill="#0D9488" stroke="#F0FDF4" strokeWidth="0.75" />
        <path
          d="M26.8 24L27.6 24.8L29.4 23"
          stroke="#FFFFFF"
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
