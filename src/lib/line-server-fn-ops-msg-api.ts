import { createServerFn } from "@tanstack/react-start";
import {
  getLineChannelAccessToken,
  type SendLineOrderPayload,
} from "./line-server-shared";
import { callLineMessagingApiWithRetry } from "./line-server-fn-ops-helpers";

export const sendLineMessagingApiFn = createServerFn({ method: "POST" })
  .validator((data: SendLineOrderPayload) => data)
  .handler(async ({ data }) => {
    const token = (
      process.env["LINE_CHANNEL_ACCESS_TOKEN"] ||
      process.env["LINE_ACCESS_TOKEN"] ||
      process.env["LINE_TOKEN"] ||
      process.env["CHANNEL_ACCESS_TOKEN"] ||
      process.env["ACCESS_TOKEN"] ||
      process.env["LINE_BOT_TOKEN"] ||
      process.env["LINE_MESSAGING_TOKEN"] ||
      data.channelAccessToken
    )?.trim();

    if (!token) {
      return {
        success: false,
        configured: false,
        error:
          "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ใน GitHub Secrets หรือ Server Environment กรุณาตรวจสอบการตั้งค่าคีย์ใน GitHub Secrets",
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
      .map((value) => value.trim())
      .filter(Boolean);
    const requestedTarget = data.toUserIdOrGroupId?.trim();
    const targets = requestedTarget ? [requestedTarget] : configuredTargets;
    if (!isBroadcast && targets.length === 0) {
      return {
        success: false,
        configured: true,
        error:
          "ยังไม่ได้ระบุผู้รับปลายทาง (LINE_TO_ID ใน GitHub Secrets หรือเลือกผู้รับจากรายชื่อ)",
      };
    }

    // Prepare message payload
    let rawFlex = data.flexMessage;
    if (typeof rawFlex === "string") {
      try {
        rawFlex = JSON.parse(rawFlex);
      } catch {
        // ignore
      }
    }

    let messageObj: unknown;
    if (rawFlex && typeof rawFlex === "object") {
      const flexData = rawFlex as Record<string, unknown>;
      const altSummary = (data.orderSummary || "LINE Flex Message").trim() || "LINE Flex Message";
      if (flexData["type"] === "flex") {
        const altText =
          typeof flexData["altText"] === "string" && flexData["altText"].trim()
            ? flexData["altText"]
            : altSummary;
        messageObj = {
          ...flexData,
          altText,
        };
      } else if (flexData["type"] === "bubble" || flexData["type"] === "carousel") {
        messageObj = {
          type: "flex",
          altText: altSummary,
          contents: flexData,
        };
      } else if (flexData["contents"]) {
        const altText =
          typeof flexData["altText"] === "string" && flexData["altText"].trim()
            ? flexData["altText"]
            : altSummary;
        messageObj = {
          type: "flex",
          altText,
          contents: flexData["contents"],
        };
      } else {
        messageObj = {
          type: "text",
          text: data.orderSummary,
        };
      }
    } else {
      messageObj = {
        type: "text",
        text: data.orderSummary,
      };
    }

    // Prepare Image Message if requested
    const sendFormat = data.format || "FLEX";
    let imageMessageObj: Record<string, unknown> | null = null;

    if (sendFormat === "IMAGE_PNG" || sendFormat === "BOTH") {
      let finalImageUrl = data.imageUrl?.trim() || "";

      if (!finalImageUrl && data.imageBase64?.trim()) {
        try {
          const { storeLineImageFromBase64 } = await import("./line-image-storage");
          const imageId = storeLineImageFromBase64(data.imageBase64);
          const baseOrigin =
            process.env["APP_URL"] ||
            process.env["VERCEL_URL"] ||
            process.env["RENDER_EXTERNAL_URL"] ||
            "https://ais-dev-jc3utk43pgkkismwy5v6xn-837009735838.asia-east1.run.app";
          const cleanOrigin = baseOrigin.startsWith("http") ? baseOrigin : `https://${baseOrigin}`;
          finalImageUrl = `${cleanOrigin}/api/line-image/${imageId}.png`;
        } catch (imgErr) {
          console.warn("Could not cache base64 image on server:", imgErr);
        }
      }

      if (finalImageUrl) {
        imageMessageObj = {
          type: "image",
          originalContentUrl: finalImageUrl,
          previewImageUrl: finalImageUrl,
        };
      }
    }

    // Assemble final messages array for LINE API
    let messagesToSend: unknown[] = [];
    if (sendFormat === "IMAGE_PNG") {
      if (imageMessageObj) {
        messagesToSend = [imageMessageObj];
      } else {
        messagesToSend = [messageObj];
      }
    } else if (sendFormat === "BOTH") {
      if (imageMessageObj) {
        messagesToSend = [messageObj, imageMessageObj];
      } else {
        messagesToSend = [messageObj];
      }
    } else {
      messagesToSend = [messageObj];
    }

    try {
      const endpoint = isBroadcast
        ? "https://api.line.me/v2/bot/message/broadcast"
        : "https://api.line.me/v2/bot/message/push";
      const recipients = isBroadcast ? [undefined] : targets;

      for (const recipient of recipients) {
        const requestBody = isBroadcast
          ? { messages: messagesToSend }
          : { to: recipient, messages: messagesToSend };

        const result = await callLineMessagingApiWithRetry(endpoint, token, requestBody);

        if (!result.ok) {
          return {
            success: false,
            configured: true,
            error: `LINE API ส่งไม่สำเร็จ (Status: ${result.status}, พยายาม ${result.attempts} ครั้ง): ${result.bodyText}`,
          };
        }
      }

      return { success: true, configured: true };
    } catch (err: unknown) {
      return { success: false, configured: true, error: String(err) };
    }
  });
