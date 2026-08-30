# API

Base URL (dev): `http://localhost:3000/api`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness |
| POST | `/diagnosis/page` | Diagnose a captured page and persist |
| GET | `/diagnosis/stats` | Dashboard stats |
| GET | `/diagnosis/reports` | Recent reports |
| GET | `/shops` | Shop list |
| GET | `/products` | Product list |
| GET | `/rules` | Scoring rule catalog |
| GET | `/auth/status` | Auth placeholder |

Success envelope:

```json
{ "success": true, "data": {}, "message": "" }
```
