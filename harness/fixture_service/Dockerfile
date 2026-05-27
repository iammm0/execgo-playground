FROM node:22-slim

WORKDIR /app
COPY app.ts /app/app.ts

RUN npm install --global tsx

EXPOSE 8080
CMD ["tsx", "/app/app.ts"]
