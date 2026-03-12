import crypto from "crypto";

export type DeviceInfo = {
  deviceKey: string;
  deviceType: "DESKTOP" | "MOBILE" | "TABLET" | "UNKNOWN";
  browser: string;
  os: string;
};

function parseBrowser(ua: string): string {
  if (/Edg\//i.test(ua))    return "Edge";
  if (/OPR\//i.test(ua))    return "Opera";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua)) return "Safari";
  if (/MSIE|Trident/i.test(ua)) return "IE";
  return "Unknown";
}

function parseOS(ua: string): string {
  if (/Windows NT/i.test(ua))  return "Windows";
  if (/Mac OS X/i.test(ua))    return "macOS";
  if (/Linux/i.test(ua))       return "Linux";
  if (/Android/i.test(ua))     return "Android";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  return "Unknown";
}

function parseDeviceType(ua: string): "DESKTOP" | "MOBILE" | "TABLET" | "UNKNOWN" {
  if (/iPad/i.test(ua))                    return "TABLET";
  if (/Android.*Tablet/i.test(ua))         return "TABLET";
  if (/Mobile|iPhone|Android/i.test(ua))   return "MOBILE";
  if (/Windows|Macintosh|Linux/i.test(ua)) return "DESKTOP";
  return "UNKNOWN";
}

export function parseDeviceInfo(userId: string, ua: string): DeviceInfo {
  const browser    = parseBrowser(ua);
  const os         = parseOS(ua);
  const deviceType = parseDeviceType(ua);
  // Key = stable hash of userId + browser + OS (ignores version churn)
  const fingerprint = `${userId}:${browser}:${os}:${deviceType}`;
  const deviceKey   = crypto.createHash("sha256").update(fingerprint).digest("hex").slice(0, 32);
  return { deviceKey, deviceType, browser, os };
}
