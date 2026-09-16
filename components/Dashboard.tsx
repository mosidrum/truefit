"use client";

import { useEffect, useState } from "react";
import ChatArea from "@/components/ChatArea";
import Sidebar from "@/components/Sidebar";
import styles from "./Dashboard.module.scss";

const MOCK_CHATS = [
  { id: "1", title: "Senior Frontend Engineer" },
  { id: "2", title: "Product Designer — Remote" },
  { id: "3", title: "Backend Engineer" },
  { id: "4", title: "React Developer" },
];

const NEW_CHAT_ID = "new";

export default function Dashboard() {
  const [activeChatId, setActiveChatId] = useState(MOCK_CHATS[0].id);
  const [inputValue, setInputValue] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  const activeTitle =
    activeChatId === NEW_CHAT_ID
      ? "New chat"
      : (MOCK_CHATS.find((chat) => chat.id === activeChatId)?.title ??
        "New chat");

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className={styles.app}>
      {sidebarOpen ? (
        <button
          type="button"
          className={styles.overlay}
          aria-label="Close sidebar"
          onClick={closeSidebar}
        />
      ) : null}

      <Sidebar
        chats={MOCK_CHATS}
        activeChatId={activeChatId}
        isOpen={sidebarOpen}
        onSelectChat={(id) => {
          setActiveChatId(id);
          closeSidebar();
        }}
        onNewChat={() => {
          setActiveChatId(NEW_CHAT_ID);
          closeSidebar();
        }}
        onClose={closeSidebar}
      />

      <ChatArea
        title={activeTitle}
        sidebarOpen={sidebarOpen}
        inputValue={inputValue}
        onOpenSidebar={() => setSidebarOpen((open) => !open)}
        onInputChange={setInputValue}
      />
    </div>
  );
}
