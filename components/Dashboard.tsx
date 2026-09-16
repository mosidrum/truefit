"use client";

import { SignOutButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  SCORE_RING_CIRCUMFERENCE,
  TAILORING_SESSIONS,
  type TailoringSession,
} from "@/lib/dashboardData";
import { PROFILE_COMPLETION } from "@/lib/profileData";
import type { AppUser } from "@/lib/session";
import styles from "./Dashboard.module.scss";

const TABS = ["What changed", "Tailored CV", "Cover letter", "Job post"] as const;

const SESSION_GROUPS = [
  { label: "Today", sessions: TAILORING_SESSIONS.slice(0, 2) },
  { label: "Earlier this week", sessions: TAILORING_SESSIONS.slice(2) },
];

export default function Dashboard({ user }: { user: AppUser }) {
  const [activeSessionId, setActiveSessionId] = useState(
    TAILORING_SESSIONS[0].id
  );
  const [activeTab, setActiveTab] = useState(0);

  const session =
    TAILORING_SESSIONS.find((s) => s.id === activeSessionId) ??
    TAILORING_SESSIONS[0];

  function selectSession(id: string) {
    setActiveSessionId(id);
    setActiveTab(0);
  }

  return (
    <div className={styles.page}>
      <DashboardSidebar
        user={user}
        activeSessionId={activeSessionId}
        onSelect={selectSession}
      />

      <main className={styles.main}>
        <WorkspaceHeader session={session} />
        <TabsNav activeTab={activeTab} onSelect={setActiveTab} />

        <div className={styles.scrollArea}>
          <div className={styles.grid}>
            <div className={styles.column}>
              {activeTab === 0 && <WhatChangedPanel session={session} />}
              {activeTab === 1 && (
                <TailoredCvPanel session={session} user={user} />
              )}
              {activeTab === 2 && <CoverLetterPanel session={session} />}
              {activeTab === 3 && <JobPostPanel session={session} />}
            </div>

            <aside className={styles.side}>
              <ScoreCard key={session.id} session={session} />
              <KeywordsCard session={session} />
              <GapCard session={session} />
            </aside>
          </div>
        </div>

        <ComposeBar />
      </main>
    </div>
  );
}

