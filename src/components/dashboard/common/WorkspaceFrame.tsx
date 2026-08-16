import type { ReactNode } from "react";

import styles from "../styles.module.css";

export function WorkspaceFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.appBackground}>
      <div className="td-workspace">
        {children}
      </div>
    </div>
  );
}
