export const getToken = () => localStorage.getItem("access_token");
export const setSession = (token: string) => localStorage.setItem("access_token", token);
export const clearSession = () => localStorage.removeItem("access_token");

export const logout = async () => {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (error) {
    // Ignore logout errors, we'll clear local session anyway
    console.warn("Logout API call failed:", error);
  } finally {
    clearSession();
  }
};