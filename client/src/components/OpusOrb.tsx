import { motion } from "framer-motion";

export default function OpusOrb({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      aria-label="Open AI Sales Coach"
      onClick={onOpen}
      className="fixed right-8 top-24 z-40 aspect-square w-[132px] rounded-full
                 bg-[radial-gradient(closest-side,rgba(1,8,20,0.9),rgba(1,8,20,0.6)_70%,transparent_71%),conic-gradient(from_0deg,rgba(56,189,248,0.9),rgba(168,85,247,0.9))]"
      data-testid="button-opus-orb"
    >
      <motion.span
        className="absolute inset-0 rounded-full"
        initial={{ boxShadow: "0 0 0 0 rgba(56,189,248,0.25)" }}
        animate={{ boxShadow: ["0 0 0 0 rgba(56,189,248,0.25)","0 0 0 16px rgba(56,189,248,0)"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="absolute inset-[18%] rounded-full bg-[#0a1224]/90" />
    </button>
  );
}