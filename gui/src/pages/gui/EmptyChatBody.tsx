import { SparklesIcon, CommandLineIcon, ShieldCheckIcon, BugAntIcon } from "@heroicons/react/24/outline";
import { ConversationStarterCards } from "../../components/ConversationStarters";
import { OnboardingCard } from "../../components/OnboardingCard";

export interface EmptyChatBodyProps {
  showOnboardingCard?: boolean;
}

export function EmptyChatBody({ showOnboardingCard }: EmptyChatBodyProps) {
  return (
    <div className="mx-3 flex flex-col items-center justify-between min-h-[480px] select-none py-2">
      {/* Top Codemind Header */}
      <div className="flex flex-col items-center text-center pt-2 z-10 bg-white/90 backdrop-blur-md px-8 py-3 rounded-2xl border border-red-200 shadow-[0_4px_20px_rgba(230,36,41,0.06)]">
        <div className="inline-flex items-center gap-2 px-3 py-0.5 mb-1 rounded-full bg-red-50 border border-red-200 shadow-xs">
          <span className="text-sm">🕷️</span>
          <span className="text-2xs font-black tracking-widest uppercase text-red-600">
            Codemind AI
          </span>
        </div>
        <h1 className="text-2xl font-black tracking-wider text-red-600 m-0">
          CODEMIND
        </h1>
        <p className="text-2xs text-zinc-600 italic font-medium mt-0.5">
          &ldquo;With great code comes great responsibility&rdquo;
        </p>
      </div>

      {/* Spacer for the Spider-Man Artwork */}
      <div className="flex-1 min-h-[220px]" />

      {/* Action Pills & Starters */}
      <div className="w-full max-w-xl flex flex-col items-center gap-3">
        <div className="flex flex-wrap justify-center gap-2 text-2xs text-red-700 font-semibold">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 border border-red-200 shadow-sm backdrop-blur-sm hover:border-red-400 transition-colors">
            <SparklesIcon className="w-3.5 h-3.5 text-red-600" /> AI Coding Companion
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 border border-red-200 shadow-sm backdrop-blur-sm hover:border-red-400 transition-colors">
            <CommandLineIcon className="w-3.5 h-3.5 text-red-600" /> Deep Code Reasoning
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 border border-red-200 shadow-sm backdrop-blur-sm hover:border-red-400 transition-colors">
            <BugAntIcon className="w-3.5 h-3.5 text-red-600" /> Bug Buster
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 border border-red-200 shadow-sm backdrop-blur-sm hover:border-red-400 transition-colors">
            <ShieldCheckIcon className="w-3.5 h-3.5 text-red-600" /> Local &amp; Groq Ready
          </span>
        </div>

        <div className="w-full">
          {showOnboardingCard ? <OnboardingCard /> : <ConversationStarterCards />}
        </div>
      </div>
    </div>
  );
}
