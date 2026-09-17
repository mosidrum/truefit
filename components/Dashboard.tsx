"use client";

import { SignOutButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useState } from "react";
import type { JobSummary } from "@/lib/jobs";
import type { AppUser } from "@/lib/session";
import styles from "./Dashboard.module.scss";

const TABS = ["What changed", "Tailored CV", "Cover letter", "Job post"] as const;

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

  const session = activeSessionId
    ? (jobs.find((j) => j.id === activeSessionId) ?? null)
    : null;

  function selectSession(id: string) {
    setActiveSessionId(id);
    setActiveTab(0);
  }

  function startNewTailor() {
    setActiveSessionId(null);
    setActiveTab(0);
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
      />

      <main className={styles.main}>
        {session ? (
          <>
            <WorkspaceHeader session={session} />
            <TabsNav activeTab={activeTab} onSelect={setActiveTab} />

            <div className={styles.scrollArea}>
              <div className={styles.grid}>
                <div className={styles.column}>
                  {activeTab === 0 && <NotGeneratedPanel label="What changed" />}
                  {activeTab === 1 && <NotGeneratedPanel label="Tailored CV" />}
                  {activeTab === 2 && <NotGeneratedPanel label="Cover letter" />}
                  {activeTab === 3 && <JobPostPanel session={session} />}
                </div>

                <InsightsAside />
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
}: {
  jobs: JobSummary[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNewTailor: () => void;
}) {
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
                  <li key={job.id}>
                    <button
                      type="button"
                      aria-current={isActive ? true : undefined}
                      className={`${styles.sessionButton} ${
                        isActive ? styles.sessionButtonActive : ""
                      }`}
                      onClick={() => onSelect(job.id)}
                    >
                      <span className={styles.sessionRail} aria-hidden="true" />
                      <span className={styles.sessionText}>
                        {jobTitle(job)}
                        {company && (
                          <span className={styles.sessionCompany}>{company}</span>
                        )}
                      </span>
                    </button>
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

function NotGeneratedPanel({ label }: { label: string }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{label}</h2>
      </div>
      <p className={styles.panelNote}>Not generated yet.</p>
    </div>
  );
}

function JobPostPanel({ session }: { session: JobSummary }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Job post</h2>
      </div>
      <p className={styles.panelNote}>Parsed from {session.sourceUrl}</p>
    </div>
  );
}

function InsightsAside() {
  return (
    <aside className={styles.side}>
      <div className={styles.sideCard}>
        <p className={styles.sideLabel}>ATS score</p>
        <p className={styles.panelNote}>Not generated yet.</p>
      </div>
      <div className={styles.sideCard}>
        <p className={styles.sideLabel}>Keywords earned</p>
        <p className={styles.panelNote}>Not generated yet.</p>
      </div>
      <div className={styles.sideCard}>
        <p className={styles.sideLabel}>One honest gap</p>
        <p className={styles.panelNote}>Not generated yet.</p>
      </div>
    </aside>
  );
}

function DraftState({ onSaved }: { onSaved: (job: JobSummary) => void }) {
  return (
    <>
      <div className={styles.scrollArea}>
        <div className={styles.draftState}>
          <p className={styles.kicker}>Tailoring</p>
          <h1 className={styles.title}>Start a new tailoring session</h1>
          <p className={styles.panelNote}>
            Paste a job posting URL below to fetch the listing and begin
            tailoring your CV.
          </p>
        </div>
      </div>
      <ComposeBar onSaved={onSaved} />
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

function ComposeBar({ onSaved }: { onSaved: (job: JobSummary) => void }) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<{
    status: "idle" | "saving" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  const isSaving = state.status === "saving";

  async function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) {
      setState({ status: "error", message: "Paste a job posting URL first." });
      return;
    }

    const validationError = validateUrl(trimmed);
    if (validationError) {
      setState({ status: "error", message: validationError });
      return;
    }

    setState({ status: "saving", message: "Fetching the posting…" });

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await response.json();

      if (!response.ok) {
        setState({
          status: "error",
          message: data.error ?? "Couldn't save that URL. Try again.",
        });
        return;
      }

      setUrl("");
      setState({ status: "idle", message: "" });
      onSaved(data.job);
    } catch {
      setState({ status: "error", message: "Couldn't save that URL. Try again." });
    }
  }

  return (
    <div className={styles.compose}>
      <div className={styles.composeRow}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste the job description URL you're applying for"
          className={styles.composeInput}
          disabled={isSaving}
        />
        <button
          type="button"
          className={styles.composeButton}
          onClick={handleSubmit}
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
