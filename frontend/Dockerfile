FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN \
	if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
	elif [ -f package-lock.json ]; then npm ci; \
	elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
	else echo "Lockfile not found." && exit 1; \
	fi

FROM base AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN \
	if [ -f yarn.lock ]; then yarn run build; \
	elif [ -f package-lock.json ]; then npm run build; \
	elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
	else echo "Lockfile not found." && exit 1; \
	fi

FROM base AS dev
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
ENV PORT=3000
CMD ["npm", "run", "dev"]

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 viteuser

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=viteuser:nodejs /app/dist ./dist

USER viteuser

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
# Static assets from builder (`vite build`); same as package.json "start"
CMD ["npm", "run", "start"]
