import { motion } from "framer-motion";

export default function OpusOrb({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="fixed right-8 top-1/2 -translate-y-1/2 z-40">
      <button
        aria-label="Open AI Sales Coach"
        onClick={onOpen}
        className="relative aspect-square w-[160px] rounded-full border-2 border-transparent bg-gradient-to-tr from-cyan-400 to-purple-500 p-1 transition-transform hover:scale-105 opus-orb"
        data-testid="button-opus-orb"
      >
        {/* Pulsing glow halo */}
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-400/30 to-purple-500/30 blur-xl"
          initial={{ scale: 1, opacity: 0.3 }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Hollow circle interior */}
        <div className="relative h-full w-full rounded-full bg-black/80 backdrop-blur-sm" />
        
        {/* Electric blue inner glow */}
        <motion.div
          className="absolute inset-2 rounded-full bg-gradient-to-tr from-cyan-400/20 to-purple-500/20"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </button>
    </div>
  );
}