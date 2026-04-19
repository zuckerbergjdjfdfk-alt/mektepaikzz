import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export const SplashScreen = ({ onDone }: { onDone: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      onAnimationComplete={() => setTimeout(onDone, 1800)}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-hero overflow-hidden"
    >
      <div className="absolute inset-0 ornament-kz opacity-40" />
      <div className="absolute inset-0 bg-gradient-mesh" />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 text-center"
      >
        <motion.div
          initial={{ rotate: -10, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-gold shadow-gold"
        >
          <Sparkles className="h-14 w-14 text-primary-foreground" strokeWidth={2.5} />
        </motion.div>

        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="font-display text-6xl font-extrabold tracking-tight text-primary-foreground"
        >
          Mektep <span className="text-secondary">AI</span>
        </motion.h1>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-4 text-lg text-primary-foreground/80"
        >
          Цифровой завуч · Aqbobek Lyceum · Алматы
        </motion.p>

        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "240px" }}
          transition={{ delay: 0.9, duration: 1.2 }}
          className="mx-auto mt-10 h-1 rounded-full bg-gradient-gold"
        />
      </motion.div>
    </motion.div>
  );
};
