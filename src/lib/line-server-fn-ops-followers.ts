import { createServerFn } from "@tanstack/react-start";
import { removeLegacySampleLineFollowers } from "./line-follower-data";
import {
  globalServerDatabase,
  getLineChannelAccessToken,
  type ServerLineFollower,
} from "./line-server-shared";

export const getLineFollowersHistoryFn = createServerFn({ method: "GET" }).handler(async () => {
  globalServerDatabase.followers = removeLegacySampleLineFollowers(globalServerDatabase.followers);
  return {
    success: true,
    followers: globalServerDatabase.followers,
    count: globalServerDatabase.followers.length,
  };
});

/** Sync verified LINE Official Account followers and their public profiles. */
export const syncLineFollowersFn = createServerFn({ method: "POST" }).handler(async () => {
  const accessToken = getLineChannelAccessToken();
  if (!accessToken) {
    return {
      success: false as const,
      message: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ฝั่งเซิร์ฟเวอร์",
    };
  }

  const userIds: string[] = [];
  let cursor: string | undefined;
  const maxPages = 20;

  try {
    for (let page = 0; page < maxPages; page += 1) {
      const url = new URL("https://api.line.me/v2/bot/followers/ids");
      url.searchParams.set("limit", "1000");
      if (cursor) url.searchParams.set("start", cursor);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        if (response.status === 403) {
          return {
            success: false as const,
            message:
              "LINE ปฏิเสธการอ่านรายชื่อ: ตรวจ Channel Access Token และสถานะ Official Account (ต้องเป็นบัญชี Verified หรือ Premium)",
          };
        }
        if (response.status === 401) {
          return {
            success: false as const,
            message:
              "LINE Channel Access Token ไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบค่า server secret",
          };
        }
        return {
          success: false as const,
          message: `เรียก LINE API ไม่สำเร็จ (HTTP ${response.status})`,
        };
      }

      const pageData = (await response.json()) as { userIds?: unknown; next?: unknown };
      const pageUserIds = Array.isArray(pageData.userIds)
        ? pageData.userIds.filter((userId): userId is string => typeof userId === "string")
        : [];
      userIds.push(...pageUserIds);

      cursor = typeof pageData.next === "string" ? pageData.next : undefined;
      if (!cursor) break;
      if (page === maxPages - 1) {
        return {
          success: false as const,
          message:
            "พบผู้ติดตามมากกว่า 20,000 รายการ จึงหยุดซิงค์เพื่อป้องกันการดึงข้อมูลเกินจำเป็น",
        };
      }
    }

    const uniqueUserIds = [...new Set(userIds)];
    const syncedAt = new Date().toLocaleString("th-TH");
    const profiles: ServerLineFollower[] = new Array(uniqueUserIds.length);
    let nextIndex = 0;

    const workers = Array.from({ length: Math.min(8, uniqueUserIds.length) }, async () => {
      while (nextIndex < uniqueUserIds.length) {
        const index = nextIndex;
        nextIndex += 1;
        const userId = uniqueUserIds[index];
        if (!userId) continue;
        const existing = globalServerDatabase.followers.find(
          (follower) => follower.userId === userId,
        );

        try {
          const profileResponse = await fetch(
            `https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          const profile = profileResponse.ok
            ? ((await profileResponse.json()) as {
                displayName?: string;
                pictureUrl?: string;
                statusMessage?: string;
              })
            : undefined;

          profiles[index] = {
            userId,
            displayName: profile?.displayName?.trim() || userId,
            pictureUrl: profile?.pictureUrl,
            statusMessage: profile?.statusMessage,
            followedAt: existing?.followedAt || "ไม่ระบุวันที่จาก LINE",
            lastInteractionAt: syncedAt,
            role:
              existing?.role === "admin" ||
              existing?.role === "staff" ||
              existing?.role === "viewer"
                ? existing.role
                : "viewer",
          };
        } catch {
          profiles[index] = {
            userId,
            displayName: userId,
            followedAt: existing?.followedAt || "ไม่ระบุวันที่จาก LINE",
            lastInteractionAt: syncedAt,
            role:
              existing?.role === "admin" ||
              existing?.role === "staff" ||
              existing?.role === "viewer"
                ? existing.role
                : "viewer",
          };
        }
      }
    });

    await Promise.all(workers);
    const currentFollowers = removeLegacySampleLineFollowers(globalServerDatabase.followers);
    const mergedFollowers = new Map(
      currentFollowers.map((follower) => [follower.userId, follower]),
    );
    profiles.forEach((profile) => mergedFollowers.set(profile.userId, profile));
    globalServerDatabase.followers = [...mergedFollowers.values()];

    return { success: true as const, followers: profiles, count: profiles.length };
  } catch (error) {
    console.error("LINE follower sync failed", error);
    return {
      success: false as const,
      message: "เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    };
  }
});

/**
 * Register / Update a Follower or User
 */
export const registerLineFollowerFn = createServerFn({ method: "POST" })
  .validator((user: ServerLineFollower) => user)
  .handler(async ({ data }) => {
    const existingIdx = globalServerDatabase.followers.findIndex((f) => f.userId === data.userId);
    if (existingIdx >= 0) {
      globalServerDatabase.followers[existingIdx] = {
        ...globalServerDatabase.followers[existingIdx],
        ...data,
        lastInteractionAt:
          new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH"),
      };
    } else {
      globalServerDatabase.followers.unshift({
        ...data,
        followedAt:
          data.followedAt ||
          new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH"),
        lastInteractionAt:
          new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH"),
      });
    }

    return {
      success: true,
      follower: data,
      allFollowers: globalServerDatabase.followers,
    };
  });
