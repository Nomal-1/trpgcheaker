// 노션 "디스코드 DM 대기열"에서 상태가 "대기"인 행을 읽어
// 봇으로 사용자 본인(nomal6007)에게 DM을 보내고 상태를 "보냄"으로 바꾼다.
// Claude 예약 작업이 디스코드 MCP 서버에 연결하지 못할 때의 예비 경로.

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const QUEUE_DB_ID = process.env.DM_QUEUE_DB_ID;
const RECIPIENT_ID = process.env.DM_RECIPIENT_ID;

const notionHeaders = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
};
const discordHeaders = {
  Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
  "Content-Type": "application/json",
};

const plain = (rich) => (rich || []).map((r) => r.plain_text).join("");

async function notion(path, method, body) {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: notionHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  return res.json();
}

async function discord(path, body) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`https://discord.com/api/v10/${path}`, {
      method: "POST",
      headers: discordHeaders,
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const text = await res.text();
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 5000 * attempt));
      continue;
    }
    throw new Error(`Discord ${res.status}: ${text}`);
  }
  throw new Error("Discord: 재시도 후에도 실패");
}

async function main() {
  const missing = ["NOTION_TOKEN", "DISCORD_BOT_TOKEN", "DM_QUEUE_DB_ID", "DM_RECIPIENT_ID"].filter(
    (k) => !process.env[k]
  );
  if (missing.length) throw new Error(`환경 변수 없음: ${missing.join(", ")}`);

  let results;
  try {
    ({ results } = await notion(`databases/${QUEUE_DB_ID}/query`, "POST", {
      filter: { property: "상태", select: { equals: "대기" } },
      sorts: [{ timestamp: "created_time", direction: "ascending" }],
      page_size: 20,
    }));
  } catch (err) {
    if (err.message.startsWith("Notion 404")) {
      // 대기열 DB가 노션 연동("세션 알림")에 아직 연결되지 않음. 15분마다 실패 메일이 가지 않도록 경고만 남긴다.
      console.warn("::warning::대기열 DB에 접근할 수 없음 — 노션에서 DB에 '세션 알림' 연결을 추가해야 함");
      return;
    }
    throw err;
  }
  console.log(`대기 중 ${results.length}건`);
  if (!results.length) return;

  const channel = await discord("users/@me/channels", { recipient_id: RECIPIENT_ID });
  let failed = 0;

  for (const page of results) {
    const props = page.properties;
    let content = plain(props["본문"]?.rich_text).trim() || plain(props["제목"]?.title).trim();
    if (!content) {
      await notion(`pages/${page.id}`, "PATCH", {
        properties: { 상태: { select: { name: "실패" } }, 오류: { rich_text: [{ text: { content: "본문 없음" } }] } },
      });
      continue;
    }
    content = content.slice(0, 2000);
    try {
      await discord(`channels/${channel.id}/messages`, { content, allowed_mentions: { parse: [] } });
      await notion(`pages/${page.id}`, "PATCH", {
        properties: {
          상태: { select: { name: "보냄" } },
          "보낸 시각": { date: { start: new Date().toISOString() } },
        },
      });
      console.log(`보냄: ${page.id}`);
    } catch (err) {
      failed++;
      console.error(`실패: ${page.id} ${err.message}`);
      // 상태는 "대기"로 두어 다음 실행에서 다시 시도한다. 오류만 기록.
      await notion(`pages/${page.id}`, "PATCH", {
        properties: { 오류: { rich_text: [{ text: { content: err.message.slice(0, 500) } }] } },
      }).catch(() => {});
    }
  }
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
