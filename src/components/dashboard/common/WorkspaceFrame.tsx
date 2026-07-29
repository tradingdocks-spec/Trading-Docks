import type { ReactNode } from "react";

import styles from "../styles.module.css";

export function WorkspaceFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.appBackground}>
      <div className="relative mx-auto w-full max-w-[1700px] px-3 py-3 sm:px-6 sm:py-5 lg:px-8 lg:py-7">
        {children}
      </div>
    </div>
  );
}
