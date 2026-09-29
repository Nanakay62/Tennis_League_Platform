import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "../api/client";

const ACCESS_TOKEN_KEY = "tennis_access_token";
const REFRESH_TOKEN_KEY = "tennis_refresh_token";
const CACHED_USER_KEY = "tennis_cached_user";

export interface UserSession {
  id: string;
  email: string;
  role: string;
  displayName: string;
  rating: string;
  homeArea: string;
  isDaytime: boolean;
  avatarUrl?: string | null;
}

export function getCachedUserSession(): UserSession | null {
  if (Platform.OS === "web") {
    try {
      const raw = localStorage.getItem(CACHED_USER_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

export function saveCachedUserSession(user: UserSession | null): void {
  if (Platform.OS === "web") {
    try {
      if (user) {
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(CACHED_USER_KEY);
      }
    } catch (e) {
      console.warn("Could not save cached user to localStorage:", e);
    }
  }
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch (e) {
      console.warn("Could not save tokens to localStorage:", e);
    }
  } else {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  }
  return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }
  return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  saveCachedUserSession(null);
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(CACHED_USER_KEY);
    } catch {}
  } else {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}

export async function fetchCurrentUser(): Promise<UserSession | null> {
  let token = await getAccessToken();
  if (!token) {
    saveCachedUserSession(null);
    return null;
  }

  try {
    let res = await fetch(`${API_BASE_URL}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // If 401 Unauthorized, attempt silent token refresh before clearing tokens
    if (res.status === 401) {
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (refreshRes.ok) {
            const tokenData = await refreshRes.json();
            await saveTokens(tokenData.access_token, tokenData.refresh_token);
            token = tokenData.access_token;
            // Retry /me with refreshed access token
            res = await fetch(`${API_BASE_URL}/me`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
          }
        } catch {
          // Token refresh network failure
        }
      }
    }

    if (!res.ok) {
      if (res.status === 401) {
        await clearTokens();
      }
      return null;
    }

    const data = await res.json();
    const session: UserSession = {
      id: data.id,
      email: data.email,
      role: data.role,
      displayName: data.profile?.display_name || "Player",
      rating: data.profile?.rating || "3.5",
      homeArea: data.profile?.home_area || "Frankfurt",
      isDaytime: data.profile?.is_daytime || false,
      avatarUrl: data.profile?.avatar_url || null,
    };

    saveCachedUserSession(session);
    return session;
  } catch (err) {
    // Return cached session on network errors to maintain user state
    return getCachedUserSession();
  }
}

export function useCurrentUser() {
  return useQuery<UserSession | null>({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
    initialData: getCachedUserSession,
    staleTime: 1000 * 60,
  });
}
