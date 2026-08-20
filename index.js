// 매주 토요일 저녁 8시, 노션의 "남은작업" 표에서
// 완료 안 된 작업들을 찾아 디스코드에 알려주는 스크립트.
// Claude API 등 유료 서비스는 전혀 쓰지 않습니다 (완전 0원).

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID; // 남은작업 체크리스트 DB
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

const ALL_DONE_MESSAGES = [
  "표를 보니 남은 작업이 하나도 없어요! 내일 세션 편하게 즐기시면 될 것 같아요 🎲",
  "와, 다 끝났네요. 준비 완벽합니다.",
];

const NOTHING_REGISTERED_MESSAGES = [
  "노션 표에 등록된 작업이 아직 없네요. 할 일이 생기면 표에 먼저 적어두시면 제가 매주 챙겨드릴게요.",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function queryIncompleteTasks() {
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
          property: "완료여부",
          checkbox: { equals: false },
        },
        sorts: [{ property: "작업 카테고리", direction: "ascending" }],
        page_size: 50,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Notion API 오류: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.results;
}

async function countAllTasks() {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 1 }),
    }
  );
  if (!res.ok) return 1; // 확인 실패 시 "표가 비었다"고 잘못 말하지 않도록 기본값 1
  const data = await res.json();
  return data.results.length;
}

function extractTaskLine(page) {
  const props = page.properties;
  const name = props["남은작업이름"]?.title?.[0]?.plain_text || "(이름 없음)";
  const category = props["작업 카테고리"]?.select?.name;
  const location = props["작업위치"]?.select?.name;

  const tags = [category, location].filter(Boolean).join(" · ");
  return tags ? `- ${name} (${tags})` : `- ${name}`;
}

async function buildMessage() {
  const incomplete = await queryIncompleteTasks();

  if (incomplete.length === 0) {
    const total = await countAllTasks();
    if (total === 0) {
      return pick(NOTHING_REGISTERED_MESSAGES);
    }
    return pick(ALL_DONE_MESSAGES);
  }

  const lines = incomplete.map(extractTaskLine);

  return [
    `내일 세션 준비는 얼마나 되셨나요? 제가 도와드릴 일이 있을까요?`,
    "",
    `아직 안 끝난 작업이 ${incomplete.length}개 있어요:`,
    ...lines,
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

  const message = await buildMessage();
  await sendToDiscord(message);
  console.log("메시지 전송 완료:", message);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
