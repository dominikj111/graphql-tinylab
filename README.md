# GraphQL Tiny Lab

> Learn GraphQL by shaping live data in a playful visual lab.

An interactive, browser-based playground for learning how GraphQL queries work. Pick fields, write queries, and watch the response shape change in real time — no server, no setup.

---

## What it teaches

- **Field selection** — request only the fields you need and see exactly what comes back
- **Nested queries** — explore how `user`, `posts`, and `stats` nest inside a single query
- **Arguments** — filter and sort with `minLikes`, `published`, `orderBy`, and `limit`
- **Response shape** — the live diagram and payload panel make the query ↔ result relationship tangible

---

## Features

| Panel | What it does |
| --- | --- |
| **Visual Query Builder** | Click field chips to add/remove fields; arguments exposed as sliders and toggles |
| **Query Editor** | Edit raw GraphQL syntax directly; syntax errors shown inline |
| **Live Diagram** | Animated tree that mirrors the selected field structure in real time |
| **Mock Datasource** | Table of generated records with rows highlighted when they appear in the result |
| **Result Payload** | Formatted JSON output with field count and byte size |
| **Code Snippets** | Ready-to-copy `graphql-request` (frontend) and `graphql-yoga` (backend) examples |

---

## Query arguments

The `posts` field accepts arguments that filter and sort the result:

```graphql
{
  user { id name }
  posts(minLikes: 10, published: true, orderBy: LIKES_DESC, limit: 5) {
    title
    likes
  }
  stats { total published }
}
```

| Argument | Type | Effect |
| --- | --- | --- |
| `minLikes` | `Int` | Only include posts with at least this many likes |
| `published` | `Boolean` | When `true`, only return published posts |
| `orderBy` | `Enum` | `LIKES_ASC`, `LIKES_DESC`, `TITLE_ASC`, `TITLE_DESC` |
| `limit` | `Int` | Cap the number of returned posts |

---

## Tech stack

- **React 19** with the experimental React Compiler (`babel-plugin-react-compiler`)
- **TypeScript 5.9** — strict mode
- **Vite 8** — dev server and build
- Custom GraphQL query parser and executor (no external GraphQL library)
- Pure CSS — no utility framework

---

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview the build locally
```

---

## Scope

This is a learning tool, not a GraphQL spec implementation. Not included:

- Fragments, directives, variables, aliases
- Mutations or subscriptions
- Schema introspection
- A real GraphQL server

---

## License

MIT
