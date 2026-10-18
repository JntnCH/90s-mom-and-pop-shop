import { createServerFn } from "@tanstack/react-start";
import {
  createMiniAppPortalFlexBubble,
  getSystemStoreName,
} from "./flex-templates";
import {
  getLineChannelAccessToken,
} from "./line-server-shared";
import { callLineMessagingApiWithRetry } from "./line-server-fn-ops-helpers";

export interface SendMiniAppPortalPayload {
  toUserId?: string | undefined;
  storeName?: string | undefined;
  liffId?: string | undefined;
  isBroadcast?: boolean | undefined;
}

export const sendMiniAppPortalCardFn = createServerFn({ method: "POST" })
  .validator((data: SendMiniAppPortalPayload) => data)
  .handler(async ({ data }) => {
    const token = (
      process.env["LINE_CHANNEL_ACCESS_TOKEN"] ||
      process.env["LINE_ACCESS_TOKEN"] ||
      process.env["LINE_TOKEN"] ||
      process.env["CHANNEL_ACCESS_TOKEN"] ||
      process.env["ACCESS_TOKEN"] ||
      process.env["LINE_BOT_TOKEN"] ||
      process.env["LINE_MESSAGING_TOKEN"]
    )?.trim();

    const envLiff = (
      process.env["LINE_LIFF_ID"] ||
      process.env["VITE_LINE_LIFF_ID"] ||
      process.env["LIFF_ID"] ||
      process.env["LINE_LIFF"] ||
      process.env["LIFFID"] ||
      data.liffId ||
      ""
    ).trim();

    const liffId = envLiff && envLiff !== "xxxxx-xxxxx" ? envLiff : "2007000000-xxxxxx";
    const storeName = getSystemStoreName(data.storeName);

    const portalBubble = createMiniAppPortalFlexBubble({
      storeName,
      liffId,
    });

    const portalMessage = {
      type: "flex",
      altText: `🏪 ทางเข้าใช้งาน LINE Mini App — ${storeName}`,
      contents: portalBubble,
      quickReply: {
        items: [
          {
            type: "action",
            action: {
              type: "uri",
              label: "🛒 สั่งซื้อสินค้า",
              uri: `https://liff.line.me/${liffId}/reorder`,
            },
          },
          {
            type: "action",
            action: {
              type: "uri",
              label: "📦 สต็อกสินค้า",
              uri: `https://liff.line.me/${liffId}/stock`,
            },
          },
          {
            type: "action",
            action: {
              type: "uri",
              label: "📷 สแกนบาร์โค้ด",
              uri: `https://liff.line.me/${liffId}/scan`,
            },
          },
          {
            type: "action",
            action: {
              type: "uri",
              label: "📊 แดชบอร์ด",
              uri: `https://liff.line.me/${liffId}`,
            },
          },
        ],
      },
    };

    if (!token) {
      return {
        success: false,
        configured: false,
        flexPayload: portalMessage,
        error:
          "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ใน GitHub Secrets หรือ Server Environment",
      };
    }

    const isBroadcast = Boolean(data.isBroadcast);
    const configuredTargets = (
      process.env["LINE_TO_ID"] ||
      process.env["LINE_TARGET_ID"] ||
      process.env["LINE_USER_ID"] ||
      process.env["LINE_RECEIVER_ID"] ||
      ""
    )
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const requestedTarget = data.toUserId?.trim();
    const targets = requestedTarget ? [requestedTarget] : configuredTargets;

    if (!isBroadcast && targets.length === 0) {
      return {
        success: false,
        configured: true,
        flexPayload: portalMessage,
        error: "ยังไม่ได้ระบุผู้รับปลายทาง (ระบุ LINE User ID หรือตั้งค่า LINE_TO_ID ใน Secrets)",
      };
    }

    try {
      const endpoint = isBroadcast
        ? "https://api.line.me/v2/bot/message/broadcast"
        : "https://api.line.me/v2/bot/message/push";
      const recipients = isBroadcast ? [undefined] : targets;

      for (const recipient of recipients) {
        const requestBody = isBroadcast
          ? { messages: [portalMessage] }
          : { to: recipient, messages: [portalMessage] };

        const result = await callLineMessagingApiWithRetry(endpoint, token, requestBody);

        if (!result.ok) {
          return {
            success: false,
            configured: true,
            flexPayload: portalMessage,
            error: `LINE Messaging API ส่งไม่สำเร็จ: ${result.bodyText}`,
          };
        }
      }

      return { success: true, configured: true, flexPayload: portalMessage };
    } catch (err: unknown) {
      return {
        success: false,
        configured: true,
        flexPayload: portalMessage,
        error: String(err),
      };
    }
  });
