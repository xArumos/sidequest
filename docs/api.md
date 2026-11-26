# SideQuest API reference

This document lists every HTTP route served by the Express API in `server/src/`.
It was written from the route handlers, not from other documentation, so where they differ the code wins.
Routes that are not on `main` yet are marked with the pull request that adds them, for example "Added in #104".
Routes that are only planned are marked "Planned".

## Contents

- [General](#general)
  - [Base URL](#base-url)
  - [Sessions and authentication](#sessions-and-authentication)
  - [Origin check](#origin-check)
  - [Requests](#requests)
  - [Errors](#errors)
  - [Pagination](#pagination)
  - [Rate limits](#rate-limits)
  - [Security headers](#security-headers)
  - [Shared response shapes](#shared-response-shapes)
- [Health](#health)
  - [GET /api/health](#get-apihealth)
  - [GET /api/ready](#get-apiready)
- [Auth](#auth)
  - [POST /api/auth/register](#post-apiauthregister)
  - [POST /api/auth/login](#post-apiauthlogin)
  - [POST /api/auth/google](#post-apiauthgoogle)
  - [GET /api/auth/me](#get-apiauthme)
  - [POST /api/auth/logout](#post-apiauthlogout)
- [Games](#games)
  - [GET /api/games](#get-apigames)
  - [GET /api/games/filters](#get-apigamesfilters)
  - [GET /api/games/top](#get-apigamestop)
  - [GET /api/games/:id](#get-apigamesid)
- [Logs and reviews](#logs-and-reviews)
  - [POST /api/games/:id/log](#post-apigamesidlog)
  - [GET /api/games/:id/log](#get-apigamesidlog)
  - [GET /api/games/:id/reviews](#get-apigamesidreviews)
  - [PATCH /api/logs/:id](#patch-apilogsid)
  - [DELETE /api/logs/:id](#delete-apilogsid)
- [Your lists and privacy settings](#your-lists-and-privacy-settings)
  - [GET /api/me/logs](#get-apimelogs)
  - [GET /api/me/wishlist-visibility](#get-apimewishlist-visibility)
  - [PATCH /api/me/wishlist-visibility](#patch-apimewishlist-visibility)
  - [GET /api/me/activity-visibility](#get-apimeactivity-visibility)
  - [PATCH /api/me/activity-visibility](#patch-apimeactivity-visibility)
  - [DELETE /api/users/me](#delete-apiusersme)
- [Users](#users)
  - [GET /api/users/:id](#get-apiusersid)
  - [GET /api/users/:id/logs](#get-apiusersidlogs)
  - [GET /api/users/:id/wishlist](#get-apiusersidwishlist)
- [Follows and feed](#follows-and-feed)
  - [POST /api/users/:id/follow](#post-apiusersidfollow)
  - [DELETE /api/users/:id/follow](#delete-apiusersidfollow)
  - [GET /api/users/:id/followers](#get-apiusersidfollowers)
  - [GET /api/users/:id/following](#get-apiusersidfollowing)
  - [GET /api/feed](#get-apifeed)
- [Developer access](#developer-access)
  - [POST /api/games/:id/developer-requests](#post-apigamesiddeveloper-requests)
  - [GET /api/games/:id/developer-requests/me](#get-apigamesiddeveloper-requestsme)
  - [GET /api/dev/games](#get-apidevgames)
  - [GET /api/dev/reviews](#get-apidevreviews)
  - [GET /api/dev/games/:id/reviews](#get-apidevgamesidreviews)
  - [DELETE /api/dev/reviews/:reviewId](#delete-apidevreviewsreviewid)
- [Admin](#admin)
  - [GET /api/admin/developer-requests](#get-apiadmindeveloper-requests)
  - [POST /api/admin/developer-requests/:id/approve](#post-apiadmindeveloper-requestsidapprove)
  - [POST /api/admin/developer-requests/:id/reject](#post-apiadmindeveloper-requestsidreject)

## General

### Base URL

All routes live under `/api` on the API server.
Locally the server listens on `http://localhost:5000` by default (`HOST` and `PORT` change this).
The frontend reads the server address from `VITE_API_BASE_URL`.
Paths in this document are absolute, for example `GET /api/games`.

### Sessions and authentication

Signing in through any `/api/auth` route sets an HttpOnly session cookie named `sidequest.sid`.
The cookie uses `SameSite=Lax`, `Path=/`, and lasts seven days.
It is marked `Secure` when `NODE_ENV=production`.
Sessions are stored in MongoDB, and the session ID is rotated on every sign-in.
Browser clients must send requests with `credentials: 'include'`.

Each route lists one of these auth requirements:

| Requirement | Meaning | When it fails |
| --- | --- | --- |
| None | Anyone, signed in or not. Some routes show more to the owner or to followers. | - |
| Signed in | A valid session. | `401 UNAUTHENTICATED` |
| Approved developer | Signed in, and an admin has approved the caller's developer request for that game. | `401 UNAUTHENTICATED`, then `403 NOT_DEVELOPER` |
| Admin | Signed in, and the account's `admin` flag is set. The flag is read from the database on every request. | `401 UNAUTHENTICATED`, then `403 NOT_ADMIN` |

If the server runs without `SESSION_SECRET`, authentication is disabled.
Every `/api/auth` route and every route that needs a session then answers `503 AUTH_NOT_CONFIGURED`.
Public routes keep working.

### Origin check

Every `/api` request whose method is not `GET`, `HEAD`, or `OPTIONS` must send an `Origin` header that exactly matches `FRONTEND_ORIGIN` (default `http://localhost:5173`, including the port).
Otherwise the API answers `403 INVALID_ORIGIN` before anything else runs, including authentication, rate limiting, and the 404 handler.
Browsers send `Origin` automatically on these requests; other clients must set it.
This protects the cookie session against cross-site request forgery.
In this document, "Origin check: yes" marks the routes this applies to.

CORS allows only `FRONTEND_ORIGIN`, with credentials.

### Requests

Request bodies are JSON and must be sent with `Content-Type: application/json`.
Routes that read a body reject other content types with their own `400` error.
Bodies are limited to 100 KB.

Path IDs (`:id`, `:reviewId`) are 24-character hexadecimal MongoDB ObjectIds.
Any other value returns `400 INVALID_ID`, for example `That game id is not valid.`

Query text parameters must appear at most once.
A repeated key such as `?genre=a&genre=b`, or a text value over 100 characters, returns `400 INVALID_QUERY`.
Text values are trimmed.

Timestamps in responses are ISO 8601 strings in UTC.

### Errors

Every error response has this shape:

```json
{ "error": { "code": "GAME_NOT_FOUND", "message": "Game not found." } }
```

`code` is stable and meant for programs.
`message` is a human-readable sentence and may change.

The developer review routes (added in #105) validate several inputs at once and add `fields`, which maps each invalid input to its problem:

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "Invalid query parameters: maxRating.",
    "fields": { "maxRating": "maxRating must be at least minRating." }
  }
}
```

These errors can come from any route and are not repeated in each route's table:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_JSON` | The body is not valid JSON. |
| `400` | `INVALID_ID` | A path ID is not a valid ObjectId. |
| `400` | `INVALID_QUERY` | `page` or `limit` is out of range, or a text parameter is repeated or too long. |
| `401` | `UNAUTHENTICATED` | The route needs a session and there is none. |
| `403` | `INVALID_ORIGIN` | A non-GET request has a missing or wrong `Origin`. |
| `404` | `NOT_FOUND` | No route matches the method and path. |
| `413` | `BODY_TOO_LARGE` | The body is over 100 KB. |
| `415` | `UNSUPPORTED_CHARSET` | The JSON body uses an unsupported charset. |
| `415` | `UNSUPPORTED_ENCODING` | The body uses an unsupported content encoding. |
| `429` | `RATE_LIMITED` | A rate limit was exceeded. See [Rate limits](#rate-limits). |
| `500` | `INTERNAL_ERROR` | An unexpected server error. Details are only logged on the server. |
| `503` | `AUTH_NOT_CONFIGURED` | Authentication is disabled and the route needs it. |

### Pagination

List routes take `page` and `limit` query parameters:

| Parameter | Type | Default | Range |
| --- | --- | --- | --- |
| `page` | integer | `1` | 1 to 100000 |
| `limit` | integer | `20` | 1 to 50 |

Paginated responses put the items under a route-specific key and add the totals:

```json
{ "games": [], "total": 42, "page": 2, "pages": 3 }
```

`pages` is `ceil(total / limit)`, so it is `0` when there are no results.
A `page` past the end returns an empty list with the same totals.

### Rate limits

Each sign-in route (`register`, `login`, `google`) has its own limit of 30 requests per 15 minutes per IP address.

Added in #102: all non-GET `/api` requests (methods other than `GET`, `HEAD`, and `OPTIONS`) also share one write limit.
It counts per signed-in account, or per IP address for signed-out requests, with IPv6 addresses grouped by /56.
The default is 300 requests per 15 minutes.
Two environment variables tune it:

| Variable | Default | Meaning |
| --- | --- | --- |
| `WRITE_RATE_LIMIT_MAX` | `300` | Requests allowed per window |
| `WRITE_RATE_LIMIT_WINDOW_MINUTES` | `15` | Window length in minutes |

Both must be positive whole numbers, or the server refuses to start.
Exceeding either limit returns:

```json
{ "error": { "code": "RATE_LIMITED", "message": "Too many requests. Try again later." } }
```

The sign-in limit uses the message `Too many authentication attempts. Try again later.` instead.
Limited responses carry IETF draft-8 `RateLimit` and `RateLimit-Policy` headers.
Counters are kept in memory per API process.

### Security headers

Added in #102: every response carries `helmet` security headers, including:

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | `default-src 'none';base-uri 'none';form-action 'none';frame-ancestors 'none'` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |

Helmet also sends `Origin-Agent-Cluster`, `X-DNS-Prefetch-Control: off`, `X-Download-Options: noopen`, `X-Permitted-Cross-Domain-Policies: none`, and `X-XSS-Protection: 0`.
`X-Powered-By` is never sent.
All `/api/auth` responses, and `GET /api/ready`, also send `Cache-Control: no-store`.

### Shared response shapes

These objects appear in several routes.

**Account** (only ever sent to the account holder):

```json
{
  "id": "6650f1c2a1b2c3d4e5f60718",
  "email": "player@example.com",
  "username": "player_1",
  "displayName": "player_1",
  "avatarUrl": "",
  "authMethod": "password",
  "admin": false
}
```

`username` is `null` for Google accounts.
`authMethod` is `password` or `google` and was added in #107.
`admin` is added in #105.

**Game summary**:

```json
{
  "id": "6650f1c2a1b2c3d4e5f60001",
  "title": "Hollow Knight",
  "slug": "hollow-knight",
  "coverUrl": "https://images.igdb.com/...",
  "genres": ["Platform"],
  "platforms": ["PC (Microsoft Windows)"],
  "releaseDate": "2017-02-24T00:00:00.000Z",
  "ratingAvg": 4.5,
  "ratingCount": 12
}
```

`releaseDate` may be `null`, and `ratingAvg` is `0` when `ratingCount` is `0`.

**Log** (a user's own record for one game):

```json
{
  "id": "6650f1c2a1b2c3d4e5f69999",
  "game": "6650f1c2a1b2c3d4e5f60001",
  "rating": 4,
  "text": "Great atmosphere.",
  "status": "played",
  "removed": null,
  "createdAt": "2026-11-01T12:00:00.000Z",
  "updatedAt": "2026-11-02T08:30:00.000Z"
}
```

`rating` is 1 to 5 or `null`, `text` is a string (empty when there is no review), and `status` is `playing`, `played`, `backlog`, `wishlist`, or `null`.
Added in #105: `removed` is `null`, or `{ "at": "<timestamp>", "reason": "<text>" }` when a developer removed the review.
In list responses, `game` is a game summary instead of an ID.

**Public review**:

```json
{
  "id": "6650f1c2a1b2c3d4e5f69999",
  "rating": 4,
  "text": "Great atmosphere.",
  "createdAt": "2026-11-01T12:00:00.000Z",
  "updatedAt": "2026-11-02T08:30:00.000Z",
  "user": { "id": "6650f1c2a1b2c3d4e5f60718", "displayName": "player_1", "username": "player_1", "avatarUrl": "" }
}
```

**User summary**:

```json
{ "id": "6650f1c2a1b2c3d4e5f60718", "displayName": "player_1", "username": "player_1", "avatarUrl": "" }
```

## Health

### GET /api/health

Reports that the HTTP process is running.
It never touches the database.

- Auth: none
- Origin check: no

Response `200`:

```json
{ "status": "ok" }
```

### GET /api/ready

Reports whether MongoDB answers a ping within 1.5 seconds.
The response is sent with `Cache-Control: no-store`.

- Auth: none
- Origin check: no

Response `200`:

```json
{ "status": "ready" }
```

Response `503` when the database is not reachable:

```json
{ "status": "unavailable" }
```

## Auth

All `/api/auth` routes send `Cache-Control: no-store`.
The three sign-in routes are limited to 30 requests per 15 minutes per IP, each with its own counter.
If authentication is disabled, every route here returns `503 AUTH_NOT_CONFIGURED`.

### POST /api/auth/register

Creates a password account and signs it in.

- Auth: none
- Origin check: yes

Body:

| Field | Type | Rules |
| --- | --- | --- |
| `username` | string | Trimmed and lowercased, then 3 to 30 of `a-z`, `0-9`, `_`. Must be unique. |
| `email` | string | Trimmed and lowercased, at most 254 characters, valid address structure. Must be unique among password accounts. |
| `password` | string | 15 to 128 Unicode code points. Not trimmed. |

Response `201`, with a new session cookie:

```json
{ "user": { "id": "6650f1c2a1b2c3d4e5f60718", "email": "player@example.com", "username": "player_1", "displayName": "player_1", "avatarUrl": "", "admin": false } }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_REGISTRATION` | Not JSON, or any field breaks the rules above. |
| `409` | `ACCOUNT_EXISTS` | The username, or the email of another password account, is taken. |
| `429` | `RATE_LIMITED` | Over the sign-in limit. |

### POST /api/auth/login

Signs in a password account by username or email.

- Auth: none
- Origin check: yes

Body:

| Field | Type | Rules |
| --- | --- | --- |
| `identifier` | string | Username or email, at most 254 characters. Trimmed and lowercased; treated as an email if it contains `@`. |
| `password` | string | Non-empty, at most 128 code points. |

Response `200`, with a new session cookie:

```json
{ "user": { "id": "6650f1c2a1b2c3d4e5f60718", "email": "player@example.com", "username": "player_1", "displayName": "player_1", "avatarUrl": "", "admin": false } }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_LOGIN` | Not JSON, or a field is missing or malformed. |
| `401` | `INVALID_CREDENTIALS` | No password account matches, or the password is wrong. Both cases use the same message. |
| `429` | `RATE_LIMITED` | Over the sign-in limit. |

### POST /api/auth/google

Verifies a Google Identity Services ID token, creates the account on first use, and signs it in.
Accounts are matched only by Google's subject ID, never by email.

- Auth: none
- Origin check: yes

Body:

| Field | Type | Rules |
| --- | --- | --- |
| `credential` | string | The Google ID token, non-empty, at most 10000 characters. |

Response `200`, with a new session cookie:

```json
{ "user": { "id": "6650f1c2a1b2c3d4e5f60720", "email": "player@gmail.com", "username": null, "displayName": "Player One", "avatarUrl": "https://lh3.googleusercontent.com/...", "admin": false } }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_CREDENTIAL` | Not JSON, or `credential` is missing or too long. |
| `401` | `INVALID_GOOGLE_TOKEN` | Google rejects the token, or the Google email is not verified. |
| `429` | `RATE_LIMITED` | Over the sign-in limit. |
| `503` | `GOOGLE_NOT_CONFIGURED` | `GOOGLE_CLIENT_ID` is not set. |

### GET /api/auth/me

Returns the signed-in account.
Use it on page load to restore the session.

- Auth: signed in
- Origin check: no

Response `200`:

```json
{ "user": { "id": "6650f1c2a1b2c3d4e5f60718", "email": "player@example.com", "username": "player_1", "displayName": "player_1", "avatarUrl": "", "admin": false } }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHENTICATED` | No session, or the account no longer exists. In the second case the session is destroyed and the cookie cleared. |

### POST /api/auth/logout

Destroys the session and clears the cookie.
It succeeds even when there is no session.
No body is needed.

- Auth: none
- Origin check: yes

Response `204` with no body.

## Games

The game catalog is public and read-only.

### GET /api/games

Searches and lists games.

- Auth: none
- Origin check: no

Query:

| Parameter | Type | Default | Rules |
| --- | --- | --- | --- |
| `q` | string | none | Case-insensitive substring of the title, at most 100 characters. |
| `genre` | string | none | Exact genre name from `/api/games/filters`. |
| `platform` | string | none | Exact platform name from `/api/games/filters`. |
| `sort` | string | `title` | `title`, `top`, `lowest`, `popular`, or `newest`. Unrated games sort last for `top` and `lowest`. |
| `page`, `limit` | integer | `1`, `20` | See [Pagination](#pagination). |

Response `200`:

```json
{ "games": [{ "id": "6650f1c2a1b2c3d4e5f60001", "title": "Hollow Knight", "slug": "hollow-knight", "coverUrl": "", "genres": ["Platform"], "platforms": ["PC (Microsoft Windows)"], "releaseDate": null, "ratingAvg": 4.5, "ratingCount": 12 }], "total": 1, "page": 1, "pages": 1 }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_QUERY` | Unknown `sort`, or a bad text or pagination value. |

### GET /api/games/filters

Lists every genre and platform in the catalog, sorted.

- Auth: none
- Origin check: no

Response `200`:

```json
{ "genres": ["Adventure", "Platform"], "platforms": ["Nintendo Switch", "PC (Microsoft Windows)"] }
```

### GET /api/games/top

Returns the highest-rated games that have at least `RANKING_MIN_COUNT` ratings (default 3).

- Auth: none
- Origin check: no

Query:

| Parameter | Type | Default | Rules |
| --- | --- | --- | --- |
| `limit` | integer | `10` | 1 to 50 |

Response `200` (not paginated; `minCount` echoes the server setting):

```json
{ "games": [{ "id": "6650f1c2a1b2c3d4e5f60001", "title": "Hollow Knight", "slug": "hollow-knight", "coverUrl": "", "genres": [], "platforms": [], "releaseDate": null, "ratingAvg": 4.5, "ratingCount": 12 }], "minCount": 3 }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_QUERY` | `limit` is out of range. |

### GET /api/games/:id

Returns one game with its summary and review count.
`reviewCount` counts records with written text; `ratingCount` counts star ratings.
From #105, reviews removed by a developer are not counted.

- Auth: none
- Origin check: no

Response `200`:

```json
{ "game": { "id": "6650f1c2a1b2c3d4e5f60001", "title": "Hollow Knight", "slug": "hollow-knight", "coverUrl": "", "genres": [], "platforms": [], "releaseDate": null, "ratingAvg": 4.5, "ratingCount": 12, "summary": "A 2D action adventure.", "reviewCount": 7 } }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `404` | `GAME_NOT_FOUND` | No game has this ID. |

## Logs and reviews

A log is a user's single record for one game: an optional star rating, optional review text, and an optional play status.
Wishlist and backlog entries are logs with that status.
A log that ends up with no rating, no text, and no status is deleted.

### POST /api/games/:id/log

Creates or updates the caller's log for a game.
A missing field is left unchanged and `null` clears it.

- Auth: signed in
- Origin check: yes

Body (at least one field, no other fields):

| Field | Type | Rules |
| --- | --- | --- |
| `rating` | integer or null | 1 to 5. |
| `text` | string or null | Trimmed, at most 2000 characters. Stored as plain text. |
| `status` | string or null | `playing`, `played`, `backlog`, or `wishlist`. |

Response `201` when the log was created, `200` when it was updated:

```json
{ "log": { "id": "6650f1c2a1b2c3d4e5f69999", "game": "6650f1c2a1b2c3d4e5f60001", "rating": 4, "text": "Great atmosphere.", "status": "played", "removed": null, "createdAt": "2026-11-01T12:00:00.000Z", "updatedAt": "2026-11-01T12:00:00.000Z" } }
```

Response `200` with `{ "log": null }` when the update left the log empty and it was deleted.

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_LOG` | Not a JSON object, no fields, an unknown field, or a value breaks the rules above. |
| `404` | `GAME_NOT_FOUND` | No game has this ID. |
| `409` | `REVIEW_REMOVED` | Added in #105. The body changes `rating` or `text` but a developer removed this review. `status` can still change. |

### GET /api/games/:id/log

Returns the caller's log for a game, or `null`.
It does not check that the game exists.

- Auth: signed in
- Origin check: no

Response `200`:

```json
{ "log": { "id": "6650f1c2a1b2c3d4e5f69999", "game": "6650f1c2a1b2c3d4e5f60001", "rating": 4, "text": "Great atmosphere.", "status": "played", "removed": null, "createdAt": "2026-11-01T12:00:00.000Z", "updatedAt": "2026-11-01T12:00:00.000Z" } }
```

### GET /api/games/:id/reviews

Lists public reviews for a game page: every log with a rating or text, newest first.
Status is never included.
From #105, reviews removed by a developer are left out.
Reviews appear here whatever the reviewer's activity visibility.

- Auth: none
- Origin check: no
- Query: `page`, `limit` (see [Pagination](#pagination))

Response `200`:

```json
{ "reviews": [{ "id": "6650f1c2a1b2c3d4e5f69999", "rating": 4, "text": "Great atmosphere.", "createdAt": "2026-11-01T12:00:00.000Z", "updatedAt": "2026-11-01T12:00:00.000Z", "user": { "id": "6650f1c2a1b2c3d4e5f60718", "displayName": "player_1", "username": "player_1", "avatarUrl": "" } }], "total": 1, "page": 1, "pages": 1 }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `404` | `GAME_NOT_FOUND` | No game has this ID. |

### PATCH /api/logs/:id

Edits one of the caller's own logs.
The body has the same fields and rules as [POST /api/games/:id/log](#post-apigamesidlog).

- Auth: signed in, and the log must belong to the caller
- Origin check: yes

Response `200`:

```json
{ "log": { "id": "6650f1c2a1b2c3d4e5f69999", "game": "6650f1c2a1b2c3d4e5f60001", "rating": 5, "text": "Great atmosphere.", "status": "played", "removed": null, "createdAt": "2026-11-01T12:00:00.000Z", "updatedAt": "2026-11-03T09:00:00.000Z" } }
```

`log` is `null` when the update left the log empty and it was deleted.

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_LOG` | The body breaks the rules. |
| `403` | `FORBIDDEN` | The log belongs to someone else. |
| `404` | `LOG_NOT_FOUND` | No log has this ID. |
| `409` | `REVIEW_REMOVED` | Added in #105. The body changes `rating` or `text` of a review a developer removed. |

### DELETE /api/logs/:id

Deletes one of the caller's own logs, including one a developer removed.

- Auth: signed in, and the log must belong to the caller
- Origin check: yes

Response `204` with no body.

Errors:

| Status | Code | When |
| --- | --- | --- |
| `403` | `FORBIDDEN` | The log belongs to someone else. |
| `404` | `LOG_NOT_FOUND` | No log has this ID. |

## Your lists and privacy settings

### GET /api/me/logs

Lists the caller's own logs with game summaries, most recently updated first.
This is how the frontend reads the wishlist, backlog, playing, and played lists.
The caller sees their own removed reviews in full, with `removed` set.

- Auth: signed in
- Origin check: no

Query:

| Parameter | Type | Default | Rules |
| --- | --- | --- | --- |
| `status` | string | all | `playing`, `played`, `backlog`, or `wishlist`. |
| `page`, `limit` | integer | `1`, `20` | See [Pagination](#pagination). |

Response `200`:

```json
{ "logs": [{ "id": "6650f1c2a1b2c3d4e5f69999", "game": { "id": "6650f1c2a1b2c3d4e5f60001", "title": "Hollow Knight", "slug": "hollow-knight", "coverUrl": "", "genres": [], "platforms": [], "releaseDate": null, "ratingAvg": 4.5, "ratingCount": 12 }, "rating": null, "text": "", "status": "wishlist", "removed": null, "createdAt": "2026-11-01T12:00:00.000Z", "updatedAt": "2026-11-01T12:00:00.000Z" }], "total": 1, "page": 1, "pages": 1 }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_QUERY` | Unknown `status`, or a bad pagination value. |

### GET /api/me/wishlist-visibility

Returns who may see the caller's wishlist.
Accounts that never set it are `private`.

- Auth: signed in
- Origin check: no

Response `200`:

```json
{ "wishlistVisibility": "private" }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHENTICATED` | No session, or the account no longer exists. |

### PATCH /api/me/wishlist-visibility

Changes who may see the caller's wishlist.

- Auth: signed in
- Origin check: yes

Body (exactly this one field):

| Field | Type | Rules |
| --- | --- | --- |
| `wishlistVisibility` | string | `public` or `private` on `main`. Added in #104: `followers`. |

Response `200`:

```json
{ "wishlistVisibility": "followers" }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_VISIBILITY` | Not JSON, another value, or extra fields. |
| `401` | `UNAUTHENTICATED` | No session, or the account no longer exists. |

### GET /api/me/activity-visibility

Added in #104.

Returns who may see the caller's profile history.
Accounts that never set it are `public`.

- Auth: signed in
- Origin check: no

Response `200`:

```json
{ "activityVisibility": "public" }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHENTICATED` | No session, or the account no longer exists. |

### PATCH /api/me/activity-visibility

Added in #104.

Changes who may see the caller's profile history.
`public` means anyone, `followers` means users who follow the caller, and `private` means only the caller.
Reviews still appear on game pages and count toward ratings whatever this is set to.

- Auth: signed in
- Origin check: yes

Body (exactly this one field):

| Field | Type | Rules |
| --- | --- | --- |
| `activityVisibility` | string | `public`, `followers`, or `private`. |

Response `200`:

```json
{ "activityVisibility": "followers" }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_VISIBILITY` | Not JSON, another value, or extra fields. |
| `401` | `UNAUTHENTICATED` | No session, or the account no longer exists. |

### DELETE /api/users/me

Added in #107 for #92.

Deletes the caller's account.
On success the server clears the session cookie and revokes the account's sessions on all devices.
Password accounts confirm with their password.
Google-only accounts have no password, so they confirm by typing their username or email.

- Auth: signed in
- Origin check: yes

Body, for a password account:

| Field | Type | Rules |
| --- | --- | --- |
| `password` | string | The account's current password. |

Body, for a Google-only account:

| Field | Type | Rules |
| --- | --- | --- |
| `confirm` | string | The account's username or email, typed by the user. |

Response `204` with no body.

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `PASSWORD_REQUIRED` | A password account sent no password or a password longer than 128 characters. |
| `400` | `CONFIRMATION_REQUIRED` | A Google account sent no confirmation or a confirmation longer than 254 characters. |
| `401` | `UNAUTHENTICATED` | There is no session or the account is gone. |
| `403` | `INVALID_PASSWORD` | The password is incorrect. |
| `403` | `CONFIRMATION_MISMATCH` | The confirmation does not match the username or email. |
| `429` | `RATE_LIMITED` | The account has reached its limit of 10 deletion attempts per 15 minutes or the shared write limit. |

## Users

### GET /api/users/:id

Returns a user's public profile.

- Auth: none
- Origin check: no

Response `200`:

```json
{ "user": { "id": "6650f1c2a1b2c3d4e5f60718", "displayName": "player_1", "username": "player_1", "avatarUrl": "", "bio": "", "wishlistVisibility": "private", "activityVisibility": "public", "followerCount": 3, "followingCount": 5, "isFollowing": false } }
```

Added in #104: `activityVisibility`, `followerCount`, `followingCount`, and `isFollowing`.
`isFollowing` is `false` for signed-out viewers and on the viewer's own profile.

Errors:

| Status | Code | When |
| --- | --- | --- |
| `404` | `USER_NOT_FOUND` | No user has this ID. |

### GET /api/users/:id/logs

Lists a user's game history, most recently updated first: logs with a rating or text, plus logs with status `playing` or `played`.
Statuses other than `playing` and `played` are returned as `null`, so wishlist and backlog entries stay hidden.
From #105, a review removed by a developer is shown only through its `playing` or `played` status, with `rating` `null`, `text` empty, and `removed` `null`.

- Auth: none
- Origin check: no
- Query: `page`, `limit` (see [Pagination](#pagination))
- Added in #104: the owner's `activityVisibility` applies; the owner always passes.

Response `200`:

```json
{ "logs": [{ "id": "6650f1c2a1b2c3d4e5f69999", "game": { "id": "6650f1c2a1b2c3d4e5f60001", "title": "Hollow Knight", "slug": "hollow-knight", "coverUrl": "", "genres": [], "platforms": [], "releaseDate": null, "ratingAvg": 4.5, "ratingCount": 12 }, "rating": 4, "text": "Great atmosphere.", "status": "played", "removed": null, "createdAt": "2026-11-01T12:00:00.000Z", "updatedAt": "2026-11-01T12:00:00.000Z" }], "total": 1, "page": 1, "pages": 1 }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `403` | `ACTIVITY_PRIVATE` | Added in #104. The viewer may not see this user's activity. |
| `404` | `USER_NOT_FOUND` | No user has this ID. |

### GET /api/users/:id/wishlist

Lists a user's wishlist logs, most recently updated first.
On `main`, a `public` wishlist is visible to anyone and a `private` one only to its owner.
Added in #104: a `followers` wishlist is also visible to users who follow the owner.
The wishlist setting is independent of activity visibility.

- Auth: none, but the owner's `wishlistVisibility` applies
- Origin check: no
- Query: `page`, `limit` (see [Pagination](#pagination))

Response `200`: the same shape as [GET /api/users/:id/logs](#get-apiusersidlogs), with `status` `wishlist`.

Errors:

| Status | Code | When |
| --- | --- | --- |
| `403` | `WISHLIST_PRIVATE` | The viewer may not see this wishlist. |
| `404` | `USER_NOT_FOUND` | No user has this ID. |

## Follows and feed

Follows are one-way and need no approval.

### POST /api/users/:id/follow

Added in #104.

Follows a user.
It is idempotent: following someone you already follow succeeds again.

- Auth: signed in
- Origin check: yes

Response `201` when a new follow was created, `200` when it already existed:

```json
{ "isFollowing": true, "followerCount": 4 }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `CANNOT_FOLLOW_SELF` | The ID is the caller's own. |
| `404` | `USER_NOT_FOUND` | No user has this ID. |

### DELETE /api/users/:id/follow

Added in #104.

Unfollows a user.
It is idempotent: unfollowing someone you do not follow succeeds.

- Auth: signed in
- Origin check: yes

Response `200`:

```json
{ "isFollowing": false, "followerCount": 3 }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `CANNOT_FOLLOW_SELF` | The ID is the caller's own. |
| `404` | `USER_NOT_FOUND` | No user has this ID. |

### GET /api/users/:id/followers

Added in #104.

Lists who follows a user, newest follow first.
Follower lists are public.

- Auth: none
- Origin check: no
- Query: `page`, `limit` (see [Pagination](#pagination))

Response `200`:

```json
{ "users": [{ "id": "6650f1c2a1b2c3d4e5f60720", "displayName": "friend", "username": "friend", "avatarUrl": "" }], "total": 1, "page": 1, "pages": 1 }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `404` | `USER_NOT_FOUND` | No user has this ID. |

### GET /api/users/:id/following

Added in #104.

Lists whom a user follows, newest follow first.
The response and errors are the same as [GET /api/users/:id/followers](#get-apiusersidfollowers).

- Auth: none
- Origin check: no
- Query: `page`, `limit` (see [Pagination](#pagination))

### GET /api/feed

Added in #104.

Lists recent ratings, reviews, and `playing` or `played` updates from users the caller follows, most recently updated first.
Users whose activity is `private` are left out; `public` and `followers` users are included.
Statuses other than `playing` and `played` are returned as `null`.
`followingCount` counts all players the caller follows, including those whose activity is private.

- Auth: signed in
- Origin check: no
- Query: `page`, `limit` (see [Pagination](#pagination))

Response `200`:

```json
{ "entries": [{ "id": "6650f1c2a1b2c3d4e5f69999", "game": { "id": "6650f1c2a1b2c3d4e5f60001", "title": "Hollow Knight", "slug": "hollow-knight", "coverUrl": "", "genres": [], "platforms": [], "releaseDate": null, "ratingAvg": 4.5, "ratingCount": 12 }, "rating": 4, "text": "Great atmosphere.", "status": "played", "removed": null, "createdAt": "2026-11-01T12:00:00.000Z", "updatedAt": "2026-11-01T12:00:00.000Z", "user": { "id": "6650f1c2a1b2c3d4e5f60720", "displayName": "friend", "username": "friend", "avatarUrl": "" } }], "total": 1, "page": 1, "pages": 1, "followingCount": 2 }
```

Each entry is a log with a game summary and a user summary.
After #107, a removed review appears in the feed only if it has a public play status.
Those entries contain the status with no rating, review text, or removal reason.

## Developer access

Added in #105.

A user asks to be recognized as a developer of a game, and an admin approves or rejects the request.
Approved developers can read their games' reviews with filters and remove reviews that break the guidelines.
A removed review is soft-deleted: it disappears from public reads and from the game's rating, and its author still sees it with the reason.

### POST /api/games/:id/developer-requests

Added in #105.

Asks to become a developer of a game.
A user has at most one request per game.

- Auth: signed in
- Origin check: yes

Body:

| Field | Type | Rules |
| --- | --- | --- |
| `justification` | string | Trimmed, 1 to 500 characters. |

Response `201`:

```json
{ "request": { "id": "6650f1c2a1b2c3d4e5f6aaaa", "game": "6650f1c2a1b2c3d4e5f60001", "status": "pending", "justification": "I am the lead designer.", "requestedAt": "2026-11-01T12:00:00.000Z", "decidedAt": null } }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_DEVELOPER_REQUEST` | Not JSON, or `justification` is missing, blank, or too long. Includes `fields.justification`. |
| `404` | `GAME_NOT_FOUND` | No game has this ID. |
| `409` | `DEVELOPER_REQUEST_EXISTS` | The caller already has a request for this game, whatever its status. |

### GET /api/games/:id/developer-requests/me

Added in #105.

Returns the caller's request for a game, or `null`.
`status` is `pending`, `approved`, or `rejected`.

- Auth: signed in
- Origin check: no

Response `200`:

```json
{ "request": { "id": "6650f1c2a1b2c3d4e5f6aaaa", "game": "6650f1c2a1b2c3d4e5f60001", "status": "approved", "justification": "I am the lead designer.", "requestedAt": "2026-11-01T12:00:00.000Z", "decidedAt": "2026-11-02T09:00:00.000Z" } }
```

### GET /api/dev/games

Added in #105.

Lists the games the caller is an approved developer of, by title.
It returns an empty list for everyone else.

- Auth: signed in
- Origin check: no

Response `200` (not paginated):

```json
{ "games": [{ "id": "6650f1c2a1b2c3d4e5f60001", "title": "Hollow Knight", "slug": "hollow-knight", "coverUrl": "", "genres": [], "platforms": [], "releaseDate": null, "ratingAvg": 4.5, "ratingCount": 12 }] }
```

### GET /api/dev/reviews

Added in #105.

Lists reviews across all games the caller is an approved developer of.
Only logs with a rating or text that have not been removed are included.
A signed-in user with no approved games gets an empty list.

- Auth: signed in; results cover only games where the caller is an approved developer
- Origin check: no

Query:

| Parameter | Type | Default | Rules |
| --- | --- | --- | --- |
| `gameId` | ObjectId | all of the caller's games | Narrows to one game. The caller must be an approved developer of it. |
| `minRating` | integer | none | 1 to 5. Excludes text-only reviews. |
| `maxRating` | integer | none | 1 to 5, at least `minRating`. Excludes text-only reviews. |
| `from` | date | none | `YYYY-MM-DD` (start of that UTC day) or an ISO 8601 date and time with `Z` or an offset. Inclusive, compared with `createdAt`. |
| `to` | date | none | Same formats. Inclusive: a bare date covers that whole UTC day. Must not be before `from`. |
| `hasText` | boolean | none | `true` for reviews with text, `false` for rating-only reviews. |
| `sort` | string | `newest` | `newest`, `oldest`, `highest`, or `lowest` (by `createdAt` or rating). Text-only reviews sort last for `highest` and `lowest`. |
| `page`, `limit` | integer | `1`, `20` | See [Pagination](#pagination). |

Any other query parameter is rejected.
Impossible dates such as `2026-02-30` are rejected.

Response `200`:

```json
{ "reviews": [{ "id": "6650f1c2a1b2c3d4e5f69999", "rating": 2, "text": "Crashes on launch.", "createdAt": "2026-11-01T12:00:00.000Z", "updatedAt": "2026-11-01T12:00:00.000Z", "user": { "id": "6650f1c2a1b2c3d4e5f60718", "displayName": "player_1", "username": "player_1", "avatarUrl": "" }, "game": { "id": "6650f1c2a1b2c3d4e5f60001", "title": "Hollow Knight" } }], "total": 1, "page": 1, "pages": 1 }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_QUERY` | Any parameter is unknown or invalid. Every problem is listed in `fields`, keyed by parameter name. |
| `403` | `NOT_DEVELOPER` | `gameId` names a game the caller is not an approved developer of. |

### GET /api/dev/games/:id/reviews

Added in #105.

Lists reviews of one game.
It takes the same query parameters as [GET /api/dev/reviews](#get-apidevreviews) except `gameId`, and returns the same shape.

- Auth: approved developer of `:id`
- Origin check: no

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_QUERY` | Any parameter is unknown (including `gameId`) or invalid. Includes `fields`. |
| `403` | `NOT_DEVELOPER` | The caller is not an approved developer of this game. |
| `404` | `GAME_NOT_FOUND` | The caller is approved for this ID but the game no longer exists. |

### DELETE /api/dev/reviews/:reviewId

Added in #105.

Removes a review that breaks the guidelines.
The review is soft-deleted, the game's rating is recalculated, and the author sees the reason on their own log.
Removing a review preserves its activity timestamp.
The author can no longer change its rating or text, but can still change its status or delete it.

- Auth: approved developer of the review's game
- Origin check: yes

Body:

| Field | Type | Rules |
| --- | --- | --- |
| `reason` | string | Trimmed, 1 to 500 characters. Shown to the author. |

Response `200`:

```json
{ "review": { "id": "6650f1c2a1b2c3d4e5f69999", "removedAt": "2026-11-03T10:00:00.000Z", "removalReason": "Spam" } }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_REASON` | Not JSON, or `reason` is missing, blank, or too long. Includes `fields.reason`. Checked before the review is looked up. |
| `403` | `NOT_DEVELOPER` | The caller is not an approved developer of the review's game. |
| `404` | `REVIEW_NOT_FOUND` | No log has this ID, or it has neither a rating nor text. |
| `409` | `REVIEW_ALREADY_REMOVED` | The review was already removed. |

## Admin

Added in #105.

Every `/api/admin` route needs an admin account, including paths that do not exist, which answer `401` or `403` before `404`.
The admin flag is set only with `npm run set:admin --prefix server`, never through the API.

### GET /api/admin/developer-requests

Added in #105.

Lists developer requests, oldest first.

- Auth: admin
- Origin check: no

Query:

| Parameter | Type | Default | Rules |
| --- | --- | --- | --- |
| `status` | string | `pending` | `pending`, `approved`, `rejected`, or `all`. |
| `page`, `limit` | integer | `1`, `20` | See [Pagination](#pagination). |

Response `200`:

```json
{ "requests": [{ "id": "6650f1c2a1b2c3d4e5f6aaaa", "status": "pending", "justification": "I am the lead designer.", "requestedAt": "2026-11-01T12:00:00.000Z", "decidedAt": null, "decidedBy": null, "user": { "id": "6650f1c2a1b2c3d4e5f60718", "displayName": "player_1", "username": "player_1", "avatarUrl": "" }, "game": { "id": "6650f1c2a1b2c3d4e5f60001", "title": "Hollow Knight" } }], "total": 1, "page": 1, "pages": 1 }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_QUERY` | Unknown `status`, or a bad pagination value. |
| `403` | `NOT_ADMIN` | The caller is not an admin. |

### POST /api/admin/developer-requests/:id/approve

Added in #105.

Approves a request.
A decision can be changed later, so approving a rejected request works too.
No body is needed.

- Auth: admin
- Origin check: yes

Response `200`:

```json
{ "request": { "id": "6650f1c2a1b2c3d4e5f6aaaa", "status": "approved", "justification": "I am the lead designer.", "requestedAt": "2026-11-01T12:00:00.000Z", "decidedAt": "2026-11-02T09:00:00.000Z", "decidedBy": "6650f1c2a1b2c3d4e5f60999", "user": { "id": "6650f1c2a1b2c3d4e5f60718", "displayName": "player_1", "username": "player_1", "avatarUrl": "" }, "game": { "id": "6650f1c2a1b2c3d4e5f60001", "title": "Hollow Knight" } } }
```

Errors:

| Status | Code | When |
| --- | --- | --- |
| `403` | `NOT_ADMIN` | The caller is not an admin. |
| `404` | `DEVELOPER_REQUEST_NOT_FOUND` | No request has this ID. |

### POST /api/admin/developer-requests/:id/reject

Added in #105.

Rejects a request, or revokes an approval.
The response and errors are the same as [approve](#post-apiadmindeveloper-requestsidapprove), with `status` `rejected`.

- Auth: admin
- Origin check: yes
