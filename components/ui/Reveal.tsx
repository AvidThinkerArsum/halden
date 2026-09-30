"use client";

import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode } from "react";

// Word-by-word reveal. The parent is observed (the words start clipped by overflow,
// so observing them directly never fires) and the words follow through variants.
export function Words({ text, italic, className, delay = 0 }: { text?: string; italic?: string; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const words = [
    ...(text ? text.split(" ") : []).map((w) => ({ w, em: false })),
    ...(italic ? italic.split(" ") : []).map((w) => ({ w, em: true })),
  ];
  return (
    <motion.span
      className={className}
      aria-label={`${text ?? ""} ${italic ?? ""}`.trim()}
      initial={reduce ? "show" : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-8% 0px" }}
    >
      {words.map(({ w, em }, i) => (
        <span key={i} aria-hidden>
          <span className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-bottom">
            <motion.span
              className="inline-block"
              variants={{ hidden: { y: "110%" }, show: { y: 0 } }}
              transition={{ duration: 0.75, delay: delay + i * 0.055, ease: [0.22, 1, 0.36, 1] }}
            >
              {em ? <em>{w}</em> : w}
            </motion.span>
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </motion.span>
  );
}

export function Rise({ children, delay = 0, className, y = 22 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { y, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
