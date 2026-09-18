import styles from "./Skeleton.module.scss";

/** A single shimmering placeholder block. Sizes are plain CSS values (e.g. "60%", "14px"). */
export function Skeleton({
  width = "100%",
  height = "12px",
  radius,
  className = "",
}: {
  width?: string;
  height?: string;
  radius?: string;
  className?: string;
}) {
  return (
    <span
      className={`${styles.skeleton} ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

/** A stack of skeleton text lines, with the last line narrower to read as a paragraph end. */
export function SkeletonLines({
  count = 3,
  lastLineWidth = "70%",
}: {
  count?: number;
  lastLineWidth?: string;
}) {
  return (
    <div className={styles.lines} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === count - 1 ? lastLineWidth : "100%"}
        />
      ))}
    </div>
  );
}
