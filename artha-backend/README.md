# ARTHA Backend — Full with Paperclip

## All Routes

### Telegram
| Method | Route | What |
|--------|-------|------|
| POST | /webhook/telegram | Telegram bot messages |

### Paperclip (all protected by Bearer token)
| Method | Route | What |
|--------|-------|------|
| POST | /api/webhook/invoke | Paperclip invokes any agent |
| POST | /api/webhook/heartbeat | Agent health check |
| POST | /api/webhook/approval-result | GST/tax approval decision |
| POST | /api/webhook/budget-alert | Agent budget 80%/100% hit |
| POST | /api/webhook/strategy-proposed | CEO strategy approval |

### Agents (direct)
| Method | Route | What |
|--------|-------|------|
| GET | /api/agents/health | All agents alive? |
| POST | /api/agents/ceo | Direct CEO invoke |
| POST | /api/agents/lekhak | Parse transaction |
| POST | /api/agents/tejas | GST calculation |
| POST | /api/agents/vivek | Reports |
| POST | /api/agents/memory/recall | Recall context |
| POST | /api/agents/execution/approve | Execute approved action |
| GET | /api/agents/entries/:companyId | Recent entries |
| GET | /api/agents/summary/:companyId | Monthly summary |

### Company
| Method | Route | What |
|--------|-------|------|
| POST | /api/company/onboard | New company setup |
| POST | /api/company/set-type | Set business type |
| GET | /api/company/:id | Get company |
| PATCH | /api/company/:id | Update company |

## Setup

```bash
cp .env.example .env   # fill keys
npm install
docker-compose up -d   # or: sudo service postgresql start
npm run db:setup
npm run dev
```

## Paperclip Adapter Config (paste in Paperclip dashboard)

```json
{
  "url": "https://YOUR_CODESPACE_URL/api/webhook/invoke",
  "webhookAuthHeader": "Bearer artha-secret-2024",
  "payloadTemplate": { "agent": "ceo" },
  "timeoutSec": 30
}
```

Change `"agent"` value for each of the 7 agents.
