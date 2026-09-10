"use client";

import Image from "next/image";
import { useLayoutEffect, useState } from "react";

const ENTRANCE_PARAM = "td_enter";

export function SignInEntrance() {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useLayoutEffect(() => {
    const url = new URL(window.location.href);

    if (url.searchParams.get(ENTRANCE_PARAM) !== "1") return;

    url.searchParams.delete(ENTRANCE_PARAM);
    window.history.replaceState(window.history.state, "", url);
    setIsVisible(true);

    const leaveTimer = window.setTimeout(() => setIsLeaving(true), 760);
    const removeTimer = window.setTimeout(() => setIsVisible(false), 1160);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      aria-label="Opening your Trading Docks workspace"
      aria-live="polite"
      className={`td-entrance ${isLeaving ? "td-entrance--leaving" : ""}`}
      role="status"
    >
      <div aria-hidden="true" className="td-entrance__aurora" />

      <div className="td-entrance__content">
        <div aria-hidden="true" className="td-entrance__cards">
          <span className="td-entrance__card td-entrance__card--left" />
          <span className="td-entrance__card td-entrance__card--right" />
          <span className="td-entrance__card td-entrance__card--center">
            <Image
              alt=""
              className="td-entrance__mark"
              height={96}
              priority
              sizes="50px"
              src="/trading-docks-mark.png"
              width={96}
            />
          </span>
        </div>

        <div className="td-entrance__copy">
          <p>TRADING DOCKS</p>
          <span>Workspace ready</span>
        </div>

        <div aria-hidden="true" className="td-entrance__signal">
          <span />
        </div>
      </div>

      <style jsx>{`
        .td-entrance {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 46%, rgb(var(--td-accent-rgb)/0.1), transparent 29rem),
            rgb(var(--td-surface-rgb)/0.985);
          opacity: 1;
          transition:
            opacity 360ms cubic-bezier(0.22, 1, 0.36, 1),
            backdrop-filter 360ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .td-entrance--leaving {
          opacity: 0;
          pointer-events: none;
          backdrop-filter: blur(0);
        }

        .td-entrance__aurora {
          position: absolute;
          width: min(70vw, 48rem);
          aspect-ratio: 1.8;
          border-radius: 50%;
          background: rgb(var(--td-accent-rgb)/0.08);
          filter: blur(90px);
          opacity: 0;
          animation: td-aurora 900ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .td-entrance__content {
          position: relative;
          display: flex;
          width: 15rem;
          flex-direction: column;
          align-items: center;
        }

        .td-entrance__cards {
          position: relative;
          width: 5.7rem;
          height: 6.5rem;
          perspective: 700px;
        }

        .td-entrance__card {
          position: absolute;
          left: 50%;
          top: 50%;
          display: grid;
          width: 3.75rem;
          height: 5.25rem;
          place-items: center;
          border: 1px solid rgb(var(--td-accent-rgb)/0.2);
          border-radius: 0.72rem;
          background: linear-gradient(145deg, rgb(var(--td-surface-rgb)/0.95), rgb(var(--td-surface-rgb)/0.98));
          box-shadow:
            inset 0 1px 0 rgb(var(--td-ink-rgb)/0.06),
            0 18px 55px rgb(var(--td-shadow-rgb)/calc(0.38*var(--td-shadow-strength)));
          transform: translate(-50%, -50%);
        }

        .td-entrance__card--left {
          animation: td-card-left 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .td-entrance__card--right {
          animation: td-card-right 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .td-entrance__card--center {
          border-color: rgb(var(--td-accent-rgb)/0.33);
          animation: td-card-center 680ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .td-entrance__mark {
          width: 3.1rem;
          height: 3.1rem;
          object-fit: contain;
          filter: drop-shadow(0 0 18px rgb(var(--td-accent-rgb)/0.2));
        }

        .td-entrance__copy {
          margin-top: 0.75rem;
          text-align: center;
          opacity: 0;
          transform: translateY(6px);
          animation: td-copy 420ms 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .td-entrance__copy p {
          margin: 0;
          color: rgb(var(--td-ink-rgb)/0.92);
          font-size: 0.62rem;
          font-weight: 650;
          letter-spacing: 0.26em;
        }

        .td-entrance__copy span {
          display: block;
          margin-top: 0.35rem;
          color: rgb(var(--td-accent-rgb)/0.76);
          font-size: 0.68rem;
          letter-spacing: 0.015em;
        }

        .td-entrance__signal {
          width: 8.5rem;
          height: 1px;
          margin-top: 1rem;
          overflow: hidden;
          background: rgb(var(--td-accent-rgb)/0.09);
        }

        .td-entrance__signal span {
          display: block;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgb(var(--td-accent-rgb)/0.9), transparent);
          transform: translateX(-100%);
          animation: td-signal 620ms 230ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }

        @keyframes td-card-left {
          from {
            opacity: 0;
            transform: translate(-90%, -44%) rotate(-18deg) translateY(14px);
          }
          to {
            opacity: 0.7;
            transform: translate(-76%, -50%) rotate(-8deg);
          }
        }

        @keyframes td-card-right {
          from {
            opacity: 0;
            transform: translate(-10%, -44%) rotate(18deg) translateY(14px);
          }
          to {
            opacity: 0.7;
            transform: translate(-24%, -50%) rotate(8deg);
          }
        }

        @keyframes td-card-center {
          from {
            opacity: 0;
            transform: translate(-50%, -44%) scale(0.92);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes td-copy {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes td-signal {
          to {
            transform: translateX(100%);
          }
        }

        @keyframes td-aurora {
          40% {
            opacity: 1;
          }
          to {
            opacity: 0.45;
            transform: scale(1.08);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .td-entrance {
            transition-duration: 120ms;
          }

          .td-entrance__aurora,
          .td-entrance__card,
          .td-entrance__copy,
          .td-entrance__signal span {
            animation: none;
          }

          .td-entrance__card--left {
            opacity: 0.7;
            transform: translate(-76%, -50%) rotate(-8deg);
          }

          .td-entrance__card--right {
            opacity: 0.7;
            transform: translate(-24%, -50%) rotate(8deg);
          }

          .td-entrance__copy {
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
