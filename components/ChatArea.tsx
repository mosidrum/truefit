import Link from "next/link";
import ChatInput from "./ChatInput";
import { currentUser } from "@/lib/session";
import styles from "./ChatArea.module.scss";

type ChatAreaProps = {
  title: string;
  sidebarOpen: boolean;
  inputValue: string;
  onOpenSidebar: () => void;
  onInputChange: (value: string) => void;
};

export default function ChatArea({
  title,
  sidebarOpen,
  inputValue,
  onOpenSidebar,
  onInputChange,
}: ChatAreaProps) {
  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.menu}
          aria-expanded={sidebarOpen}
          aria-controls="conversation-sidebar"
          onClick={onOpenSidebar}
        >
          Chats
        </button>
        <h1 className={styles.title}>{title}</h1>
        <Link
          href="/profile"
          className={styles.avatar}
          aria-label="Open profile"
        >
          {currentUser.initials}
        </Link>
      </header>

      <main className={styles.main}>
        <div className={styles.empty}>
          <h2 className={styles.heading}>
            Tailor your CV for the role you want.
          </h2>
          <p className={styles.copy}>
            Paste the job description URL below and TrueFit will prepare your CV
            around it.
          </p>
        </div>
      </main>

      <ChatInput value={inputValue} onChange={onInputChange} />
    </div>
  );
}
