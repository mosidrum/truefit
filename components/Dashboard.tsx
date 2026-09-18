"use client";

import { SignOutButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import type { JobSummary } from "@/lib/jobs";
import type { AppUser } from "@/lib/session";
import type { TailoringRecord } from "@/lib/tailoring";
import {
  formatContactLine,
  formatEducationLine,
  formatExperienceHeader,
  formatExperienceMeta,
  formatProjectHeader,
  normalizeTailoredCvForDisplay,
} from "@/lib/tailoredCvCompat";
import { Skeleton, SkeletonLines } from "./Skeleton";
import styles from "./Dashboard.module.scss";

const TABS = ["What changed", "Tailored CV", "Cover letter", "Job post"] as const;
const GAP_FILE_ACCEPT = ".pdf,.doc,.docx,.txt";
const GAP_MAX_FILE_SIZE = 10 * 1024 * 1024;

type TailoringState =
  | { status: "loading" }
  | { status: "ready"; data: TailoringRecord }
  | { status: "error"; message: string };

/** Best available label for a job: parsed title, else parsed company, else the URL's host. */
function jobTitle(job: JobSummary): string {
  if (job.parsedTitle) return job.parsedTitle;
  if (job.parsedCompany) return job.parsedCompany;
  try {
    return new URL(job.sourceUrl).hostname;
  } catch {
    return job.sourceUrl;
  }
}

/** Only shown as a subtitle when both title and company were actually extracted. */
function jobCompany(job: JobSummary): string | null {
  return job.parsedTitle && job.parsedCompany ? job.parsedCompany : null;
}

export default function Dashboard({
  user,
  completion,
  jobs: initialJobs,
}: {
  user: AppUser;
  completion: number;
  jobs: JobSummary[];
}) {
  const [jobs, setJobs] = useState<JobSummary[]>(initialJobs);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [tailoringBySession, setTailoringBySession] = useState<
    Record<string, TailoringState>
  >({});

  const session = activeSessionId
    ? (jobs.find((j) => j.id === activeSessionId) ?? null)
    : null;
  const tailoringState = session ? tailoringBySession[session.id] : undefined;

  // Fully automatic: the moment a session becomes active without cached
  // tailoring, fetch it if it already exists, or generate it if it doesn't
  // (covers both a brand-new session and an older one from history).
  useEffect(() => {
    if (!session || tailoringBySession[session.id]) return;
    const jobId = session.id;
    const hadTailoring = session.hasTailoring;

    setTailoringBySession((prev) => ({ ...prev, [jobId]: { status: "loading" } }));

    (async () => {
      try {
        let res = await fetch(`/api/jobs/${jobId}/tailoring`, {
          method: hadTailoring ? "GET" : "POST",
        });
        if (res.status === 404) {
          // Stale hasTailoring flag from initial page load — generate instead.
          res = await fetch(`/api/jobs/${jobId}/tailoring`, { method: "POST" });
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't generate tailoring.");
        setTailoringBySession((prev) => ({
          ...prev,
          [jobId]: { status: "ready", data: data.tailoring },
        }));
      } catch (error) {
        setTailoringBySession((prev) => ({
          ...prev,
          [jobId]: {
            status: "error",
            message: error instanceof Error ? error.message : "Couldn't generate tailoring.",
          },
        }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  function retryTailoring(jobId: string) {
    setTailoringBySession((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
  }

  async function forceRegenerate(jobId: string, additionalContext: string) {
    const previous = tailoringBySession[jobId];
    setTailoringBySession((prev) => ({ ...prev, [jobId]: { status: "loading" } }));
    try {
      const res = await fetch(`/api/jobs/${jobId}/tailoring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true, additionalContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't regenerate tailoring.");
      setTailoringBySession((prev) => ({
        ...prev,
        [jobId]: { status: "ready", data: data.tailoring },
      }));
      setJobs((prev) =>
        prev.map((job) => (job.id === jobId ? { ...job, hasTailoring: true } : job))
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Couldn't regenerate tailoring.";
      setTailoringBySession((prev) => ({
        ...prev,
        [jobId]:
          previous?.status === "ready"
            ? previous
            : { status: "error", message },
      }));
      throw error instanceof Error ? error : new Error(message);
    }
  }

  function selectSession(id: string) {
    setActiveSessionId(id);
    setActiveTab(0);
  }

  function startNewTailor() {
    setActiveSessionId(null);
    setActiveTab(0);
  }

  async function deleteSession(job: JobSummary) {
    const label = jobTitle(job);
    if (!window.confirm(`Delete “${label}”? This can't be undone.`)) return;

    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data.error ?? "Couldn't delete that session.");
        return;
      }
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      setTailoringBySession((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      if (activeSessionId === job.id) {
        setActiveSessionId(null);
        setActiveTab(0);
      }
    } catch {
      window.alert("Couldn't delete that session.");
    }
  }

  function handleJobSaved(job: JobSummary) {
    setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
    setActiveSessionId(job.id);
    setActiveTab(0);
  }

  return (
    <div className={styles.page}>
      <AccountBadge user={user} completion={completion} />

      <DashboardSidebar
        jobs={jobs}
        activeSessionId={activeSessionId}
        onSelect={selectSession}
        onNewTailor={startNewTailor}
        onDelete={deleteSession}
      />

      <main className={styles.main}>
        {session ? (
          <>
            <WorkspaceHeader session={session} />
            <TabsNav activeTab={activeTab} onSelect={setActiveTab} />

            <div className={styles.scrollArea}>
              <div className={styles.grid}>
                <div className={styles.column}>
                  {activeTab === 0 && (
                    <WhatChangedPanel state={tailoringState} onRetry={() => retryTailoring(session.id)} />
                  )}
                  {activeTab === 1 && (
                    <TailoredCvPanel
                      state={tailoringState}
                      jobPostId={session.id}
                      candidateName={user.name}
                      candidateEmail={user.email}
                      onRetry={() => retryTailoring(session.id)}
                    />
                  )}
                  {activeTab === 2 && (
                    <CoverLetterPanel state={tailoringState} onRetry={() => retryTailoring(session.id)} />
                  )}
                  {activeTab === 3 && <JobPostPanel session={session} />}
                </div>

                <InsightsAside
                  state={tailoringState}
                  jobPostId={session.id}
                  onForceRegenerate={forceRegenerate}
                />
              </div>
            </div>
          </>
        ) : (
          <DraftState onSaved={handleJobSaved} />
        )}
      </main>
    </div>
  );
}

function AccountBadge({
  user,
  completion,
}: {
  user: AppUser;
  completion: number;
}) {
  return (
    <div className={styles.accountBadge}>
      <UserButton />
      <Link href="/profile" className={styles.profileText}>
        {user.name}
        <span className={styles.profileMeta}>
          Career record {completion}%
        </span>
      </Link>
      <SignOutButton redirectUrl="/">
        <button type="button" className={styles.signOutButton}>
          Sign out
        </button>
      </SignOutButton>
    </div>
  );
}

function DashboardSidebar({
  jobs,
  activeSessionId,
  onSelect,
  onNewTailor,
  onDelete,
}: {
  jobs: JobSummary[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNewTailor: () => void;
  onDelete: (job: JobSummary) => void;
}) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  return (
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand}>
        <span className={styles.brandMark}>T</span>
        <span className={styles.brandName}>truefit</span>
      </Link>

      <button type="button" className={styles.newTailor} onClick={onNewTailor}>
        New tailor <span aria-hidden="true">＋</span>
      </button>

      <nav className={styles.sessionNav} aria-label="Tailoring sessions">
        <div className={styles.sessionGroup}>
          <p className={styles.groupLabel}>History</p>
          {jobs.length === 0 ? (
            <p className={styles.sessionEmpty}>
              No tailoring sessions yet — paste a job URL to start one.
            </p>
          ) : (
            <ul className={styles.sessionList}>
              {jobs.map((job) => {
                const isActive = job.id === activeSessionId;
                const company = jobCompany(job);
                return (
                  <li key={job.id} className={styles.sessionRow}>
                    <button
                      type="button"
                      aria-current={isActive ? true : undefined}
                      className={`${styles.sessionButton} ${
                        isActive ? styles.sessionButtonActive : ""
                      }`}
                      onClick={() => {
                        setMenuOpenId(null);
                        onSelect(job.id);
                      }}
                    >
                      <span className={styles.sessionRail} aria-hidden="true" />
                      <span className={styles.sessionText}>
                        {jobTitle(job)}
                        {company && (
                          <span className={styles.sessionCompany}>{company}</span>
                        )}
                      </span>
                    </button>
                    <SessionOverflowMenu
                      open={menuOpenId === job.id}
                      onOpenChange={(open) =>
                        setMenuOpenId(open ? job.id : null)
                      }
                      onDelete={() => {
                        setMenuOpenId(null);
                        onDelete(job);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </nav>
    </aside>
  );
}

function SessionOverflowMenu({
  open,
  onOpenChange,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div className={styles.sessionMenu} ref={rootRef}>
      <button
        type="button"
        className={styles.sessionMenuTrigger}
        aria-label="Session actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div className={styles.sessionMenuPopover} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.sessionMenuDelete}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function WorkspaceHeader({ session }: { session: JobSummary }) {
  const company = jobCompany(session);
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        <p className={styles.kicker}>Tailoring</p>
        <h1 className={styles.title}>
          {jobTitle(session)}{" "}
          {company && <span className={styles.company}>· {company}</span>}
        </h1>
      </div>
      <span className={styles.statusPill}>Saved</span>
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

function RetryNote({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.errorNote}>
      <p className={styles.panelNote}>{message}</p>
      <button type="button" className={styles.retryButton} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function WhatChangedPanel({
  state,
  onRetry,
}: {
  state: TailoringState | undefined;
  onRetry: () => void;
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>What changed</h2>
      </div>

      {!state || state.status === "loading" ? (
        <ul className={styles.changeList} aria-label="Tailoring this CV to the job…">
          {Array.from({ length: 3 }).map((_, index) => (
            <li key={index} className={`${styles.changeItem} ${styles.skeletonStack}`}>
              <Skeleton height="14px" width="65%" />
              <Skeleton height="11px" width="90%" />
            </li>
          ))}
        </ul>
      ) : state.status === "error" ? (
        <RetryNote message={state.message} onRetry={onRetry} />
      ) : state.data.whatChanged.length === 0 ? (
        <p className={styles.panelNote}>No substantive changes were needed.</p>
      ) : (
        <ul className={styles.changeList}>
          {state.data.whatChanged.map((change, index) => (
            <li key={index} className={styles.changeItem}>
              <p className={styles.changeItemText}>{change.item}</p>
              <p className={styles.changeJustification}>{change.justification}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TailoredCvPanel({
  state,
  jobPostId,
  candidateName,
  candidateEmail,
  onRetry,
}: {
  state: TailoringState | undefined;
  jobPostId: string;
  candidateName: string;
  candidateEmail: string;
  onRetry: () => void;
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Tailored CV</h2>
        {state?.status === "ready" && (
          <a
            href={`/api/jobs/${jobPostId}/tailoring/pdf`}
            download
            className={styles.exportButton}
          >
            Download PDF
          </a>
        )}
      </div>

      {!state || state.status === "loading" ? (
        <div className={styles.cvContent} aria-label="Tailoring this CV to the job…">
          <Skeleton height="20px" width="40%" />
          <Skeleton height="14px" width="28%" />
          <Skeleton height="12px" width="70%" />
          <SkeletonLines count={3} lastLineWidth="80%" />
          <div className={styles.cvSection}>
            <Skeleton height="10px" width="22%" />
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className={styles.cvRole}>
                <Skeleton height="13px" width="55%" />
                <Skeleton height="12px" width="45%" />
                <SkeletonLines count={2} lastLineWidth="60%" />
              </div>
            ))}
          </div>
        </div>
      ) : state.status === "error" ? (
        <RetryNote message={state.message} onRetry={onRetry} />
      ) : (
        (() => {
          const tailoredCv = normalizeTailoredCvForDisplay(state.data.tailoredCv);
          const contactLine = formatContactLine({
            location: tailoredCv.location,
            email: candidateEmail,
            website: tailoredCv.website,
            github: tailoredCv.github,
          });
          return (
            <div className={styles.cvContent}>
              <p className={styles.cvName}>{candidateName}</p>
              {tailoredCv.headline ? (
                <h3 className={styles.cvHeadline}>{tailoredCv.headline}</h3>
              ) : null}
              {contactLine ? <p className={styles.cvContact}>{contactLine}</p> : null}

              {tailoredCv.summary ? (
                <div className={styles.cvSection}>
                  <p className={styles.cvSectionTitle}>Summary</p>
                  <p className={styles.cvSummary}>{tailoredCv.summary}</p>
                </div>
              ) : null}

              {tailoredCv.experience.length > 0 && (
                <div className={styles.cvSection}>
                  <p className={styles.cvSectionTitle}>Experience</p>
                  {tailoredCv.experience.map((role, index) => (
                    <div key={index} className={styles.cvRole}>
                      <p className={styles.cvRoleTitle}>
                        {formatExperienceHeader(role.company, role.title)}
                      </p>
                      {formatExperienceMeta(role.dates, role.context) ? (
                        <p className={styles.cvRoleMeta}>
                          {formatExperienceMeta(role.dates, role.context)}
                        </p>
                      ) : null}
                      <ul className={styles.cvBullets}>
                        {role.bullets.map((bullet, bulletIndex) => (
                          <li key={bulletIndex}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {tailoredCv.projects.length > 0 && (
                <div className={styles.cvSection}>
                  <p className={styles.cvSectionTitle}>Projects</p>
                  {tailoredCv.projects.map((project, index) => (
                    <div key={index} className={styles.cvRole}>
                      <p className={styles.cvRoleTitle}>
                        {formatProjectHeader(project.name, project.dates, project.description)}
                      </p>
                      {project.bullets.length > 0 ? (
                        <ul className={styles.cvBullets}>
                          {project.bullets.map((bullet, bulletIndex) => (
                            <li key={bulletIndex}>{bullet}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {tailoredCv.skills.length > 0 && (
                <div className={styles.cvSection}>
                  <p className={styles.cvSectionTitle}>Skills</p>
                  {tailoredCv.skills.map((group) => (
                    <p key={group.category} className={styles.cvSkillLine}>
                      <span className={styles.cvSkillGroupLabel}>{group.category}: </span>
                      {group.items.join(", ")}
                    </p>
                  ))}
                </div>
              )}

              {tailoredCv.education.length > 0 && (
                <div className={styles.cvSection}>
                  <p className={styles.cvSectionTitle}>Education</p>
                  {tailoredCv.education.map((entry, index) => (
                    <p key={index} className={styles.cvEducationLine}>
                      {formatEducationLine(entry.degree, entry.institution, entry.dates)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}

function CoverLetterPanel({
  state,
  onRetry,
}: {
  state: TailoringState | undefined;
  onRetry: () => void;
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Cover letter</h2>
      </div>

      {!state || state.status === "loading" ? (
        <div className={styles.coverLetterText} aria-label="Writing a tailored cover letter…">
          <SkeletonLines count={4} lastLineWidth="85%" />
          <SkeletonLines count={3} lastLineWidth="55%" />
        </div>
      ) : state.status === "error" ? (
        <RetryNote message={state.message} onRetry={onRetry} />
      ) : (
        <div className={styles.coverLetterText}>
          {state.data.coverLetter
            .split(/\n\s*\n/)
            .filter((p) => p.trim())
            .map((paragraph, index) => (
              <p key={index}>{paragraph.trim()}</p>
            ))}
        </div>
      )}
    </div>
  );
}

function JobPostPanel({ session }: { session: JobSummary }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Job post</h2>
      </div>

      <dl className={styles.jobPostFields}>
        <dt>Title</dt>
        <dd>{session.parsedTitle ?? "Not available"}</dd>
        <dt>Company</dt>
        <dd>{session.parsedCompany ?? "Not available"}</dd>
        <dt>Location</dt>
        <dd>{session.parsedLocation ?? "Not available"}</dd>
      </dl>

      <p className={styles.panelNote}>
        {session.parsedDescription ?? "Not available"}
      </p>

      {session.parsedRequirements && session.parsedRequirements.length > 0 && (
        <div className={styles.cvSection}>
          <p className={styles.cvSectionTitle}>Requirements</p>
          <ul className={styles.jobPostRequirements}>
            {session.parsedRequirements.map((req, index) => (
              <li key={index}>{req}</li>
            ))}
          </ul>
        </div>
      )}

      <p className={styles.panelNote}>Parsed from {session.sourceUrl}</p>
    </div>
  );
}

function ScoreBreakdownList({
  breakdown,
}: {
  breakdown: NonNullable<TailoringRecord["atsScoreBreakdown"]>;
}) {
  return (
    <ul className={styles.breakdownList}>
      {breakdown.criteria.map((criterion) => (
        <li
          key={criterion.key}
          className={`${styles.breakdownRow} ${
            criterion.score <= 1 ? styles.breakdownRowWeak : ""
          }`}
          title={criterion.detail}
        >
          <span className={styles.breakdownLabel}>{criterion.label}</span>
          <span className={styles.breakdownScore}>{criterion.score}/3</span>
        </li>
      ))}
    </ul>
  );
}

function ScoreBreakdownCard({
  label,
  breakdown,
  state,
}: {
  label: string;
  breakdown: TailoringRecord["atsScoreBreakdown"] | undefined;
  state: TailoringState | undefined;
}) {
  const ready = state?.status === "ready" ? state.data : null;

  return (
    <div className={styles.sideCard}>
      <p className={styles.sideLabel}>{label}</p>
      {ready ? (
        breakdown ? (
          <ScoreBreakdownList breakdown={breakdown} />
        ) : (
          <p className={styles.panelNote}>
            Not available for this session — generated before scoring breakdowns existed.
          </p>
        )
      ) : state?.status === "loading" ? (
        <div className={styles.skeletonStack} aria-label="Not generated yet.">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} height="14px" width="100%" />
          ))}
        </div>
      ) : (
        <p className={styles.panelNote}>
          {state?.status === "error" ? "Couldn't generate." : "Not generated yet."}
        </p>
      )}
    </div>
  );
}

function InsightsAside({
  state,
  jobPostId,
  onForceRegenerate,
}: {
  state: TailoringState | undefined;
  jobPostId: string;
  onForceRegenerate: (jobId: string, additionalContext: string) => Promise<void>;
}) {
  const ready = state?.status === "ready" ? state.data : null;
  const delta = ready ? ready.atsScore - ready.preTailoringMatchScore : null;
  const gap = ready?.unmetRequirement?.trim() || null;

  return (
    <aside className={styles.side}>
      <div className={styles.sideCard}>
        <p className={styles.sideLabel}>ATS score</p>
        {ready ? (
          <p className={styles.scoreDelta}>
            <span className={styles.scoreValueMuted}>{ready.preTailoringMatchScore}</span>
            <span className={styles.scoreArrow} aria-hidden="true">
              →
            </span>
            <span className={styles.scoreValue}>{ready.atsScore}</span>
            {delta !== null && (
              <span
                className={delta > 0 ? styles.scoreDeltaPositive : styles.scoreDeltaNegative}
              >
                {delta > 0 ? "+" : ""}
                {delta}
              </span>
            )}
          </p>
        ) : state?.status === "loading" ? (
          <span aria-label="Not generated yet.">
            <Skeleton height="24px" width="120px" />
          </span>
        ) : (
          <p className={styles.panelNote}>
            {state?.status === "error" ? "Couldn't generate." : "Not generated yet."}
          </p>
        )}
      </div>
      <ScoreBreakdownCard
        label="Before tailoring"
        breakdown={ready?.preTailoringBreakdown}
        state={state}
      />
      <ScoreBreakdownCard
        label="After tailoring"
        breakdown={ready?.atsScoreBreakdown}
        state={state}
      />
      <div className={styles.sideCard}>
        <p className={styles.sideLabel}>Keywords earned</p>
        {ready ? (
          ready.keywordsCovered.length > 0 ? (
            <ul className={styles.keywordList}>
              {ready.keywordsCovered.map((keyword) => (
                <li key={keyword} className={styles.keywordTag}>
                  {keyword}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.panelNote}>None yet.</p>
          )
        ) : state?.status === "loading" ? (
          <div className={styles.keywordList} aria-label="Not generated yet.">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} height="20px" width="52px" radius="999px" />
            ))}
          </div>
        ) : (
          <p className={styles.panelNote}>
            {state?.status === "error" ? "Couldn't generate." : "Not generated yet."}
          </p>
        )}
      </div>
      <div className={styles.sideCard}>
        <p className={styles.sideLabel}>One honest gap</p>
        {ready ? (
          gap ? (
            <>
              <p className={styles.panelNote}>{gap}</p>
              <GapEvidencePrompt
                key={`${jobPostId}:${ready.id}`}
                jobPostId={jobPostId}
                gap={gap}
                onForceRegenerate={onForceRegenerate}
              />
            </>
          ) : (
            <p className={styles.panelNote}>No gap found.</p>
          )
        ) : state?.status === "loading" ? (
          <SkeletonLines count={2} lastLineWidth="60%" />
        ) : (
          <p className={styles.panelNote}>
            {state?.status === "error" ? "Couldn't generate." : "Not generated yet."}
          </p>
        )}
      </div>
    </aside>
  );
}

async function uploadCareerDocument(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/documents", {
    method: "POST",
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? `Couldn't upload ${file.name}.`);
  }
}

function GapEvidencePrompt({
  jobPostId,
  gap,
  onForceRegenerate,
}: {
  jobPostId: string;
  gap: string;
  onForceRegenerate: (jobId: string, additionalContext: string) => Promise<void>;
}) {
  const [step, setStep] = useState<"ask" | "form" | "dismissed">("ask");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const next: File[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > GAP_MAX_FILE_SIZE) {
        setError(`${file.name} is larger than 10MB.`);
        return;
      }
      next.push(file);
    }
    setError("");
    setFiles((prev) => {
      const names = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const merged = [...prev];
      for (const file of next) {
        const key = `${file.name}:${file.size}`;
        if (!names.has(key)) merged.push(file);
      }
      return merged;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = note.trim();
    if (!trimmed && files.length === 0) {
      setError("Add a short note or upload a file.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      for (const file of files) {
        await uploadCareerDocument(file);
      }
      if (trimmed) {
        const blob = new Blob([trimmed], { type: "text/plain" });
        const noteFile = new File([blob], `gap-note-${jobPostId}.txt`, {
          type: "text/plain",
        });
        await uploadCareerDocument(noteFile);
      }

      const additionalContext = [
        `Previously identified gap: ${gap}`,
        trimmed ? `User response:\n${trimmed}` : null,
        files.length > 0
          ? `User uploaded ${files.length} supporting file(s), now saved in their career record.`
          : null,
      ]
        .filter(Boolean)
        .join("\n\n");

      await onForceRegenerate(jobPostId, additionalContext);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Couldn't submit gap evidence."
      );
      setSubmitting(false);
    }
  }

  if (step === "dismissed") return null;

  if (step === "ask") {
    return (
      <div className={styles.gapPrompt}>
        <p className={styles.gapPromptQuestion}>
          Do you have anything relevant for this gap?
        </p>
        <div className={styles.gapPromptActions}>
          <button
            type="button"
            className={styles.gapPromptYes}
            onClick={() => setStep("form")}
          >
            Yes
          </button>
          <button
            type="button"
            className={styles.gapPromptNo}
            onClick={() => setStep("dismissed")}
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.gapForm} onSubmit={handleSubmit}>
      <label className={styles.gapFormLabel} htmlFor={`gap-note-${jobPostId}`}>
        Add context for this gap
      </label>
      <textarea
        id={`gap-note-${jobPostId}`}
        className={styles.gapTextarea}
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Experience, projects, or details that address this gap…"
        disabled={submitting}
      />
      <div className={styles.gapFiles}>
        <input
          ref={fileInputRef}
          type="file"
          accept={GAP_FILE_ACCEPT}
          multiple
          className={styles.gapFileInput}
          disabled={submitting}
          onChange={(event) => handleFilesSelected(event.target.files)}
        />
        <button
          type="button"
          className={styles.gapFileButton}
          disabled={submitting}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload files
        </button>
        <span className={styles.gapFileHint}>PDF, DOCX, or TXT · max 10MB</span>
      </div>
      {files.length > 0 && (
        <ul className={styles.gapFileList}>
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${index}`} className={styles.gapFileItem}>
              <span className={styles.gapFileName}>{file.name}</span>
              <button
                type="button"
                className={styles.gapFileRemove}
                disabled={submitting}
                aria-label={`Remove ${file.name}`}
                onClick={() => removeFile(index)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className={styles.gapFormError}>{error}</p>}
      <div className={styles.gapFormActions}>
        <button
          type="submit"
          className={styles.gapSubmit}
          disabled={submitting}
        >
          {submitting ? "Updating CV…" : "Update tailored CV"}
        </button>
        <button
          type="button"
          className={styles.gapPromptNo}
          disabled={submitting}
          onClick={() => setStep("dismissed")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function DraftState({ onSaved }: { onSaved: (job: JobSummary) => void }) {
  const [isFetchingJob, setIsFetchingJob] = useState(false);

  return (
    <>
      <div className={styles.scrollArea}>
        <div className={styles.draftState}>
          {isFetchingJob ? (
            <div
              className={styles.draftLoading}
              role="status"
              aria-live="polite"
              aria-label="Fetching the posting"
            >
              <p className={styles.kicker}>Tailoring</p>
              <div className={styles.draftLoadingTitle}>
                <Skeleton height="28px" width="72%" />
              </div>
              <div className={styles.draftLoadingBody}>
                <SkeletonLines count={2} lastLineWidth="68%" />
              </div>
              <p className={styles.panelNote}>Fetching the posting…</p>
            </div>
          ) : (
            <>
              <p className={styles.kicker}>Tailoring</p>
              <h1 className={styles.title}>Start a new tailoring session</h1>
              <p className={styles.panelNote}>
                Paste a job posting URL below to fetch the listing and begin
                tailoring your CV.
              </p>
            </>
          )}
        </div>
      </div>
      <ComposeBar onSaved={onSaved} onFetchingChange={setIsFetchingJob} />
    </>
  );
}

function validateUrl(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "Enter a valid URL (including https://).";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Only http or https URLs are supported.";
  }
  return null;
}

function ComposeBar({
  onSaved,
  onFetchingChange,
}: {
  onSaved: (job: JobSummary) => void;
  onFetchingChange: (isFetching: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<{
    status: "idle" | "saving" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  const isSaving = state.status === "saving";

  async function submitUrl(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setState({ status: "error", message: "Paste a job posting URL first." });
      return;
    }

    const validationError = validateUrl(trimmed);
    if (validationError) {
      setState({ status: "error", message: validationError });
      return;
    }

    // Show the draft loading state before the network call so Save/paste feel instant.
    onFetchingChange(true);
    setUrl(trimmed);
    setState({ status: "saving", message: "Fetching the posting…" });

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await response.json();

      if (!response.ok) {
        onFetchingChange(false);
        setState({
          status: "error",
          message: data.error ?? "Couldn't save that URL. Try again.",
        });
        return;
      }

      setUrl("");
      setState({ status: "idle", message: "" });
      // Keep the draft loading visible until the session workspace mounts —
      // clearing it here would flash the empty state before AI skeletons.
      onSaved(data.job);
    } catch {
      onFetchingChange(false);
      setState({ status: "error", message: "Couldn't save that URL. Try again." });
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    if (isSaving) return;
    const pasted = e.clipboardData.getData("text").trim();
    if (!pasted || validateUrl(pasted)) return;

    e.preventDefault();
    void submitUrl(pasted);
  }

  return (
    <div className={styles.compose}>
      <div className={styles.composeRow}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPaste={handlePaste}
          placeholder="Paste the job description URL you're applying for"
          className={styles.composeInput}
          disabled={isSaving}
        />
        <button
          type="button"
          className={styles.composeButton}
          onClick={() => void submitUrl(url)}
          disabled={isSaving}
        >
          {isSaving ? "Saving…" : "Save job post"}
        </button>
      </div>
      <p className={styles.composeNote}>
        {state.message || "Only job posting URLs are accepted here."}
      </p>
    </div>
  );
}
