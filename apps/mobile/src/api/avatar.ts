import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { API_BASE_URL } from "./client";
import { getAccessToken } from "../lib/auth";

export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface AvatarUploadResult {
  avatarUrl: string;
}

/**
 * Prompt user to select/take a photo, crops it 1:1, compresses it,
 * requests a presigned Cloudflare R2 upload URL, uploads the bytes directly,
 * and saves the new avatar URL to the user profile.
 */
export async function pickAndUploadAvatar(): Promise<AvatarUploadResult | null> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("You must be logged in to update your profile photo.");
  }

  // Request permissions
  if (Platform.OS !== "web") {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Permission to access photos was denied. Please allow access in your settings.");
    }
  }

  // Launch image picker with 1:1 square crop and 0.8 compression
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];

  // Client-side file size validation if available
  if (asset.fileSize && asset.fileSize > MAX_AVATAR_SIZE_BYTES) {
    throw new Error("Photo is too large (maximum 2 MB). Please select a smaller photo.");
  }

  const mimeType = asset.mimeType || "image/jpeg";
  if (!ALLOWED_AVATAR_TYPES.includes(mimeType)) {
    throw new Error("Unsupported image format. Please select a JPG, PNG, or WebP photo.");
  }

  // 1. Get presigned upload URL from backend
  const uploadUrlRes = await fetch(`${API_BASE_URL}/identity/avatar/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      content_type: mimeType,
      file_size_bytes: asset.fileSize || 200000,
    }),
  });

  if (!uploadUrlRes.ok) {
    const errData = await uploadUrlRes.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to initialize image upload. Please try again.");
  }

  const { upload_url, public_url, fields } = await uploadUrlRes.json();

  // 2. Upload file directly to R2 (or sandbox)
  const formData = new FormData();
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value as string);
    }
  }

  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    if (blob.size > MAX_AVATAR_SIZE_BYTES) {
      throw new Error("Photo is too large (maximum 2 MB). Please select a smaller photo.");
    }
    formData.append("file", blob, "avatar.jpg");
  } else {
    // Native FormData file representation
    formData.append("file", {
      uri: asset.uri,
      name: "avatar.jpg",
      type: mimeType,
    } as any);
  }

  const targetUploadUrl = upload_url.startsWith("http")
    ? upload_url
    : `${API_BASE_URL}${upload_url}`;

  const uploadHeaders: Record<string, string> = {};
  if (!upload_url.startsWith("http")) {
    // Sandbox fallback requires authorization
    uploadHeaders["Authorization"] = `Bearer ${token}`;
  }

  const r2UploadRes = await fetch(targetUploadUrl, {
    method: "POST",
    headers: uploadHeaders,
    body: formData,
  });

  if (!r2UploadRes.ok && r2UploadRes.status !== 204) {
    throw new Error("Could not upload photo to storage. Please check your internet connection.");
  }

  // 3. Confirm and update player profile with new avatar URL
  const patchRes = await fetch(`${API_BASE_URL}/identity/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ avatar_url: public_url }),
  });

  if (!patchRes.ok) {
    throw new Error("Photo was uploaded but your profile could not be updated. Please try again.");
  }

  return { avatarUrl: public_url };
}

/**
 * Remove profile photo and revert to initials.
 */
export async function removeAvatar(): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;

  const patchRes = await fetch(`${API_BASE_URL}/identity/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ avatar_url: null }),
  });

  if (!patchRes.ok) {
    throw new Error("Could not remove profile photo. Please try again.");
  }
}
