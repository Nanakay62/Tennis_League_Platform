import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../api/client";

const ACCESS_TOKEN_KEY = "tennis_access_token";
const REFRESH_TOKEN_KEY = "tennis_refresh_token";

export interface UserSession {
  id: string;
  email: string;
  role: string;
  displayName: string;
  rating: string;
  homeArea: string;
  isDaytime: boolean;
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
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {}
  } else {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}

export async function fetchCurrentUser(): Promise<UserSession | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        await clearTokens();
      }
      return null;
    }

    const data = await res.json();
    return {
      id: data.id,
      email: data.email,
      role: data.role,
      displayName: data.profile?.display_name || "Player",
      rating: data.profile?.rating || "3.5",
      homeArea: data.profile?.home_area || "Frankfurt",
      isDaytime: data.profile?.is_daytime || false,
    };
  } catch (err) {
    return null;
  }
}
