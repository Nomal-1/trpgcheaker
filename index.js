// 매주 토요일 저녁 8시, 노션 세션 준비 체크리스트를 읽어서
// 디스코드 채널에 상황에 맞는 메시지를 보내는 스크립트.
// Claude API 등 유료 서비스는 전혀 쓰지 않습니다 (완전 0원).

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID; // 세션 준비 체크리스트 DB
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

// ---- 항목별 안내 문구 (자유롭게 문구를 바꿔도 됩니다) ----
const ITEM_MESSAGES = {
  "NPC 정리": "NPC 정리가 아직인 것 같아요. 이번 세션에 등장할 NPC들, 슬슬 정리해볼까요?",
  "이번 국면 준비": "이번 세션 국면(장면) 구성이 비어있네요. 어떤 장면으로 시작할지 미리 잡아두면 편할 거예요.",
  "소품/음악 준비": "소품이나 배경 음악 준비가 아직이네요. 분위기 잡을 플레이리스트나 소품 챙겨두면 좋을 것 같아요.",
};

const ALL_DONE_MESSAGES = [
  "체크리스트를 보니 이번 세션 준비는 다 끝나신 것 같아요! 내일 세션 화이팅입니다 🎲",
  "와, 준비 끝났네요. 내일 세션 편하게 즐기시면 될 것 같아요!",
];

const NO_SESSION_MESSAGES = [
  "이번 주는 예정된 세션이 노션에 등록되어 있지 않네요. 세션이 있다면 체크리스트에 먼저 등록해두면 제가 챙겨드릴게요.",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function nextSaturdayISORange() {
  // "가장 가까운 다가오는 세션"을 찾기 위해 오늘부터 7일 뒤까지 범위로 검색
  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const toISODate = (d) => d.toISOString().slice(0, 10);
  return { start: toISODate(now), end: toISODate(in7days) };
}

async function queryUpcomingSession() {
  const { start, end } = nextSaturdayISORange();
  const res = await fetch(
    `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          and: [
            { property: "세션 날짜", date: { on_or_after: start } },
            { property: "세션 날짜", date: { on_or_before: end } },
          ],
        },
        sorts: [{ property: "세션 날짜", direction: "ascending" }],
        page_size: 1,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Notion API 오류: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.results[0] || null;
}

function buildMessage(page) {
  if (!page) {
    return pick(NO_SESSION_MESSAGES);
  }

  const props = page.properties;
  const sessionName = props["세션 이름"]?.title?.[0]?.plain_text || "이번 세션";

  const uncheckedLines = Object.keys(ITEM_MESSAGES)
    .filter((key) => props[key]?.checkbox === false)
    .map((key) => `- ${ITEM_MESSAGES[key]}`);

  if (uncheckedLines.length === 0) {
    return `**${sessionName}** 준비 상황 체크!\n\n${pick(ALL_DONE_MESSAGES)}`;
  }

  return [
    `**${sessionName}** 준비는 얼마나 되셨나요? 제가 도와드릴 일이 있을까요?`,
    "",
    ...uncheckedLines,
  ].join("\n");
}

async function sendToDiscord(content) {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    }
  );
  if (!res.ok) {
    throw new Error(`Discord API 오류: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  const missing = ["NOTION_TOKEN", "NOTION_DATABASE_ID", "DISCORD_BOT_TOKEN", "DISCORD_CHANNEL_ID"]
    .filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`환경변수가 설정되지 않았어요: ${missing.join(", ")}`);
  }

  const page = await queryUpcomingSession();
  const message = buildMessage(page);
  await sendToDiscord(message);
  console.log("메시지 전송 완료:", message);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
