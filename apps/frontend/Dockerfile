FROM node:24-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json ./
RUN pnpm install --no-frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm build

FROM nginx:alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]