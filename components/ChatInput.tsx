import styles from "./ChatInput.module.scss";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function ChatInput({ value, onChange }: ChatInputProps) {
  return (
    <form
      className={styles.bar}
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <label className="visually-hidden" htmlFor="job-url">
        Job description URL
      </label>
      <div className={styles.row}>
        <input
          id="job-url"
          className={styles.input}
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="paste th job description url you are applying for"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="submit" className={styles.submit}>
          Tailor a CV
        </button>
      </div>
    </form>
  );
}
