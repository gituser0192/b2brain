"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest } from "@/services/api-client";
import type { AuthResponse, AuthSession, MeResponse, RefreshResponse, RegistrationResponse } from "./auth.types";
import type { AuthOrganization } from "./auth.types";

interface RegisterInput { invitationToken: string; firstName: string; lastName?: string; password: string; }
interface LoginInput { email: string; password: string; }
interface AuthContextValue {
  session: AuthSession | null;
  accessToken: string | null;
  isLoading: boolean;
  login(input: LoginInput): Promise<AuthSession>;
  register(input: RegisterInput): Promise<RegistrationResponse>;
  logout(): Promise<void>;
  updateOrganization(organization: AuthOrganization): void;
  reloadSession(): Promise<AuthSession>;
  authorizedRequest<T>(path: string, init?: RequestInit): Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const establish = useCallback((response: AuthResponse) => {
    const { accessToken: token, ...account } = response.data;
    setAccessToken(token);
    setSession(account);
    return account;
  }, []);
  const login = useCallback(async (input: LoginInput) => establish(await apiRequest<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(input) })), [establish]);
  const register = useCallback((input: RegisterInput) => apiRequest<RegistrationResponse>("/auth/register", { method: "POST", body: JSON.stringify(input) }), []);
  const logout = useCallback(async () => {
    try { await apiRequest("/auth/logout", { method: "POST" }); }
    finally { setAccessToken(null); setSession(null); }
  }, []);
  const updateOrganization = useCallback((organization: AuthOrganization) => {
    setSession((current) => current ? { ...current, organization } : current);
  }, []);
  const reloadSession = useCallback(async () => {
    if (!accessToken) throw new Error("Authentication is required.");
    const response = await apiRequest<MeResponse>("/auth/me", { headers: { Authorization: `Bearer ${accessToken}` } });
    setSession(response.data);
    return response.data;
  }, [accessToken]);
  const authorizedRequest = useCallback(async <T,>(path: string, init?: RequestInit) => {
    if (!accessToken) throw new Error("Authentication is required.");
    return apiRequest<T>(path, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` } });
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const refreshed = await apiRequest<RefreshResponse>("/auth/refresh", { method: "POST" });
        const account = await apiRequest<MeResponse>("/auth/me", { headers: { Authorization: `Bearer ${refreshed.data.accessToken}` } });
        if (active) { setAccessToken(refreshed.data.accessToken); setSession(account.data); }
      } catch {
        if (active) { setAccessToken(null); setSession(null); }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void restore();
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({ session, accessToken, isLoading, login, register, logout, updateOrganization, reloadSession, authorizedRequest }), [session, accessToken, isLoading, login, register, logout, updateOrganization, reloadSession, authorizedRequest]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