function DashboardSidebar({
  user,
  activeSessionId,
  onSelect,
}: {
  user: AppUser;
  activeSessionId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand}>
        <span className={styles.brandMark}>T</span>
        <span className={styles.brandName}>truefit</span>
      </Link>

      <button type="button" className={styles.newTailor}>
        New tailor <span aria-hidden="true">＋</span>
      </button>

      <nav className={styles.sessionNav} aria-label="Tailoring sessions">
        {SESSION_GROUPS.map((group) => (
          <div key={group.label} className={styles.sessionGroup}>
            <p className={styles.groupLabel}>{group.label}</p>
            <ul className={styles.sessionList}>
              {group.sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <li key={session.id}>
                    <button
                      type="button"
                      aria-current={isActive ? true : undefined}
                      className={`${styles.sessionButton} ${
                        isActive ? styles.sessionButtonActive : ""
                      }`}
                      onClick={() => onSelect(session.id)}
                    >
                      <span className={styles.sessionRail} aria-hidden="true" />
                      <span className={styles.sessionText}>
                        {session.title}
                        <span className={styles.sessionCompany}>
                          {session.company}
                        </span>
                      </span>
                      <span className={styles.sessionScore}>
                        {session.score}%
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.planCard}>
          <p className={styles.planLabel}>Pro · 41 of ∞ tailors</p>
          <div className={styles.planTrack}>
            <div className={styles.planFill} style={{ width: "64%" }} />
          </div>
        </div>
        <div className={styles.profileLink}>
          <UserButton />
          <Link href="/profile" className={styles.profileText}>
            {user.name}
            <span className={styles.profileMeta}>
              Career record {PROFILE_COMPLETION}%
            </span>
          </Link>
        </div>
        <SignOutButton redirectUrl="/">
          <button type="button" className={styles.signOutButton}>
            Sign out
          </button>
        </SignOutButton>
      </div>
    </aside>
  );
}

function WorkspaceHeader({ session }: { session: TailoringSession }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        <p className={styles.kicker}>Tailoring</p>
        <h1 className={styles.title}>
          {session.title}{" "}
          <span className={styles.company}>· {session.company}</span>
        </h1>
      </div>
      <span className={styles.statusPill}>{session.status}</span>
      <button type="button" className={styles.shareButton}>
        Share
      </button>
      <button type="button" className={styles.exportButton}>
        Export PDF
      </button>
    </header>
  );
}

function TabsNav({
  activeTab,
  onSelect,
}: {
  activeTab: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className={styles.tabs}>
      {TABS.map((label, index) => (
        <button
          key={label}
          type="button"
          aria-current={activeTab === index ? true : undefined}
          className={`${styles.tab} ${
            activeTab === index ? styles.tabActive : ""
          }`}
          onClick={() => onSelect(index)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function WhatChangedPanel({ session }: { session: TailoringSession }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>What changed</h2>
        <span className={styles.panelNote}>{session.changed}</span>
      </div>
      {session.diffs.map((diff) => (
        <div key={diff.num} className={styles.diffRow}>
          <span className={styles.diffNum}>{diff.num}</span>
          <div className={styles.diffBody}>
            <p className={styles.diffBefore}>{diff.before}</p>
            <div className={styles.diffAfterRow}>
              <span className={styles.diffBar} aria-hidden="true" />
              <div className={styles.diffAfterCol}>
                <p className={styles.diffAfter}>{diff.after}</p>
                <div className={styles.diffFootnote}>
                  <span>Source · {diff.source}</span>
                  <span className={styles.diffMatch}>
                    Matches · {diff.match}
                  </span>
                </div>
                <div className={styles.diffActions}>
                  <button type="button" className={styles.keepButton}>
                    Keep
                  </button>
                  <button type="button" className={styles.revertButton}>
                    Revert
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TailoredCvPanel({
  session,
  user,
}: {
  session: TailoringSession;
  user: AppUser;
}) {
  return (
    <div className={`${styles.panel} ${styles.cvPanel}`}>
      <p className={styles.cvName}>{user.name}</p>
      <p className={styles.cvMeta}>
        {session.title} · London · {user.email}
      </p>
      <hr className={styles.cvDivider} />
      <p className={styles.cvSectionLabel}>Summary</p>
      <p className={styles.cvSummary}>{session.summary}</p>
      <p className={styles.cvSectionLabel}>Experience</p>
      <ul className={styles.cvList}>
        {session.cvLines.map((line, i) => (
          <li key={i} className={styles.cvItem}>
            <span aria-hidden="true">—</span> {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CoverLetterPanel({ session }: { session: TailoringSession }) {
  return (
    <div className={styles.panel}>
      <p className={styles.panelNote}>Drafted from the same evidence</p>
      {session.letter.map((paragraph, i) => (
        <p key={i} className={styles.letterParagraph}>
          {paragraph}
        </p>
      ))}
      <div className={styles.letterActions}>
        <button type="button" className={styles.regenButton}>
          Regenerate
        </button>
        <button type="button" className={styles.copyButton}>
          Copy
        </button>
      </div>
    </div>
  );
}

function JobPostPanel({ session }: { session: TailoringSession }) {
  return (
    <div className={styles.panel}>
      <p className={styles.panelNote}>{session.postUrl}</p>
      <ul className={styles.reqList}>
        {session.reqs.map((req) => (
          <li
            key={req.label}
            className={`${styles.reqRow} ${
              req.status === "ok" ? styles.reqOk : ""
            }`}
          >
            <span className={styles.reqIcon} aria-hidden="true">
              {req.status === "ok" ? "✓" : req.status === "part" ? "~" : "–"}
            </span>
            <span className={styles.reqLabel}>{req.label}</span>
            <span className={styles.reqState}>
              {req.status === "ok"
                ? "Covered"
                : req.status === "part"
                  ? "Partial"
                  : "Not on record"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Keyed by session id from the parent so switching sessions remounts this
// component, restarting the tween from zero (mirrors Landing's HeroStage).
function ScoreCard({ session }: { session: TailoringSession }) {
  const [score, setScore] = useState(0);

  useEffect(() => {
    const target = session.score;
    const tween = window.setInterval(() => {
      setScore((current) => {
        if (Math.abs(current - target) <= 0.4) return target;
        return current + (target - current) * 0.12;
      });
    }, 30);
    return () => window.clearInterval(tween);
  }, [session.score]);

  const rounded = Math.round(score);
  const ringOffset =
    SCORE_RING_CIRCUMFERENCE - (SCORE_RING_CIRCUMFERENCE * score) / 100;

  return (
    <div className={styles.scoreCard}>
      <div className={styles.scoreTop}>
        <svg viewBox="0 0 56 56" className={styles.ring}>
          <circle cx="28" cy="28" r="23" className={styles.ringTrack} />
          <circle
            cx="28"
            cy="28"
            r="23"
            className={styles.ringProgress}
            strokeDasharray={SCORE_RING_CIRCUMFERENCE}
            strokeDashoffset={ringOffset}
          />
        </svg>
        <div>
          <p className={styles.scoreValue}>{rounded}%</p>
          <p className={styles.scoreSub}>match against 14 requirements</p>
        </div>
      </div>
      <div className={styles.bars}>
        {session.bars.map(([label, pct]) => (
          <div key={label} className={styles.barRow}>
            <div className={styles.barHead}>
              <span>{label}</span>
              <span>{pct}%</span>
            </div>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeywordsCard({ session }: { session: TailoringSession }) {
  return (
    <div className={styles.sideCard}>
      <p className={styles.sideLabel}>Keywords earned</p>
      <div className={styles.chips}>
        {session.keywords.map((word) => (
          <span key={word} className={styles.chip}>
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}

function GapCard({ session }: { session: TailoringSession }) {
  return (
    <div className={styles.sideCard}>
      <p className={styles.sideLabel}>One honest gap</p>
      <p className={styles.gapTitle}>{session.gapTitle}</p>
      <p className={styles.gapBody}>{session.gapBody}</p>
      <button type="button" className={styles.addRecordButton}>
        Add to record
      </button>
    </div>
  );
}

function ComposeBar() {
  return (
    <div className={styles.compose}>
      <div className={styles.composeRow}>
        <input
          type="url"
          placeholder="Paste the job description URL you're applying for"
          className={styles.composeInput}
        />
        <button type="button" className={styles.composeButton}>
          Tailor a CV
        </button>
      </div>
      <p className={styles.composeNote}>
        Or drop a PDF of the posting · Average tailor takes 11 seconds
      </p>
    </div>
  );
}
