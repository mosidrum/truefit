import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userCvs, userLoggedIn } from "@/lib/session";
import styles from "./profile.module.scss";

export default function ProfilePage() {
  if (!userLoggedIn) {
    redirect("/");
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          TrueFit
        </Link>
        <Link href="/" className={styles.back}>
          Workspace
        </Link>
        <span className={styles.avatar} aria-hidden="true">
          {currentUser.initials}
        </span>
      </header>

      <main className={styles.main}>
        <section className={styles.identity} aria-labelledby="profile-name">
          <span className={styles.avatarLarge}>{currentUser.initials}</span>
          <div>
            <h1 id="profile-name">{currentUser.name}</h1>
            <p className={styles.email}>{currentUser.email}</p>
          </div>
        </section>

        <section className={styles.cvs} aria-labelledby="cv-heading">
          <div className={styles.cvHead}>
            <h2 id="cv-heading">Your CVs</h2>
            <label className={styles.upload}>
              Upload CV
              <input
                className="visually-hidden"
                type="file"
                accept=".pdf,.doc,.docx"
                tabIndex={0}
              />
            </label>
          </div>

          {userCvs.length > 0 ? (
            <ul className={styles.list}>
              {userCvs.map((cv) => (
                <li key={cv.id} className={styles.card}>
                  <p className={styles.cvName}>{cv.name}</p>
                  <p className={styles.cvMeta}>Updated {cv.updated}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No CVs yet</p>
              <p className={styles.emptyCopy}>
                Upload a CV to start tailoring it for the roles you want.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
