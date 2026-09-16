import styles from "./Sidebar.module.scss";

type Chat = {
  id: string;
  title: string;
};

type SidebarProps = {
  chats: Chat[];
  activeChatId: string;
  isOpen: boolean;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onClose: () => void;
};

export default function Sidebar({
  chats,
  activeChatId,
  isOpen,
  onSelectChat,
  onNewChat,
  onClose,
}: SidebarProps) {
  return (
    <aside
      id="conversation-sidebar"
      className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}
    >
      <div className={styles.top}>
        <p className={styles.brand}>TrueFit</p>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <button type="button" className={styles.newChat} onClick={onNewChat}>
        + New chat
      </button>

      <nav aria-label="Conversations" className={styles.nav}>
        <ul className={styles.list}>
          {chats.map((chat) => {
            const isActive = chat.id === activeChatId;

            return (
              <li key={chat.id}>
                <button
                  type="button"
                  className={styles.chat}
                  aria-current={isActive ? true : undefined}
                  onClick={() => onSelectChat(chat.id)}
                >
                  {chat.title}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
