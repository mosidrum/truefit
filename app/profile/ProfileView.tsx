"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  COMPLETION_RING_CIRCUMFERENCE,
  DEFAULT_TONE_INDEX,
  TONES,
} from "@/lib/profileData";
import type { AggregatedProfile } from "@/lib/profile";
import type { CvSummary } from "@/lib/cvs";
import type { AppUser } from "@/lib/session";
import styles from "./profile.module.scss";

export default function ProfileView({
  user,
  documents,
  profile,
}: {
  user: AppUser;
  documents: CvSummary[];
  profile: AggregatedProfile;
}) {
  const router = useRouter();
  const [openRoleIndex, setOpenRoleIndex] = useState(0);
  const [toneIndex, setToneIndex] = useState(DEFAULT_TONE_INDEX);
  const [completion, setCompletion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<{
    status: "idle" | "uploading" | "saved" | "duplicate" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteState, setDeleteState] = useState<{
    status: "idle" | "deleting" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  // Tweens the completeness ring up to its target whenever it changes,
  // mirroring the source design's load-in animation.
  useEffect(() => {
    const target = profile.completion;
    const tween = window.setInterval(() => {
      setCompletion((current) => {
        if (current >= target - 0.4) return target;
        return current + (target - current) * 0.12;
      });
    }, 30);
    return () => window.clearInterval(tween);
  }, [profile.completion]);

  const roundedCompletion = Math.round(completion);
  const ringOffset =
    COMPLETION_RING_CIRCUMFERENCE -
    (COMPLETION_RING_CIRCUMFERENCE * completion) / 100;

  function toggleRole(index: number) {
    setOpenRoleIndex((current) => (current === index ? -1 : index));
  }

  async function handleDocumentUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadState({ status: "uploading", message: "Uploading…" });

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setUploadState({
          status: "error",
          message: data.error ?? "Upload failed. Try again.",
        });
        return;
      }

      if (data.duplicate) {
        setUploadState({
          status: "duplicate",
          message: "Already on file — no changes to save.",
        });
        return;
      }

      setUploadState({
        status: "saved",
        message: data.enriched
          ? "Saved to your record."
          : "Saved, but we couldn't pull structured details from it.",
      });
      router.refresh();
    } catch {
      setUploadState({
        status: "error",
        message: "Upload failed. Try again.",
      });
    }
  }

  function toggleDocumentSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllDocuments() {
    setSelectedIds((current) =>
      current.size === documents.length
        ? new Set()
        : new Set(documents.map((doc) => doc.id))
    );
  }

  async function deleteDocuments(ids: string[]) {
    if (ids.length === 0) return;

    setDeleteState({ status: "deleting", message: "" });

    try {
      const response = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await response.json();

      if (!response.ok) {
        setDeleteState({
          status: "error",
          message: data.error ?? "Delete failed. Try again.",
        });
        return;
      }

      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of ids) next.delete(id);
        return next;
      });
      setDeleteState({ status: "idle", message: "" });
      router.refresh();
    } catch {
      setDeleteState({ status: "error", message: "Delete failed. Try again." });
    }
  }

  function confirmAndDelete(ids: string[], label: string) {
    if (window.confirm(`Delete ${label}? This can't be undone.`)) {
      deleteDocuments(ids);
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <Link href="/" className={styles.backLink}>
            <span aria-hidden="true">←</span> Dashboard
          </Link>
          <div className={styles.headerText}>
            <p className={styles.kicker}>Career record</p>
            <h1 className={styles.title}>{user.name}</h1>
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.topGrid}>
            <div className={styles.identityCard}>
              <span className={styles.identityAvatar} aria-hidden="true">
                {user.initials}
              </span>
              <div className={styles.identityText}>
                <p className={styles.identityName}>{user.name}</p>
                <p className={styles.identityHeadline}>
                  {profile.identity.headline || user.email}
                </p>
                {profile.identity.tags.length > 0 && (
                  <div className={styles.identityTags}>
                    {profile.identity.tags.map((tag, index) => (
                      <span
                        key={tag}
                        className={`${styles.identityTag} ${
                          index === 0 ? styles.identityTagAccent : ""
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.completionCard}>
              <svg viewBox="0 0 64 64" className={styles.completionRing}>
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  className={styles.completionRingTrack}
                />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  className={styles.completionRingProgress}
                  strokeDasharray={COMPLETION_RING_CIRCUMFERENCE}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <div className={styles.completionText}>
                <p className={styles.completionValue}>
                  {roundedCompletion}% complete
                </p>
                <p className={styles.completionNote}>{profile.gapNote}</p>
                <a href="#experience" className={styles.completionLink}>
                  Fix the gaps →
                </a>
              </div>
            </div>
          </div>

          <div id="experience" className={styles.experienceGrid}>
            <section className={styles.experience}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Experience</h2>
                <span className={styles.sectionHint}>
                  click a role to see its evidence
                </span>
              </div>

              {profile.roles.length === 0 ? (
                <p className={styles.sideNote}>
                  No experience yet — upload a CV and we&apos;ll pull your
                  roles and bullets in here.
                </p>
              ) : (
                <div>
                  {profile.roles.map((role, index) => {
                    const isOpen = openRoleIndex === index;
                    return (
                      <div
                        key={role.title + role.company}
                        className={styles.roleRow}
                      >
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          className={styles.roleToggle}
                          onClick={() => toggleRole(index)}
                        >
                          <span className={styles.roleText}>
                            <span className={styles.roleTitle}>
                              {role.title}
                            </span>
                            <span className={styles.roleMeta}>
                              {role.company} · {role.dates}
                            </span>
                          </span>
                          <span
                            className={`${styles.roleFlag} ${
                              role.flag === "complete"
                                ? styles.roleFlagComplete
                                : ""
                            }`}
                          >
                            {role.flag === "complete"
                              ? "Complete"
                              : "Needs numbers"}
                          </span>
                        </button>

                        {isOpen && (
                          <div className={styles.bulletList}>
                            {role.bullets.map((bullet, bulletIndex) => (
                              <div
                                key={bulletIndex}
                                className={styles.bulletRow}
                              >
                                <span
                                  className={styles.bulletRail}
                                  aria-hidden="true"
                                />
                                <span className={styles.bulletText}>
                                  {bullet.text}
                                </span>
                                <span className={styles.bulletUsed}>
                                  {bullet.source}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className={styles.sideStack}>
              <div className={styles.sideCard}>
                <p className={styles.sideLabel}>Skills with evidence</p>
                {profile.skills.length === 0 ? (
                  <p className={styles.sideNote}>
                    No skills detected yet — they&apos;ll show up here once
                    you upload a CV.
                  </p>
                ) : (
                  <>
                    <div className={styles.skillChips}>
                      {profile.skills.map((skill) => (
                        <span key={skill.label} className={styles.skillChip}>
                          {skill.label}{" "}
                          <span className={styles.skillCount}>
                            {skill.evidenceCount}
                          </span>
                        </span>
                      ))}
                    </div>
                    <p className={styles.sideNote}>
                      Numbers show how many bullets back each skill. Skills
                      with no evidence are never written into a CV.
                    </p>
                  </>
                )}
              </div>

              <div className={styles.sideCard}>
                <p className={styles.sideLabel}>Writing voice</p>
                <div className={styles.toneRow}>
                  {TONES.map((tone, index) => (
                    <button
                      key={tone.label}
                      type="button"
                      aria-current={toneIndex === index ? true : undefined}
                      className={`${styles.toneButton} ${
                        toneIndex === index ? styles.toneButtonActive : ""
                      }`}
                      onClick={() => setToneIndex(index)}
                    >
                      {tone.label}
                    </button>
                  ))}
                </div>
                <p className={styles.sideNote}>{TONES[toneIndex].note}</p>
              </div>

              <div className={styles.sideCard}>
                <div className={styles.docHeader}>
                  <p className={styles.sideLabel}>
                    Documents
                    {documents.length > 0 ? ` (${documents.length})` : ""}
                  </p>
                  {documents.length > 0 && (
                    <button
                      type="button"
                      className={styles.docSelectAll}
                      onClick={toggleSelectAllDocuments}
                    >
                      {selectedIds.size === documents.length
                        ? "Clear"
                        : "Select all"}
                    </button>
                  )}
                </div>
                {documents.length > 0 && (
                  <div className={styles.docList}>
                    {documents.map((doc) => (
                      <div key={doc.id} className={styles.docRow}>
                        <label className={styles.docRowLabel}>
                          <input
                            type="checkbox"
                            className={styles.docCheckbox}
                            checked={selectedIds.has(doc.id)}
                            onChange={() => toggleDocumentSelected(doc.id)}
                          />
                          <span className={styles.docText}>
                            {doc.fileName}
                          </span>
                        </label>
                        <button
                          type="button"
                          className={styles.docRemove}
                          aria-label={`Remove ${doc.fileName}`}
                          disabled={deleteState.status === "deleting"}
                          onClick={() =>
                            confirmAndDelete([doc.id], doc.fileName)
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={deleteState.status === "deleting"}
                    onClick={() =>
                      confirmAndDelete(
                        [...selectedIds],
                        `${selectedIds.size} document${
                          selectedIds.size === 1 ? "" : "s"
                        }`
                      )
                    }
                  >
                    {deleteState.status === "deleting"
                      ? "Deleting…"
                      : `Delete selected (${selectedIds.size})`}
                  </button>
                )}
                {deleteState.status === "error" && (
                  <p className={`${styles.uploadStatus} ${styles.uploadStatusError}`}>
                    {deleteState.message}
                  </p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  aria-label="Upload a CV document"
                  onChange={handleDocumentUpload}
                  className={styles.docUploadInput}
                  disabled={uploadState.status === "uploading"}
                />
                <button
                  type="button"
                  className={styles.addBulletButton}
                  disabled={uploadState.status === "uploading"}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadState.status === "uploading"
                    ? "Uploading…"
                    : "Upload a document"}
                </button>
                {uploadState.message && (
                  <p
                    className={`${styles.uploadStatus} ${
                      uploadState.status === "error"
                        ? styles.uploadStatusError
                        : ""
                    }`}
                  >
                    {uploadState.message}
                  </p>
                )}
              </div>

              <div className={styles.sideCard}>
                <p className={styles.sideLabel}>Privacy</p>
                <p className={styles.privacyText}>
                  Your record is encrypted and scoped to this account. It is
                  never used to train models.
                </p>
                <button
                  type="button"
                  className={styles.deleteButton}
                  disabled={documents.length === 0 || deleteState.status === "deleting"}
                  onClick={() =>
                    confirmAndDelete(
                      documents.map((doc) => doc.id),
                      "everything — this clears your entire profile"
                    )
                  }
                >
                  {deleteState.status === "deleting" ? "Deleting…" : "Delete everything"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
