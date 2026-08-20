# 세션 준비 알리미 (0원 버전)

매주 토요일 저녁 8시, 노션의 "세션 준비 체크리스트"를 확인해서
디스코드 "일반" 채널에 상황에 맞는 메시지를 자동으로 보냅니다.
Claude API 등 유료 서비스는 전혀 사용하지 않습니다 — 완전히 규칙 기반(템플릿) 방식이라 비용이 0원입니다.

## 1. 노션 연동 토큰 만들기

1. https://www.notion.so/profile/integrations 접속
2. "새 통합(New integration)" 클릭 → 이름은 아무거나 (예: "세션 알리미")
3. 만들고 나면 "Internal Integration Token" 이라는 값이 나옵니다. 이게 `NOTION_TOKEN` 이에요. (`ntn_`으로 시작)
4. 노션에서 "세션 준비 체크리스트" 데이터베이스 페이지를 열고, 오른쪽 위 `···` 메뉴 → "연결 추가(Connections)" → 방금 만든 통합을 추가해주세요. (이걸 안 하면 봇이 그 데이터베이스를 못 읽습니다)

`NOTION_DATABASE_ID` 는 아래 값을 그대로 쓰시면 됩니다:
```
44d6ddf0514a4cbb8a67fdec2e158010
```

## 2. 디스코드 봇 토큰

이미 Render에 올려두신 디스코드 MCP 서버를 만들 때 쓰신 그 봇 토큰(`DISCORD_BOT_TOKEN`)을 그대로 재사용하시면 됩니다.
채널 ID(`DISCORD_CHANNEL_ID`, "일반" 채널)는 아래 값을 쓰시면 됩니다:
```
1521033281506644132
```

## 3. Render에 Cron Job으로 배포하기

1. 이 폴더(`index.js`, `package.json`)를 깃허브 저장소 하나 새로 만들어서 올려주세요.
2. Render 대시보드 → New → **Cron Job** 선택
3. 방금 만든 저장소를 연결
4. 설정값:
   - **Build Command**: (비워두거나) `npm install`
   - **Command**: `node index.js`
   - **Schedule**: `0 11 * * 6`
     - (Render의 cron 시간은 UTC 기준이라, 한국시간 토요일 20:00 = UTC 토요일 11:00 입니다)
5. Environment 탭에서 아래 4개 변수를 추가:
   - `NOTION_TOKEN`
   - `NOTION_DATABASE_ID` = `44d6ddf0514a4cbb8a67fdec2e158010`
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_CHANNEL_ID` = `1521033281506644132`
6. 저장하면 끝! 매주 토요일 저녁 8시에 자동으로 실행됩니다.

## 4. 체크리스트 사용법

노션의 "세션 준비 체크리스트" 데이터베이스에 다음 세션 행을 미리 만들어두세요:
- **세션 이름**: 예) "3화: 폐허의 탑"
- **세션 날짜**: 이번 주 토요일 날짜
- **NPC 정리 / 이번 국면 준비 / 소품·음악 준비**: 준비되는 대로 체크

체크가 안 된 항목이 있으면 그 항목에 대한 안내 메시지가, 다 체크되어 있으면 응원 메시지가 갑니다.
행이 아예 없으면 "이번 주는 세션이 없나 봐요" 메시지가 갑니다.

## 5. 문구 바꾸고 싶을 때

`index.js` 안의 `ITEM_MESSAGES`, `ALL_DONE_MESSAGES`, `NO_SESSION_MESSAGES` 부분 텍스트만 수정하면 됩니다. 코드를 더 몰라도 이 부분은 그냥 문장만 바꾸면 돼요.
