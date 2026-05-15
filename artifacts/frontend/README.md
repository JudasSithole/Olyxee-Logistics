# Olyxee Admin — Frontend

This is the **frontend** (the website users see). It is a React + Vite app.

```
src/
├── pages/        ← one file per screen (login, dashboard, customers…)
├── components/   ← reusable UI pieces
├── contexts/     ← app-wide state (e.g. auth-context = who is logged in)
├── hooks/        ← reusable React logic
├── lib/          ← small helpers (e.g. supabase.ts = the auth client)
├── App.tsx       ← maps URLs to pages
├── main.tsx      ← entry point
└── index.css     ← global styles + Tailwind
```

## Where common things live

- **Login screen** → `src/pages/login.tsx`
- **Who is logged in?** → `src/contexts/auth-context.tsx`
- **Talking to the backend** → uses `@workspace/api-client-react` (auto-generated)
- **Theme / colors** → `src/index.css` + `tailwind.config.ts`

See `../../PROJECT_STRUCTURE.md` for the full project map.
