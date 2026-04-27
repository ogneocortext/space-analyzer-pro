import React from "react";
import styles from "../../styles/components/PageContainer.module.css";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

const PageContainer: React.FC<PageContainerProps> = ({ children, className = "" }) => {
  return (
    <div className={`${styles.pageContainer} ${className}`}>
      <div className={styles.pageContent}>{children}</div>
    </div>
  );
};

export default PageContainer;
