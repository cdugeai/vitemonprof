Install command: `npx sv create --template minimal --types ts --add better-auth drizzle eslint prettier tailwindcss vitest --install npm --no-dir-check`

To update the db schema:

- write a new migration file
- apply it to database: `npm run db:migrate`
- generate types accordingly: `npm run db:types`
