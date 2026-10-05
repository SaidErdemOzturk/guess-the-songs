import React, { useState } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Button, Card, Input } from "@/components/ui";

interface LoginPageProps {
  pendingInviteRoomCode?: string | null;
  onSuccessLogin: () => void;
  onContinueAsGuest: () => void;
}

type AuthMode = "login" | "register" | "forgot-password";

export const LoginPage: React.FC<LoginPageProps> = ({
  pendingInviteRoomCode,
  onSuccessLogin,
  onContinueAsGuest,
}) => {
  const { login, register, resetPassword, continueAsGuest, isLoading } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Lütfen e-posta adresinizi girin.");
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);
      await login({ email: email.trim(), password });
      onSuccessLogin();
    } catch (err: any) {
      setError(err?.message || "Giriş yapılırken bir hata oluştu.");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim()) {
      setError("Lütfen adınızı girin.");
      return;
    }

    if (!lastName.trim()) {
      setError("Lütfen soyadınızı girin.");
      return;
    }

    if (!email.trim()) {
      setError("Lütfen e-posta adresinizi girin.");
      return;
    }

    if (!password || password.length < 4) {
      setError("Şifreniz en az 4 karakterden oluşmalıdır.");
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);
      await register({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      onSuccessLogin();
    } catch (err: any) {
      setError(err?.message || "Kayıt işlemi sırasında bir hata oluştu.");
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Lütfen e-posta adresinizi girin.");
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setError("Yeni şifreniz en az 4 karakterden oluşmalıdır.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Girdiğiniz yeni şifreler birbiriyle eşleşmiyor.");
      return;
    }

    try {
      setError(null);
      const msg = await resetPassword({
        email: email.trim(),
        newPassword,
      });
      setSuccessMessage(msg || "Şifreniz başarıyla güncellendi. Giriş yapabilirsiniz.");
      setPassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setAuthMode("login");
    } catch (err: any) {
      setError(err?.message || "Şifre sıfırlama sırasında bir hata oluştu.");
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    try {
      setError(null);
      setSuccessMessage(null);
      await login({ email: demoEmail });
      onSuccessLogin();
    } catch (err: any) {
      setError(err?.message || "Giriş yapılırken bir hata oluştu.");
    }
  };

  const handleGuest = () => {
    continueAsGuest();
    onContinueAsGuest();
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "28rem",
        margin: "1.5rem auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 10,
      }}
    >
      <Card style={{ width: "100%", padding: "2rem" }}>
        {/* Giriş / Kayıt Sekme Seçici */}
        <div
          style={{
            display: "flex",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            padding: "0.25rem",
            borderRadius: "var(--radius-md)",
            marginBottom: "1.5rem",
            gap: "0.25rem",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setAuthMode("login");
              setError(null);
              setSuccessMessage(null);
            }}
            style={{
              flex: 1,
              padding: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: authMode === "login" ? 700 : 500,
              color: authMode === "login" ? "#ffffff" : "#9ca3af",
              backgroundColor: authMode === "login"
                ? "rgba(99, 102, 241, 0.4)"
                : "transparent",
              border: authMode === "login"
                ? "1px solid rgba(129, 140, 248, 0.4)"
                : "1px solid transparent",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Giriş Yap
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode("register");
              setError(null);
              setSuccessMessage(null);
            }}
            style={{
              flex: 1,
              padding: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: authMode === "register" ? 700 : 500,
              color: authMode === "register" ? "#ffffff" : "#9ca3af",
              backgroundColor: authMode === "register"
                ? "rgba(99, 102, 241, 0.4)"
                : "transparent",
              border: authMode === "register"
                ? "1px solid rgba(129, 140, 248, 0.4)"
                : "1px solid transparent",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Üye Ol
          </button>
        </div>

        {/* Başlık */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
            {authMode === "forgot-password" ? "🔑" : "🎧"}
          </div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f9fafb" }}>
            {authMode === "forgot-password"
              ? "Şifremi Unuttum"
              : authMode === "register"
              ? "Yeni Hesap Oluştur"
              : pendingInviteRoomCode
              ? "Odaya Katılmak İçin Giriş Yap"
              : "Giriş Yap"}
          </h2>
          <p
            style={{
              color: "#9ca3af",
              fontSize: "0.8125rem",
              marginTop: "0.25rem",
            }}
          >
            {authMode === "forgot-password" ? (
              "Hesabınıza ait e-posta adresinizi ve yeni şifrenizi girerek güncelleyin."
            ) : authMode === "register" ? (
              "Şarkı tahmin yarışmasına katılmak ve odalar kurmak için kaydolun."
            ) : pendingInviteRoomCode ? (
              <span style={{ color: "#818cf8", fontWeight: 600 }}>
                {pendingInviteRoomCode} kodlu odaya davet edildiniz.
              </span>
            ) : (
              "Oda kurmak ve arkadaşlarınızla yarışmak için hesabınıza giriş yapın."
            )}
          </p>
        </div>

        {/* Başarı Mesajı */}
        {successMessage && (
          <div
            style={{
              padding: "0.6rem 0.85rem",
              backgroundColor: "rgba(16, 185, 129, 0.2)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              borderRadius: "var(--radius-sm)",
              color: "#34d399",
              fontSize: "0.8125rem",
              marginBottom: "1rem",
              lineHeight: 1.4,
            }}
          >
            ✅ {successMessage}
          </div>
        )}

        {/* Hata Mesajı */}
        {error && (
          <div
            style={{
              padding: "0.6rem 0.85rem",
              backgroundColor: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "var(--radius-sm)",
              color: "#f87171",
              fontSize: "0.8125rem",
              marginBottom: "1rem",
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        )}

        {/* GİRİŞ MODU */}
        {authMode === "login" && (
          <form
            onSubmit={handleLoginSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <Input
              label="E-posta Adresi"
              type="email"
              placeholder="ornek@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />

            <div>
              <Input
                label="Şifre"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "0.35rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("forgot-password");
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#818cf8",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                  }}
                >
                  Şifremi unuttum?
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              style={{ width: "100%", marginTop: "0.5rem" }}
            >
              Giriş Yap & Devam Et
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              isLoading={isLoading}
              style={{ width: "100%", marginTop: "0.25rem" }}
              onClick={() => {
                setAuthMode("register");
                setError(null);
                setSuccessMessage(null);
              }}
            >
              Üye ol
            </Button>
          </form>
        )}

        {/* KAYIT MODU */}
        {authMode === "register" && (
          <form
            onSubmit={handleRegisterSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
              }}
            >
              <Input
                label="Ad"
                type="text"
                placeholder="Ahmet"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isLoading}
                required
              />
              <Input
                label="Soyad"
                type="text"
                placeholder="Yılmaz"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <Input
              label="E-posta Adresi"
              type="email"
              placeholder="ornek@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />

            <Input
              label="Şifre"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              style={{ width: "100%", marginTop: "0.5rem" }}
            >
              Üye Ol & Devam Et
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              isLoading={isLoading}
              style={{ width: "100%", marginTop: "0.25rem" }}
              onClick={() => {
                setAuthMode("login");
                setError(null);
                setSuccessMessage(null);
              }}
            >
              Zaten hesabın var mı? Giriş Yap
            </Button>
          </form>
        )}

        {/* ŞİFREMİ UNUTTUM MODU */}
        {authMode === "forgot-password" && (
          <form
            onSubmit={handleResetPasswordSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <Input
              label="E-posta Adresi"
              type="email"
              placeholder="kayitli@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />

            <Input
              label="Yeni Şifre"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              required
            />

            <Input
              label="Yeni Şifre (Tekrar)"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              style={{ width: "100%", marginTop: "0.5rem" }}
            >
              Şifremi Sıfırla & Güncelle
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              isLoading={isLoading}
              style={{ width: "100%", marginTop: "0.25rem" }}
              onClick={() => {
                setAuthMode("login");
                setError(null);
                setSuccessMessage(null);
              }}
            >
              ← Giriş Ekranına Dön
            </Button>
          </form>
        )}

        {/* Hızlı Demo Hesaplar */}
        {authMode === "login" && (
          <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
              Hızlı Demo Giriş:
            </span>
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                justifyContent: "center",
                marginTop: "0.5rem",
              }}
            >
              <button
                type="button"
                onClick={() => handleQuickDemoLogin("ahmet@muzik.com")}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.6rem",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(99, 102, 241, 0.15)",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  color: "#a5b4fc",
                  cursor: "pointer",
                }}
              >
                Ahmet
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin("zeynep@muzik.com")}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.6rem",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(236, 72, 153, 0.15)",
                  border: "1px solid rgba(236, 72, 153, 0.3)",
                  color: "#f472b6",
                  cursor: "pointer",
                }}
              >
                Zeynep
              </button>
            </div>
          </div>
        )}

        {/* Ayırıcı */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            margin: "1.5rem 0",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              flex: 1,
              height: "1px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
            }}
          />
          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>veya</span>
          <div
            style={{
              flex: 1,
              height: "1px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
            }}
          />
        </div>

        {/* Misafir Olarak Devam Et Butonu */}
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={handleGuest}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          <span>👤</span>
          <span>Misafir Olarak Devam Et (Tek Başına Oyna)</span>
        </Button>
      </Card>
    </div>
  );
};
