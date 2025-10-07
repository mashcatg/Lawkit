import { useEffect, useState } from 'react';

const messages = [
  "Analyzing your request...",
  "Processing information...",
  "Gathering insights...",
  "Formulating response...",
  "Reviewing legal documents...",
  "Consulting case law...",
  "Analyzing precedents...",
  "Researching statutes...",
  "Compiling references...",
  "Drafting response...",
  "Verifying citations...",
  "Cross-referencing sources...",
  "Structuring arguments...",
  "Finalizing analysis...",
  "Preparing document...",
  "Evaluating legal principles...",
  "Examining jurisprudence...",
  "Synthesizing findings...",
  "Organizing research...",
  "Building comprehensive answer...",
];

const lateMessage = "Almost there...";

export function useLoadingMessages(duration?: number) {
  const [message, setMessage] = useState(messages[0]);
  const [messageIndex, setMessageIndex] = useState(0);
  const [isLate, setIsLate] = useState(false);

  useEffect(() => {
    // If duration provided and > 60s, show late message immediately
    if (duration && duration > 60) {
      setIsLate(true);
      setMessage(lateMessage);
      return;
    }

    const messageInterval = setInterval(() => {
      if (!isLate) {
        // Pick a random message instead of cycling sequentially
        const randomIndex = Math.floor(Math.random() * messages.length);
        setMessage(messages[randomIndex]);
        setMessageIndex(randomIndex);
      }
    }, 4000);

    const lateTimeout = setTimeout(() => {
      setIsLate(true);
      setMessage(lateMessage);
    }, 60000); // 1 minute

    return () => {
      clearInterval(messageInterval);
      clearTimeout(lateTimeout);
    };
  }, [isLate, duration]);

  return message;
}
