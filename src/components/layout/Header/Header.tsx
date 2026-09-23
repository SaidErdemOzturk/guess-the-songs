import React from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import styles from './Header.module.css';

interface HeaderProps {
  onTitleClick?: () => void;
  onLoginClick?: () => void;
  onCreateRoomClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onTitleClick,
  onLoginClick,
  onCreateRoomClick,
}) => {
  const { user, isAuthenticated, isGuest, logout } = useAuth();

  return (
    <header className={styles.headerWrapper}>
      <div className={styles.topBar}>
        <div className={styles.authControls}>
          {isAuthenticated && user ? (
            <>
              <button
                type="button"
                className={styles.createRoomBtn}
                onClick={onCreateRoomClick}
              >
                <span>➕</span>
                <span>Oda Kur</span>
              </button>
              <div className={styles.userInfo} title={user.email}>
                <div className={styles.userAvatar}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className={styles.userName}>{user.name}</span>
              </div>
              <button
                type="button"
                className={styles.logoutBtn}
                onClick={logout}
                title="Çıkış Yap"
              >
                Çıkış
              </button>
            </>
          ) : (
            <>
              {isGuest && (
                <div className={styles.guestBadge}>
                  <span>👤</span>
                  <span>Misafir Modu</span>
                </div>
              )}
              {onLoginClick && (
                <button
                  type="button"
                  className={styles.loginBtn}
                  onClick={onLoginClick}
                >
                  Giriş Yap
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className={styles.titleSection}>
        <h1
          onClick={onTitleClick}
          className={styles.mainTitle}
          style={{ cursor: onTitleClick ? 'pointer' : 'default' }}
        >
          <span className={styles.titleWhite}>şarkıyı</span>
          <span className={styles.titleGradient}>tahmin et</span>
        </h1>
        <p className={styles.subtitle}>
          bir saniyesinden parçayı tanı
        </p>
      </div>
    </header>
  );
};
