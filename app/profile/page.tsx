"use client";

import Link from "next/link";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import {
  COMPLETION_RING_CIRCUMFERENCE,
  DEFAULT_TONE_INDEX,
  DOCUMENTS,
  PROFILE_COMPLETION,
  PROFILE_GAP_NOTE,
  PROFILE_IDENTITY,
  ROLES,
  SKILLS,
  TONES,
} from "@/lib/profileData";
import { currentUser, userLoggedIn } from "@/lib/session";
import styles from "./profile.module.scss";

const NAV_ITEMS = [
  { label: "Tailors", href: "/", current: false },
  { label: "Career record", href: "/profile", current: true },
  { label: "Documents", href: "/", current: false },
  { label: "Settings", href: "/", current: false },
];

export default function ProfilePage() {
  // Hooks run unconditionally on every render; the login guard below only
  // decides whether this render's output is ever committed.
  const [openRoleIndex, setOpenRoleIndex] = useState(0);
  const [toneIndex, setToneIndex] = useState(DEFAULT_TONE_INDEX);
  const [completion, setCompletion] = useState(0);

  // Tweens the completeness ring up to its target once on mount, mirroring
  // the source design's load-in animation.
  useEffect(() => {
    const tween = window.setInterval(() => {
      setCompletion((current) => {
        if (current >= PROFILE_COMPLETION - 0.4) return PROFILE_COMPLETION;
        return current + (PROFILE_COMPLETION - current) * 0.12;
      });
    }, 30);
    return () => window.clearInterval(tween);
  }, []);

  if (!userLoggedIn) {
    redirect("/");
  }

  const roundedCompletion = Math.round(completion);
  const ringOffset =
    COMPLETION_RING_CIRCUMFERENCE -
    (COMPLETION_RING_CIRCUMFERENCE * completion) / 100;

  function toggleRole(index: number) {
    setOpenRoleIndex((current) => (current === index ? -1 : index));
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>T</span>
          <span className={styles.brandName}>truefit</span>
        </Link>

        <nav className={styles.nav} aria-label="Sections">
          {NAV_ITEMS.map((item) =>
            item.current ? (
              <span
                key={item.label}
                className={`${styles.navItem} ${styles.navItemCurrent}`}
              >
                <span className={styles.navRail} aria-hidden="true" />
                {item.label}
              </span>
            ) : (
              <Link key={item.label} href={item.href} className={styles.navItem}>
                {item.label}
              </Link>
            )
          )}
        </nav>

        <p className={styles.sidebarFooter}>
          Your record is the only thing TrueFit writes from. Nothing outside
          it reaches a CV.
        </p>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.kicker}>Career record</p>
            <h1 className={styles.title}>{currentUser.name}</h1>
          </div>
          <button type="button" className={styles.importButton}>
            Import from LinkedIn
          </button>
          <button type="button" className={styles.saveButton}>
            Save record
          </button>
        </header>

        <div className={styles.content}>
          <div className={styles.topGrid}>
            <div className={styles.identityCard}>
              <span className={styles.identityAvatar} aria-hidden="true">
                {currentUser.initials}
              </span>
              <div className={styles.identityText}>
                <p className={styles.identityName}>{PROFILE_IDENTITY.name}</p>
                <p className={styles.identityHeadline}>
                  {PROFILE_IDENTITY.headline}
                </p>
                <div className={styles.identityTags}>
                  {PROFILE_IDENTITY.tags.map((tag, index) => (
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
                <p className={styles.completionNote}>{PROFILE_GAP_NOTE}</p>
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

              <div>
                {ROLES.map((role, index) => {
                  const isOpen = openRoleIndex === index;
                  return (
                    <div key={role.title + role.company} className={styles.roleRow}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        className={styles.roleToggle}
                        onClick={() => toggleRole(index)}
                      >
                        <span className={styles.roleText}>
                          <span className={styles.roleTitle}>{role.title}</span>
                          <span className={styles.roleMeta}>
                            {role.company} · {role.dates}
                          </span>
                        </span>
                        <span
                          className={`${styles.roleFlag} ${
                            role.flag === "complete" ? styles.roleFlagComplete : ""
                          }`}
                        >
                          {role.flag === "complete" ? "Complete" : "Needs numbers"}
                        </span>
                      </button>

                      {isOpen && (
                        <div className={styles.bulletList}>
                          {role.bullets.map((bullet) => (
                            <div key={bullet.text} className={styles.bulletRow}>
                              <span
                                className={styles.bulletRail}
                                aria-hidden="true"
                              />
                              <span className={styles.bulletText}>
                                {bullet.text}
                              </span>
                              <span className={styles.bulletUsed}>
                                {bullet.usedIn}
                              </span>
                            </div>
                          ))}
                          <button type="button" className={styles.addBulletButton}>
                            Add a bullet
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <div className={styles.sideStack}>
              <div className={styles.sideCard}>
                <p className={styles.sideLabel}>Skills with evidence</p>
                <div className={styles.skillChips}>
                  {SKILLS.map((skill) => (
                    <span key={skill.label} className={styles.skillChip}>
                      {skill.label}{" "}
                      <span className={styles.skillCount}>
                        {skill.evidenceCount}
                      </span>
                    </span>
                  ))}
                </div>
                <p className={styles.sideNote}>
                  Numbers show how many bullets back each skill. Skills with
                  no evidence are never written into a CV.
                </p>
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
                <p className={styles.sideLabel}>Documents</p>
                <div className={styles.docList}>
                  {DOCUMENTS.map((doc) => (
                    <div key={doc.name} className={styles.docRow}>
                      <span className={styles.docText}>
                        {doc.name}
                        <span className={styles.docMeta}>{doc.meta}</span>
                      </span>
                      <a href="#experience" className={styles.docOpen}>
                        Open
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.sideCard}>
                <p className={styles.sideLabel}>Privacy</p>
                <p className={styles.privacyText}>
                  Your record is encrypted and scoped to this account. It is
                  never used to train models.
                </p>
                <button type="button" className={styles.deleteButton}>
                  Delete everything
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
