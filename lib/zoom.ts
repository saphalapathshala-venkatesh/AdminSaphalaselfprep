/**
 * Zoom Server-to-Server OAuth integration.
 *
 * Credentials are stored as Replit secrets:
 *   ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
 *
 * Token is cached in-memory with a 55-minute TTL (Zoom tokens expire in 60 min).
 */

let _token: string | null = null;
let _tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (_token && now < _tokenExpiresAt) return _token;

  const accountId    = process.env.ZOOM_ACCOUNT_ID;
  const clientId     = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET are not set");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom token error ${res.status}: ${body}`);
  }

  const json = await res.json();
  _token = json.access_token as string;
  _tokenExpiresAt = now + 55 * 60 * 1000; // 55-minute cache
  return _token;
}

export interface ZoomMeetingInput {
  topic: string;
  /** ISO 8601 in UTC — "2026-04-01T14:30:00Z" */
  startTime: string;
  /** Duration in minutes */
  durationMinutes: number;
  agenda?: string;
  password?: string;
}

export interface ZoomMeetingResult {
  meetingId: string;
  joinUrl: string;
  startUrl: string;
  password: string;
}

/**
 * Create a Zoom meeting via the Zoom API.
 * Returns meetingId, joinUrl, startUrl, and password.
 */
export async function createZoomMeeting(
  input: ZoomMeetingInput
): Promise<ZoomMeetingResult> {
  const token = await getAccessToken();

  const body = {
    topic: input.topic,
    type: 2, // Scheduled meeting
    start_time: input.startTime,
    duration: input.durationMinutes,
    agenda: input.agenda || "",
    password: input.password || generatePassword(),
    settings: {
      join_before_host: false,
      waiting_room: true,
      mute_upon_entry: true,
      approval_type: 0,
    },
  };

  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoom create meeting error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    meetingId: String(data.id),
    joinUrl:   data.join_url,
    startUrl:  data.start_url,
    password:  data.password,
  };
}

/**
 * Delete a Zoom meeting. Silently ignores 404 (already deleted).
 */
export async function deleteZoomMeeting(meetingId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Zoom delete meeting error ${res.status}: ${err}`);
  }
}

/**
 * Update a Zoom meeting's topic, time, and duration.
 */
export async function updateZoomMeeting(
  meetingId: string,
  input: Partial<ZoomMeetingInput>
): Promise<void> {
  const token = await getAccessToken();

  const body: Record<string, unknown> = {};
  if (input.topic)         body.topic      = input.topic;
  if (input.startTime)     body.start_time = input.startTime;
  if (input.durationMinutes) body.duration = input.durationMinutes;
  if (input.agenda)        body.agenda     = input.agenda;

  const res = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    throw new Error(`Zoom update meeting error ${res.status}: ${err}`);
  }
}

function generatePassword(): string {
  // Pad to ensure we always get exactly 6 alphanumeric chars regardless of random value
  const raw = Math.random().toString(36).slice(2).padEnd(6, "0");
  return raw.slice(0, 6).toUpperCase();
}

// ─── Zoom Poll Helpers ────────────────────────────────────────────────────────

export interface ZoomPollQuestion {
  name: string;
  /** "single" = one answer, "multiple" = multiple answers allowed */
  type: "single" | "multiple";
  answers: string[];
}

export interface ZoomPoll {
  id: string;
  title: string;
  questions: ZoomPollQuestion[];
}

/**
 * List all polls for a Zoom meeting.
 */
export async function listZoomPolls(meetingId: string): Promise<ZoomPoll[]> {
  const token = await getAccessToken();
  const res = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/polls`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 404) return [];
    const err = await res.text();
    throw new Error(`Zoom list polls error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return (data.polls || []) as ZoomPoll[];
}

/**
 * Create a poll for a Zoom meeting.
 * Each poll has a title and one or more questions with answer options.
 */
export async function createZoomPoll(
  meetingId: string,
  input: { title: string; questions: ZoomPollQuestion[] }
): Promise<ZoomPoll> {
  const token = await getAccessToken();
  const res = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/polls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: input.title,
      questions: input.questions.map(q => ({
        name: q.name,
        type: q.type,
        answers: q.answers,
      })),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoom create poll error ${res.status}: ${err}`);
  }
  return await res.json() as ZoomPoll;
}

/**
 * Update an existing Zoom poll.
 */
export async function updateZoomPoll(
  meetingId: string,
  pollId: string,
  input: { title: string; questions: ZoomPollQuestion[] }
): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/polls/${pollId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: input.title,
      questions: input.questions.map(q => ({
        name: q.name,
        type: q.type,
        answers: q.answers,
      })),
    }),
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    throw new Error(`Zoom update poll error ${res.status}: ${err}`);
  }
}

/**
 * Delete a Zoom poll. Silently ignores 404.
 */
export async function deleteZoomPoll(meetingId: string, pollId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/polls/${pollId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 204) {
    const err = await res.text();
    throw new Error(`Zoom delete poll error ${res.status}: ${err}`);
  }
}
